export type NebulaColors = [string, string, string];

export const NEBULA_DEFAULT_HEX = '#8a2be2';

function hexToHue(hex: string): number {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return 270;
  const r = parseInt(m[1], 16) / 255;
  const g = parseInt(m[2], 16) / 255;
  const b = parseInt(m[3], 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  if (d === 0) return 0;
  let h: number;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h *= 60;
  return h < 0 ? h + 360 : h;
}

/** Construit la palette nébuleuse (3 halos triadiques) à partir d'une teinte de base. */
export function buildNebulaPalette(hue: number): NebulaColors {
  const h1 = hue % 360;
  const h2 = (hue + 130) % 360;
  const h3 = (hue + 250) % 360;
  return [
    `hsla(${h1.toFixed(0)}, 85%, 55%, 0.8)`,
    `hsla(${h2.toFixed(0)}, 90%, 55%, 0.7)`,
    `hsla(${h3.toFixed(0)}, 75%, 50%, 0.6)`,
  ];
}

export function nebulaPaletteFromHex(hex: string): NebulaColors {
  return buildNebulaPalette(hexToHue(hex));
}

export function randomNebulaHex(): string {
  const hue = Math.floor(Math.random() * 360);
  return hslHueToHex(hue);
}

function hslHueToHex(hue: number): string {
  const s = 0.8;
  const l = 0.5;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (hue < 60) [r, g, b] = [c, x, 0];
  else if (hue < 120) [r, g, b] = [x, c, 0];
  else if (hue < 180) [r, g, b] = [0, c, x];
  else if (hue < 240) [r, g, b] = [0, x, c];
  else if (hue < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const toHex = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}
