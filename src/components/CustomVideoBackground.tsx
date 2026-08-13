import { useEffect, useRef } from 'react';
import {
  extractDominantHslFromVideoFrame,
  applyVideoThemeAccentHsl,
  storeThemeAccents,
  parseHslTriplet,
  formatHslTriplet,
  lerpHslTriplet,
  hslTripletsDiffer,
  type HslTriplet,
} from '@/lib/dominantColor';

// Fréquence d'échantillonnage de la vidéo : assez rapide pour suivre les
// changements de plan, assez espacé pour rester négligeable en coût CPU
// (extraction sur un canvas 64×64 en willReadFrequently ≈ sub-milliseconde).
const SAMPLE_INTERVAL_MS = 1200;
// Durée du fondu entre deux couleurs — assez long pour être perçu comme fluide,
// assez court pour ne pas sembler à la traîne derrière l'image.
const TWEEN_MS = 900;

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * Fond du thème personnalisé "Vidéo" — la vidéo choisie par l'utilisateur joue en
 * boucle derrière l'interface, et la couleur d'accent (boutons, halos, anneaux)
 * suit en direct la couleur dominante de l'image, avec un fondu doux entre deux
 * échantillons plutôt qu'un changement brusque.
 *
 * Coût maîtrisé : un seul setInterval pour l'échantillonnage (pas de tick vidéo
 * par frame), et la boucle requestAnimationFrame du fondu ne tourne que pendant
 * la transition elle-même (~900ms) — jamais en continu.
 */
export default function CustomVideoBackground({
  videoUrl,
  paused,
  className = 'fixed inset-0',
}: {
  videoUrl: string;
  paused: boolean;
  className?: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  const currentRef = useRef<HslTriplet | null>(null);
  const fromRef = useRef<HslTriplet | null>(null);
  const targetRef = useRef<HslTriplet | null>(null);
  const tweenStartRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  // Lecture/pause synchronisée avec la visibilité de l'app (même logique que les
  // autres thèmes animés — évite de consommer batterie/CPU en arrière-plan).
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (paused) video.pause();
    else video.play().catch(() => { /* autoplay bloqué : ignoré, l'utilisateur peut relancer via l'UI */ });
  }, [paused]);

  useEffect(() => {
    if (paused) return;
    const video = videoRef.current;
    if (!video) return;

    const applyAndStore = (triplet: HslTriplet) => {
      const hsl = formatHslTriplet(triplet);
      applyVideoThemeAccentHsl(hsl);
      // Garde le "snapshot" du thème en phase avec la vidéo — sinon un changement
      // de son (PlayerContext → restoreThemeAccents) réappliquerait l'ancienne
      // couleur figée du thème de base au lieu de la couleur vidéo actuelle.
      storeThemeAccents({ primary: hsl, accent: hsl, ring: hsl, sidebarPrimary: hsl, sidebarRing: hsl });
    };

    const stepTween = (now: number) => {
      const from = fromRef.current, target = targetRef.current;
      if (!from || !target) { rafRef.current = null; return; }
      const t = Math.min(1, (now - tweenStartRef.current) / TWEEN_MS);
      const value = lerpHslTriplet(from, target, easeOutCubic(t));
      currentRef.current = value;
      applyAndStore(value);
      rafRef.current = t < 1 ? requestAnimationFrame(stepTween) : null;
    };

    const sample = () => {
      const hsl = extractDominantHslFromVideoFrame(video);
      if (!hsl) return;
      const triplet = parseHslTriplet(hsl);
      if (!triplet) return;

      if (!currentRef.current) {
        // Première couleur : s'applique immédiatement, rien à fondre depuis.
        currentRef.current = triplet;
        applyAndStore(triplet);
        return;
      }
      if (!hslTripletsDiffer(currentRef.current, triplet)) return; // écart imperceptible : on ignore

      fromRef.current = currentRef.current;
      targetRef.current = triplet;
      tweenStartRef.current = performance.now();
      if (rafRef.current == null) rafRef.current = requestAnimationFrame(stepTween);
    };

    sample();
    const interval = setInterval(sample, SAMPLE_INTERVAL_MS);
    return () => {
      clearInterval(interval);
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [paused, videoUrl]);

  return (
    <div aria-hidden className={className} style={{ pointerEvents: 'none', overflow: 'hidden' }}>
      <video
        ref={videoRef}
        src={videoUrl}
        className="h-full w-full object-cover"
        autoPlay
        loop
        muted
        playsInline
      />
      {/* Voile pour garder le texte lisible par-dessus une vidéo arbitraire (cf. principe de vibrance) */}
      <div className="absolute inset-0 bg-background/55" />
    </div>
  );
}
