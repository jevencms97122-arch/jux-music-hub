import { useEffect, useState, useCallback, useMemo, useRef, type CSSProperties, type ReactNode } from 'react';
import { pb } from '@/lib/pocketbase';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion, type PanInfo, type TapInfo } from 'framer-motion';
import {
  X, Share2, Download, Trophy, Heart, Sparkles,
  Moon, Compass, Radio, Clock, CalendarDays,
  RectangleVertical, RectangleHorizontal,
} from 'lucide-react';
import { songCoverUrl } from '@/lib/storage';
import { toast } from 'sonner';
import type { Song } from '@/types/music';
import { recordToSong } from '@/lib/pbUtils';
import { cn } from '@/lib/utils';

interface WrappedData {
  totalListens: number;
  uniqueSongs: number;
  topSongs: Array<{ song: Song; count: number }>;
  topGenre: string | null;
  topArtist: string | null;
  topArtistCount: number;
  topGenreCount: number;
  totalMinutes: number;
  prevMonthTotal: number;
  mostActiveDay: string | null;
  archetype: ArchetypeKey | null;
}

/** Palette "carte glow" partagée par toutes les slides : dégradé diagonal + halo lumineux assorti. */
const PALETTE = {
  violet: { bg: 'linear-gradient(135deg, #1b0a35 0%, #3a1a72 45%, #5b2fae 100%)', glow: '0 0 50px rgba(196,181,253,0.85), 0 0 100px rgba(139,92,246,0.55)' },
  blue: { bg: 'linear-gradient(135deg, #0a0730 0%, #1c1464 45%, #2f3fa8 100%)', glow: '0 0 50px rgba(165,180,252,0.85), 0 0 100px rgba(99,102,241,0.55)' },
  teal: { bg: 'linear-gradient(135deg, #031f1a 0%, #0a4a3f 45%, #12a888 100%)', glow: '0 0 50px rgba(110,231,183,0.85), 0 0 100px rgba(16,185,129,0.55)' },
  orange: { bg: 'linear-gradient(135deg, #2b1400 0%, #5c2400 45%, #a8460b 100%)', glow: '0 0 50px rgba(253,186,116,0.85), 0 0 100px rgba(234,88,12,0.55)' },
  rose: { bg: 'linear-gradient(135deg, #2b0618 0%, #5e123a 45%, #9c1f5e 100%)', glow: '0 0 50px rgba(249,168,212,0.85), 0 0 100px rgba(219,39,119,0.55)' },
  amber: { bg: 'linear-gradient(135deg, #2b1a00 0%, #5c3900 45%, #a8650b 100%)', glow: '0 0 50px rgba(252,211,77,0.85), 0 0 100px rgba(217,119,6,0.55)' },
  fuchsia: { bg: 'linear-gradient(135deg, #240a35 0%, #4a1464 45%, #7d1f9c 100%)', glow: '0 0 50px rgba(240,171,252,0.85), 0 0 100px rgba(192,38,211,0.55)' },
  cyan: { bg: 'linear-gradient(135deg, #021a2b 0%, #04405e 45%, #0a76a8 100%)', glow: '0 0 50px rgba(103,232,249,0.85), 0 0 100px rgba(6,182,212,0.55)' },
  slate: { bg: 'linear-gradient(135deg, #0b0b12 0%, #1c1c26 45%, #2c2c3a 100%)', glow: '0 0 40px rgba(226,232,240,0.5), 0 0 80px rgba(148,163,184,0.35)' },
} as const;

/** Bloc réutilisé par chaque slide : titre géant avec halo, légende en gras, badge pilule. */
function HeroSlide({
  eyebrow, hero, heroClassName = 'text-6xl', glow, caption, pill, extra,
}: {
  eyebrow?: string;
  hero: ReactNode;
  heroClassName?: string;
  glow: string;
  caption?: string;
  pill?: ReactNode;
  extra?: ReactNode;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center text-center px-8">
      {eyebrow && (
        <motion.p {...fadeUp} className="text-sm uppercase tracking-widest text-white/50 mb-5">
          {eyebrow}
        </motion.p>
      )}
      <motion.div
        {...fadeUp}
        transition={{ ...fadeUp.transition, delay: eyebrow ? 0.08 : 0 }}
        className={cn('leading-none font-extrabold tracking-tight text-white', heroClassName)}
        style={{ textShadow: glow }}
      >
        {hero}
      </motion.div>
      {caption && (
        <motion.p
          {...fadeUp} transition={{ ...fadeUp.transition, delay: eyebrow ? 0.16 : 0.1 }}
          className="text-3xl font-extrabold tracking-tight text-white mt-1"
        >
          {caption}
        </motion.p>
      )}
      {extra}
      {pill && (
        <motion.div
          {...fadeUp} transition={{ ...fadeUp.transition, delay: eyebrow ? 0.34 : 0.3 }}
          className="mt-6 flex items-center gap-1.5 rounded-full bg-white/15 backdrop-blur-md px-4 py-1.5 text-xs font-semibold tracking-wide text-white/90 ring-1 ring-white/10"
        >
          {pill}
        </motion.div>
      )}
    </div>
  );
}

type ArchetypeKey = 'fidele' | 'explorateur' | 'noctambule' | 'melomane';

const ARCHETYPES: Record<ArchetypeKey, { label: string; desc: (d: WrappedData) => string; icon: typeof Heart }> = {
  fidele: {
    label: 'Fidèle',
    desc: (d) => `Tu es resté(e) fidèle à ${d.topArtist} presque tout le mois.`,
    icon: Heart,
  },
  explorateur: {
    label: 'Explorateur',
    desc: () => `Tu as multiplié les genres différents ce mois-ci. Curieux(se) de nature !`,
    icon: Compass,
  },
  noctambule: {
    label: 'Noctambule',
    desc: () => `Une bonne partie de tes écoutes se sont faites tard le soir ou la nuit.`,
    icon: Moon,
  },
  melomane: {
    label: 'Mélomane',
    desc: () => `Un mois de musique varié et équilibré, sans excès dans un sens ou l'autre.`,
    icon: Radio,
  },
};

const DAYS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

/** Easing "pro" façon Spotify Wrapped : rapide, net, sans rebond. */
const EASE = [0.22, 1, 0.36, 1] as const;

const fadeUp = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.45, ease: EASE },
};

function CountUp({ value, duration = 900, className }: { value: number; duration?: number; className?: string }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    let start: number | null = null;
    let raf: number;
    const step = (ts: number) => {
      if (start === null) start = ts;
      const progress = Math.min((ts - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(eased * value));
      if (progress < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return <span className={className}>{display.toLocaleString('fr-FR')}</span>;
}

type ShareOrientation = 'portrait' | 'landscape';

/** Texte centré avec halo lumineux (équivalent canvas du text-shadow des slides). */
function drawGlowText(
  ctx: CanvasRenderingContext2D, text: string, cx: number, y: number,
  font: string, color: string, glowColor: string, glowBlur: number,
) {
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.fillStyle = color;
  ctx.shadowColor = glowColor;
  ctx.shadowBlur = glowBlur;
  ctx.fillText(text, cx, y);
  ctx.shadowBlur = 0;
}

/** Pilule translucide centrée, même langage visuel que les badges des slides. */
function drawPill(ctx: CanvasRenderingContext2D, text: string, cx: number, y: number) {
  ctx.font = '600 26px system-ui, sans-serif';
  const textWidth = ctx.measureText(text).width;
  const w = textWidth + 64;
  const h = 60;
  const x = cx - w / 2;
  ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(255,255,255,0.14)';
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, h / 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.fillText(text, cx, y + h / 2 + 9);
}

/** Panneau "verre" translucide (fond des cartes de stats). */
function drawPanel(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r = 28) {
  ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(255,255,255,0.055)';
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.1)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

/** Fine ligne de séparation en dégradé, centrée. */
function drawDivider(ctx: CanvasRenderingContext2D, cx: number, y: number, width: number) {
  const g = ctx.createLinearGradient(cx - width / 2, 0, cx + width / 2, 0);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(0.5, 'rgba(255,255,255,0.35)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.strokeStyle = g;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(cx - width / 2, y);
  ctx.lineTo(cx + width / 2, y);
  ctx.stroke();
}

async function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const i = new Image();
    i.crossOrigin = 'anonymous';
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = src;
  });
}

/**
 * Dessine la carte de partage, dans le même langage visuel que les slides : fond dégradé
 * diagonal, texte géant avec halo, cartes "verre" translucides. Deux compositions distinctes
 * selon l'orientation choisie par l'utilisateur (portrait 9:16 pour les stories, paysage 16:9
 * pour le partage externe / fond d'écran).
 */
async function buildShareCanvas(
  data: WrappedData, pseudo: string, monthLabel: string, orientation: ShareOrientation = 'portrait',
): Promise<HTMLCanvasElement> {
  const portrait = orientation === 'portrait';
  const W = portrait ? 1080 : 1920;
  const H = portrait ? 1920 : 1080;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  // Fond : dégradé diagonal + halo subtil pour la profondeur
  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, '#0a0730');
  grad.addColorStop(0.45, '#1c1464');
  grad.addColorStop(1, '#2f3fa8');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  const halo = ctx.createRadialGradient(W * 0.18, H * 0.1, 0, W * 0.18, H * 0.1, Math.max(W, H) * 0.7);
  halo.addColorStop(0, 'rgba(255,255,255,0.07)');
  halo.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, W, H);

  const monthText = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);
  const p = pseudo.length > 20 ? pseudo.slice(0, 20) + '…' : pseudo;

  const topSong = data.topSongs[0];
  let coverImg: HTMLImageElement | null = null;
  if (topSong) {
    try { coverImg = await loadImage(songCoverUrl(topSong.song)); } catch { /* pas de cover */ }
  }

  if (portrait) {
    const cx = W / 2;
    const pad = 60;

    ctx.textAlign = 'center';
    ctx.font = '800 44px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.fillText('JUX', cx, 96);
    ctx.font = '500 26px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fillText(monthText, cx, 140);
    ctx.font = '800 38px system-ui, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(p, cx, 182);

    drawDivider(ctx, cx, 244, 220);

    drawGlowText(ctx, String(data.totalListens), cx, 490, '800 210px system-ui, sans-serif', '#ffffff', 'rgba(165,180,252,0.9)', 60);
    ctx.shadowBlur = 0;
    ctx.font = '800 58px system-ui, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('ÉCOUTES', cx, 560);
    drawPill(ctx, `${Math.round(data.totalMinutes / 60)} HEURES CE MOIS`, cx, 606);

    drawDivider(ctx, cx, 738, 220);

    // Deux cartes côte à côte : artiste préféré / genre favori
    const cardY = 786;
    const cardH = 210;
    const gap = 20;
    const cardW = (W - pad * 2 - gap) / 2;
    if (data.topArtist) {
      const ccx = pad + cardW / 2;
      drawPanel(ctx, pad, cardY, cardW, cardH);
      ctx.textAlign = 'center';
      ctx.font = '700 20px system-ui, sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.fillText('ARTISTE', ccx, cardY + 44);
      const a = data.topArtist.length > 14 ? data.topArtist.slice(0, 14) + '…' : data.topArtist;
      drawGlowText(ctx, a, ccx, cardY + 118, '800 34px system-ui, sans-serif', '#ffffff', 'rgba(249,168,212,0.85)', 22);
      ctx.shadowBlur = 0;
      ctx.font = '600 18px system-ui, sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.fillText(`${data.topArtistCount} écoutes`, ccx, cardY + 156);
    }
    if (data.topGenre) {
      const ccx = pad + cardW + gap + cardW / 2;
      drawPanel(ctx, pad + cardW + gap, cardY, cardW, cardH);
      ctx.textAlign = 'center';
      ctx.font = '700 20px system-ui, sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.fillText('GENRE', ccx, cardY + 44);
      drawGlowText(ctx, data.topGenre, ccx, cardY + 118, '800 34px system-ui, sans-serif', '#ffffff', 'rgba(252,211,77,0.85)', 22);
      ctx.shadowBlur = 0;
      ctx.font = '600 18px system-ui, sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.fillText(`${data.topGenreCount} écoutes`, ccx, cardY + 156);
    }

    // Carte pleine largeur : top titre
    if (topSong) {
      const panelY = cardY + cardH + 24;
      const panelH = 460;
      drawPanel(ctx, pad, panelY, W - pad * 2, panelH);
      if (coverImg) {
        const size = 176;
        const rx = cx - size / 2;
        const ry = panelY + 32;
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(rx, ry, size, size, 22);
        ctx.clip();
        ctx.drawImage(coverImg, rx, ry, size, size);
        ctx.restore();
      }
      ctx.textAlign = 'center';
      ctx.font = '700 20px system-ui, sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.fillText('TOP TITRE', cx, panelY + 244);
      const t = topSong.song.title.length > 22 ? topSong.song.title.slice(0, 22) + '…' : topSong.song.title;
      drawGlowText(ctx, t, cx, panelY + 296, '800 36px system-ui, sans-serif', '#ffffff', 'rgba(240,171,252,0.8)', 22);
      ctx.shadowBlur = 0;
      ctx.font = '500 22px system-ui, sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.fillText(topSong.song.author, cx, panelY + 332);
      drawPill(ctx, `${topSong.count} ÉCOUTES`, cx, panelY + 366);
    }

    ctx.shadowBlur = 0;
    ctx.font = '500 20px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fillText('Nexora-Music · disponible sur Jux-Store', cx, H - 56);
  } else {
    const pad = 76;
    const leftW = W * 0.42;
    const leftCx = pad + (leftW - pad) / 2;

    // Colonne gauche : identité + hero
    ctx.textAlign = 'left';
    ctx.font = '800 42px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.fillText('JUX', pad, 90);
    ctx.font = '500 24px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fillText(monthText, pad, 130);
    ctx.font = '800 34px system-ui, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(p, pad, 168);

    drawGlowText(ctx, String(data.totalListens), leftCx, 560, '800 190px system-ui, sans-serif', '#ffffff', 'rgba(165,180,252,0.9)', 55);
    ctx.shadowBlur = 0;
    ctx.font = '800 54px system-ui, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText('ÉCOUTES', leftCx, 626);
    drawPill(ctx, `${Math.round(data.totalMinutes / 60)} HEURES CE MOIS`, leftCx, 668);

    ctx.textAlign = 'left';
    ctx.font = '500 20px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fillText('Nexora-Music · disponible sur Jux-Store', pad, H - 50);

    // Colonne droite : 3 cartes empilées
    const rightX = leftW + 24;
    const rightW = W - pad - rightX;
    const gap = 22;
    const cardH = (H - pad * 2 - gap * 2) / 3;
    let cy = pad;

    if (data.topArtist) {
      drawPanel(ctx, rightX, cy, rightW, cardH);
      const tcx = rightX + 44;
      ctx.textAlign = 'left';
      ctx.font = '700 20px system-ui, sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.fillText('ARTISTE PRÉFÉRÉ', tcx, cy + 46);
      const a = data.topArtist.length > 22 ? data.topArtist.slice(0, 22) + '…' : data.topArtist;
      ctx.shadowColor = 'rgba(249,168,212,0.85)';
      ctx.shadowBlur = 24;
      ctx.font = '800 44px system-ui, sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(a, tcx, cy + 98);
      ctx.shadowBlur = 0;
      ctx.font = '600 18px system-ui, sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.fillText(`${data.topArtistCount} écoutes`, tcx, cy + 130);
      cy += cardH + gap;
    }

    if (data.topGenre) {
      drawPanel(ctx, rightX, cy, rightW, cardH);
      const tcx = rightX + 44;
      ctx.textAlign = 'left';
      ctx.font = '700 20px system-ui, sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.fillText('GENRE FAVORI', tcx, cy + 46);
      ctx.shadowColor = 'rgba(252,211,77,0.85)';
      ctx.shadowBlur = 24;
      ctx.font = '800 44px system-ui, sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(data.topGenre, tcx, cy + 98);
      ctx.shadowBlur = 0;
      ctx.font = '600 18px system-ui, sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.fillText(`${data.topGenreCount} écoutes`, tcx, cy + 130);
      cy += cardH + gap;
    }

    if (topSong) {
      drawPanel(ctx, rightX, cy, rightW, cardH);
      const coverSize = cardH - 40;
      if (coverImg) {
        const rx = rightX + 20;
        const ry = cy + 20;
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(rx, ry, coverSize, coverSize, 18);
        ctx.clip();
        ctx.drawImage(coverImg, rx, ry, coverSize, coverSize);
        ctx.restore();
      }
      const tcx = rightX + 20 + (coverImg ? coverSize + 28 : 0);
      ctx.textAlign = 'left';
      ctx.font = '700 20px system-ui, sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.fillText('TOP TITRE', tcx, cy + 44);
      const t = topSong.song.title.length > 18 ? topSong.song.title.slice(0, 18) + '…' : topSong.song.title;
      ctx.shadowColor = 'rgba(240,171,252,0.8)';
      ctx.shadowBlur = 22;
      ctx.font = '800 32px system-ui, sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(t, tcx, cy + 88);
      ctx.shadowBlur = 0;
      ctx.font = '500 20px system-ui, sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.fillText(topSong.song.author, tcx, cy + 118);
    }
  }

  return canvas;
}

export default function Wrapped() {
  const navigate = useNavigate();
  const { profile, user } = useAuth();
  const [data, setData] = useState<WrappedData | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [sharingStory, setSharingStory] = useState(false);
  const [slideIndex, setSlideIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const [progress, setProgress] = useState(0);
  const progressRef = useRef(0);
  const intervalRef = useRef<number | null>(null);
  const prefersReducedMotion = useMemo(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  );

  const monthLabel = new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

  useEffect(() => {
    const authId = pb.authStore.model?.id;
    if (!authId) return;

    (async () => {
      try {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const startStr = startOfMonth.toISOString().replace('T', ' ');
        const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const prevMonthEnd = startOfMonth;

        const historyItems = await pb.collection('listen_history').getFullList({
          filter: `user_id = "${authId}" && listened_at >= "${startStr}"`,
          requestKey: null,
        });

        let prevMonthTotal = 0;
        try {
          const prevRes = await pb.collection('listen_history').getList(1, 1, {
            filter: `user_id = "${authId}" && listened_at >= "${prevMonthStart.toISOString().replace('T', ' ')}" && listened_at < "${prevMonthEnd.toISOString().replace('T', ' ')}"`,
            requestKey: null,
          });
          prevMonthTotal = prevRes.totalItems;
        } catch { /* comparaison optionnelle */ }

        const counts = new Map<string, number>();
        historyItems.forEach((h: any) => {
          if (h.song_id) counts.set(h.song_id, (counts.get(h.song_id) ?? 0) + 1);
        });

        const songIds = [...counts.keys()];
        let topSongs: Array<{ song: Song; count: number }> = [];
        let topGenre: string | null = null;
        let topArtist: string | null = null;
        let topArtistCount = 0;
        let topGenreCount = 0;
        let totalMinutes = 0;
        let archetype: ArchetypeKey | null = null;

        if (songIds.length > 0) {
          const songsList: Song[] = [];
          for (let i = 0; i < songIds.length; i += 50) {
            const batch = songIds.slice(i, i + 50);
            const filters = batch.map((id: string) => `id = "${id}"`).join(' || ');
            const res = await pb.collection('songs').getList(1, 50, { filter: filters, requestKey: null });
            songsList.push(...res.items.map(recordToSong));
          }
          const songsMap = new Map(songsList.map((s) => [s.id, s]));

          topSongs = [...counts.entries()]
            .map(([id, count]) => ({ song: songsMap.get(id), count }))
            .filter((x) => x.song)
            .sort((a, b) => b.count - a.count)
            .slice(0, 5) as Array<{ song: Song; count: number }>;

          const genreCount = new Map<string, number>();
          const artistCount = new Map<string, number>();
          let totalSeconds = 0;
          let nightListens = 0;
          historyItems.forEach((h: any) => {
            const song = songsMap.get(h.song_id);
            if (song?.genre) genreCount.set(song.genre, (genreCount.get(song.genre) ?? 0) + 1);
            if (song?.author) artistCount.set(song.author, (artistCount.get(song.author) ?? 0) + 1);
            totalSeconds += song?.duration || 210;
            if (h.listened_at) {
              const hour = new Date(h.listened_at).getHours();
              if (hour >= 22 || hour < 5) nightListens++;
            }
          });
          totalMinutes = Math.round(totalSeconds / 60);
          const topGenreEntry = genreCount.size > 0 ? [...genreCount.entries()].sort((a, b) => b[1] - a[1])[0] : null;
          const topArtistEntry = artistCount.size > 0 ? [...artistCount.entries()].sort((a, b) => b[1] - a[1])[0] : null;
          topGenre = topGenreEntry ? topGenreEntry[0] : null;
          topGenreCount = topGenreEntry ? topGenreEntry[1] : 0;
          topArtist = topArtistEntry ? topArtistEntry[0] : null;
          topArtistCount = topArtistEntry ? topArtistEntry[1] : 0;

          if (historyItems.length >= 3) {
            const topArtistShare = topArtist ? (artistCount.get(topArtist) ?? 0) / historyItems.length : 0;
            if (topArtistShare > 0.4) archetype = 'fidele';
            else if (genreCount.size >= 5) archetype = 'explorateur';
            else if (nightListens / historyItems.length > 0.3) archetype = 'noctambule';
            else archetype = 'melomane';
          }
        }

        const dayCounts = new Array(7).fill(0);
        historyItems.forEach((h: any) => {
          if (h.listened_at) dayCounts[new Date(h.listened_at).getDay()]++;
        });
        const maxDayCount = Math.max(...dayCounts);
        const mostActiveDay = maxDayCount > 0 ? DAYS[dayCounts.indexOf(maxDayCount)] : null;

        setData({
          totalListens: historyItems.length,
          uniqueSongs: songIds.length,
          topSongs,
          topGenre,
          topArtist,
          topArtistCount,
          topGenreCount,
          totalMinutes,
          prevMonthTotal,
          mostActiveDay,
          archetype,
        });
      } catch (err) {
        console.error('Wrapped fetch error:', err);
        setData({
          totalListens: 0, uniqueSongs: 0, topSongs: [], topGenre: null, topArtist: null,
          topArtistCount: 0, topGenreCount: 0,
          totalMinutes: 0, prevMonthTotal: 0, mostActiveDay: null, archetype: null,
        });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const pseudo = profile?.pseudo || 'Musicien';

  const slides = useMemo(() => {
    if (!data) return [];
    const list: Array<{ id: string; bg: string; bgStyle?: CSSProperties; autoAdvance: boolean; content: JSX.Element }> = [];

    list.push({
      id: 'intro',
      bg: '',
      bgStyle: { background: PALETTE.violet.bg },
      autoAdvance: true,
      content: (
        <HeroSlide
          glow={PALETTE.violet.glow}
          hero={pseudo}
          heroClassName="text-5xl"
          caption="TON MOIS EN MUSIQUE"
          pill={<><Sparkles className="h-3.5 w-3.5" /><span className="capitalize">{monthLabel}</span></>}
        />
      ),
    });

    list.push({
      id: 'total',
      bg: '',
      bgStyle: { background: PALETTE.blue.bg },
      autoAdvance: true,
      content: (
        <HeroSlide
          glow={PALETTE.blue.glow}
          hero={<CountUp value={data.totalListens} />}
          heroClassName="text-[7.5rem]"
          caption="ÉCOUTES"
          pill={<><Clock className="h-3.5 w-3.5" /><span>{Math.round(data.totalMinutes / 60)} HEURES</span></>}
        />
      ),
    });

    if (data.prevMonthTotal > 0) {
      const diff = Math.round(((data.totalListens - data.prevMonthTotal) / data.prevMonthTotal) * 100);
      const up = diff >= 0;
      const palette = up ? PALETTE.teal : PALETTE.orange;
      list.push({
        id: 'comparison',
        bg: '',
        bgStyle: { background: palette.bg },
        autoAdvance: true,
        content: (
          <HeroSlide
            glow={palette.glow}
            hero={`${up ? '+' : ''}${diff}%`}
            heroClassName="text-8xl"
            caption="VS LE MOIS DERNIER"
            pill={<span>{up ? 'En hausse 🔥' : 'En baisse'} · {data.totalListens} vs {data.prevMonthTotal}</span>}
          />
        ),
      });
    }

    if (data.topArtist) {
      list.push({
        id: 'artist',
        bg: '',
        bgStyle: { background: PALETTE.rose.bg },
        autoAdvance: true,
        content: (
          <HeroSlide
            glow={PALETTE.rose.glow}
            hero={data.topArtist}
            heroClassName="text-5xl break-words"
            caption="ARTISTE PRÉFÉRÉ"
            pill={<><Trophy className="h-3.5 w-3.5" /><span>{data.topArtistCount} écoutes</span></>}
          />
        ),
      });
    }

    if (data.topGenre) {
      list.push({
        id: 'genre',
        bg: '',
        bgStyle: { background: PALETTE.amber.bg },
        autoAdvance: true,
        content: (
          <HeroSlide
            glow={PALETTE.amber.glow}
            hero={data.topGenre}
            heroClassName="text-6xl"
            caption="GENRE FAVORI"
            pill={<><Heart className="h-3.5 w-3.5" /><span>{data.topGenreCount} écoutes</span></>}
          />
        ),
      });
    }

    if (data.topSongs[0]) {
      const top = data.topSongs[0];
      list.push({
        id: 'song',
        bg: '',
        bgStyle: { background: PALETTE.fuchsia.bg },
        autoAdvance: true,
        content: (
          <div className="flex h-full flex-col items-center justify-center text-center px-8">
            <motion.p {...fadeUp} className="text-sm uppercase tracking-widest text-white/50 mb-6">
              Ton titre le plus écouté
            </motion.p>
            <motion.img
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.45, ease: EASE, delay: 0.05 }}
              src={songCoverUrl(top.song)}
              alt=""
              className="h-52 w-52 rounded-2xl object-cover shadow-2xl shadow-black/60 ring-1 ring-white/10"
            />
            <motion.h2
              {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.15 }}
              className="text-3xl font-extrabold tracking-tight text-white mt-6"
              style={{ textShadow: PALETTE.fuchsia.glow }}
            >
              {top.song.title}
            </motion.h2>
            <motion.p {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.2 }} className="text-white/60 mt-1">
              {top.song.author}
            </motion.p>
            <motion.div
              {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.28 }}
              className="mt-6 flex items-center gap-1.5 rounded-full bg-white/15 backdrop-blur-md px-4 py-1.5 text-xs font-semibold tracking-wide text-white/90 ring-1 ring-white/10"
            >
              <span>{top.count} ÉCOUTES</span>
            </motion.div>
          </div>
        ),
      });
    }

    if (data.topSongs.length > 0) {
      list.push({
        id: 'top5',
        bg: '',
        bgStyle: { background: PALETTE.slate.bg },
        autoAdvance: true,
        content: (
          <div className="flex h-full flex-col items-center justify-center px-8">
            <motion.p {...fadeUp} className="text-sm uppercase tracking-widest text-white/50 mb-6 text-center">
              Ton top titres
            </motion.p>
            <div className="w-full max-w-sm space-y-3">
              {data.topSongs.map(({ song, count }, i) => (
                <motion.div
                  key={song.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, ease: EASE, delay: (data.topSongs.length - 1 - i) * 0.08 }}
                  className="flex items-center gap-3 rounded-xl bg-white/5 p-2 ring-1 ring-white/10"
                >
                  <span className="w-6 text-center font-bold text-white/50">{i + 1}</span>
                  <img src={songCoverUrl(song)} alt="" className="h-11 w-11 rounded-lg object-cover" />
                  <div className="min-w-0 flex-1 text-left">
                    <p className="text-sm font-semibold text-white truncate">{song.title}</p>
                    <p className="text-xs text-white/50 truncate">{song.author}</p>
                  </div>
                  <span className="text-xs text-white/40">{count}×</span>
                </motion.div>
              ))}
            </div>
          </div>
        ),
      });
    }

    if (data.archetype) {
      const arch = ARCHETYPES[data.archetype];
      list.push({
        id: 'archetype',
        bg: '',
        bgStyle: { background: PALETTE.cyan.bg },
        autoAdvance: true,
        content: (
          <HeroSlide
            eyebrow="TON PROFIL D'AUDITEUR"
            glow={PALETTE.cyan.glow}
            hero={arch.label}
            heroClassName="text-6xl"
            pill={data.mostActiveDay ? <><CalendarDays className="h-3.5 w-3.5" /><span>Jour le plus actif : {data.mostActiveDay}</span></> : undefined}
            extra={
              <motion.p {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.2 }} className="text-white/60 mt-4 max-w-xs text-sm">
                {arch.desc(data)}
              </motion.p>
            }
          />
        ),
      });
    }

    list.push({
      id: 'share',
      bg: '',
      bgStyle: { background: 'linear-gradient(135deg, #1b0a35 0%, #2a0f5e 50%, #000000 100%)' },
      autoAdvance: false,
      content: (
        <ShareSlide
          data={data} pseudo={pseudo} monthLabel={monthLabel} userId={user?.id}
          downloading={downloading} setDownloading={setDownloading}
          sharingStory={sharingStory} setSharingStory={setSharingStory}
        />
      ),
    });

    return list;
  }, [data, pseudo, monthLabel, downloading, sharingStory, user?.id]);

  const AUTO_MS = 5500;

  const goNext = useCallback(() => {
    setDirection(1);
    setSlideIndex((i) => Math.min(i + 1, slides.length - 1));
  }, [slides.length]);

  const goPrev = useCallback(() => {
    setDirection(-1);
    setSlideIndex((i) => Math.max(i - 1, 0));
  }, []);

  useEffect(() => {
    if (!slides.length) return;
    const current = slides[slideIndex];
    progressRef.current = 0;
    setProgress(0);
    if (!current?.autoAdvance) return;

    const step = 100;
    intervalRef.current = window.setInterval(() => {
      progressRef.current += step;
      setProgress(progressRef.current);
      if (progressRef.current >= AUTO_MS) {
        if (intervalRef.current) clearInterval(intervalRef.current);
        if (slideIndex < slides.length - 1) goNext();
      }
    }, step);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [slideIndex, slides, goNext]);

  const handleTap = useCallback((info: TapInfo, containerWidth: number) => {
    const x = info.point.x;
    if (x < containerWidth * 0.35) goPrev();
    else if (x > containerWidth * 0.65) goNext();
  }, [goNext, goPrev]);

  const handleDragEnd = useCallback((_e: any, info: PanInfo) => {
    if (info.offset.x < -80 || info.velocity.x < -500) goNext();
    else if (info.offset.x > 80 || info.velocity.x > 500) goPrev();
  }, [goNext, goPrev]);

  if (loading) return <div className="p-8 text-center">Calcul de ton wrapped...</div>;

  if (!data || data.totalListens === 0) {
    return (
      <div className="relative min-h-screen p-4">
        <header className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate(-1)} className="text-white/70"><X className="h-6 w-6" /></button>
          <h1 className="text-xl font-bold">Mon Wrapped</h1>
        </header>
        <p className="text-center text-muted-foreground mt-20">Pas assez d'écoutes ce mois-ci pour générer ton Wrapped.</p>
      </div>
    );
  }

  const current = slides[slideIndex];

  return (
    <div className="fixed inset-0 z-50 overflow-hidden select-none bg-black">
      {/* Fond : un calque fixe par slide, jamais déplacé — seule sa couleur fait un fondu. */}
      <AnimatePresence>
        <motion.div
          key={slideIndex}
          className={cn('absolute inset-0', current.bg)}
          style={current.bgStyle}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={prefersReducedMotion ? { duration: 0.15 } : { duration: 0.5, ease: 'easeInOut' }}
        />
      </AnimatePresence>

      {/* Contenu : seul calque qui suit le geste, indépendant du fond. */}
      <AnimatePresence initial={false} custom={direction} mode="popLayout">
        <motion.div
          key={slideIndex}
          custom={direction}
          initial={prefersReducedMotion ? { opacity: 0 } : { x: direction > 0 ? 48 : -48, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={prefersReducedMotion ? { opacity: 0 } : { x: direction > 0 ? -48 : 48, opacity: 0 }}
          transition={prefersReducedMotion ? { duration: 0.15 } : { type: 'spring', bounce: 0, duration: 0.4 }}
          drag={current.id === 'share' ? false : 'x'}
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.15}
          onDragEnd={current.id === 'share' ? undefined : handleDragEnd}
          onTap={(_e, info) => { if (current.id !== 'share') handleTap(info, window.innerWidth); }}
          className="absolute inset-0"
        >
          {current.content}
        </motion.div>
      </AnimatePresence>

      {/* Barres de progression segmentées */}
      <div className="absolute left-0 right-0 top-3 z-10 flex gap-1 px-3 pointer-events-none">
        {slides.map((_, i) => (
          <div key={i} className="h-1 flex-1 rounded-full bg-white/20 backdrop-blur-sm overflow-hidden">
            <div
              className="h-full w-full origin-left rounded-full bg-white transition-transform duration-100 ease-linear"
              style={{
                transform: `scaleX(${i === slideIndex ? progress / AUTO_MS : i < slideIndex ? 1 : 0})`,
              }}
            />
          </div>
        ))}
      </div>

      <button
        onClick={() => navigate(-1)}
        className="absolute right-4 top-8 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white/90 backdrop-blur-md ring-1 ring-white/10 transition-transform duration-100 active:scale-90"
      >
        <X className="h-5 w-5" />
      </button>
    </div>
  );
}

function ShareSlide({
  data, pseudo, monthLabel, userId, downloading, setDownloading, sharingStory, setSharingStory,
}: {
  data: WrappedData; pseudo: string; monthLabel: string; userId?: string;
  downloading: boolean; setDownloading: (v: boolean) => void;
  sharingStory: boolean; setSharingStory: (v: boolean) => void;
}) {
  const topSong = data.topSongs[0];
  const [orientation, setOrientation] = useState<ShareOrientation>('portrait');

  const handleShareToStory = async () => {
    if (!topSong || !userId) {
      toast.error('Impossible de partager : aucun titre disponible.');
      return;
    }
    setSharingStory(true);
    try {
      const canvas = await buildShareCanvas(data, pseudo, monthLabel);
      const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/png'));
      if (!blob) throw new Error('Génération de l\'image impossible');

      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      const formData = new FormData();
      formData.append('user_id', userId);
      formData.append('song_id', topSong.song.id);
      formData.append('comment', `Mon Wrapped ${monthLabel} 🎧`);
      formData.append('expires_at', expiresAt);
      formData.append('image', blob, 'wrapped.png');

      await pb.collection('stories').create(formData);
      toast.success('Wrapped partagé dans tes stories !');
    } catch (err: any) {
      toast.error(err?.message || 'Erreur lors du partage en story');
    }
    setSharingStory(false);
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const canvas = await buildShareCanvas(data, pseudo, monthLabel, orientation);
      const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/png'));
      if (!blob) throw new Error('Génération de l\'image impossible');

      const file = new File([blob], `jux-wrapped-${orientation}-${new Date().getFullYear()}.png`, { type: 'image/png' });

      // Partage natif (WhatsApp, Instagram, Snap, etc.) si disponible
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'Mon Wrapped Jux',
          text: `Mon résumé musical ${monthLabel} sur Jux 🎧`,
        });
        setDownloading(false);
        return;
      }

      // Sinon, téléchargement classique
      const link = document.createElement('a');
      link.download = file.name;
      link.href = URL.createObjectURL(blob);
      link.click();
      URL.revokeObjectURL(link.href);
      toast.success('Carte téléchargée !');
    } catch (err: any) {
      if (err?.name !== 'AbortError') toast.error('Erreur lors du téléchargement');
    }
    setDownloading(false);
  };

  return (
    <div className="flex h-full flex-col items-center justify-center px-8">
      <motion.div {...fadeUp}>
        <Sparkles className="h-11 w-11 mb-6 text-violet-300" style={{ filter: 'drop-shadow(0 0 20px rgba(196,181,253,0.7))' }} />
      </motion.div>
      <motion.h2
        {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.08 }}
        className="text-4xl font-extrabold tracking-tight text-white text-center"
        style={{ textShadow: PALETTE.violet.glow }}
      >
        C'est tout !
      </motion.h2>
      <motion.p {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.16 }} className="text-white/60 text-center mt-3 mb-10">
        Partage ton Wrapped avec tes amis.
      </motion.p>

      <motion.div {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.24 }} className="w-full max-w-xs space-y-3">
        <button
          onClick={(e) => { e.stopPropagation(); handleShareToStory(); }}
          disabled={sharingStory || !topSong}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-white text-black font-semibold py-3 transition-transform duration-100 active:scale-[0.97] disabled:opacity-60 disabled:active:scale-100"
        >
          <Share2 className="h-4 w-4" />
          {sharingStory ? 'Publication…' : 'Partager en story Jux'}
        </button>

        <div
          onClick={(e) => e.stopPropagation()}
          className="flex items-center justify-center gap-1 rounded-xl bg-white/5 p-1 ring-1 ring-white/10"
        >
          <button
            onClick={() => setOrientation('portrait')}
            className={cn(
              'flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-colors',
              orientation === 'portrait' ? 'bg-white/15 text-white' : 'text-white/50',
            )}
          >
            <RectangleVertical className="h-3.5 w-3.5" /> Portrait
          </button>
          <button
            onClick={() => setOrientation('landscape')}
            className={cn(
              'flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-colors',
              orientation === 'landscape' ? 'bg-white/15 text-white' : 'text-white/50',
            )}
          >
            <RectangleHorizontal className="h-3.5 w-3.5" /> Paysage
          </button>
        </div>

        <button
          onClick={(e) => { e.stopPropagation(); handleDownload(); }}
          disabled={downloading}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-white/10 text-white font-semibold py-3 ring-1 ring-white/15 backdrop-blur-md transition-transform duration-100 active:scale-[0.97] disabled:opacity-60 disabled:active:scale-100"
        >
          <Download className="h-4 w-4" />
          {downloading ? 'Génération…' : 'Télécharger l\'image'}
        </button>
      </motion.div>
    </div>
  );
}
