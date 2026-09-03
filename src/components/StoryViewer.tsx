import { useEffect, useMemo, useRef, useState } from 'react';
import { pb } from '@/lib/pocketbase';
import { useAuth } from '@/contexts/AuthContext';
import { songCoverUrl, songAudioUrl, publicUrl } from '@/lib/storage';
import { X, Music2 } from 'lucide-react';
import StoryMusicWidget from '@/components/StoryMusicWidget';
import { LAYOUT_FIELD, parseStoryLayout } from '@/lib/storyLayout';

interface Props {
  stories: any[];
  initialIndex?: number;
  onClose: () => void;
}

/**
 * Durée d'affichage d'une story. L'extrait musical prime quand il est renseigné ;
 * les stories image-seule (ex: cartes Wrapped, qui ne posent pas start/end_time)
 * gardent leurs 7 s.
 */
function storyDuration(story: any): number {
  const clipMs =
    story?.start_time != null && story?.end_time != null
      ? (story.end_time - story.start_time) * 1000
      : 0;
  if (clipMs > 0) return Math.max(3000, clipMs);
  if (story?.image) return 7000;
  if (story?.song_id) return 30000;
  return 5000;
}

export default function StoryViewer({ stories, initialIndex = 0, onClose }: Props) {
  const { user } = useAuth();
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [progress, setProgress] = useState(0);
  const [song, setSong] = useState<any | null>(null);
  // Vrai dès que la story n'a pas de son à charger, ou dès que la lecture a réellement
  // démarré — la barre de progression ne défile qu'à partir de là (voir plus bas), pour
  // ne pas décompter dans le vide pendant que le fichier audio charge encore.
  const [audioReady, setAudioReady] = useState(false);
  const progressRef = useRef(0);
  const intervalRef = useRef<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const rafRef = useRef<number>(0);

  const canvasRef = useRef<HTMLDivElement>(null);
  const [canvasWidth, setCanvasWidth] = useState(0);

  const story = stories[currentIndex];
  const storyImageUrl = story?.image ? publicUrl('stories', story.id, story.image) : null;
  // `null` = story publiée avant cette fonctionnalité : on garde l'ancien rendu.
  const layout = useMemo(() => parseStoryLayout(story?.[LAYOUT_FIELD]), [story?.id]);

  // Le widget dimensionne son texte à partir de la largeur du canvas 9:16.
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const measure = () => setCanvasWidth(el.getBoundingClientRect().width);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [layout]);

  // Charge la song à chaque changement de story
  useEffect(() => {
    setSong(null);
    setAudioReady(!story?.song_id); // pas de son à charger pour cette story : prêt immédiatement
    if (!story?.song_id) return;
    pb.collection('songs').getOne(story.song_id, { requestKey: null })
      .then((rec) => setSong(rec))
      .catch(() => setAudioReady(true)); // échec de chargement : ne pas bloquer la story indéfiniment
  }, [story?.id]);

  // Lecture audio de l'extrait
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    cancelAnimationFrame(rafRef.current);

    if (!song) return;

    const audioUrl = songAudioUrl(song);
    if (!audioUrl) { setAudioReady(true); return; } // pas de son exploitable, ne pas bloquer la story

    const audio = new Audio(audioUrl);
    audio.volume = 0.3;

    const startAt = story?.start_time ?? 0;
    const endAt = story?.end_time ?? 30;
    audio.currentTime = startAt;
    audio.play().then(() => setAudioReady(true)).catch(() => setAudioReady(true));

    const ensureStop = () => {
      if (audioRef.current && audioRef.current.currentTime >= endAt) {
        audioRef.current.pause();
        cancelAnimationFrame(rafRef.current);
        return;
      }
      rafRef.current = requestAnimationFrame(ensureStop);
    };
    rafRef.current = requestAnimationFrame(ensureStop);
    audioRef.current = audio;

    return () => {
      audio.pause();
      audioRef.current = null;
      cancelAnimationFrame(rafRef.current);
    };
  }, [song]);

  // Progression de la story — ne démarre qu'une fois le son chargé et lancé (audioReady),
  // sinon la barre défilait pendant que l'audio chargeait encore, en silence.
  useEffect(() => {
    if (!story) return;
    progressRef.current = 0;
    setProgress(0);
    if (!audioReady) return;
    if (user) {
      pb.collection('story_views').create({ story_id: story.id, viewer_id: user.id }).catch(() => {});
    }
    const storyDurationMs = storyDuration(story);
    const step = 100;
    intervalRef.current = window.setInterval(() => {
      progressRef.current += step;
      setProgress(progressRef.current);
      if (progressRef.current >= storyDurationMs) {
        if (intervalRef.current) clearInterval(intervalRef.current);
        if (currentIndex < stories.length - 1) setCurrentIndex((i) => i + 1);
        else onClose();
      }
    }, step);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [story?.id, currentIndex, user, audioReady]);

  const handleClick = (e: React.MouseEvent) => {
    const x = e.clientX / window.innerWidth;
    if (x < 0.3 && currentIndex > 0) setCurrentIndex((i) => i - 1);
    else if (x > 0.7 && currentIndex < stories.length - 1) setCurrentIndex((i) => i + 1);
    else onClose();
  };

  if (!story) return null;

  const storyDurationMs = storyDuration(story);
  const coverUrl = song ? songCoverUrl(song) : null;
  const hasCover = coverUrl && coverUrl !== '/placeholder.svg';

  return (
    <div className="fixed inset-0 z-50 bg-black" onClick={handleClick}>
      {/* Story composée : canvas 9:16 letterboxé, widget musique à la position enregistrée.
          Le canvas garde toujours la même forme que celui de l'éditeur, sinon les
          coordonnées relatives ne tomberaient pas au même endroit. */}
      {layout && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div
            ref={canvasRef}
            className="relative overflow-hidden"
            style={{ width: 'min(100vw, calc(100vh * 9 / 16))', aspectRatio: '9 / 16', maxHeight: '100vh' }}
          >
            {storyImageUrl ? (
              <img src={storyImageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
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

            {song && (
              <StoryMusicWidget
                title={song.title}
                author={song.author}
                coverUrl={coverUrl}
                layout={layout.music}
                canvasWidth={canvasWidth}
              />
            )}

            {story.comment && (
              <div className="absolute inset-x-0 bottom-6 flex justify-center px-6">
                <p className="text-center text-lg font-bold text-white drop-shadow-lg">{story.comment}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Image plein écran (ex: carte Wrapped partagée) */}
      {!layout && storyImageUrl && (
        <img src={storyImageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
      )}
      {/* Fond flouté (stories musicales classiques) */}
      {!layout && !storyImageUrl && hasCover && (
        <div
          className="absolute inset-0 bg-cover bg-center blur-2xl scale-110"
          style={{ backgroundImage: `url(${coverUrl})` }}
        />
      )}
      {!layout && !storyImageUrl && <div className="absolute inset-0 bg-black/40" />}

      {/* Bouton fermer */}
      <button
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        className="absolute right-4 top-4 z-10 text-white"
      >
        <X className="h-6 w-6" />
      </button>

      {/* Barres de progression */}
      <div className="absolute left-0 right-0 top-2 z-10 flex gap-1 px-2">
        {stories.map((_, i) => (
          <div key={i} className="h-1 flex-1 rounded-full bg-white/30 overflow-hidden">
            <div
              className="h-full w-full origin-left rounded-full bg-white transition-transform duration-100 ease-linear"
              style={{
                transform: `scaleX(${
                  i === currentIndex
                    ? progress / storyDurationMs
                    : i < currentIndex ? 1 : 0
                })`,
              }}
            />
          </div>
        ))}
      </div>

      {/* Contenu centré (stories musicales classiques uniquement) */}
      {!layout && !storyImageUrl && (
        <div className="relative z-10 flex h-full items-center justify-center">
          <div className="text-center px-8">
            {hasCover && (
              <div className="mb-6 flex justify-center">
                <img
                  src={coverUrl!}
                  alt={song?.title || 'Cover'}
                  className="h-56 w-56 rounded-3xl object-cover shadow-2xl shadow-black/50 ring-1 ring-white/[0.12]"
                />
              </div>
            )}
            {song && (
              <div className="mb-4 flex items-center justify-center gap-2 text-white/80">
                <Music2 className="h-4 w-4" />
                <span className="text-sm font-medium">{song.title} — {song.author}</span>
              </div>
            )}
            {story.comment ? (
              <p className="text-xl font-bold text-white">{story.comment}</p>
            ) : null}
            <p className="text-sm text-white/60 mt-2">Story musicale</p>
          </div>
        </div>
      )}

      {/* Chip discret indiquant le titre joué en fond, pour les cartes Wrapped */}
      {!layout && storyImageUrl && song && (
        <div className="absolute bottom-8 left-0 right-0 z-10 flex justify-center">
          <div className="flex items-center gap-2 rounded-full bg-black/40 backdrop-blur-md px-4 py-2 text-white/90 ring-1 ring-white/10">
            <Music2 className="h-3.5 w-3.5" />
            <span className="text-xs font-medium">{song.title} — {song.author}</span>
          </div>
        </div>
      )}
    </div>
  );
}
