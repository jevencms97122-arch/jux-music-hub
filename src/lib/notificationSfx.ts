/**
 * Catalogue des SFX de notification "nouveau message" — servis en assets
 * statiques depuis public/sfx/new-message/ (et non via import.meta.glob :
 * ce pattern faisait planter vite-plugin-pwa de façon aléatoire sous Windows).
 * Pour ajouter un son, déposer le fichier dans ce dossier et ajouter son nom
 * dans FILENAMES ci-dessous.
 */

const FILENAMES = [
  'dragon-studio-notification-bell-sound-1-376885.mp3',
  'mixkit-alert-bells-echo-765.wav',
  'mixkit-arcade-bonus-alert-767.wav',
  'mixkit-fantasy-game-sweep-notification-255.wav',
  'mixkit-interface-hint-notification-911.wav',
  'mixkit-unlock-new-item-game-notification-254.wav',
  'soundreality-notification-center-443093.mp3',
  'universfield-message-notification-199577.mp3',
  'universfield-new-notification-014-363678.mp3',
  'universfield-new-notification-040-493469.mp3',
  'universfield-notification-beep-229154.mp3',
];

export interface SfxOption {
  id: string;
  label: string;
  url: string;
}

export const NOTIFICATION_SFX_OPTIONS: SfxOption[] = FILENAMES
  .map((filename) => ({
    id: filename,
    label: filename.replace(/\.[^.]+$/, ''),
    url: `/sfx/new-message/${filename}`,
  }))
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

/** Fichier utilisé comme son de notification par défaut tant que l'utilisateur n'a rien choisi. */
const DEFAULT_SFX_ID = 'universfield-notification-beep-229154.mp3';

export function getSelectedSfx(): SfxOption | null {
  const id = getSelectedSfxId();
  if (id === NONE_SFX_ID) return null; // choix explicite : pas de son
  if (!id) {
    // jamais configuré -> défaut
    return NOTIFICATION_SFX_OPTIONS.find((s) => s.id === DEFAULT_SFX_ID) ?? NOTIFICATION_SFX_OPTIONS[0] ?? null;
  }
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
