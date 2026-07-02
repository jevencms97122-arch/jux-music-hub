export class BeatDetector {
  private analyser: AnalyserNode;
  private data: Uint8Array;
  private beatTimes: number[] = [];
  private beatCount = 0;
  private lastEnergy = 0;
  private cooldownTicks = 0;
  private avgInterval: number | null = null;
  private readonly THRESHOLD = 145;
  private readonly COOLDOWN = 5; // ~250ms à 50ms/tick
  private intervalId: number | null = null;

  constructor(analyser: AnalyserNode) {
    this.analyser = analyser;
    this.data = new Uint8Array(analyser.frequencyBinCount);
  }

  start() {
    if (this.intervalId !== null) return;
    this.beatTimes = [];
    this.beatCount = 0;
    this.avgInterval = null;
    this.intervalId = window.setInterval(() => this.tick(), 50);
  }

  stop() {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.beatTimes = [];
    this.beatCount = 0;
    this.avgInterval = null;
  }

  private tick() {
    this.analyser.getByteFrequencyData(this.data);
    const bassEnd = Math.max(1, Math.floor(this.data.length * 0.1));
    let energy = 0;
    for (let i = 0; i < bassEnd; i++) energy += this.data[i];
    energy /= bassEnd;

    if (this.cooldownTicks > 0) {
      this.cooldownTicks--;
      this.lastEnergy = energy;
      return;
    }

    if (energy > this.THRESHOLD && energy > this.lastEnergy * 1.2) {
      const now = performance.now();
      this.beatTimes.push(now);
      this.beatCount++;
      if (this.beatTimes.length > 16) this.beatTimes.shift();

      // Recalcule l'intervalle moyen sur les 8 derniers beats
      if (this.beatTimes.length >= 4) {
        const recent = this.beatTimes.slice(-8);
        const intervals: number[] = [];
        for (let i = 1; i < recent.length; i++) intervals.push(recent[i] - recent[i - 1]);
        this.avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      }

      this.cooldownTicks = this.COOLDOWN;
    }

    this.lastEnergy = energy;
  }

  getBpm(): number | null {
    if (!this.avgInterval || this.avgInterval <= 0) return null;
    const bpm = Math.round(60000 / this.avgInterval);
    return bpm >= 40 && bpm <= 220 ? bpm : null;
  }

  getMsUntilNextBeat(): number | null {
    if (!this.avgInterval || this.beatTimes.length < 2) return null;
    const elapsed = performance.now() - this.beatTimes[this.beatTimes.length - 1];
    return this.avgInterval - (elapsed % this.avgInterval);
  }

  /** Délai en ms avant le prochain début de mesure (défaut : 4 beats) */
  getMsUntilNextMeasure(beatsPerMeasure = 4): number | null {
    if (!this.avgInterval || this.beatTimes.length < 4) return null;
    const elapsed = performance.now() - this.beatTimes[this.beatTimes.length - 1];
    const beatsIntoMeasure = this.beatCount % beatsPerMeasure;
    const beatsUntilBoundary = beatsPerMeasure - beatsIntoMeasure;
    let ms = beatsUntilBoundary * this.avgInterval - elapsed;
    // Si on est trop proche, sauter à la mesure suivante
    if (ms < 80) ms += beatsPerMeasure * this.avgInterval;
    return ms;
  }
}
