import { useEffect, useRef, useState } from 'react';
import { usePlayer } from '@/contexts/PlayerContext';
import { useVoiceAssistantSettings, isSpeechRecognitionSupported } from '@/hooks/useVoiceAssistant';
import { startVoskSession, type VoskSession } from '@/lib/voskEngine';
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

/** L'app est chargée dans le wrapper Electron (exposé par preload.cjs) ? */
function isElectronApp(): boolean {
  return typeof window !== 'undefined' && !!(window as any).electronAPI?.isElectron;
}

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
 * Le micro est ouvert en mode "brut" (echoCancellation, noiseSuppression et
 * autoGainControl désactivés, comme Discord) pour limiter au maximum le
 * risque de réduction de volume par l'OS pendant que l'assistant écoute.
 *
 * Moteur de reconnaissance : webkitSpeechRecognition dans un navigateur
 * classique (plus précis, envoie l'audio au service de Google). Dans l'app
 * Electron, ce service échoue systématiquement (erreur "network" — réservé
 * aux builds officiels de Chrome), donc on bascule sur Vosk, un moteur
 * 100% local en WASM (voir src/lib/voskEngine.ts).
 */
export default function JuxAssistant() {
  const { enabled, micDeviceId } = useVoiceAssistantSettings();
  const { currentSong, isPlaying, togglePlay, next, previous } = usePlayer();
  const [armed, setArmed] = useState(false);

  const recognitionRef = useRef<any>(null);
  const voskSessionRef = useRef<VoskSession | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const activeRef = useRef(false);
  const armedUntilRef = useRef<number>(0);
  const armTimeoutRef = useRef<number | null>(null);
  const restartTimeoutRef = useRef<number | null>(null);

  // Refs vers l'état du lecteur pour éviter de recréer la reconnaissance à chaque re-render
  const isPlayingRef = useRef(isPlaying);
  const togglePlayRef = useRef(togglePlay);
  const nextRef = useRef(next);
  const previousRef = useRef(previous);
  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);
  useEffect(() => { togglePlayRef.current = togglePlay; }, [togglePlay]);
  useEffect(() => { nextRef.current = next; }, [next]);
  useEffect(() => { previousRef.current = previous; }, [previous]);

  const electron = isElectronApp();
  const shouldListen = enabled && !!currentSong && (electron || isSpeechRecognitionSupported());

  useEffect(() => {
    const cleanup = () => {
      activeRef.current = false;
      if (recognitionRef.current) { try { recognitionRef.current.stop(); } catch {} recognitionRef.current = null; }
      if (voskSessionRef.current) { try { voskSessionRef.current.stop(); } catch {} voskSessionRef.current = null; }
      if (micStreamRef.current) { micStreamRef.current.getTracks().forEach((t) => t.stop()); micStreamRef.current = null; }
      if (armTimeoutRef.current) { clearTimeout(armTimeoutRef.current); armTimeoutRef.current = null; }
      if (restartTimeoutRef.current) { clearTimeout(restartTimeoutRef.current); restartTimeoutRef.current = null; }
      setArmed(false);
    };

    if (!shouldListen) { cleanup(); return; }

    activeRef.current = true;
    let cancelled = false;

    (async () => {
      // Ouvrir le micro en mode "brut" AVANT la reconnaissance : sans annulation
      // d'écho ni suppression de bruit, Chrome n'active pas le mode communication
      // et Windows ne réduit pas le volume des autres sons (comportement Discord).
      const rawConstraints = { echoCancellation: false, noiseSuppression: false, autoGainControl: false };
      let stream: MediaStream | null = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: micDeviceId ? { deviceId: { exact: micDeviceId }, ...rawConstraints } : rawConstraints,
        });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        micStreamRef.current = stream;
      } catch (err: any) {
        if (cancelled) return;
        if (err?.name === 'NotAllowedError') {
          activeRef.current = false;
          toast.error("Micro refusé — l'assistant vocal ne peut pas fonctionner", { position: 'bottom-center' });
          return;
        }
        // Le périphérique choisi dans les paramètres n'est plus disponible
        // (débranché, ID périmé...) : on retombe sur le micro par défaut
        // plutôt que d'échouer silencieusement.
        if (micDeviceId) {
          try {
            stream = await navigator.mediaDevices.getUserMedia({ audio: rawConstraints });
            if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
            micStreamRef.current = stream;
          } catch (err2: any) {
            if (cancelled) return;
            if (err2?.name === 'NotAllowedError') {
              activeRef.current = false;
              toast.error("Micro refusé — l'assistant vocal ne peut pas fonctionner", { position: 'bottom-center' });
              return;
            }
            console.error('[JuxAssistant] Impossible d\'ouvrir le micro', err2);
            toast.error("Micro introuvable — vérifie qu'un micro est branché et sélectionné", { position: 'bottom-center' });
          }
        } else {
          console.error('[JuxAssistant] Impossible d\'ouvrir le micro', err);
          toast.error("Micro introuvable — vérifie qu'un micro est branché", { position: 'bottom-center' });
        }
      }
      if (cancelled || !activeRef.current || !stream) return;

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

      const disarm = () => {
        armedUntilRef.current = 0;
        setArmed(false);
        if (armTimeoutRef.current) { clearTimeout(armTimeoutRef.current); armTimeoutRef.current = null; }
      };

      const arm = () => {
        armedUntilRef.current = Date.now() + ARM_WINDOW_MS;
        setArmed(true);
        if (armTimeoutRef.current) clearTimeout(armTimeoutRef.current);
        armTimeoutRef.current = window.setTimeout(disarm, ARM_WINDOW_MS);
      };

      // Logique commune de détection, partagée entre les deux moteurs
      // (webkitSpeechRecognition dans un navigateur, Vosk dans Electron).
      const handleTranscript = (raw: string) => {
        const text = normalize(raw);
        if (!text) return;
        console.debug('[JuxAssistant] Entendu:', text);

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
      };

      if (electron) {
        console.log('[JuxAssistant] Moteur: Vosk (local, Electron)');
        try {
          const session = await startVoskSession(
            stream,
            (text) => handleTranscript(text),
            (err) => console.error('[JuxAssistant] Erreur Vosk:', err),
          );
          if (cancelled || !activeRef.current) { session.stop(); return; }
          voskSessionRef.current = session;
        } catch (err) {
          if (cancelled) return;
          console.error('[JuxAssistant] Impossible de démarrer la reconnaissance locale (Vosk)', err);
          toast.error("Assistant vocal indisponible — modèle de reconnaissance local introuvable", { position: 'bottom-center' });
        }
        return;
      }

      console.log('[JuxAssistant] Moteur: WebSpeech (navigateur)');
      const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const recognition = new SR();
      recognition.lang = 'fr-FR';
      recognition.continuous = true;
      recognition.interimResults = false;
      recognition.maxAlternatives = 3;

      recognition.onresult = (event: any) => {
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (!result.isFinal) continue;
          // Tester toutes les alternatives proposées par la reconnaissance
          for (let a = 0; a < result.length; a++) {
            handleTranscript(result[a].transcript || '');
          }
        }
      };

      recognition.onerror = (e: any) => {
        // "no-speech" (silence normal) et "aborted" (stop() volontaire) ne sont pas des erreurs à signaler
        if (e?.error === 'no-speech' || e?.error === 'aborted') return;
        if (e?.error === 'not-allowed' || e?.error === 'service-not-allowed') {
          activeRef.current = false;
          toast.error("Micro refusé — l'assistant vocal ne peut pas fonctionner", { position: 'bottom-center' });
          return;
        }
        console.error('[JuxAssistant] Erreur reconnaissance vocale:', e?.error);
        if (e?.error === 'network') {
          toast.error('Assistant vocal : pas de connexion — la reconnaissance a besoin d\'internet', { position: 'bottom-center' });
        } else if (e?.error === 'audio-capture') {
          toast.error('Assistant vocal : aucun micro détecté', { position: 'bottom-center' });
        } else if (e?.error === 'language-not-supported') {
          toast.error('Assistant vocal : reconnaissance en français non disponible sur cet appareil', { position: 'bottom-center' });
        }
      };

      // Chrome coupe la reconnaissance régulièrement : on relance tant qu'on est actif
      recognition.onend = () => {
        if (!activeRef.current) return;
        restartTimeoutRef.current = window.setTimeout(() => {
          if (!activeRef.current) return;
          try { recognition.start(); } catch {}
        }, 300);
      };

      try { recognition.start(); } catch {}
      recognitionRef.current = recognition;
    })();

    return () => { cancelled = true; cleanup(); };
    // Redémarre l'écoute si le périphérique micro choisi change dans les paramètres
  }, [shouldListen, micDeviceId, electron]);

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
