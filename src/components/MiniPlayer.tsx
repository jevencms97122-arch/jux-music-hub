import { usePlayer, usePlayerProgress } from '@/contexts/PlayerContext';
import { getSongCoverUrl } from '@/lib/pocketbase';
import { Play, Pause, Heart, Loader2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';

export default function MiniPlayer() {
  const { currentSong, isPlaying, isLoading, togglePlay, next, previous, setPlayerOpen, likedSongs, toggleLike } = usePlayer();
  const { progress, duration } = usePlayerProgress();
  const [showMenu, setShowMenu] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const { toast } = useToast();

  const handleShare = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowMenu(false);
    const url = `${window.location.origin}/listen/${currentSong?.id}`;
    setShareUrl(url);
    setShowShareModal(true);
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(shareUrl).then(() => {
      toast({ title: 'Lien copié !' });
      setShowShareModal(false);
    }).catch(console.error);
  };

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
          <button onClick={e => { e.stopPropagation(); togglePlay(); }} className="p-2 text-foreground" type="button">
            {isLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : isPlaying ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6 fill-current" />}
          </button>
        </div>
      </div>

    </div>
  );
}
