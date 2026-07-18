export type SymbolPreset = {
  id: string;
  name: string;
  /** Couleur au repos (idle) */
  idle: string;
  /** Étape 30% du pulse */
  c1: string;
  /** Étape 50% du pulse */
  c2: string;
  /** Étape 70% (pic) du pulse */
  c3: string;
};

export const SYMBOL_PRESET_DEFAULT_ID = 'ocean-electrique';

export const SYMBOL_PRESETS: SymbolPreset[] = [
  {
    id: 'ocean-electrique',
    name: 'Océan Électrique',
    idle: 'rgba(0, 150, 255, 0.4)',
    c1: 'rgba(100, 200, 255, 1)',
    c2: 'rgba(255, 105, 180, 1)',
    c3: '#ffffff',
  },
  {
    id: 'matrix-vert',
    name: 'Matrix Vert',
    idle: 'rgba(0, 255, 100, 0.35)',
    c1: 'rgba(150, 255, 150, 1)',
    c2: 'rgba(0, 255, 140, 1)',
    c3: '#eaffea',
  },
  {
    id: 'braise',
    name: 'Braise',
    idle: 'rgba(255, 120, 0, 0.35)',
    c1: 'rgba(255, 200, 80, 1)',
    c2: 'rgba(255, 60, 0, 1)',
    c3: '#fff6e0',
  },
  {
    id: 'neon-violet',
    name: 'Néon Violet',
    idle: 'rgba(170, 0, 255, 0.35)',
    c1: 'rgba(220, 120, 255, 1)',
    c2: 'rgba(255, 0, 200, 1)',
    c3: '#f5e6ff',
  },
  {
    id: 'glace-monochrome',
    name: 'Glace Monochrome',
    idle: 'rgba(200, 220, 255, 0.3)',
    c1: 'rgba(255, 255, 255, 0.9)',
    c2: 'rgba(180, 210, 255, 1)',
    c3: '#ffffff',
  },
  {
    id: 'or-ambre',
    name: 'Or Ambré',
    idle: 'rgba(255, 190, 60, 0.35)',
    c1: 'rgba(255, 225, 140, 1)',
    c2: 'rgba(255, 140, 0, 1)',
    c3: '#fff8e6',
  },
];

export function getSymbolPreset(id: string): SymbolPreset {
  return SYMBOL_PRESETS.find((p) => p.id === id) ?? SYMBOL_PRESETS[0];
}
