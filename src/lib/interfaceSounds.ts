/**
 * Catalogue des SFX d'interface, par catégorie — servis en assets statiques
 * depuis public/sfx/interface/ (et non via import.meta.glob : ce pattern
 * faisait planter vite-plugin-pwa de façon aléatoire sous Windows, voir
 * notificationSfx.ts). Nom de fichier : "<categorie>__nom.ext". Pour ajouter
 * un son, déposer le fichier dans ce dossier et ajouter son nom dans FILENAMES.
 * Contrairement aux notifications, aucun son n'est sélectionné par défaut tant
 * que l'utilisateur n'en choisit pas un.
 */

export interface SfxOption {
  id: string;
  label: string;
  url: string;
}

export interface InterfaceSoundCategory {
  id: string;
  label: string;
  description: string;
}

export const INTERFACE_SOUND_CATEGORIES: InterfaceSoundCategory[] = [
  { id: 'tap', label: 'Appui sur un bouton', description: 'Boutons principaux, onglets' },
  { id: 'success', label: 'Action réussie', description: 'Publication, ajout, validation' },
  { id: 'error', label: 'Erreur', description: 'Échec d\'une action' },
  { id: 'transition', label: 'Changement de page', description: 'Navigation entre les écrans' },
];

const FILENAMES = [
  'tap__ksjsbwuil-digital-click-3-513897.mp3',
  'success__alexis_gaming_cam-sfx-acceptation-363730.mp3',
  'error__universfield-error-notification-05-199276.mp3',
  'transition__dragon-studio-whoosh-03-410868.mp3',
];

const optionsByCategory = new Map<string, SfxOption[]>();
for (const filename of FILENAMES) {
  const sepIndex = filename.indexOf('__');
  if (sepIndex === -1) continue; // fichier mal nommé (pas de préfixe "<categorie>__")
  const category = filename.slice(0, sepIndex);
  const label = filename.slice(sepIndex + 2).replace(/\.[^.]+$/, '');
  const list = optionsByCategory.get(category) ?? [];
  list.push({ id: filename, label, url: `/sfx/interface/${filename}` });
  optionsByCategory.set(category, list);
}
for (const list of optionsByCategory.values()) list.sort((a, b) => a.label.localeCompare(b.label));

export function getInterfaceSoundOptions(categoryId: string): SfxOption[] {
  return optionsByCategory.get(categoryId) ?? [];
}

export const NONE_SFX_ID = '__none__';

function storageKey(categoryId: string): string {
  return `jux:interfaceSfx:${categoryId}`;
}

export function getSelectedInterfaceSfxId(categoryId: string): string | null {
  return localStorage.getItem(storageKey(categoryId));
}

export function setSelectedInterfaceSfxId(categoryId: string, id: string | null): void {
  if (id) localStorage.setItem(storageKey(categoryId), id);
  else localStorage.removeItem(storageKey(categoryId));
}

/** `null` = pas de son configuré pour cette catégorie (silence, contrairement au
 * comportement "premier son par défaut" des notifications). */
export function getSelectedInterfaceSfx(categoryId: string): SfxOption | null {
  const id = getSelectedInterfaceSfxId(categoryId);
  if (!id || id === NONE_SFX_ID) return null;
  return getInterfaceSoundOptions(categoryId).find((o) => o.id === id) ?? null;
}

let previewAudio: HTMLAudioElement | null = null;

export function playSfxUrl(url: string, volume = 0.6): void {
  try {
    if (previewAudio) { previewAudio.pause(); previewAudio.currentTime = 0; }
    const audio = new Audio(url);
    audio.volume = volume;
    previewAudio = audio;
    audio.play().catch(() => {});
  } catch { /* noop */ }
}

/** Point d'entrée à appeler depuis n'importe quelle interaction de l'app pour
 * jouer le son configuré pour cette catégorie (silencieux si rien n'est choisi). */
export function playInterfaceSound(categoryId: string): void {
  const sfx = getSelectedInterfaceSfx(categoryId);
  if (sfx) playSfxUrl(sfx.url);
}
