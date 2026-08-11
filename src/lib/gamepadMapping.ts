/**
 * Mapping des boutons manette, personnalisable par l'utilisateur.
 * Chaque action est liée à une combinaison (chord) de boutons — une combinaison
 * vide signifie que l'action est désactivée (aucune touche assignée).
 */

export type GamepadActionId =
  | 'navUp' | 'navDown' | 'navLeft' | 'navRight'
  | 'click' | 'back' | 'playPause' | 'openPlayer'
  | 'previous' | 'next' | 'seekBack' | 'seekForward';

export interface GamepadActionInfo {
  id: GamepadActionId;
  label: string;
  description: string;
}

export const GAMEPAD_ACTIONS: GamepadActionInfo[] = [
  { id: 'navUp', label: 'Naviguer vers le haut', description: 'Déplace la sélection' },
  { id: 'navDown', label: 'Naviguer vers le bas', description: 'Déplace la sélection' },
  { id: 'navLeft', label: 'Naviguer à gauche', description: 'Déplace la sélection' },
  { id: 'navRight', label: 'Naviguer à droite', description: 'Déplace la sélection' },
  { id: 'click', label: 'Sélectionner', description: 'Clique l\'élément visé/sélectionné' },
  { id: 'back', label: 'Retour', description: 'Ferme un panneau ou revient en arrière' },
  { id: 'playPause', label: 'Lecture / Pause', description: '' },
  { id: 'openPlayer', label: 'Ouvrir le lecteur', description: 'Ouvre/ferme le plein écran' },
  { id: 'previous', label: 'Morceau précédent', description: '' },
  { id: 'next', label: 'Morceau suivant', description: '' },
  { id: 'seekBack', label: 'Reculer 10s', description: '' },
  { id: 'seekForward', label: 'Avancer 10s', description: '' },
];

export type GamepadMapping = Record<GamepadActionId, number[]>;

export const DEFAULT_GAMEPAD_MAPPING: GamepadMapping = {
  navUp: [12],
  navDown: [13],
  navLeft: [14],
  navRight: [15],
  click: [0],
  back: [1],
  playPause: [2],
  openPlayer: [3],
  previous: [4],
  next: [5],
  seekBack: [6],
  seekForward: [7],
};

/** Noms des boutons standard (mapping "standard" du Gamepad API, style Xbox). */
export const GAMEPAD_BUTTON_LABELS: Record<number, string> = {
  0: 'A', 1: 'B', 2: 'X', 3: 'Y',
  4: 'LB', 5: 'RB', 6: 'LT', 7: 'RT',
  8: 'Select', 9: 'Start', 10: 'L3', 11: 'R3',
  12: 'Haut', 13: 'Bas', 14: 'Gauche', 15: 'Droite',
  16: 'Home',
};

export function buttonLabel(index: number): string {
  return GAMEPAD_BUTTON_LABELS[index] ?? `Bouton ${index}`;
}

export function comboLabel(buttons: number[]): string {
  if (!buttons.length) return 'Aucune';
  return buttons.map(buttonLabel).join(' + ');
}

const ENABLED_KEY = 'jux:gamepadEnabled';
const MAPPING_KEY = 'jux:gamepadMapping';
export const GAMEPAD_MAPPING_CHANGED_EVENT = 'jux:gamepadMappingChanged';

export function isGamepadEnabled(): boolean {
  const v = localStorage.getItem(ENABLED_KEY);
  return v === null ? true : v === 'true'; // activé par défaut (comportement historique)
}

export function setGamepadEnabled(enabled: boolean): void {
  localStorage.setItem(ENABLED_KEY, String(enabled));
  window.dispatchEvent(new CustomEvent(GAMEPAD_MAPPING_CHANGED_EVENT));
}

export function getGamepadMapping(): GamepadMapping {
  try {
    const raw = localStorage.getItem(MAPPING_KEY);
    if (!raw) return { ...DEFAULT_GAMEPAD_MAPPING };
    const parsed = JSON.parse(raw);
    // Fusionne avec les défauts pour couvrir les actions ajoutées après coup
    return { ...DEFAULT_GAMEPAD_MAPPING, ...parsed };
  } catch {
    return { ...DEFAULT_GAMEPAD_MAPPING };
  }
}

export function setActionBinding(actionId: GamepadActionId, buttons: number[]): void {
  const mapping = getGamepadMapping();
  mapping[actionId] = [...buttons].sort((a, b) => a - b);
  localStorage.setItem(MAPPING_KEY, JSON.stringify(mapping));
  window.dispatchEvent(new CustomEvent(GAMEPAD_MAPPING_CHANGED_EVENT));
}

export function resetGamepadMapping(): void {
  localStorage.removeItem(MAPPING_KEY);
  window.dispatchEvent(new CustomEvent(GAMEPAD_MAPPING_CHANGED_EVENT));
}

// Pendant la capture d'un nouveau combo (écran de remappage), le hook principal
// ne doit pas aussi interpréter ces mêmes appuis comme des actions normales.
let remapping = false;
export function isRemappingInProgress(): boolean {
  return remapping;
}
export function setRemappingInProgress(value: boolean): void {
  remapping = value;
}
