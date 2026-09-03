import { Music2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { MusicLayout } from '@/lib/storyLayout';

interface Props {
  title: string;
  author: string;
  coverUrl?: string | null;
  layout: MusicLayout;
  /** Largeur réelle du canvas 9:16 en px — sert à dimensionner le texte. */
  canvasWidth: number;
  className?: string;
}

/**
 * Widget musique posé sur une story. Utilisé à l'identique par l'éditeur
 * (page CreateStory) et par le viewer, pour que l'aperçu corresponde exactement
 * au résultat publié.
 *
 * Toutes les tailles internes sont des fractions de la largeur du widget : quand
 * on le redimensionne, le texte et la pochette suivent, comme attendu d'un
 * pincement. La hauteur n'est jamais imposée — un titre long passe sur deux lignes.
 */
export default function StoryMusicWidget({ title, author, coverUrl, layout, canvasWidth, className }: Props) {
  const u = canvasWidth * layout.w; // largeur du widget en px
  const hasCover = !!coverUrl && coverUrl !== '/placeholder.svg';

  const wrapper = {
    position: 'absolute' as const,
    left: `${layout.x * 100}%`,
    top: `${layout.y * 100}%`,
    width: `${layout.w * 100}%`,
    transform: `translate(-50%, -50%) rotate(${layout.rot}deg)`,
  };

  if (layout.variant === 'cover') {
    return (
      <div style={wrapper} className={className}>
        <div className="flex flex-col items-center" style={{ gap: u * 0.05 }}>
          {hasCover ? (
            <img
              src={coverUrl!}
              alt=""
              className="w-full object-cover shadow-2xl shadow-black/50 ring-1 ring-white/[0.12]"
              style={{ aspectRatio: '1 / 1', borderRadius: u * 0.09 }}
            />
          ) : (
            <div
              className="flex w-full items-center justify-center bg-white/10 ring-1 ring-white/[0.12]"
              style={{ aspectRatio: '1 / 1', borderRadius: u * 0.09 }}
            >
              <Music2 style={{ width: u * 0.3, height: u * 0.3 }} className="text-white/50" />
            </div>
          )}
          <div className="w-full text-center text-white" style={{ paddingInline: u * 0.04 }}>
            <p className="font-bold leading-tight drop-shadow-lg" style={{ fontSize: u * 0.095 }}>{title}</p>
            <p className="leading-tight text-white/70 drop-shadow" style={{ fontSize: u * 0.075, marginTop: u * 0.015 }}>{author}</p>
          </div>
        </div>
      </div>
    );
  }

  if (layout.variant === 'card') {
    return (
      <div style={wrapper} className={className}>
        <div
          className="flex items-center bg-black/45 backdrop-blur-md ring-1 ring-white/10"
          style={{ gap: u * 0.05, padding: u * 0.045, borderRadius: u * 0.1 }}
        >
          <div
            className="flex flex-shrink-0 items-center justify-center overflow-hidden bg-white/10"
            style={{ width: u * 0.2, height: u * 0.2, borderRadius: u * 0.055 }}
          >
            {hasCover
              ? <img src={coverUrl!} alt="" className="h-full w-full object-cover" />
              : <Music2 style={{ width: u * 0.1, height: u * 0.1 }} className="text-white/60" />}
          </div>
          <div className="min-w-0 flex-1 text-white">
            <p className="truncate font-bold leading-tight" style={{ fontSize: u * 0.085 }}>{title}</p>
            <p className="truncate leading-tight text-white/65" style={{ fontSize: u * 0.068, marginTop: u * 0.012 }}>{author}</p>
          </div>
        </div>
      </div>
    );
  }

  // chip — le rendu historique : une pastille compacte
  return (
    <div style={wrapper} className={className}>
      <div
        className={cn('flex items-center justify-center bg-black/45 backdrop-blur-md ring-1 ring-white/10')}
        style={{ gap: u * 0.04, paddingInline: u * 0.06, paddingBlock: u * 0.04, borderRadius: 9999 }}
      >
        {hasCover ? (
          <img
            src={coverUrl!}
            alt=""
            className="flex-shrink-0 rounded-full object-cover"
            style={{ width: u * 0.11, height: u * 0.11 }}
          />
        ) : (
          <Music2 style={{ width: u * 0.075, height: u * 0.075 }} className="flex-shrink-0 text-white/80" />
        )}
        <span
          className="truncate font-semibold text-white/95"
          style={{ fontSize: u * 0.062 }}
        >
          {title} — {author}
        </span>
      </div>
    </div>
  );
}
