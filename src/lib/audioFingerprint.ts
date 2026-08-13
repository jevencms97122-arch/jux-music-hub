/**
 * Empreinte audio légère — détecte qu'un fichier "sonne comme" un autre déjà
 * publié, même s'il a été ré-encodé, légèrement coupé au début/à la fin, ou
 * exporté à un autre bitrate. Ce n'est PAS un hash de fichier (ça, c'est
 * file_hash — voir Upload.tsx) : ici on analyse le contenu audio lui-même.
 *
 * Principe (proche d'un "chromagramme", en plus simple) :
 * 1. Décoder l'audio en mono, ré-échantillonné à une fréquence basse (le détail
 *    fin n'est pas nécessaire pour reconnaître un morceau).
 * 2. Découper la piste en un nombre FIXE de segments (indépendant de la durée
 *    réelle) — ça absorbe les petites coupes en début/fin et les différences
 *    d'encodage.
 * 3. Pour chaque segment, FFT sur une fenêtre représentative → répartir
 *    l'énergie du spectre dans 12 bandes de fréquence (log-spaced, comme les
 *    octaves musicales) → normaliser.
 * 4. Résultat : un vecteur de taille fixe (SEGMENTS × BANDS), quantifié en
 *    entiers 0-255, sérialisé en JSON. Deux morceaux similaires produisent des
 *    vecteurs très proches (comparés par similarité cosinus côté serveur).
 */

const TARGET_SAMPLE_RATE = 5512; // couvre l'essentiel du contenu musical utile, calcul rapide
const SEGMENTS = 48;
const FFT_SIZE = 1024;
const BANDS = 12;
const MIN_FREQ = 80;   // en dessous : essentiellement du bruit/DC pour de la musique
const MAX_FREQ = 2600; // au-dessus : moins discriminant pour l'identification, on l'ignore

export const FINGERPRINT_LENGTH = SEGMENTS * BANDS;

function nextPow2(n: number): number {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

/** FFT radix-2 itérative in-place (Cooley-Tukey), entrée réelle (imag = 0). */
function fft(real: Float32Array, imag: Float32Array): void {
  const n = real.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [real[i], real[j]] = [real[j], real[i]];
      [imag[i], imag[j]] = [imag[j], imag[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let curWr = 1, curWi = 0;
      for (let k = 0; k < len / 2; k++) {
        const ur = real[i + k], ui = imag[i + k];
        const vr = real[i + k + len / 2] * curWr - imag[i + k + len / 2] * curWi;
        const vi = real[i + k + len / 2] * curWi + imag[i + k + len / 2] * curWr;
        real[i + k] = ur + vr;
        imag[i + k] = ui + vi;
        real[i + k + len / 2] = ur - vr;
        imag[i + k + len / 2] = ui - vi;
        const nWr = curWr * wr - curWi * wi;
        curWi = curWr * wi + curWi * wr;
        curWr = nWr;
      }
    }
  }
}

/** Bucketise le spectre de magnitude en BANDS bandes log-espacées entre MIN_FREQ et MAX_FREQ. */
function spectrumToBands(magnitudes: Float32Array, sampleRate: number): number[] {
  const bands = new Array(BANDS).fill(0);
  const nyquist = sampleRate / 2;
  const binHz = nyquist / (magnitudes.length - 1);
  const logMin = Math.log2(MIN_FREQ), logMax = Math.log2(MAX_FREQ);

  for (let bin = 1; bin < magnitudes.length; bin++) {
    const freq = bin * binHz;
    if (freq < MIN_FREQ || freq > MAX_FREQ) continue;
    const t = (Math.log2(freq) - logMin) / (logMax - logMin);
    const bandIdx = Math.min(BANDS - 1, Math.max(0, Math.floor(t * BANDS)));
    bands[bandIdx] += magnitudes[bin];
  }

  const total = bands.reduce((a, b) => a + b, 0) || 1;
  return bands.map((b) => b / total); // normalisé : indépendant du volume global
}

async function decodeMono(file: File): Promise<{ samples: Float32Array; sampleRate: number }> {
  const arrayBuffer = await file.arrayBuffer();
  const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
  const probeCtx: AudioContext = new AudioCtx();
  let decoded: AudioBuffer;
  try {
    decoded = await probeCtx.decodeAudioData(arrayBuffer.slice(0));
  } finally {
    probeCtx.close().catch(() => {});
  }

  // Ré-échantillonnage + downmix mono via OfflineAudioContext (plus rapide et
  // fiable que de le faire à la main échantillon par échantillon).
  const targetLength = Math.ceil(decoded.duration * TARGET_SAMPLE_RATE);
  const offline = new OfflineAudioContext(1, targetLength, TARGET_SAMPLE_RATE);
  const source = offline.createBufferSource();
  source.buffer = decoded;
  source.connect(offline.destination);
  source.start();
  const rendered = await offline.startRendering();
  return { samples: rendered.getChannelData(0), sampleRate: TARGET_SAMPLE_RATE };
}

/** Calcule l'empreinte audio d'un fichier — chaîne JSON compacte prête à envoyer au serveur. */
export async function computeAudioFingerprint(file: File): Promise<string | null> {
  try {
    const { samples, sampleRate } = await decodeMono(file);
    if (samples.length < FFT_SIZE) return null;

    const fftSize = nextPow2(FFT_SIZE);
    const segmentStride = (samples.length - fftSize) / Math.max(1, SEGMENTS - 1);
    const vector: number[] = [];

    for (let s = 0; s < SEGMENTS; s++) {
      const start = Math.min(samples.length - fftSize, Math.round(s * segmentStride));
      const real = new Float32Array(fftSize);
      const imag = new Float32Array(fftSize);
      for (let i = 0; i < fftSize; i++) {
        // Fenêtre de Hann : réduit les artefacts de bord de la FFT.
        const w = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (fftSize - 1));
        real[i] = samples[start + i] * w;
      }
      fft(real, imag);
      const magnitudes = new Float32Array(fftSize / 2);
      for (let i = 0; i < magnitudes.length; i++) {
        magnitudes[i] = Math.hypot(real[i], imag[i]);
      }
      vector.push(...spectrumToBands(magnitudes, sampleRate));
    }

    // Quantification en entiers 0-255 : compact, largement suffisant pour la
    // comparaison par similarité (pas besoin de précision flottante ici).
    const quantized = vector.map((v) => Math.round(Math.min(1, Math.max(0, v)) * 255));
    return JSON.stringify(quantized);
  } catch (e) {
    console.error('[audioFingerprint] échec du calcul', e);
    return null; // en cas d'échec (format non décodable, etc.), on n'empêche pas l'upload
  }
}
