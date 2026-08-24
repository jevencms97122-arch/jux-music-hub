/**
 * Estimation de BPM en direct à partir d'un AnalyserNode (Web Audio API).
 *
 * Contrairement à une analyse offline (decodeAudioData + autocorrélation sur le
 * fichier complet), on lit ici l'énergie des basses fréquences en continu pendant
 * la lecture pour détecter les onsets (kicks/snares), puis on en déduit le tempo
 * à partir de l'intervalle le plus fréquent entre deux onsets. Moins précis
 * qu'une vraie autocorrélation sur fichier complet, mais ne nécessite ni de
 * télécharger le fichier entier ni de bloquer le thread principal.
 *
 * Au passage, la même boucle d'échantillonnage sert aussi à repérer les
 * silences (intro et fin de piste), utile pour AutoMix.
 */

export type BpmConfidence = 'low' | 'medium' | 'high';

export interface BpmResult {
  bpm: number;
  confidence: BpmConfidence;
}

const MIN_ONSET_INTERVAL_MS = 200; // >300 BPM impossible : filtre les faux doublons
const MAX_ONSETS_TRACKED = 40;
const BUCKET_TOLERANCE = 0.08; // 8% : deux intervalles sont "le même beat" en dessous de ça
const SILENCE_ENERGY_THRESHOLD = 12; // sur une échelle 0-255 (byte frequency data)
const MAX_INTRO_SILENCE_SEC = 6; // garde-fou : n'ignore jamais plus de 6s d'intro

export class LiveBpmEstimator {
  private analyser: AnalyserNode;
  private freqData: Uint8Array;
  private prevEnergy = 0;
  private onsetTimes: number[] = [];
  private rafId: number | null = null;
  private running = false;
  private trackStartTs: number | null = null;
  private introSilenceMs: number | null = null;
  private lastAudibleTs: number = performance.now();

  constructor(analyser: AnalyserNode) {
    this.analyser = analyser;
    this.freqData = new Uint8Array(analyser.frequencyBinCount);
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.trackStartTs = performance.now();
    this.lastAudibleTs = performance.now();
    const tick = () => {
      if (!this.running) return;
      this.analyser.getByteFrequencyData(this.freqData as Uint8Array<ArrayBuffer>);
      // Énergie pondérée vers les basses (kick/snare) — bien plus fiable pour
      // détecter le beat que le spectre complet.
      const bassBins = Math.min(24, this.freqData.length);
      let energy = 0;
      for (let i = 0; i < bassBins; i++) energy += this.freqData[i];
      energy /= bassBins;

      const now = performance.now();
      if (energy > SILENCE_ENERGY_THRESHOLD) {
        this.lastAudibleTs = now;
        if (this.introSilenceMs === null && this.trackStartTs !== null) {
          this.introSilenceMs = now - this.trackStartTs;
        }
      }

      if (energy > this.prevEnergy * 1.15 && energy > 25) {
        const last = this.onsetTimes[this.onsetTimes.length - 1];
        if (last === undefined || now - last > MIN_ONSET_INTERVAL_MS) {
          this.onsetTimes.push(now);
          if (this.onsetTimes.length > MAX_ONSETS_TRACKED) this.onsetTimes.shift();
        }
      }
      this.prevEnergy = energy;
      // setTimeout (~30 fps) et non requestAnimationFrame : rAF ne se déclenche pas
      // quand la page n'est pas visible (app en arrière-plan sur Android), ce qui
      // gelait l'échantillonnage — lastAudibleTs cessait d'avancer et AutoMix croyait
      // à tort que la piste était retombée dans le silence. ~33 ms suffisent largement
      // pour détecter des onsets espacés d'au moins MIN_ONSET_INTERVAL_MS.
      this.rafId = window.setTimeout(tick, 33);
    };
    this.rafId = window.setTimeout(tick, 33);
  }

  stop(): void {
    this.running = false;
    if (this.rafId !== null) clearTimeout(this.rafId);
    this.rafId = null;
  }

  reset(): void {
    this.onsetTimes = [];
    this.prevEnergy = 0;
    this.trackStartTs = null;
    this.introSilenceMs = null;
    this.lastAudibleTs = performance.now();
  }

  /** Intervalle dominant entre deux onsets (ms), ou `null` si pas assez de données. */
  private dominantInterval(): { intervalMs: number; count: number } | null {
    if (this.onsetTimes.length < 6) return null;
    const intervals: number[] = [];
    for (let i = 1; i < this.onsetTimes.length; i++) {
      intervals.push(this.onsetTimes[i] - this.onsetTimes[i - 1]);
    }
    // Regroupe les intervalles proches (tolérance 8%) pour trouver l'intervalle
    // dominant — équivalent simplifié de l'autocorrélation du spec original.
    const buckets: { interval: number; count: number }[] = [];
    for (const interval of intervals) {
      const bucket = buckets.find((b) => Math.abs(interval - b.interval) / b.interval < BUCKET_TOLERANCE);
      if (bucket) bucket.count += 1;
      else buckets.push({ interval, count: 1 });
    }
    const best = buckets.reduce((a, b) => (b.count > a.count ? b : a));
    return { intervalMs: best.interval, count: best.count };
  }

  /** BPM estimé à partir des onsets accumulés, ou `null` si pas assez de données. */
  getBpm(): BpmResult | null {
    const dominant = this.dominantInterval();
    if (!dominant) return null;

    let bpm = Math.round(60000 / dominant.intervalMs);
    // Correction d'octave : ramène dans une plage plausible (évite le tempo
    // détecté à 2x ou 1/2x du tempo réel, cf. "octave errors").
    while (bpm < 80) bpm *= 2;
    while (bpm > 180) bpm /= 2;
    bpm = Math.round(bpm);

    const confidence: BpmConfidence = dominant.count >= 12 ? 'high' : dominant.count >= 6 ? 'medium' : 'low';
    return { bpm, confidence };
  }

  /**
   * Millisecondes avant le prochain beat prévu, extrapolé à partir du dernier
   * onset détecté et de l'intervalle dominant. `null` si pas assez de données
   * ou si le prochain beat est trop loin (au-delà de `maxWaitMs`).
   */
  getMsUntilNextBeat(maxWaitMs = 1000): number | null {
    const dominant = this.dominantInterval();
    if (!dominant) return null;
    const lastOnset = this.onsetTimes[this.onsetTimes.length - 1];
    if (lastOnset === undefined) return null;
    const now = performance.now();
    let nextBeat = lastOnset;
    while (nextBeat < now) nextBeat += dominant.intervalMs;
    const wait = nextBeat - now;
    return wait <= maxWaitMs ? wait : null;
  }

  /** Durée du silence en tout début de piste (secondes), plafonnée à 6s. */
  getIntroSilenceSec(): number {
    if (this.introSilenceMs === null) return 0;
    return Math.min(this.introSilenceMs / 1000, MAX_INTRO_SILENCE_SEC);
  }

  /** Depuis combien de temps (ms) le signal est retombé sous le seuil de silence. */
  getMsSinceLastAudible(): number {
    return performance.now() - this.lastAudibleTs;
  }
}

/** Score de compatibilité de tempo entre deux BPM, de 0 (très différent) à 1 (identique). */
export function tempoCompatibilityScore(bpmA: number, bpmB: number): number {
  const ratio = Math.min(bpmA, bpmB) / Math.max(bpmA, bpmB);
  return ratio > 0.95 ? 1 : ratio;
}
