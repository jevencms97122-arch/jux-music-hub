import { useEffect, useRef, useState } from 'react';
import { usePlayer } from '@/contexts/PlayerContext';
import { useVoiceAssistantSettings, isSpeechRecognitionSupported } from '@/hooks/useVoiceAssistant';
import { Mic } from 'lucide-react';
import { toast } from 'sonner';

// Variantes/abréviations tolérées par mot magique — la reconnaissance transcrit
// souvent approximativement des mots courts ou inventés comme "Jux"/"Nexora"
const WAKE_VARIANTS: Record<string, string[]> = {
  jux: ['jux', 'juxe', 'jus', 'juks', 'jukse', 'djux', 'joukse', 'jeuks', 'jax', 'juck', 'jusse'],
  nexora: ['nexora', 'nexorah', 'nexorra', 'nexaura', 'nexo ra', 'next aura', 'nexo', 'nexeau', 'nexhora', 'nex ora', 'nexauras'],
};

// Distance de Levenshtein max tolérée pour rapprocher un mot entendu du mot magique
// (couvre les abréviations/déformations non listées explicitement ci-dessus)
const WAKE_FUZZY_DISTANCE: Record<string, number> = { jux: 1, nexora: 2 };

// Fenêtre pendant laquelle on écoute une commande après le mot magique
const ARM_WINDOW_MS = 6000;

// ── Détection d'activité vocale (VAD) sur notre flux brut ──────────────────
// Le moteur de reconnaissance du navigateur (SpeechRecognition) ouvre en
// interne SA PROPRE capture micro, avec écho-annulation, qu'on ne peut pas
// configurer — c'est cette capture-là (pas la nôtre) que Windows/macOS/Chrome
// finit par classer "communication" et qui déclenche la réduction de volume
// des autres sons après quelques secondes d'activation continue.
// Pour limiter cette exposition sur toutes les plateformes, on ne démarre la
// reconnaissance que par courtes rafales, uniquement quand on détecte une
// vraie voix sur notre flux brut (sans traitement, donc sans ducking) —
// plutôt que de la laisser tourner en continu pendant toute la lecture.
const VAD_ENTER_MARGIN = 16; // dépassement du bruit ambiant pour déclencher une rafale
const VAD_SUSTAIN_MARGIN = 9; // dépassement pour considérer qu'on parle encore
const VAD_MIN_ENTER_LEVEL = 18; // plancher absolu (évite de réagir au bruit de fond quasi nul)
const VAD_ENTER_DEBOUNCE_MS = 150; // durée au-dessus du seuil avant de déclencher (anti-transitoire)
const VAD_SILENCE_STOP_MS = 1400; // silence continu avant d'arrêter la rafale
const VAD_MAX_BURST_MS = 15000; // garde-fou absolu (couvre la fenêtre d'attente de commande)
const AMBIENT_TAU_MS = 3000; // constante de temps du lissage du niveau ambiant

function normalize(text: string): string {
  // Minuscules + suppression des accents (é → e) pour un matching robuste
  return text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
}

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

/**
 * Cherche N'IMPORTE LEQUEL des mots magiques dans le texte (variantes connues +
 * rapprochement flou mot à mot) — "Jux" et "Nexora" sont tous les deux acceptés
 * en permanence, il n'y a plus de choix exclusif entre les deux.
 */
function findWakeWord(text: string): { index: number; length: number } | null {
  for (const wakeWord of Object.keys(WAKE_VARIANTS)) {
    for (const v of WAKE_VARIANTS[wakeWord]) {
      const idx = text.indexOf(v);
      if (idx !== -1) return { index: idx, length: v.length };
    }
  }
  // Rapprochement flou : compare chaque mot prononcé à chaque mot magique de base
  const wordRe = /[a-z]+/g;
  let m: RegExpExecArray | null;
  while ((m = wordRe.exec(text)) !== null) {
    const word = m[0];
    if (word.length < 2) continue;
    for (const wakeWord of Object.keys(WAKE_VARIANTS)) {
      const maxDist = WAKE_FUZZY_DISTANCE[wakeWord] ?? 1;
      if (levenshtein(word, wakeWord) <= maxDist) return { index: m.index, length: word.length };
    }
  }
  return null;
}

type Command = 'pause' | 'resume' | 'next' | 'previous';

function parseCommand(text: string): Command | null {
  // Ordre important : "suivante"/"precedente" avant les mots génériques
  if (/suivant|suivante|passe|skip|apres|prochain/.test(text)) return 'next';
  if (/precedent|precedente|reviens|arriere|retour|avant/.test(text)) return 'previous';
  if (/\bpause\b|\bstop\b|arrete|coupe/.test(text)) return 'pause';
  if (/reprend|reprendre|relance|remets|lecture|continue|\bplay\b|\bjoue\b/.test(text)) return 'resume';
  return null;
}

/**
 * Assistant vocal — headless, monté une fois dans l'app.
 * Micro actif uniquement quand une musique est lancée et que l'option est activée.
 * Les deux mots magiques "Jux" et "Nexora" sont acceptés en permanence.
 *
 * Le flux micro qu'on ouvre nous-mêmes est en mode "brut" (echoCancellation,
 * noiseSuppression et autoGainControl désactivés, comme Discord) et reste
 * ouvert en continu sans jamais provoquer de ducking. La reconnaissance vocale
 * elle-même n'est démarrée que par courtes rafales déclenchées par la
 * détection d'activité vocale (VAD) ci-dessus, pour limiter au minimum le
 * temps où la capture interne du navigateur (celle qui cause le ducking) est active.
 */
export default function JuxAssistant() {
  const { enabled, micDeviceId } = useVoiceAssistantSettings();
  const { currentSong, isPlaying, togglePlay, next, previous } = usePlayer();
  const [armed, setArmed] = useState(false);

  const recognitionRef = useRef<any>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const activeRef = useRef(false);
  const armedUntilRef = useRef<number>(0);
  const armTimeoutRef = useRef<number | null>(null);
  const restartTimeoutRef = useRef<number | null>(null);

  // VAD
  const vadAudioCtxRef = useRef<AudioContext | null>(null);
  const vadAnalyserRef = useRef<AnalyserNode | null>(null);
  const vadDataRef = useRef<Uint8Array | null>(null);
  const vadRafRef = useRef<number | null>(null);
  const ambientLevelRef = useRef(0);
  const enterSinceRef = useRef<number | null>(null);
  const lastLoudRef = useRef(0);
  const burstActiveRef = useRef(false);
  const burstStartRef = useRef(0);
  const intentionalStopRef = useRef(false);
  const recognitionRunningRef = useRef(false);
  const lastFrameTsRef = useRef<number | null>(null);

  // Refs vers l'état du lecteur pour éviter de recréer la reconnaissance à chaque re-render
  const isPlayingRef = useRef(isPlaying);
  const togglePlayRef = useRef(togglePlay);
  const nextRef = useRef(next);
  const previousRef = useRef(previous);
  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);
  useEffect(() => { togglePlayRef.current = togglePlay; }, [togglePlay]);
  useEffect(() => { nextRef.current = next; }, [next]);
  useEffect(() => { previousRef.current = previous; }, [previous]);

  const shouldListen = enabled && !!currentSong && isSpeechRecognitionSupported();

  useEffect(() => {
    const cleanup = () => {
      activeRef.current = false;
      if (vadRafRef.current) { cancelAnimationFrame(vadRafRef.current); vadRafRef.current = null; }
      if (recognitionRef.current) { try { recognitionRef.current.stop(); } catch {} recognitionRef.current = null; }
      if (micStreamRef.current) { micStreamRef.current.getTracks().forEach((t) => t.stop()); micStreamRef.current = null; }
      if (vadAudioCtxRef.current) { vadAudioCtxRef.current.close().catch(() => {}); vadAudioCtxRef.current = null; }
      vadAnalyserRef.current = null;
      vadDataRef.current = null;
      if (armTimeoutRef.current) { clearTimeout(armTimeoutRef.current); armTimeoutRef.current = null; }
      if (restartTimeoutRef.current) { clearTimeout(restartTimeoutRef.current); restartTimeoutRef.current = null; }
      burstActiveRef.current = false;
      recognitionRunningRef.current = false;
      setArmed(false);
    };

    if (!shouldListen) { cleanup(); return; }

    activeRef.current = true;
    let cancelled = false;

    (async () => {
      // Ouvrir le micro en mode "brut" : sans traitement voix, ce flux ne
      // déclenche jamais le ducking, quelle que soit sa durée d'ouverture.
      // C'est sur LUI qu'on fait tourner la détection d'activité vocale.
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            deviceId: micDeviceId ? { exact: micDeviceId } : undefined,
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
          },
        });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        micStreamRef.current = stream;
      } catch (err: any) {
        if (cancelled) return;
        if (err?.name === 'NotAllowedError') {
          activeRef.current = false;
          toast.error("Micro refusé — l'assistant vocal ne peut pas fonctionner", { position: 'bottom-center' });
        }
        return;
      }
      if (cancelled || !activeRef.current) return;

      const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const recognition = new SR();
      recognition.lang = 'fr-FR';
      recognition.continuous = true;
      recognition.interimResults = false;
      recognition.maxAlternatives = 3;
      recognitionRef.current = recognition;

      const executeCommand = (cmd: Command) => {
        switch (cmd) {
          case 'pause':
            if (isPlayingRef.current) { togglePlayRef.current(); toast('⏸️ Pause', { position: 'bottom-center' }); }
            break;
          case 'resume':
            if (!isPlayingRef.current) { togglePlayRef.current(); toast('▶️ Lecture', { position: 'bottom-center' }); }
            break;
          case 'next':
            nextRef.current();
            toast('⏭️ Musique suivante', { position: 'bottom-center' });
            break;
          case 'previous':
            previousRef.current();
            toast('⏮️ Musique précédente', { position: 'bottom-center' });
            break;
        }
      };

      // ── Gestion des rafales de reconnaissance ──
      const stopBurst = () => {
        if (!burstActiveRef.current) return;
        burstActiveRef.current = false;
        intentionalStopRef.current = true;
        try { recognition.stop(); } catch {}
      };

      const startBurst = () => {
        if (burstActiveRef.current || recognitionRunningRef.current) return;
        burstActiveRef.current = true;
        burstStartRef.current = Date.now();
        intentionalStopRef.current = false;
        try { recognition.start(); } catch {}
      };

      const disarm = () => {
        armedUntilRef.current = 0;
        setArmed(false);
        if (armTimeoutRef.current) { clearTimeout(armTimeoutRef.current); armTimeoutRef.current = null; }
        stopBurst();
      };

      const arm = () => {
        armedUntilRef.current = Date.now() + ARM_WINDOW_MS;
        lastLoudRef.current = Date.now();
        setArmed(true);
        if (armTimeoutRef.current) clearTimeout(armTimeoutRef.current);
        armTimeoutRef.current = window.setTimeout(disarm, ARM_WINDOW_MS);
      };

      recognition.onstart = () => { recognitionRunningRef.current = true; };

      recognition.onresult = (event: any) => {
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (!result.isFinal) continue;
          // Tester toutes les alternatives proposées par la reconnaissance
          for (let a = 0; a < result.length; a++) {
            const text = normalize(result[a].transcript || '');
            if (!text) continue;

            const found = findWakeWord(text);

            if (found) {
              // Mot magique détecté : commande dans la même phrase ("jux pause") ?
              const after = text.slice(found.index + found.length);
              const before = text.slice(0, found.index);
              const cmd = parseCommand(after) ?? parseCommand(before);
              if (cmd) { executeCommand(cmd); disarm(); return; }
              arm();
              return;
            }

            // Fenêtre d'écoute ouverte : phrase = commande seule
            if (armedUntilRef.current > Date.now()) {
              const cmd = parseCommand(text);
              if (cmd) { executeCommand(cmd); disarm(); return; }
            }
          }
        }
      };

      recognition.onerror = (e: any) => {
        // Micro refusé : inutile d'insister
        if (e?.error === 'not-allowed' || e?.error === 'service-not-allowed') {
          activeRef.current = false;
          toast.error("Micro refusé — l'assistant vocal ne peut pas fonctionner", { position: 'bottom-center' });
        }
      };

      recognition.onend = () => {
        recognitionRunningRef.current = false;
        if (!activeRef.current) return;
        if (intentionalStopRef.current) {
          // Rafale arrêtée volontairement (silence ou commande traitée) : on
          // attend simplement le prochain déclenchement du VAD.
          intentionalStopRef.current = false;
          return;
        }
        // Fin inattendue côté navigateur (timeout interne) : si la rafale doit
        // continuer (silence pas encore détecté), on relance immédiatement.
        if (burstActiveRef.current) {
          restartTimeoutRef.current = window.setTimeout(() => {
            if (!activeRef.current || !burstActiveRef.current) return;
            try { recognition.start(); } catch {}
          }, 150);
        }
      };

      // ── Détection d'activité vocale sur notre flux brut ──
      const audioCtx = new AudioContext();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      vadAudioCtxRef.current = audioCtx;
      vadAnalyserRef.current = analyser;
      vadDataRef.current = new Uint8Array(analyser.frequencyBinCount);

      // Restreint l'analyse à la bande de fréquences de la voix humaine
      // (≈300–3400 Hz) pour mieux distinguer une voix des basses de la musique.
      const nyquist = audioCtx.sampleRate / 2;
      const binHz = nyquist / analyser.frequencyBinCount;
      const voiceLowBin = Math.max(1, Math.floor(300 / binHz));
      const voiceHighBin = Math.min(analyser.frequencyBinCount - 1, Math.ceil(3400 / binHz));

      const tick = () => {
        vadRafRef.current = requestAnimationFrame(tick);
        const data = vadDataRef.current;
        if (!data) return;
        analyser.getByteFrequencyData(data);
        let sum = 0;
        for (let i = voiceLowBin; i <= voiceHighBin; i++) sum += data[i];
        const level = sum / (voiceHighBin - voiceLowBin + 1);

        const now = Date.now();
        const dt = lastFrameTsRef.current ? now - lastFrameTsRef.current : 16;
        lastFrameTsRef.current = now;

        if (!burstActiveRef.current) {
          // Le niveau ambiant (bruit/musique de fond) n'est mis à jour qu'en dehors
          // des rafales pour ne pas se laisser polluer par la voix elle-même.
          const alpha = 1 - Math.exp(-dt / AMBIENT_TAU_MS);
          ambientLevelRef.current += (level - ambientLevelRef.current) * alpha;
        }

        const enterThreshold = Math.max(VAD_MIN_ENTER_LEVEL, ambientLevelRef.current + VAD_ENTER_MARGIN);
        const sustainThreshold = Math.max(VAD_MIN_ENTER_LEVEL - 6, ambientLevelRef.current + VAD_SUSTAIN_MARGIN);

        if (!burstActiveRef.current) {
          if (level >= enterThreshold) {
            if (enterSinceRef.current == null) enterSinceRef.current = now;
            if (now - enterSinceRef.current >= VAD_ENTER_DEBOUNCE_MS) {
              enterSinceRef.current = null;
              lastLoudRef.current = now;
              startBurst();
            }
          } else {
            enterSinceRef.current = null;
          }
        } else {
          if (level >= sustainThreshold) lastLoudRef.current = now;
          const waitingForCommand = armedUntilRef.current > now;
          const burstDuration = now - burstStartRef.current;
          const silentFor = now - lastLoudRef.current;
          if (burstDuration >= VAD_MAX_BURST_MS) {
            stopBurst();
          } else if (!waitingForCommand && silentFor >= VAD_SILENCE_STOP_MS) {
            stopBurst();
          }
        }
      };
      vadRafRef.current = requestAnimationFrame(tick);
    })();

    return () => { cancelled = true; cleanup(); };
    // Redémarre l'écoute si le périphérique micro choisi change dans les paramètres
  }, [shouldListen, micDeviceId]);

  // Indicateur discret quand l'assistant attend une commande
  if (!armed) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-[80] flex justify-center">
      <div className="flex items-center gap-2 rounded-full border border-primary/40 bg-background/90 px-4 py-2 shadow-elegant backdrop-blur-md" style={{ animation: 'fadeSlideUp 0.25s cubic-bezier(0.16,1,0.3,1) both' }}>
        <Mic className="h-4 w-4 animate-pulse text-primary" />
        <span className="text-sm font-semibold">Je t'écoute…</span>
      </div>
    </div>
  );
}
