import { useEffect, useRef, useState } from 'react';
import { pb } from '@/lib/pocketbase';
import { useAuth } from '@/contexts/AuthContext';
import { songCoverUrl, songAudioUrl } from '@/lib/storage';
import { X, Music2 } from 'lucide-react';

interface Props {
  stories: any[];
  initialIndex?: number;
  onClose: () => void;
}

export default function StoryViewer({ stories, initialIndex = 0, onClose }: Props) {
  const { user } = useAuth();
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [progress, setProgress] = useState(0);
  const [song, setSong] = useState<any | null>(null);
  const progressRef = useRef(0);
  const intervalRef = useRef<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const rafRef = useRef<number>(0);

  const story = stories[currentIndex];

  // Charge la song à chaque changement de story
  useEffect(() => {
    setSong(null);
    if (!story?.song_id) return;
    pb.collection('songs').getOne(story.song_id, { requestKey: null })
      .then((rec) => setSong(rec))
      .catch(() => {});
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
    if (!audioUrl) return;

    const audio = new Audio(audioUrl);
    audio.volume = 0.3;

    const startAt = story?.start_time ?? 0;
    const endAt = story?.end_time ?? 30;
    audio.currentTime = startAt;
    audio.play().catch(() => {});

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

  // Progression de la story
  useEffect(() => {
    if (!story) return;
    if (user) {
      pb.collection('story_views').create({ story_id: story.id, viewer_id: user.id }).catch(() => {});
    }
    progressRef.current = 0;
    setProgress(0);
    const storyDurationMs = story.song_id
      ? Math.max(3000, ((story.end_time || 30) - (story.start_time || 0)) * 1000)
      : 5000;
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
  }, [story?.id, currentIndex, user]);

  const handleClick = (e: React.MouseEvent) => {
    const x = e.clientX / window.innerWidth;
    if (x < 0.3 && currentIndex > 0) setCurrentIndex((i) => i - 1);
    else if (x > 0.7 && currentIndex < stories.length - 1) setCurrentIndex((i) => i + 1);
    else onClose();
  };

  if (!story) return null;

  const storyDurationMs = story.song_id
    ? Math.max(3000, ((story.end_time || 30) - (story.start_time || 0)) * 1000)
    : 5000;
  const coverUrl = song ? songCoverUrl(song) : null;
  const hasCover = coverUrl && coverUrl !== '/placeholder.svg';

  return (
    <div className="fixed inset-0 z-50 bg-black" onClick={handleClick}>
      {/* Fond flouté */}
      {hasCover && (
        <div
          className="absolute inset-0 bg-cover bg-center blur-2xl scale-110"
          style={{ backgroundImage: `url(${coverUrl})` }}
        />
      )}
      <div className="absolute inset-0 bg-black/40" />

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

      {/* Contenu centré */}
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
    </div>
  );
}
