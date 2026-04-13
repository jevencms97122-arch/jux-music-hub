import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePlayer, usePlayerProgress } from '@/contexts/PlayerContext';
import { useAuth } from '@/contexts/AuthContext';
import { getSongCoverUrl, pb } from '@/lib/pocketbase';
import { ChevronDown, Play, Pause, SkipForward, SkipBack, Shuffle, Repeat, Repeat1, Heart, Headphones, Loader2, Plus, MoreVertical, LogIn, Radio, BookOpen } from 'lucide-react';
import QueueView from './QueueView';
import FriendsLikedBadge from './FriendsLikedBadge';
import AddToPlaylistModal from './AddToPlaylistModal';
import CreateStoryModal from './CreateStoryModal';
import { useNavigate } from 'react-router-dom';

function formatTime(s: number) {
  if (!s || isNaN(s)) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

export default function PlayerPage() {
  const { currentSong, isPlaying, isLoading, togglePlay, next, previous, seek, setPlayerOpen, playerOpen, shuffle, repeatMode, toggleShuffle, cycleRepeat, toggleLike: toggleLikeContext, likedSongs, getImageLoadControl, registerImageLoad, radioMode, toggleRadioMode } = usePlayer();
  const { progress, duration } = usePlayerProgress();

  const { imageKey } = currentSong ? getImageLoadControl(currentSong.id) : { imageKey: '' };
  const { user } = useAuth();
  
  const [tab, setTab] = useState<'player' | 'queue'>('player');
  const [likesCount, setLikesCount] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [showAddToPlaylist, setShowAddToPlaylist] = useState(false);
  const [showCreateStory, setShowCreateStory] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const navigate = useNavigate();
  const sliderRef = useRef<HTMLInputElement>(null);
  const animationFrameRef = useRef<number>();
  const dragTimeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (!currentSong) return;
    setLikesCount(currentSong.likesCount || 0);
  }, [currentSong]);

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

  useEffect(() => {
    if (!showMenu) return;
    const close = () => setShowMenu(false);
    setTimeout(() => document.addEventListener('click', close), 0);
    return () => document.removeEventListener('click', close);
  }, [showMenu]);

  const handleToggleLike = async () => {
    if (!currentSong) return;
    const wasLiked = likedSongs.has(currentSong.id);
    await toggleLikeContext(currentSong);
    setLikesCount(prev => wasLiked ? Math.max(0, prev - 1) : prev + 1);
  };


  if (!currentSong) return null;
  const uploaderPseudo = currentSong.expand?.uploadedBy?.pseudo;

  const RepeatIcon = repeatMode === 'one' ? Repeat1 : Repeat;

  return (
    <>
      <AnimatePresence>
        {playerOpen && (
          <motion.div
          key="player-panel"
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 30, stiffness: 300, mass: 1 }}
          className="fixed inset-0 z-50 bg-background flex flex-col will-change-transform"
        >
          <div className="absolute inset-0 z-0">
            <img
              src={getSongCoverUrl(currentSong)}
              alt=""
              className="w-full h-full object-cover blur-3xl opacity-30"
              onError={(e) => {
                (e.target as HTMLImageElement).src = '/placeholder.svg';
              }}
            />
            <div className="absolute inset-0 bg-background/80 backdrop-blur-md" />
          </div>

          <div className="relative z-10 flex items-center justify-between px-4 py-3">
            <button onClick={() => { setPlayerOpen(false); setTab('player'); }} className="p-2 text-foreground" type="button">
              <ChevronDown className="h-6 w-6" />
            </button>
            <p className="text-xs text-muted-foreground">En cours de lecture</p>
            <div className="relative">
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setShowMenu(!showMenu);
                }} 
                className="p-2 text-foreground/70 hover:text-primary transition-colors" 
                type="button"
              >
                <MoreVertical className="h-6 w-6" />
              </button>
              
              {showMenu && (
                <div className="absolute right-0 top-10 bg-card border border-border rounded-lg shadow-xl w-48 z-[9999] pointer-events-auto" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => {
                      setShowAddToPlaylist(true);
                      setShowMenu(false);
                    }}
                    className="w-full px-4 py-3 text-left text-sm hover:bg-accent/50 flex items-center gap-2 transition-colors"
                    type="button"
                  >
                    <Plus className="h-4 w-4" />
                    Ajouter à une playlist
                  </button>
                   <button
                     onClick={() => {
                       setShowCreateStory(true);
                       setShowMenu(false);
                     }}
                     className="w-full px-4 py-3 text-left text-sm hover:bg-accent/50 flex items-center gap-2 transition-colors"
                     type="button"
                   >
                     <BookOpen className="h-4 w-4" />
                     Ajouter à la story
                   </button>
                   <button
                     onClick={() => {
                       toggleRadioMode();
                       setShowMenu(false);
                     }}
                     className={`w-full px-4 py-3 text-left text-sm hover:bg-accent/50 flex items-center gap-2 transition-colors ${radioMode ? 'text-primary' : ''}`}
                     type="button"
                   >
                     <Radio className="h-4 w-4" />
                     {radioMode ? 'Désactiver mode Radio' : 'Activer mode Radio'}
                   </button>
                 </div>
              )}
            </div>
          </div>

          <div className={`relative z-10 flex-1 overflow-hidden ${showMenu ? 'pointer-events-none' : ''}`}>
            <AnimatePresence mode="wait">
              <motion.div
                key={tab}
                initial={{ opacity: 0, x: tab === 'player' ? -20 : 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: tab === 'player' ? 20 : -20 }}
                transition={{ duration: 0.2 }}
                className="h-full"
              >
                {tab === 'player' ? (
                  <div className="flex flex-col items-center justify-center px-8 h-full">
                    <div className={`w-48 h-48 sm:w-56 sm:h-56 md:w-64 md:h-64 lg:w-72 lg:h-72 rounded-xl overflow-hidden shadow-2xl mb-8 transition-transform duration-500 ${isPlaying ? 'scale-100' : 'scale-95 opacity-80'}`}>
                      <motion.img
                        key={imageKey}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.3 }}
                        src={getSongCoverUrl(currentSong)}
                        alt={currentSong.title}
                        className="h-full w-full object-cover"
                        onLoad={() => {
                          if (currentSong) registerImageLoad(currentSong.id);
                        }}
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = '/placeholder.svg';
                        }}
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
                        <span>{currentSong.playCount || 0}</span>
                      </div>
                      <button onClick={handleToggleLike} className="flex items-center gap-1 text-xs text-muted-foreground" type="button">
                        <Heart className={`h-3.5 w-3.5 transition-colors ${likedSongs.has(currentSong.id) ? 'fill-primary text-primary' : ''}`} />
                        <span>{likesCount}</span>
                      </button>
                    </div>

                    {user && currentSong && (
                      <FriendsLikedBadge songId={currentSong.id} userId={user.id} />
                    )}

                     {!radioMode && (
                       <div className="flex items-center gap-4 mb-6 w-full px-4">
                         <span className="text-xs text-muted-foreground w-12 text-right flex-shrink-0">{formatTime(progress)}</span>
                         <div className="flex-1 relative flex items-center h-3">
                           <div className="absolute top-1/2 left-0 h-1 bg-secondary rounded-full w-full transform -translate-y-1/2" />
                           <div className="absolute top-1/2 left-0 h-1 bg-orange-500 rounded-full transform -translate-y-1/2" style={{ width: duration > 0 ? `${(Math.min(progress, duration) / duration) * 100}%` : '0%' }} />
                           <input
                             ref={sliderRef}
                             type="range"
                             min={0}
                             max={duration || 0}
                             value={progress}
                             onChange={(e) => {
                               const val = Number(e.target.value);
                               if (sliderRef.current) {
                                 sliderRef.current.value = e.target.value;
                               }
                               seek(val);
                             }}
                             onMouseDown={() => setIsDragging(true)}
                             onMouseUp={(e) => {
                               setIsDragging(false);
                               seek(Number((e.target as HTMLInputElement).value));
                             }}
                             onTouchStart={() => setIsDragging(true)}
                             onTouchEnd={(e) => {
                               setIsDragging(false);
                               seek(Number((e.target as HTMLInputElement).value));
                             }}
                             className="absolute w-full h-4 opacity-0 cursor-pointer"
                           />
                           {/* Thumb */}
                           <div
                             className="absolute h-4 w-4 rounded-full bg-orange-500 pointer-events-none transform -translate-x-1/2 -translate-y-1/2 top-1/2"
                             style={{ left: duration > 0 ? `${(Math.min(progress, duration) / duration) * 100}%` : '0%' }}
                           />
                         </div>
                         <span className="text-xs text-muted-foreground w-12 flex-shrink-0">{formatTime(duration)}</span>
                       </div>
                     )}

                     <div className="flex items-center justify-center gap-8">
                       {!radioMode && (
                         <button onClick={toggleShuffle} className={`p-2 transition-colors ${shuffle ? 'text-primary' : 'text-muted-foreground'}`} type="button">
                           <Shuffle className="h-5 w-5" />
                         </button>
                       )}
                       {!radioMode && (
                         <button onClick={previous} className="p-2 text-foreground" type="button"><SkipBack className="h-7 w-7 fill-foreground" /></button>
                       )}
                       <button onClick={togglePlay} className="h-16 w-16 rounded-full bg-foreground flex items-center justify-center" type="button">
                         {isLoading ? (
                           <Loader2 className="h-7 w-7 text-background animate-spin" />
                         ) : isPlaying ? (
                           <Pause className="h-7 w-7 text-background fill-background" />
                         ) : (
                           <Play className="h-7 w-7 text-background fill-background ml-1" />
                         )}
                       </button>
                       {!radioMode && (
                         <button onClick={next} className="p-2 text-foreground" type="button"><SkipForward className="h-7 w-7 fill-foreground" /></button>
                       )}
                       {!radioMode && (
                         <button onClick={cycleRepeat} className={`p-2 transition-colors ${repeatMode !== 'off' ? 'text-primary' : 'text-muted-foreground'}`} type="button">
                           <RepeatIcon className="h-5 w-5" />
                         </button>
                       )}
                     </div>

                    {!user && (
                      <div className="mt-8 p-4 bg-card/80 backdrop-blur-sm rounded-xl border border-border w-full max-w-sm text-center">
                        <p className="text-sm text-muted-foreground mb-3">
                          Pour accéder à toutes les fonctionnalités communautaires et écouter vos musiques et celles de vos amis sans interruption, connectez-vous !
                        </p>
                        <button
                          onClick={() => navigate('/')}
                          className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
                        >
                          <LogIn className="h-4 w-4" />
                          Se connecter
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="h-full overflow-y-auto">
                    <QueueView />
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

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

      <AddToPlaylistModal
        isOpen={showAddToPlaylist}
        onClose={() => setShowAddToPlaylist(false)}
        song={currentSong}
      />

      <CreateStoryModal
        isOpen={showCreateStory}
        onClose={() => setShowCreateStory(false)}
        song={currentSong}
      />
    </>
  );
}
