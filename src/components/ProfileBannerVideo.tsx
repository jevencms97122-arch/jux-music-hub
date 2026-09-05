import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { useBannerMediaMode } from '@/hooks/useBannerMediaMode';

interface Props {
  url?: string | null;
  className?: string;
}

/** Largeur au-delà de laquelle le média net reste borné plutôt que de s'étirer sur toute la fenêtre. */
const SHARP_MAX_WIDTH = 'max-w-[1500px]';

/**
 * Fond du header de profil : le média personnalisé si l'utilisateur en a
 * choisi un (vidéo .mp4/.webm ou GIF, ex: un lien GIPHY), sinon le halo dégradé
 * par défaut. Utilisé par ProfilePage (son propre profil) et UserProfile (celui
 * des autres) pour un rendu identique.
 *
 * Remplit tout son parent (`position: relative`) plutôt qu'une hauteur fixe —
 * l'appelant l'enveloppe autour de tout ce qui doit apparaître par-dessus
 * (header, identité, rang...) pour que le fond couvre exactement cette zone,
 * quelle que soit sa hauteur réelle (badge présent ou non, bio plus ou moins
 * longue, rang affiché ou pas...).
 *
 * Sur une fenêtre large (desktop), un simple `object-cover` sur toute la
 * largeur "sur-zoome" une vidéo portrait/carrée pour en couvrir la hauteur —
 * l'animation semble étirée, comme les bandes noires qu'on a réglées pour les
 * stories. Même remède ici : une copie floutée et agrandie remplit toute la
 * largeur, et la version nette reste bornée (`max-w-[1500px]`) et centrée
 * par-dessus. Sur mobile, cette largeur borne dépasse déjà celle de l'écran :
 * le rendu ne change pas, il n'y a rien à voir "à côté".
 *
 * Le halo dégradé reste affiché en dessous tant que le média n'a pas fini de
 * charger, pour qu'il n'y ait jamais de zone vide — le média apparaît ensuite
 * en fondu (`fade in`) une fois prêt, au lieu de surgir d'un coup.
 */
export default function ProfileBannerVideo({ url, className }: Props) {
  const { mode, onVideoError, onImageError } = useBannerMediaMode(url);
  const show = !!url && mode !== 'failed';

  const [loaded, setLoaded] = useState(false);
  useEffect(() => { setLoaded(false); }, [url, mode]);

  return (
    <div className={cn('pointer-events-none absolute inset-0 -z-10 overflow-hidden', className)}>
      {/* Halo par défaut, toujours présent en dessous : fond de repli si pas de
          média, et le temps que celui-ci charge (évite tout flash à vide). */}
      <div className="absolute inset-0 h-full w-full bg-gradient-hero" />

      {show && (
        <div
          className={cn('absolute inset-0 transition-opacity duration-700 ease-out', loaded ? 'opacity-100' : 'opacity-0')}
          // Fondu vers la transparence en bas, PAS vers une couleur fixe : le thème
          // choisi par l'utilisateur peut être n'importe quelle couleur/dégradé
          // (`to-background` visait une valeur CSS figée, quasi noire — sur un thème
          // clair ou coloré ça produisait exactement la bande tranchée du screenshot).
          // En fondant tout le bloc en alpha, c'est le vrai fond de la page qui
          // apparaît progressivement dessous, donc toujours raccord, sans deviner sa couleur.
          style={{
            maskImage: 'linear-gradient(to bottom, black 0%, black 65%, transparent 100%)',
            WebkitMaskImage: 'linear-gradient(to bottom, black 0%, black 65%, transparent 100%)',
          }}
        >
          {mode === 'video' ? (
            <video
              key={`${url}-blur`}
              src={url!}
              className="absolute inset-0 h-full w-full scale-110 object-cover blur-2xl"
              autoPlay
              muted
              loop
              playsInline
              disablePictureInPicture
              aria-hidden
            />
          ) : (
            <img
              key={`${url}-blur`}
              src={url!}
              alt=""
              className="absolute inset-0 h-full w-full scale-110 object-cover blur-2xl"
              aria-hidden
            />
          )}

          {/* `inset-0` + `mx-auto` ne centre pas ici : left/right sont tous les deux
              fixés à 0, donc la largeur remplit tout le parent quel que soit
              `max-width` et les marges auto n'ont aucun espace à répartir. La
              technique fiable pour un élément en position absolute avec une
              largeur bornée est left-50% + translate-x-(-50%).
              Le masque en dégradé sur les bords gauche/droit fond la zone nette
              dans le flou en dessous — sans lui, la jonction serait une coupure
              nette au lieu d'une transition. */}
          <div
            className={cn('absolute inset-y-0 left-1/2 w-full -translate-x-1/2', SHARP_MAX_WIDTH)}
            style={{
              maskImage: 'linear-gradient(to right, transparent, black 12%, black 88%, transparent)',
              WebkitMaskImage: 'linear-gradient(to right, transparent, black 12%, black 88%, transparent)',
            }}
          >
            {mode === 'video' ? (
              <video
                key={url}
                src={url!}
                className="h-full w-full object-cover"
                autoPlay
                muted
                loop
                playsInline
                disablePictureInPicture
                onError={onVideoError}
                onLoadedData={() => setLoaded(true)}
              />
            ) : (
              <img
                key={url}
                src={url!}
                alt=""
                className="h-full w-full object-cover"
                onError={onImageError}
                onLoad={() => setLoaded(true)}
              />
            )}
          </div>

          <div className="absolute inset-0 bg-black/25" />

          {/* Flou progressif sur le dernier tiers — un seul calque avec un masque
              suffit : là où le masque est transparent on voit le média net en
              dessous, là où il est opaque on voit sa version floutée, et le masque
              étant lui-même en dégradé, la transition est progressive. Combiné au
              fondu en alpha du bloc entier (juste au-dessus), la bannière se
              dissout dans le fond réel de la page, quel que soit le thème actif. */}
          <div
            className="absolute inset-x-0 bottom-0 h-2/5 backdrop-blur-xl"
            style={{
              maskImage: 'linear-gradient(to bottom, transparent, black 85%)',
              WebkitMaskImage: 'linear-gradient(to bottom, transparent, black 85%)',
              WebkitBackdropFilter: 'blur(24px)',
            }}
          />
        </div>
      )}
    </div>
  );
}
