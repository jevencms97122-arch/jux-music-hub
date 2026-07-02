export interface EqPreset {
  id: string;
  name: string;
  emoji: string;
  /** gains en dB pour les bandes : 60Hz, 250Hz, 1kHz, 4kHz, 16kHz */
  gains: [number, number, number, number, number];
}

export const EQ_BANDS_HZ = [60, 250, 1000, 4000, 16000] as const;
export const EQ_STORAGE_KEY = 'jux:eqPreset';

export const EQ_PRESETS: EqPreset[] = [
  { id: 'flat',       name: 'Normal',       emoji: '⚖️',  gains: [0,  0,  0,  0,  0] },
  { id: 'bass',       name: 'Bass Boost',   emoji: '🔊',  gains: [8,  5,  0, -1, -2] },
  { id: 'treble',     name: 'Treble Boost', emoji: '✨',  gains: [-2, -1,  0,  4,  7] },
  { id: 'rock',       name: 'Rock',         emoji: '🎸',  gains: [5,  3, -1,  3,  5] },
  { id: 'pop',        name: 'Pop',          emoji: '🎵',  gains: [-1,  2,  5,  3,  1] },
  { id: 'electronic', name: 'Électronique', emoji: '🎛️', gains: [6,  4,  0,  3,  6] },
  { id: 'acoustic',   name: 'Acoustique',   emoji: '🪕',  gains: [3,  2,  1,  3,  4] },
  { id: 'vocal',      name: 'Voix',         emoji: '🎤',  gains: [-2,  0,  5,  4,  1] },
  { id: 'jazz',       name: 'Jazz',         emoji: '🎺',  gains: [4,  2,  0,  2,  4] },
  { id: 'classical',  name: 'Classique',    emoji: '🎻',  gains: [4,  3,  0, -1, -2] },
];
