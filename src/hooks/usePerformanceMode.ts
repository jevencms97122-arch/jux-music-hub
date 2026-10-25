import { useCallback, useState } from 'react';

import {
  getPerfPreference,
  setPerfPreference,
  detectedTier,
  type PerfPreference,
  type PerfTier,
} from '@/lib/perfProfile';

/**
 * Masquage des images — réglage à part entière, et non une conséquence du mode
 * performance : une liste sans couvertures est un changement visible que
 * personne n'attend d'un réglage automatique. Il reste utile sur une connexion
 * très lente ou un appareil à la mémoire saturée, mais c'est un choix explicite.
 */
const HIDE_IMAGES_KEY = 'jux_hide_images';
/** Ancienne clé du Mode Performance : sa valeur 'true' masquait les images. */
const LEGACY_KEY = 'jux_performance_mode';

function readHideImages(): boolean {
  try {
    const own = localStorage.getItem(HIDE_IMAGES_KEY);
    if (own !== null) return own === 'true';
    // Reprise de l'ancien réglage : les utilisateurs qui avaient activé le Mode
    // Performance d'avant gardent leurs images masquées jusqu'à ce qu'ils
    // touchent au nouveau commutateur.
    return localStorage.getItem(LEGACY_KEY) === 'true';
  } catch {
    return false;
  }
}

/**
 * Préférence de palier de performance : 'auto' (détection, voir perfProfile),
 * 'low' (allégé de force) ou 'high' (tous les effets).
 *
 * Le palier effectif étant figé pour la session, l'appelant recharge l'app
 * après un changement.
 */
export function usePerformanceMode() {
  const [preference, setPreferenceState] = useState<PerfPreference>(getPerfPreference);

  const setPreference = useCallback((pref: PerfPreference) => {
    setPerfPreference(pref);
    setPreferenceState(pref);
  }, []);

  return {
    preference,
    setPreference,
    /** Ce que la détection conclut sur cet appareil, à afficher à côté de 'auto'. */
    detected: detectedTier() as PerfTier,
  };
}

export function useHideImages() {
  const [enabled, setEnabledState] = useState(readHideImages);

  const setEnabled = useCallback((v: boolean) => {
    try {
      localStorage.setItem(HIDE_IMAGES_KEY, String(v));
    } catch {
      // ignore
    }
    setEnabledState(v);
  }, []);

  return { enabled, setEnabled };
}

/** Lecture synchrone pour les composants de rendu (voir CachedImage). */
export function isPerformanceModeEnabled(): boolean {
  return readHideImages();
}
