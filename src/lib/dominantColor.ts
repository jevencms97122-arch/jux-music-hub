// Extraction de la couleur dominante par quantification de couleurs (buckets).
// Utilise fetch → blob URL pour contourner le taint CORS du canvas.

const cache = new Map<string, string>();

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
}

function saturation(r: number, g: number, b: number): number {
  const max = Math.max(r, g, b) / 255;
  const min = Math.min(r, g, b) / 255;
  if (max === min) return 0;
  const l = (max + min) / 2;
  const d = max - min;
  return l > 0.5 ? d / (2 - max - min) : d / (max + min);
}

function extractFromPixels(data: Uint8ClampedArray): string | null {
  const QUANT = 20;
  type Bucket = { r: number; g: number; b: number; count: number };
  const buckets = new Map<number, Bucket>();

  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) continue;
    const r = data[i], g = data[i + 1], b = data[i + 2];

    // Ignore near-black, near-white et pixels trop désaturés (gris)
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    if (lum < 20 || lum > 235) continue;
    if (saturation(r, g, b) < 0.1) continue;

    const key = (Math.floor(r / QUANT) << 16) | (Math.floor(g / QUANT) << 8) | Math.floor(b / QUANT);
    const bkt = buckets.get(key);
    if (bkt) { bkt.r += r; bkt.g += g; bkt.b += b; bkt.count++; }
    else buckets.set(key, { r, g, b, count: 1 });
  }

  if (buckets.size === 0) return null;

  // Score = nb pixels × bonus saturation (favorise les couleurs vives et dominantes)
  let best: Bucket | null = null, bestScore = -1;
  for (const bkt of buckets.values()) {
    const ar = bkt.r / bkt.count, ag = bkt.g / bkt.count, ab = bkt.b / bkt.count;
    const score = bkt.count * (0.35 + saturation(ar, ag, ab) * 0.65);
    if (score > bestScore) { bestScore = score; best = bkt; }
  }
  if (!best) return null;

  const ar = best.r / best.count, ag = best.g / best.count, ab = best.b / best.count;
  let [h, s, l] = rgbToHsl(ar, ag, ab);
  s = Math.max(s, 50);          // garantir une couleur suffisamment vive
  l = Math.max(45, Math.min(65, l)); // visible sur fond sombre
  return `${h} ${s}% ${l}%`;
}

function drawAndExtract(src: string, crossOrigin?: boolean): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image();
    const isBlobUrl = src.startsWith('blob:');
    if (crossOrigin) img.crossOrigin = 'anonymous';

    img.onload = () => {
      if (isBlobUrl) URL.revokeObjectURL(src);
      try {
        const size = 80;
        const canvas = document.createElement('canvas');
        canvas.width = size; canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(null);
        ctx.drawImage(img, 0, 0, size, size);
        resolve(extractFromPixels(ctx.getImageData(0, 0, size, size).data));
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => {
      if (isBlobUrl) URL.revokeObjectURL(src);
      resolve(null);
    };
    img.src = src;
  });
}

export async function extractDominantHsl(imageUrl: string): Promise<string | null> {
  if (!imageUrl || imageUrl === '/placeholder.svg') return null;
  if (cache.has(imageUrl)) return cache.get(imageUrl)!;

  let result: string | null = null;

  // Méthode 1 : fetch → blob URL (contourne le taint CORS du canvas)
  try {
    const res = await fetch(imageUrl);
    if (res.ok) {
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      result = await drawAndExtract(blobUrl);
    }
  } catch { /* ignore, on essaie le fallback */ }

  // Méthode 2 : fallback crossOrigin (si le serveur envoie les headers CORS)
  if (!result) {
    result = await drawAndExtract(imageUrl, true);
  }

  if (result) cache.set(imageUrl, result);
  return result;
}

// ─── Sauvegarde / restauration du thème de base ───────────────────────────────

let _savedTheme: {
  primary: string; primaryGlow: string; accent: string; ring: string;
  sidebarPrimary: string; sidebarRing: string;
  gradientPrimary: string; gradientHero: string;
  shadowElegant: string; shadowElegantSm: string; shadowGlow: string;
} | null = null;

export function storeThemeAccents(theme: {
  primary: string; primaryGlow?: string; accent: string; ring: string;
  sidebarPrimary?: string; sidebarRing?: string;
}) {
  const prim = theme.primary;
  const glow = theme.primaryGlow ?? prim;
  const sp = theme.sidebarPrimary ?? prim;
  const sr = theme.sidebarRing ?? prim;
  _savedTheme = {
    primary: prim, primaryGlow: glow, accent: theme.accent, ring: theme.ring,
    sidebarPrimary: sp, sidebarRing: sr,
    gradientPrimary: `linear-gradient(135deg, hsl(${prim}), hsl(${glow}))`,
    gradientHero: `radial-gradient(ellipse at top, hsl(${prim} / 0.18), transparent 60%)`,
    shadowElegant: `0 10px 40px -10px hsl(${prim} / 0.35)`,
    shadowElegantSm: `0 6px 18px -6px hsl(${prim} / 0.35)`,
    shadowGlow: `0 0 0 1px hsl(${prim} / 0.25), 0 8px 30px -6px hsl(${prim} / 0.45)`,
  };
}

export function restoreThemeAccents() {
  if (!_savedTheme) return;
  const root = document.documentElement;
  const t = _savedTheme;
  root.style.setProperty('--primary', t.primary);
  root.style.setProperty('--primary-glow', t.primaryGlow);
  root.style.setProperty('--accent', t.accent);
  root.style.setProperty('--ring', t.ring);
  root.style.setProperty('--sidebar-primary', t.sidebarPrimary);
  root.style.setProperty('--sidebar-ring', t.sidebarRing);
  root.style.setProperty('--gradient-primary', t.gradientPrimary);
  root.style.setProperty('--gradient-hero', t.gradientHero);
  root.style.setProperty('--shadow-elegant', t.shadowElegant);
  root.style.setProperty('--shadow-elegant-sm', t.shadowElegantSm);
  root.style.setProperty('--shadow-glow', t.shadowGlow);
}

export function applyAccentHsl(hsl: string | null) {
  if (!hsl) { restoreThemeAccents(); return; }
  const m = hsl.match(/^(\d+) (\d+)% (\d+)%$/);
  let glow = hsl;
  if (m) {
    const l = Math.min(80, parseInt(m[3], 10) + 8);
    glow = `${m[1]} ${m[2]}% ${l}%`;
  }
  const root = document.documentElement;
  root.style.setProperty('--primary', hsl);
  root.style.setProperty('--primary-glow', glow);
  root.style.setProperty('--accent', hsl);
  root.style.setProperty('--ring', hsl);
  root.style.setProperty('--sidebar-primary', hsl);
  root.style.setProperty('--sidebar-ring', hsl);
  root.style.setProperty('--gradient-primary', `linear-gradient(135deg, hsl(${hsl}), hsl(${glow}))`);
  root.style.setProperty('--gradient-hero', `radial-gradient(ellipse at top, hsl(${hsl} / 0.18), transparent 60%)`);
  root.style.setProperty('--shadow-elegant', `0 10px 40px -10px hsl(${hsl} / 0.35)`);
  root.style.setProperty('--shadow-elegant-sm', `0 6px 18px -6px hsl(${hsl} / 0.35)`);
  root.style.setProperty('--shadow-glow', `0 0 0 1px hsl(${hsl} / 0.25), 0 8px 30px -6px hsl(${hsl} / 0.45)`);
}
