/**
 * Profil de performance de l'appareil.
 *
 * Objectif : sur un téléphone à 2 Go de RAM et CPU faible, l'interface doit
 * rester fluide. Les effets qui coûtent le plus cher ne sont pas les calculs
 * JS, ce sont les effets de composition plein écran :
 *  - `backdrop-filter: blur(…)` (une recapture de la zone sous l'élément à
 *    chaque frame, non cachée quand le fond bouge) ;
 *  - les fonds animés en `background-position` / `filter` (repaint plein écran
 *    à chaque frame, impossible à déléguer au GPU) ;
 *  - les animations infinies cumulées (chaque élément animé garde une couche
 *    de composition vivante, donc de la VRAM et du travail par frame).
 *
 * On expose donc un "palier" (`tier`) décidé une seule fois au démarrage, posé
 * sur `<html data-perf="low">` avant le premier rendu, pour que le CSS et les
 * composants puissent dégrader ces effets sans recalcul au runtime.
 */

export type PerfTier = 'low' | 'high';
/** Choix de l'utilisateur : 'auto' laisse la détection décider. */
export type PerfPreference = 'auto' | 'low' | 'high';

const PREF_KEY = 'jux_performance_mode';

/**
 * Seuils de détection. `deviceMemory` est arrondi par le navigateur à une
 * puissance de 2 et plafonné à 8 : un appareil annoncé à 2 (ou moins) a
 * réellement 2 Go ou moins, ce qui est exactement la cible visée.
 */
const LOW_MEMORY_GB = 3;
const LOW_CORE_COUNT = 4;

function readPreference(): PerfPreference {
  try {
    const raw = localStorage.getItem(PREF_KEY);
    // 'true'/'false' : ancien format booléen du Mode Performance manuel.
    if (raw === 'true' || raw === 'low') return 'low';
    if (raw === 'false' || raw === 'high') return 'high';
  } catch {
    // localStorage indisponible (mode privé strict) : on laisse l'auto décider.
  }
  return 'auto';
}

function detectTier(): PerfTier {
  if (typeof navigator === 'undefined') return 'high';

  const nav = navigator as Navigator & { deviceMemory?: number };

  // RAM annoncée par l'appareil : le signal le plus direct pour notre cible.
  if (typeof nav.deviceMemory === 'number' && nav.deviceMemory <= LOW_MEMORY_GB) return 'low';

  // Peu de cœurs = peu de marge pour le thread de composition en plus du JS.
  if (typeof nav.hardwareConcurrency === 'number' && nav.hardwareConcurrency > 0
      && nav.hardwareConcurrency <= LOW_CORE_COUNT) return 'low';

  // L'utilisateur a demandé moins d'animations au niveau système : on respecte
  // l'intention et on en profite pour alléger le rendu.
  try {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return 'low';
  } catch {
    // matchMedia absent : rien à conclure.
  }

  return 'high';
}

let cachedTier: PerfTier | null = null;

/**
 * Palier effectif. Calculé une seule fois : il ne doit pas changer en cours de
 * session, sinon les composants monteraient/démonteraient des fonds animés au
 * milieu de la navigation.
 */
export function getPerfTier(): PerfTier {
  if (cachedTier) return cachedTier;
  const pref = readPreference();
  cachedTier = pref === 'auto' ? detectTier() : pref;
  return cachedTier;
}

export function isLowPerf(): boolean {
  return getPerfTier() === 'low';
}

export function getPerfPreference(): PerfPreference {
  return readPreference();
}

/**
 * Enregistre le choix de l'utilisateur. Le palier étant figé pour la session,
 * l'appelant recharge l'app pour que le nouveau choix s'applique partout.
 */
export function setPerfPreference(pref: PerfPreference): void {
  try {
    if (pref === 'auto') localStorage.removeItem(PREF_KEY);
    else localStorage.setItem(PREF_KEY, pref);
  } catch {
    // ignore
  }
}

/**
 * Pose `data-perf` sur <html>. Appelé depuis main.tsx avant le premier rendu :
 * le CSS bas-de-gamme est ainsi actif dès la première frame, sans flash d'une
 * interface riche qu'on dégraderait juste après.
 */
export function applyPerfAttribute(): PerfTier {
  const tier = getPerfTier();
  try {
    document.documentElement.setAttribute('data-perf', tier);
  } catch {
    // ignore
  }
  return tier;
}

/** Détection brute, sans la préférence utilisateur — pour l'afficher dans les réglages. */
export function detectedTier(): PerfTier {
  return detectTier();
}
