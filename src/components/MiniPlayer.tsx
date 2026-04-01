import { usePlayer, usePlayerProgress } from '@/contexts/PlayerContext';
import { getSongCoverUrl } from '@/lib/pocketbase';
import { Play, Pause, Heart, Loader2, MoreVertical, Share2, X } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useToast } from '@/components/ui/use-toast';

export default function MiniPlayer() {
  const { currentSong, isPlaying, isLoading, togglePlay, next, previous, setPlayerOpen, likedSongs, toggleLike } = usePlayer();
  const { progress, duration } = usePlayerProgress();
  const [showMenu, setShowMenu] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    if (!showMenu) return;
    const close = () => setShowMenu(false);
    setTimeout(() => document.addEventListener('click', close), 0);
    return () => document.removeEventListener('click', close);
  }, [showMenu]);

  if (!currentSong) return null;

  const isLiked = likedSongs.has(currentSong.id);

  return (
    <div
      className="fixed bottom-14 left-0 right-0 z-40 bg-card/80 backdrop-blur-xl border-t border-border/50 safe-bottom cursor-pointer transition-colors hover:bg-card/90"
      onClick={() => setPlayerOpen(true)}
    >
      <div className="flex items-center gap-4 px-4 py-3">
        <img
          key={currentSong.id}
          src={getSongCoverUrl(currentSong)}
          alt={currentSong.title}
          className="h-12 w-12 rounded-lg object-cover shadow-md"
        />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">{currentSong.title}</p>
          <p className="text-xs text-muted-foreground truncate font-medium">{currentSong.author}</p>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={e => { e.stopPropagation(); toggleLike(currentSong); }}
            className="p-2 text-foreground/70 hover:text-primary transition-colors"
            type="button"
          >
            <Heart className={`h-5 w-5 ${isLiked ? 'fill-primary text-primary' : ''}`} />
          </button>
          <div className="relative">
            <button
              onClick={e => { e.stopPropagation(); setShowMenu(!showMenu); }}
              className="p-2 text-foreground/70 hover:text-foreground transition-colors"
              type="button"
            >
              <MoreVertical className="h-5 w-5" />
            </button>
            {showMenu && (
              <div className="absolute bottom-full right-0 mb-2 bg-card border border-border rounded-lg shadow-lg py-1 z-50">
                <button
                  onClick={handleShare}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-secondary flex items-center gap-2"
                >
                  <Share2 className="h-4 w-4" />
                  Partager
                </button>
              </div>
            )}
          </div>
          <button onClick={e => { e.stopPropagation(); togglePlay(); }} className="p-2 text-foreground" type="button">
            {isLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : isPlaying ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6 fill-current" />}
          </button>
        </div>
      </div>

      {/* Share Modal */}
      {showShareModal && (
        <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4" onClick={() => setShowShareModal(false)}>
          <div className="bg-card rounded-xl p-6 w-full max-w-md shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-foreground">Partager le titre</h3>
              <button
                onClick={() => setShowShareModal(false)}
                className="p-1 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Partagez ce titre avec vos amis. Ils pourront écouter la musique même sans compte.
            </p>
            <div className="flex items-center gap-2 bg-secondary/50 rounded-lg p-3">
              <input
                type="text"
                readOnly
                value={shareUrl}
                className="flex-1 bg-transparent text-sm text-foreground outline-none truncate"
              />
              <button
                onClick={copyToClipboard}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
                type="button"
              >
                Copier
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
