/**
 * Catalogue des SFX de notification "nouveau message" — détectés automatiquement
 * depuis src/assets/sfx/new-message/ (aucune liste à maintenir à la main).
 */

const modules = import.meta.glob('/src/assets/sfx/new-message/*.{mp3,wav,ogg,m4a}', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

export interface SfxOption {
  id: string;
  label: string;
  url: string;
}

export const NOTIFICATION_SFX_OPTIONS: SfxOption[] = Object.entries(modules)
  .map(([path, url]) => {
    const filename = path.split('/').pop() ?? path;
    const label = filename.replace(/\.[^.]+$/, '');
    return { id: filename, label, url };
  })
  .sort((a, b) => a.label.localeCompare(b.label));

const STORAGE_KEY = 'jux:notificationSfx';

/** Valeur stockée quand l'utilisateur choisit explicitement "Aucun son". */
export const NONE_SFX_ID = '__none__';

export function getSelectedSfxId(): string | null {
  return localStorage.getItem(STORAGE_KEY);
}

export function setSelectedSfxId(id: string | null): void {
  if (id) localStorage.setItem(STORAGE_KEY, id);
  else localStorage.removeItem(STORAGE_KEY);
}

export function getSelectedSfx(): SfxOption | null {
  const id = getSelectedSfxId();
  if (id === NONE_SFX_ID) return null; // choix explicite : pas de son
  if (!id) return NOTIFICATION_SFX_OPTIONS[0] ?? null; // jamais configuré -> défaut
  return NOTIFICATION_SFX_OPTIONS.find((s) => s.id === id) ?? NOTIFICATION_SFX_OPTIONS[0] ?? null;
}

let previewAudio: HTMLAudioElement | null = null;

/** Joue un SFX (aperçu dans le sélecteur, ou notification réelle). */
export function playSfx(url: string, volume = 0.7): void {
  try {
    if (previewAudio) { previewAudio.pause(); previewAudio.currentTime = 0; }
    const audio = new Audio(url);
    audio.volume = volume;
    previewAudio = audio;
    audio.play().catch(() => {});
  } catch { /* noop */ }
}

/** Joue le SFX actuellement sélectionné pour "nouveau message". */
export function playNotificationSfx(): void {
  const sfx = getSelectedSfx();
  if (sfx) playSfx(sfx.url);
}

// ── Mode "son seul" (Windows) ───────────────────────────────────────────────
// Quand actif, on ne montre jamais la notification native Windows — seul le
// SFX joue, même quand l'app est en arrière-plan.
const SOUND_ONLY_KEY = 'jux:notificationSoundOnly';

export function isSoundOnlyMode(): boolean {
  return localStorage.getItem(SOUND_ONLY_KEY) === 'true';
}

export function setSoundOnlyMode(enabled: boolean): void {
  localStorage.setItem(SOUND_ONLY_KEY, String(enabled));
}
