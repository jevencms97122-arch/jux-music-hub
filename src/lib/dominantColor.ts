// Extrait la couleur dominante d'une image et la convertit en HSL.
// Renvoie une string "H S% L%" (format compatible avec hsl(var(--primary))).

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
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
}

export async function extractDominantHsl(imageUrl: string): Promise<string | null> {
  if (!imageUrl) return null;
  if (cache.has(imageUrl)) return cache.get(imageUrl)!;

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const size = 32;
        const canvas = document.createElement('canvas');
        canvas.width = size; canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(null);
        ctx.drawImage(img, 0, 0, size, size);
        const data = ctx.getImageData(0, 0, size, size).data;

        // Moyenne pondérée en ignorant transparents et pixels quasi blanc/noir
        let r = 0, g = 0, b = 0, count = 0;
        for (let i = 0; i < data.length; i += 4) {
          const a = data[i + 3];
          if (a < 125) continue;
          const pr = data[i], pg = data[i + 1], pb = data[i + 2];
          const lum = (pr + pg + pb) / 3;
          if (lum < 15 || lum > 240) continue;
          r += pr; g += pg; b += pb; count++;
        }
        if (count === 0) return resolve(null);
        r = Math.round(r / count); g = Math.round(g / count); b = Math.round(b / count);
        let [h, s, l] = rgbToHsl(r, g, b);
        // Eviter couleurs trop sombres / trop ternes pour rester visible sur fond sombre
        l = Math.max(45, Math.min(70, l));
        const result = `${h} ${s}% ${l}%`;
        cache.set(imageUrl, result);
        resolve(result);
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = imageUrl;
  });
}

export function applyAccentHsl(hsl: string | null) {
  const root = document.documentElement;
  if (!hsl) {
    root.style.removeProperty('--primary');
    root.style.removeProperty('--primary-glow');
    root.style.removeProperty('--accent');
    root.style.removeProperty('--ring');
    root.style.removeProperty('--gradient-primary');
    root.style.removeProperty('--gradient-hero');
    root.style.removeProperty('--shadow-elegant');
    return;
  }
  // Glow = même teinte un peu plus claire
  const m = hsl.match(/^(\d+) (\d+)% (\d+)%$/);
  let glow = hsl;
  if (m) {
    const h = m[1], s = m[2], l = Math.min(80, parseInt(m[3], 10) + 7);
    glow = `${h} ${s}% ${l}%`;
  }
  root.style.setProperty('--primary', hsl);
  root.style.setProperty('--primary-glow', glow);
  root.style.setProperty('--accent', hsl);
  root.style.setProperty('--ring', hsl);
  root.style.setProperty('--gradient-primary', `linear-gradient(135deg, hsl(${hsl}), hsl(${glow}))`);
  root.style.setProperty('--gradient-hero', `radial-gradient(ellipse at top, hsl(${hsl} / 0.18), transparent 60%)`);
  root.style.setProperty('--shadow-elegant', `0 10px 40px -10px hsl(${hsl} / 0.35)`);
}
