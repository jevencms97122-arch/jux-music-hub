import { useEffect, useRef, useState } from 'react';
import { usePlayer } from '@/contexts/PlayerContext';
import { useVoiceAssistantSettings, isSpeechRecognitionSupported } from '@/hooks/useVoiceAssistant';
import { Mic } from 'lucide-react';
import { toast } from 'sonner';

// Variantes tolérées par mot magique — la reconnaissance transcrit parfois approximativement
const WAKE_VARIANTS: Record<string, string[]> = {
  jux: ['jux', 'juxe', 'jus', 'djux', 'jukse', 'juks'],
  nexora: ['nexora', 'nexorah', 'nexorra', 'nexaura', 'nexo ra', 'next aura'],
};

// Fenêtre pendant laquelle on écoute une commande après le mot magique
const ARM_WINDOW_MS = 6000;

function normalize(text: string): string {
  // Minuscules + suppression des accents (é → e) pour un matching robuste
  return text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
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
 * Assistant vocal Jux — headless, monté une fois dans l'app.
 * Micro actif uniquement quand une musique est lancée et que l'option est activée.
 *
 * Comme Discord : le micro est ouvert en mode "brut" (echoCancellation,
 * noiseSuppression et autoGainControl désactivés). Sans ces traitements voix,
 * le navigateur ne classe pas la capture comme un appel/communication et
 * Windows ne baisse pas le volume de la musique.
 */
export default function JuxAssistant() {
  const { enabled, wakeWord } = useVoiceAssistantSettings();
  const { currentSong, isPlaying, togglePlay, next, previous } = usePlayer();
  const [armed, setArmed] = useState(false);

  const recognitionRef = useRef<any>(null);
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

  const wakeWordRef = useRef(wakeWord);
  useEffect(() => { wakeWordRef.current = wakeWord; }, [wakeWord]);

  const shouldListen = enabled && !!currentSong && isSpeechRecognitionSupported();

  useEffect(() => {
    const cleanup = () => {
      activeRef.current = false;
      if (recognitionRef.current) { try { recognitionRef.current.stop(); } catch {} recognitionRef.current = null; }
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
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
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
          return;
        }
        // Autre erreur (pas de micro, etc.) : on tente quand même la reconnaissance
      }
      if (cancelled || !activeRef.current) return;

      const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const recognition = new SR();
      recognition.lang = 'fr-FR';
      recognition.continuous = true;
      recognition.interimResults = false;
      recognition.maxAlternatives = 3;

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

      recognition.onresult = (event: any) => {
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (!result.isFinal) continue;
          // Tester toutes les alternatives proposées par la reconnaissance
          for (let a = 0; a < result.length; a++) {
            const text = normalize(result[a].transcript || '');
            if (!text) continue;

            const variants = WAKE_VARIANTS[wakeWordRef.current] ?? [wakeWordRef.current];
            const found = variants.find((v) => text.includes(v));

            if (found) {
              // Mot magique détecté : commande dans la même phrase ("jux pause") ?
              const after = text.slice(text.indexOf(found) + found.length);
              const cmd = parseCommand(after) ?? parseCommand(text.replace(found, ''));
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
  }, [shouldListen]);

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
