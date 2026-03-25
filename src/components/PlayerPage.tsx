import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePlayer, usePlayerProgress } from '@/contexts/PlayerContext';
import { useAuth } from '@/contexts/AuthContext';
import { getSongCoverUrl, pb } from '@/lib/pocketbase';
import { ChevronDown, Play, Pause, SkipForward, SkipBack, Shuffle, Repeat, Repeat1, Heart, Headphones, Loader2 } from 'lucide-react';
import QueueView from './QueueView';
import FriendsLikedBadge from './FriendsLikedBadge';

function formatTime(s: number) {
  if (!s || isNaN(s)) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

export default function PlayerPage() {
  const { currentSong, isPlaying, isLoading, togglePlay, next, previous, seek, setPlayerOpen, playerOpen, shuffle, repeatMode, toggleShuffle, cycleRepeat } = usePlayer();
  const { progress, duration } = usePlayerProgress();
  const { user } = useAuth();
  const [tab, setTab] = useState<'player' | 'queue'>('player');
  const [liked, setLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  const [playCount, setPlayCount] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const sliderRef = useRef<HTMLInputElement>(null);
  const animationFrameRef = useRef<number>();
  const dragTimeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (!currentSong) return;
    setPlayCount(currentSong.playCount || 0);
    setLikesCount(currentSong.likesCount || 0);

    if (user) {
      pb.collection('song_likes').getList(1, 1, {
        filter: `user="${user.id}" && song="${currentSong.id}"`,
      }).then(r => setLiked(r.items.length > 0)).catch(() => setLiked(false));
    }
  }, [currentSong, user]);

  // Synchronize slider thumb with progress updates using requestAnimationFrame
  useEffect(() => {
    const updateSlider = () => {
      if (sliderRef.current && !isDragging && currentSong) {
        sliderRef.current.value = progress.toString();
      }
      if (isPlaying && !isDragging) {
        animationFrameRef.current = requestAnimationFrame(updateSlider);
      }
    };

    if (isPlaying && !isDragging) {
      animationFrameRef.current = requestAnimationFrame(updateSlider);
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying, isDragging, progress, currentSong]);

  const toggleLike = async () => {
    if (!user || !currentSong) return;
    try {
      if (liked) {
        const existing = await pb.collection('song_likes').getList(1, 1, {
          filter: `user="${user.id}" && song="${currentSong.id}"`,
        });
        if (existing.items[0]) {
          await pb.collection('song_likes').delete(existing.items[0].id);
          setLiked(false);
          const newCount = Math.max(0, likesCount - 1);
          setLikesCount(newCount);
          await pb.collection('songs').update(currentSong.id, { likesCount: newCount });
        }
      } else {
        await pb.collection('song_likes').create({ user: user.id, song: currentSong.id });
        setLiked(true);
        const newCount = likesCount + 1;
        setLikesCount(newCount);
        await pb.collection('songs').update(currentSong.id, { likesCount: newCount });
      }
    } catch (e) {
      console.error('Like error', e);
    }
  };

  if (!currentSong) return null;
  const uploaderPseudo = currentSong.expand?.uploadedBy?.pseudo;

  const RepeatIcon = repeatMode === 'one' ? Repeat1 : Repeat;

  return (
    <AnimatePresence>
      {playerOpen && (
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          className="fixed inset-0 z-50 bg-background flex flex-col"
        >
          <div className="flex items-center justify-between px-4 py-3">
            <button onClick={() => { setPlayerOpen(false); setTab('player'); }} className="p-2 text-foreground" type="button">
              <ChevronDown className="h-6 w-6" />
            </button>
            <p className="text-xs text-muted-foreground">En cours de lecture</p>
            <div className="w-10" />
          </div>

          {tab === 'player' ? (
            <div className="flex-1 flex flex-col items-center justify-center px-8">
              <div className={`w-48 h-48 sm:w-56 sm:h-56 md:w-64 md:h-64 lg:w-72 lg:h-72 rounded-xl overflow-hidden shadow-2xl mb-8 transition-transform duration-500 ${isPlaying ? 'scale-100' : 'scale-95 opacity-80'}`}>
                <img
                  key={currentSong.id}
                  src={getSongCoverUrl(currentSong)}
                  alt={currentSong.title}
                  className="h-full w-full object-cover"
                />
              </div>

              <div className="w-full text-center mb-2">
                <h2 className="text-xl font-bold text-foreground truncate">{currentSong.title}</h2>
                <p className="text-sm text-muted-foreground truncate">
                  {currentSong.author}
                  {uploaderPseudo && <span> · publié par {uploaderPseudo}</span>}
                </p>
              </div>

              <div className="flex items-center gap-4 mb-4">
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Headphones className="h-3.5 w-3.5" />
                  <span>{playCount}</span>
                </div>
                <button onClick={toggleLike} className="flex items-center gap-1 text-xs text-muted-foreground" type="button">
                  <Heart className={`h-3.5 w-3.5 transition-colors ${liked ? 'fill-primary text-primary' : ''}`} />
                  <span>{likesCount}</span>
                </button>
              </div>

              {user && currentSong && (
                <FriendsLikedBadge songId={currentSong.id} userId={user.id} />
              )}

              <div className="flex items-center gap-4 mb-6 w-full px-4">
                <span className="text-xs text-muted-foreground w-12 text-right flex-shrink-0">{formatTime(progress)}</span>
                <div className="flex-1 relative flex items-center h-3">
                  <div className="absolute top-1/2 left-0 h-1 bg-orange-500 rounded-full transform -translate-y-1/2" style={{ width: duration > 0 ? `calc(${(progress / duration) * 100}% + 6px)` : '0%' }} />
                  <input
                    ref={sliderRef}
                    type="range"
                    min={0}
                    max={duration || 0}
                    value={progress}
                    onChange={(e) => {
                      // Only update visual position during dragging, don't seek yet
                      if (isDragging) {
                        // Update the slider value visually during drag without seeking
                        if (sliderRef.current) {
                          sliderRef.current.value = e.target.value;
                        }
                      } else {
                        // Only seek when not dragging
                        seek(Number(e.target.value));
                      }
                    }}
                    onMouseDown={() => {
                      setIsDragging(true);
                      // Prevent animation frame from updating slider during drag
                      if (animationFrameRef.current) {
                        cancelAnimationFrame(animationFrameRef.current);
                      }
                    }}
                    onMouseMove={(e) => {
                      // Update slider value during mouse move if dragging
                      if (isDragging && sliderRef.current) {
                        sliderRef.current.value = (e.target as HTMLInputElement).value;
                      }
                    }}
                    onMouseUp={(e) => {
                      setIsDragging(false);
                      // Seek to the final position when drag ends
                      seek(Number((e.target as HTMLInputElement).value));
                    }}
                    onTouchStart={() => {
                      setIsDragging(true);
                      // Prevent animation frame from updating slider during drag
                      if (animationFrameRef.current) {
                        cancelAnimationFrame(animationFrameRef.current);
                      }
                    }}
                    onTouchMove={(e) => {
                      // Update slider value during touch move if dragging
                      if (isDragging && sliderRef.current) {
                        sliderRef.current.value = (e.target as HTMLInputElement).value;
                      }
                    }}
                    onTouchEnd={(e) => {
                      setIsDragging(false);
                      // Seek to the final position when drag ends
                      seek(Number((e.target as HTMLInputElement).value));
                    }}
                    className="w-full h-1 appearance-none bg-secondary rounded-full [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-orange-500 [&::-webkit-slider-thumb]:-ml-1"
                  />
                </div>
                <span className="text-xs text-muted-foreground w-12 flex-shrink-0">{formatTime(duration)}</span>
              </div>

              <div className="flex items-center justify-center gap-8">
                <button onClick={toggleShuffle} className={`p-2 transition-colors ${shuffle ? 'text-primary' : 'text-muted-foreground'}`} type="button">
                  <Shuffle className="h-5 w-5" />
                </button>
                <button onClick={previous} className="p-2 text-foreground" type="button"><SkipBack className="h-7 w-7 fill-foreground" /></button>
                <button onClick={togglePlay} className="h-16 w-16 rounded-full bg-foreground flex items-center justify-center" type="button">
                  {isLoading ? (
                    <Loader2 className="h-7 w-7 text-background animate-spin" />
                  ) : isPlaying ? (
                    <Pause className="h-7 w-7 text-background fill-background" />
                  ) : (
                    <Play className="h-7 w-7 text-background fill-background ml-1" />
                  )}
                </button>
                <button onClick={next} className="p-2 text-foreground" type="button"><SkipForward className="h-7 w-7 fill-foreground" /></button>
                <button onClick={cycleRepeat} className={`p-2 transition-colors ${repeatMode !== 'off' ? 'text-primary' : 'text-muted-foreground'}`} type="button">
                  <RepeatIcon className="h-5 w-5" />
                </button>
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto">
              <QueueView />
            </div>
          )}

          <div className="flex border-t border-border safe-bottom">
            {(['player', 'queue'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 py-3 text-sm font-medium transition-colors ${tab === t ? 'text-foreground border-b-2 border-foreground' : 'text-muted-foreground'}`}
                type="button"
              >
                {t === 'queue' ? 'À suivre' : 'Lecteur'}
              </button>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
