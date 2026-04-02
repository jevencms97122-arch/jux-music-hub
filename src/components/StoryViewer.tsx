import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Play } from 'lucide-react';
import { pb, getSongCoverUrl, getSongAudioUrl, getUserAvatarUrl } from '@/lib/pocketbase';
import { usePlayer } from '@/contexts/PlayerContext';
import { useAuth } from '@/contexts/AuthContext';
import type { Story, PBUser } from '@/types/music';

interface StoryViewerProps {
  stories: Story[];
  initialIndex: number;
  isOpen: boolean;
  onClose: () => void;
}

export default function StoryViewer({ stories, initialIndex, isOpen, onClose }: StoryViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [progress, setProgress] = useState(0);
  const [viewers, setViewers] = useState<PBUser[]>([]);
  const audioRef = useRef(new Audio());
  const timerRef = useRef<NodeJS.Timeout>();
  const { playSong } = usePlayer();
  const { user } = useAuth();

  const story = stories[currentIndex];

  useEffect(() => {
    setCurrentIndex(initialIndex);
  }, [initialIndex]);

  useEffect(() => {
    if (!isOpen || !story) return;

    const audio = audioRef.current;
    const songData = story.expand?.song;
    if (!songData) return;

    audio.src = getSongAudioUrl(songData);
    audio.currentTime = story.startTime;
    audio.play().catch(console.error);

    // Record view
    if (user) {
      pb.collection('story_views').create({
        story: story.id,
        viewer: user.id,
      }).catch(() => {}); // Ignore duplicates
    }

    // Load viewers for the story owner
    pb.collection('story_views').getFullList({
      filter: `story="${story.id}"`,
      expand: 'viewer',
    }).then(res => {
      const list = (res as any[])
        .map(v => v.expand?.viewer)
        .filter((viewer: PBUser | undefined): viewer is PBUser => Boolean(viewer));
      const uniqueViewers = Array.from(new Map(list.map(v => [v.id, v])).values());
      setViewers(uniqueViewers);
    }).catch(() => {});

    // Progress timer
    const duration = (story.endTime - story.startTime) * 1000;
    const startTime = Date.now();
    setProgress(0);

    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const pct = Math.min(elapsed / duration, 1);
      setProgress(pct);

      if (pct >= 1) {
        clearInterval(timerRef.current);
        // Go to next story
        if (currentIndex < stories.length - 1) {
          setCurrentIndex(prev => prev + 1);
        } else {
          onClose();
        }
      }
    }, 50);

    // Stop audio at endTime
    const stopTimeout = setTimeout(() => {
      audio.pause();
    }, duration);

    return () => {
      audio.pause();
      clearInterval(timerRef.current);
      clearTimeout(stopTimeout);
    };
  }, [isOpen, currentIndex, story]);

  const goNext = () => {
    if (currentIndex < stories.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      onClose();
    }
  };

  const goPrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  };

  const handleListenFull = () => {
    audioRef.current.pause();
    if (story?.expand?.song) {
      playSong(story.expand.song);
    }
    onClose();
  };

  if (!isOpen || !story) return null;

  const storyUser = story.expand?.user;
  const songData = story.expand?.song;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[70] bg-black flex flex-col"
      >
        {/* Progress bars */}
        <div className="flex gap-1 px-3 pt-3">
          {stories.map((_, i) => (
            <div key={i} className="flex-1 h-0.5 bg-white/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-white rounded-full transition-all"
                style={{
                  width: i < currentIndex ? '100%' : i === currentIndex ? `${progress * 100}%` : '0%',
                }}
              />
            </div>
          ))}
        </div>

        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3">
          {storyUser && (
            <div className="h-8 w-8 rounded-full overflow-hidden border-2 border-primary">
              {storyUser.avatar ? (
                <img src={getUserAvatarUrl(storyUser as any)} className="h-full w-full object-cover" />
              ) : (
                <div className="h-full w-full bg-secondary" />
              )}
            </div>
          )}
          <div className="flex-1">
            <p className="text-sm font-semibold text-white">{storyUser?.pseudo}</p>
          </div>
          {storyUser?.id === user?.id && (
            <div className="text-white/80 text-xs">
              {viewers.length === 0 ? (
                <span>Aucun visualisateur pour le moment</span>
              ) : (
                <>
                  <div className="flex items-center gap-1 mb-1">
                    {viewers.slice(0, 4).map(v => (
                      <img
                        key={v.id}
                        src={getUserAvatarUrl(v)}
                        alt={v.pseudo}
                        className="h-5 w-5 rounded-full border border-white/30"
                      />
                    ))}
                    {viewers.length > 4 && (
                      <span className="text-[10px]">+{viewers.length - 4}</span>
                    )}
                  </div>
                  <div className="whitespace-nowrap overflow-hidden overflow-ellipsis text-[10px]">
                    Vu par {viewers.map(v => v.pseudo).slice(0, 4).join(', ')}{viewers.length > 4 ? ', ...' : ''}
                  </div>
                </>
              )}
            </div>
          )}
          <button onClick={onClose} className="p-2 text-white">
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Touch zones */}
        <div className="flex-1 flex relative">
          <button onClick={goPrev} className="absolute left-0 top-0 bottom-0 w-1/3 z-10" />
          <button onClick={goNext} className="absolute right-0 top-0 bottom-0 w-1/3 z-10" />

          {/* Content */}
          <div className="flex-1 flex flex-col items-center justify-center px-8">
            {songData && (
              <motion.div
                key={story.id}
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="flex flex-col items-center gap-4"
              >
                <div className="w-56 h-56 rounded-2xl overflow-hidden shadow-2xl">
                  <img src={getSongCoverUrl(songData)} alt={songData.title} className="w-full h-full object-cover" />
                </div>
                <h3 className="text-xl font-bold text-white text-center">{songData.title}</h3>
                <p className="text-sm text-white/60">{songData.author}</p>
                {story.comment && (
                  <p className="text-sm text-white/80 text-center mt-2 max-w-xs">{story.comment}</p>
                )}
              </motion.div>
            )}
          </div>
        </div>

        {/* Listen button */}
        <div className="px-6 pb-8 safe-bottom">
          <button
            onClick={handleListenFull}
            className="w-full py-3 bg-primary text-primary-foreground rounded-full font-medium flex items-center justify-center gap-2"
          >
            <Play className="h-5 w-5 fill-current" />
            Écouter le morceau complet
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
