import { useState, useEffect, useCallback } from 'react';
import { pb } from '@/lib/pocketbase';
import { songCoverUrl, avatarUrl } from '@/lib/storage';
import { usePlayer } from '@/contexts/PlayerContext';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Heart, MessageCircle, Share2, ListMusic, MoreHorizontal,
  UserPlus, User, Play, Pause, SkipBack, SkipForward, Shuffle, Repeat,
  Volume2, VolumeX, ChevronDown, Music2, X
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import CommentsModal from './CommentsModal';
import AddToPlaylistModal from './AddToPlaylistModal';
import type { Song } from '@/types/music';
import { toast } from 'sonner';
import VolumeControl from './VolumeControl';
import PlaybackRateControl from './PlaybackRateControl';
import { isAndroidNative } from '@/lib/platform';

export default function PlayerPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { currentSong, isPlaying, currentTime, duration, queue, queueIndex, playSong, togglePlay, next, previous, seek, setVolume, volume, closePlayer, isShuffled, toggleShuffle, repeatMode, cycleRepeat, playbackRate, isPlayerOpen } = usePlayer();
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [commentOpen, setCommentOpen] = useState(false);
  const [playlistOpen, setPlaylistOpen] = useState(false);
  const [showVolume, setShowVolume] = useState(false);

  const pbGetFirst = async (collection: string, filter: string) => {
    try { const r = await pb.collection(collection).getList(1, 1, { filter, requestKey: null }); return r.items[0] || null; } catch { return null; }
  };

  useEffect(() => {
    if (!currentSong || !user) return;
    (async () => {
      try {
        const likeRecord = await pbGetFirst('song_likes', `user_id = "${user.id}" && song_id = "${currentSong.id}"`);
        setLiked(!!likeRecord);
        const songRecord = await pbGetFirst('songs', `id = "${currentSong.id}"`);
        setLikeCount(songRecord?.get('likes_count') ?? 0);
      } catch {}
    })();
  }, [currentSong, user]);

  const toggleLike = useCallback(async () => {
    if (!user || !currentSong) return;
    try {
      if (liked) {
        const likeRecord = await pbGetFirst('song_likes', `user_id = "${user.id}" && song_id = "${currentSong.id}"`);
        if (likeRecord) await pb.collection('song_likes').delete(likeRecord.id);
        setLiked(false);
        setLikeCount((c) => Math.max(0, c - 1));
      } else {
        await pb.collection('song_likes').create({ user_id: user.id, song_id: currentSong.id });
        setLiked(true);
        setLikeCount((c) => c + 1);
      }
    } catch {}
  }, [user, currentSong, liked]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60); const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  if (!currentSong) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between p-4">
        <Button variant="ghost" size="icon" onClick={closePlayer}><ChevronDown className="h-6 w-6" /></Button>
        <div className="text-center">
          <p className="text-xs font-medium text-muted-foreground">En cours de lecture</p>
        </div>
        <Button variant="ghost" size="icon" onClick={() => navigate('/home')}><X className="h-5 w-5" /></Button>
      </div>

      {/* Cover */}
      <div className="flex flex-1 items-center justify-center px-8">
        <div className="aspect-square w-full max-w-sm overflow-hidden rounded-3xl shadow-2xl">
          <img src={songCoverUrl(currentSong)} alt={currentSong.title} className="h-full w-full object-cover" />
        </div>
      </div>

      {/* Info */}
      <div className="px-6 pt-4">
        <h2 className="text-xl font-bold truncate">{currentSong.title}</h2>
        <p className="text-sm text-muted-foreground truncate">{currentSong.author}</p>
      </div>

      {/* Progress */}
      <div className="px-6 pt-4">
        <input type="range" min={0} max={duration || 100} value={currentTime} onChange={(e) => seek(parseFloat(e.target.value))} className="w-full accent-primary" />
        <div className="flex justify-between text-xs text-muted-foreground mt-1">
          <span>{formatTime(currentTime)}</span><span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-6 px-6 py-4">
        <button onClick={toggleShuffle} className={`p-2 ${isShuffled ? 'text-primary' : 'text-muted-foreground'}`}><Shuffle className="h-5 w-5" /></button>
        <button onClick={previous} className="p-2 text-muted-foreground"><SkipBack className="h-7 w-7" /></button>
        <button onClick={togglePlay} className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg">
          {isPlaying ? <Pause className="h-7 w-7 fill-current" /> : <Play className="h-7 w-7 fill-current ml-1" />}
        </button>
        <button onClick={next} className="p-2 text-muted-foreground"><SkipForward className="h-7 w-7" /></button>
        <button onClick={cycleRepeat} className={`p-2 ${repeatMode !== 'off' ? 'text-primary' : 'text-muted-foreground'}`}>
          <Repeat className="h-5 w-5" />
          {repeatMode === 'one' && <span className="absolute text-[8px] font-bold">1</span>}
        </button>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-around px-6 pb-6">
        <button onClick={toggleLike} className={`flex flex-col items-center gap-1 ${liked ? 'text-red-500' : 'text-muted-foreground'}`}>
          <Heart className={`h-6 w-6 ${liked ? 'fill-current' : ''}`} />
          <span className="text-xs">{likeCount}</span>
        </button>
        <button onClick={() => setCommentOpen(true)} className="flex flex-col items-center gap-1 text-muted-foreground">
          <MessageCircle className="h-6 w-6" />
          <span className="text-xs">Commentaires</span>
        </button>
        <button onClick={() => setPlaylistOpen(true)} className="flex flex-col items-center gap-1 text-muted-foreground">
          <ListMusic className="h-6 w-6" />
          <span className="text-xs">Playlist</span>
        </button>
        {currentSong?.video_url && (
          <button onClick={() => navigate(`/video/${currentSong.id}`)} className="flex flex-col items-center gap-1 text-muted-foreground">
            <Music2 className="h-6 w-6" />
            <span className="text-xs">Vidéo</span>
          </button>
        )}
      </div>

      <CommentsModal open={commentOpen} onOpenChange={setCommentOpen} songId={currentSong.id} />
      <AddToPlaylistModal open={playlistOpen} onOpenChange={setPlaylistOpen} songId={currentSong.id} />
    </div>
  );
}