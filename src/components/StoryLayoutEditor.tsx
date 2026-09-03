import { useCallback, useEffect, useRef, useState } from 'react';
import { RotateCcw, Move } from 'lucide-react';
import { cn } from '@/lib/utils';
import StoryMusicWidget from '@/components/StoryMusicWidget';
import {
  clampMusicLayout,
  DEFAULT_MUSIC_LAYOUT,
  type MusicLayout,
  type MusicVariant,
} from '@/lib/storyLayout';

interface Props {
  /** Image de fond choisie par l'utilisateur (objectURL), sinon la pochette floutée sert de fond. */
  imageUrl: string | null;
  coverUrl: string | null;
  title: string;
  author: string;
  layout: MusicLayout;
  onChange: (l: MusicLayout) => void;
  /** Hauteur du canvas ; la largeur en découle (9:16). */
  heightCss?: string;
}

const VARIANT_LABELS: Record<MusicVariant, string> = {
  chip: 'Pastille',
  card: 'Carte',
  cover: 'Pochette',
};

type Gesture =
  | { mode: 'move'; rect: DOMRect; pointerX: number; pointerY: number; start: MusicLayout }
  | { mode: 'transform'; rect: DOMRect; dist: number; angle: number; start: MusicLayout };

const dist = (ax: number, ay: number, bx: number, by: number) => Math.hypot(bx - ax, by - ay);
const angleDeg = (ax: number, ay: number, bx: number, by: number) =>
  (Math.atan2(by - ay, bx - ax) * 180) / Math.PI;

/** Ramène une rotation dans [-180, 180] pour éviter l'accumulation sur plusieurs gestes. */
const normalizeRot = (deg: number) => ((((deg + 180) % 360) + 360) % 360) - 180;

/** Largeur de la zone d'aimantation, en degrés de part et d'autre de l'angle droit. */
const SNAP_DEGREES = 7;

/**
 * Aimante la rotation sur le multiple de 90° le plus proche. Sans ça, remettre
 * le widget parfaitement droit au doigt est quasi impossible : on tombe toujours
 * à 1 ou 2 degrés près, et ça se voit.
 */
const snapRot = (deg: number) => {
  const n = normalizeRot(deg);
  const nearest = Math.round(n / 90) * 90;
  return Math.abs(n - nearest) <= SNAP_DEGREES ? normalizeRot(nearest) : n;
};

/** Vrai quand la valeur affichée est le résultat d'une aimantation (pour le retour visuel). */
const isSnapped = (deg: number) => Math.abs(normalizeRot(deg) % 90) < 0.001;

/** Repères d'alignement : centre horizontal, et haut / centre / bas sur la verticale. */
const SNAP_X = [0.5];
const SNAP_Y = [0.15, 0.5, 0.85];

/** Rayon d'aimantation en pixels écran — converti par axe, le canvas n'étant pas carré. */
const SNAP_PX = 9;

/** Colle `v` sur la cible la plus proche si elle est dans le rayon, sinon laisse libre. */
const snapTo = (v: number, targets: number[], threshold: number) => {
  let best = v;
  let bestDist = threshold;
  for (const t of targets) {
    const d = Math.abs(v - t);
    if (d <= bestDist) { best = t; bestDist = d; }
  }
  return best;
};

const onTarget = (v: number, targets: number[]) => targets.some((t) => Math.abs(v - t) < 0.0001);

export default function StoryLayoutEditor({
  imageUrl,
  coverUrl,
  title,
  author,
  layout,
  onChange,
  heightCss = '42vh',
}: Props) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [canvasWidth, setCanvasWidth] = useState(0);

  // Les repères d'alignement ne s'affichent que pendant un geste : sinon la ligne
  // de centrage resterait visible en permanence, le layout par défaut étant centré.
  const [gesturing, setGesturing] = useState(false);

  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<Gesture | null>(null);
  const layoutRef = useRef(layout);
  useEffect(() => { layoutRef.current = layout; }, [layout]);

  // Le texte du widget est dimensionné en px à partir de la largeur du canvas :
  // il faut donc la mesurer, elle dépend de la hauteur de viewport.
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const measure = () => setCanvasWidth(el.getBoundingClientRect().width);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const centerPx = (rect: DOMRect, l: MusicLayout) => ({
    cx: rect.left + l.x * rect.width,
    cy: rect.top + l.y * rect.height,
  });

  const beginGesture = useCallback(() => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const pts = [...pointers.current.values()];
    const start = { ...layoutRef.current };

    if (pts.length >= 2) {
      gesture.current = {
        mode: 'transform',
        rect,
        dist: dist(pts[0].x, pts[0].y, pts[1].x, pts[1].y),
        angle: angleDeg(pts[0].x, pts[0].y, pts[1].x, pts[1].y),
        start,
      };
    } else if (pts.length === 1) {
      gesture.current = { mode: 'move', rect, pointerX: pts[0].x, pointerY: pts[0].y, start };
    } else {
      gesture.current = null;
    }
  }, []);

  const onWidgetPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    setGesturing(true);
    beginGesture();
  };

  const onWidgetPointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gesture.current;
    if (!g) return;

    if (g.mode === 'move') {
      const dx = (e.clientX - g.pointerX) / g.rect.width;
      const dy = (e.clientY - g.pointerY) / g.rect.height;
      onChange(clampMusicLayout({
        ...g.start,
        x: snapTo(g.start.x + dx, SNAP_X, SNAP_PX / g.rect.width),
        y: snapTo(g.start.y + dy, SNAP_Y, SNAP_PX / g.rect.height),
      }));
      return;
    }

    const pts = [...pointers.current.values()];
    if (pts.length < 2) return;
    const d = dist(pts[0].x, pts[0].y, pts[1].x, pts[1].y);
    const a = angleDeg(pts[0].x, pts[0].y, pts[1].x, pts[1].y);
    onChange(clampMusicLayout({
      ...g.start,
      w: g.start.w * (d / (g.dist || 1)),
      rot: snapRot(g.start.rot + (a - g.angle)),
    }));
  };

  const endPointer = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size === 0) setGesturing(false);
    // Un doigt levé pendant un pincement : on redémarre proprement un déplacement
    // avec le doigt restant, sinon le widget saute.
    beginGesture();
  };

  // Poignée coin bas-droit : redimensionne ET tourne d'un seul geste (utilisable à la souris).
  const onHandlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    (e.target as Element).setPointerCapture?.(e.pointerId);

    const start = { ...layoutRef.current };
    const { cx, cy } = centerPx(rect, start);
    const startDist = dist(cx, cy, e.clientX, e.clientY) || 1;
    const startAngle = angleDeg(cx, cy, e.clientX, e.clientY);

    const move = (ev: PointerEvent) => {
      const d = dist(cx, cy, ev.clientX, ev.clientY);
      const a = angleDeg(cx, cy, ev.clientX, ev.clientY);
      onChange(clampMusicLayout({
        ...start,
        w: start.w * (d / startDist),
        rot: snapRot(start.rot + (a - startAngle)),
      }));
    };
    const up = () => {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
      document.removeEventListener('pointercancel', up);
    };
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up);
    document.addEventListener('pointercancel', up);
  };

  const hasCover = !!coverUrl && coverUrl !== '/placeholder.svg';

  return (
    <div className="space-y-3">
      <div
        ref={canvasRef}
        className="relative mx-auto overflow-hidden rounded-2xl bg-black ring-1 ring-white/10 touch-none select-none"
        style={{ height: heightCss, width: `calc(${heightCss} * 9 / 16)` }}
      >
        {/* Fond : image choisie, sinon pochette floutée comme le rendu historique */}
        {imageUrl ? (
          <img src={imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
        ) : hasCover ? (
          <>
            <div
              className="absolute inset-0 scale-110 bg-cover bg-center blur-2xl"
              style={{ backgroundImage: `url(${coverUrl})` }}
            />
            <div className="absolute inset-0 bg-black/40" />
          </>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-primary/25 to-black" />
        )}

        {/* Repères d'alignement, visibles seulement pendant un geste et seulement
            sur l'axe réellement aimanté */}
        {gesturing && onTarget(layout.x, SNAP_X) && (
          <div className="pointer-events-none absolute inset-y-0 left-1/2 z-20 w-px -translate-x-1/2 bg-primary/80" />
        )}
        {gesturing && onTarget(layout.y, SNAP_Y) && (
          <div
            className="pointer-events-none absolute inset-x-0 z-20 h-px -translate-y-1/2 bg-primary/80"
            style={{ top: `${layout.y * 100}%` }}
          />
        )}

        {/* Widget manipulable */}
        <div
          onPointerDown={onWidgetPointerDown}
          onPointerMove={onWidgetPointerMove}
          onPointerUp={endPointer}
          onPointerCancel={endPointer}
          className="absolute inset-0"
          style={{ touchAction: 'none' }}
        >
          <StoryMusicWidget
            title={title}
            author={author}
            coverUrl={coverUrl}
            layout={layout}
            canvasWidth={canvasWidth}
            className="cursor-grab active:cursor-grabbing"
          />

          {/* Cadre + poignée, calqués sur la boîte du widget */}
          <div
            className={cn(
              'pointer-events-none absolute rounded-lg ring-1 ring-dashed transition-colors',
              isSnapped(layout.rot) ? 'ring-primary' : 'ring-white/50'
            )}
            style={{
              left: `${layout.x * 100}%`,
              top: `${layout.y * 100}%`,
              width: `${layout.w * 100}%`,
              height: 0,
              transform: `translate(-50%, -50%) rotate(${layout.rot}deg)`,
            }}
          />
          <button
            onPointerDown={onHandlePointerDown}
            aria-label="Redimensionner et pivoter"
            className={cn(
              'absolute z-10 flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full shadow-lg transition-colors',
              isSnapped(layout.rot) ? 'bg-primary text-primary-foreground' : 'bg-white text-black'
            )}
            style={{
              left: `calc(${layout.x * 100}% + ${(layout.w / 2) * 100}%)`,
              top: `${layout.y * 100}%`,
              touchAction: 'none',
            }}
          >
            <Move className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <p className="text-center text-[10px] text-muted-foreground/70">
        Glisse le widget pour le placer · pince ou tire la poignée pour le redimensionner et le pivoter
      </p>

      <div className="flex items-center justify-center gap-2">
        {(Object.keys(VARIANT_LABELS) as MusicVariant[]).map((v) => (
          <button
            key={v}
            onClick={() => onChange({ ...layout, variant: v })}
            className={cn(
              'rounded-lg px-3 py-1.5 text-[11px] font-semibold transition-colors',
              layout.variant === v
                ? 'bg-gradient-primary text-primary-foreground'
                : 'bg-white/[0.06] text-muted-foreground hover:text-foreground'
            )}
          >
            {VARIANT_LABELS[v]}
          </button>
        ))}
        <button
          onClick={() => onChange({ ...DEFAULT_MUSIC_LAYOUT, variant: layout.variant })}
          aria-label="Réinitialiser la position"
          className="rounded-lg bg-white/[0.06] p-1.5 text-muted-foreground hover:text-foreground transition-colors"
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
