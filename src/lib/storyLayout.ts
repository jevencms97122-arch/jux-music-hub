/**
 * Layout d'une story : position/taille des éléments posés sur le canvas.
 *
 * Tout est stocké en fractions 0→1 d'un canvas de référence **9:16**, jamais en
 * pixels : une story composée sur un 412×915 doit s'afficher à l'identique sur
 * un 1080×2400 ou dans une fenêtre desktop. L'éditeur comme le viewer letterboxent
 * donc leur zone d'affichage en 9:16 avant d'appliquer ces valeurs.
 */

/** Nom de la colonne `json` dans la collection `stories`. */
export const LAYOUT_FIELD = 'layout';

export const STORY_ASPECT = 9 / 16;

export type MusicVariant = 'chip' | 'card' | 'cover';

export interface MusicLayout {
  /** Centre du widget, fraction de la largeur du canvas. */
  x: number;
  /** Centre du widget, fraction de la hauteur du canvas. */
  y: number;
  /** Largeur du widget, fraction de la largeur du canvas. La hauteur reste
   *  dérivée du contenu : un titre long doit pouvoir passer sur deux lignes. */
  w: number;
  /** Rotation en degrés. */
  rot: number;
  variant: MusicVariant;
}

export interface StoryLayout {
  /** Version de schéma — permet de convertir au lieu de casser les vieilles stories. */
  v: 1;
  music: MusicLayout;
}

export const MIN_WIDGET_W = 0.28;
export const MAX_WIDGET_W = 1;

export const DEFAULT_MUSIC_LAYOUT: MusicLayout = {
  x: 0.5,
  y: 0.86,
  w: 0.72,
  rot: 0,
  variant: 'chip',
};

export const DEFAULT_LAYOUT: StoryLayout = { v: 1, music: { ...DEFAULT_MUSIC_LAYOUT } };

const VARIANTS: MusicVariant[] = ['chip', 'card', 'cover'];

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

const num = (raw: unknown, fallback: number) =>
  typeof raw === 'number' && Number.isFinite(raw) ? raw : fallback;

/** Ramène un layout dans ses bornes. Appliqué à l'écriture ET à la lecture. */
export function clampMusicLayout(l: MusicLayout): MusicLayout {
  return {
    x: clamp(l.x, 0, 1),
    y: clamp(l.y, 0, 1),
    w: clamp(l.w, MIN_WIDGET_W, MAX_WIDGET_W),
    rot: clamp(l.rot, -180, 180),
    variant: VARIANTS.includes(l.variant) ? l.variant : 'chip',
  };
}

/**
 * Lit le champ `layout` d'un enregistrement. Renvoie `null` si la story n'en a
 * pas (toutes celles créées avant cette fonctionnalité) — l'appelant retombe
 * alors sur l'ancien rendu. Un layout corrompu ne doit jamais empêcher la story
 * de s'afficher : on retombe sur le défaut plutôt que de throw.
 */
export function parseStoryLayout(raw: unknown): StoryLayout | null {
  if (raw == null || raw === '') return null;

  let obj: any = raw;
  if (typeof raw === 'string') {
    try { obj = JSON.parse(raw); } catch { return DEFAULT_LAYOUT; }
  }
  if (typeof obj !== 'object' || obj === null) return DEFAULT_LAYOUT;

  const m = obj.music;
  if (typeof m !== 'object' || m === null) return DEFAULT_LAYOUT;

  return {
    v: 1,
    music: clampMusicLayout({
      x: num(m.x, DEFAULT_MUSIC_LAYOUT.x),
      y: num(m.y, DEFAULT_MUSIC_LAYOUT.y),
      w: num(m.w, DEFAULT_MUSIC_LAYOUT.w),
      rot: num(m.rot, DEFAULT_MUSIC_LAYOUT.rot),
      variant: m.variant,
    }),
  };
}

/** Sérialise pour PocketBase (les valeurs sont arrondies : inutile de stocker 15 décimales). */
export function serializeStoryLayout(music: MusicLayout): string {
  const c = clampMusicLayout(music);
  return JSON.stringify({
    v: 1,
    music: {
      x: Math.round(c.x * 1000) / 1000,
      y: Math.round(c.y * 1000) / 1000,
      w: Math.round(c.w * 1000) / 1000,
      rot: Math.round(c.rot * 10) / 10,
      variant: c.variant,
    },
  });
}
