import { cn } from '@/lib/utils';

// Mosaïque 2x2 avec fondu réel entre covers voisines : chaque image déborde
// légèrement sur le centre et se superpose aux autres. TL reste opaque (base).
// TR et BL se fondent dans TL sur leur bord commun (mask-image en dégradé).
// BR, au-dessus de tout, se fond en diagonale dans TR/BL/TL au centre.
// Résultat : à chaque jointure on voit un vrai mélange des pixels des deux
// covers adjacentes, pas un fondu vers le fond de la carte.
const SIZE = '62%';

export default function PlaylistCoverMosaic({ covers, className }: { covers: string[]; className?: string }) {
  if (covers.length >= 4) {
    return (
      <div className={cn('relative h-full w-full overflow-hidden', className)}>
        {/* Top-left : base opaque, aucun fondu */}
        <div className="absolute" style={{ top: 0, left: 0, width: SIZE, height: SIZE }}>
          <img src={covers[0]} alt="" className="h-full w-full object-cover" />
        </div>
        {/* Top-right : se fond dans TL (gauche) et dans BR (bas). Deux dégradés linéaires
            combinés en intersection (et non un radial-gradient) pour rester correct
            quel que soit le ratio largeur/hauteur de la tuile (carré ou bandeau large). */}
        <div
          className="absolute"
          style={{
            top: 0, right: 0, width: SIZE, height: SIZE,
            WebkitMaskImage: 'linear-gradient(to right, transparent 0%, black 32%), linear-gradient(to top, transparent 0%, black 32%)',
            maskImage: 'linear-gradient(to right, transparent 0%, black 32%), linear-gradient(to top, transparent 0%, black 32%)',
            WebkitMaskComposite: 'source-in',
            maskComposite: 'intersect',
          }}
        >
          <img src={covers[1]} alt="" className="h-full w-full object-cover" />
        </div>
        {/* Bottom-left : se fond dans TL (haut) et dans BR (droite), même technique. */}
        <div
          className="absolute"
          style={{
            bottom: 0, left: 0, width: SIZE, height: SIZE,
            WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 32%), linear-gradient(to left, transparent 0%, black 32%)',
            maskImage: 'linear-gradient(to bottom, transparent 0%, black 32%), linear-gradient(to left, transparent 0%, black 32%)',
            WebkitMaskComposite: 'source-in',
            maskComposite: 'intersect',
          }}
        >
          <img src={covers[2]} alt="" className="h-full w-full object-cover" />
        </div>
        {/* Bottom-right : au-dessus de tout, se fond vers le centre (haut + gauche). */}
        <div
          className="absolute"
          style={{
            bottom: 0, right: 0, width: SIZE, height: SIZE,
            WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 32%), linear-gradient(to right, transparent 0%, black 32%)',
            maskImage: 'linear-gradient(to bottom, transparent 0%, black 32%), linear-gradient(to right, transparent 0%, black 32%)',
            WebkitMaskComposite: 'source-in',
            maskComposite: 'intersect',
          }}
        >
          <img src={covers[3]} alt="" className="h-full w-full object-cover" />
        </div>
      </div>
    );
  }
  if (covers.length > 0) {
    return <img src={covers[0]} alt="" className={cn('h-full w-full object-cover', className)} />;
  }
  return null;
}
