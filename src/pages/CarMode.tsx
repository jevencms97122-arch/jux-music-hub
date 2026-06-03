import { usePlayer } from '@/contexts/PlayerContext';
import { songCoverUrl } from '@/lib/storage';
import { useNavigate } from 'react-router-dom';
import { Play, Pause, SkipBack, SkipForward, X, Heart, Radio } from 'lucide-react';
import { pb } from '@/lib/pocketbase';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

export default function CarMode() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { currentSong, isPlaying, togglePlay, next, previous, startRadio, refreshSongStats } = usePlayer();
  const [liked, setLiked] = useState(false);

  const pbGetFirst = async (collection: string, filter: string) => {
    try { const r = await pb.collection(collection).getList(1, 1, { filter, requestKey: null }); return r.items[0] || null; } catch { return null; }
  };

  useEffect(() => {
    if (!user || !currentSong) { setLiked(false); return; }
    pbGetFirst('song_likes', `song_id = "${currentSong.id}" && user_id = "${user.id}"`).then((r) => setLiked(!!r));
  }, [user, currentSong]);

  const toggleLike = async () => {
    if (!user || !currentSong) return;
    try {
      if (liked) {
        const likeRecord = await pbGetFirst('song_likes', `song_id = "${currentSong.id}" && user_id = "${user.id}"`);
        if (likeRecord) await pb.collection('song_likes').delete(likeRecord.id);
        setLiked(false);
        refreshSongStats(currentSong.id);
        toast('Like retiré', { description: currentSong.title, position: 'bottom-center' });
      } else {
        await pb.collection('song_likes').create({ song_id: currentSong.id, user_id: user.id });
        setLiked(true);
        refreshSongStats(currentSong.id);
        toast.success('Ajouté aux titres likés', { description: currentSong.title, position: 'bottom-center' });
      }
    } catch { toast.error("Impossible de modifier le like", { position: 'bottom-center' }); }
  };

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-background">
      <div className="absolute inset-0 bg-gradient-hero opacity-40" />
      <div className="relative flex items-center justify-between p-6" style={{ animation: 'fadeSlideUp 0.6s cubic-bezier(0.16,1,0.3,1) both' }}>
        <span className="text-2xl font-bold uppercase tracking-wider text-foreground">Mode Voiture</span>
        <button onClick={() => navigate(-1)} className="rounded-full bg-secondary/80 p-3"><X className="h-6 w-6" /></button>
      </div>
      <div className="relative flex flex-1 flex-col items-center justify-center gap-8">
        {currentSong ? (
          <>
            <div className="w-64 h-64 rounded-3xl overflow-hidden shadow-2xl">
              <img src={songCoverUrl(currentSong)} alt={currentSong.title} className="h-full w-full object-cover" />
            </div>
            <div className="text-center">
              <h2 className="text-2xl font-bold text-foreground">{currentSong.title}</h2>
              <p className="text-lg text-muted-foreground">{currentSong.author}</p>
            </div>
            <div className="flex items-center gap-8">
              <button onClick={() => startRadio(currentSong)} className="flex flex-col items-center text-muted-foreground">
                <Radio className="h-8 w-8 mb-1" />
                <span className="text-xs">Radio</span>
              </button>
              <button onClick={previous} className="p-4"><SkipBack className="h-10 w-10" /></button>
              <button onClick={togglePlay} className="flex h-20 w-20 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xl">
                {isPlaying ? <Pause className="h-10 w-10 fill-current" /> : <Play className="h-10 w-10 fill-current ml-2" />}
              </button>
              <button onClick={next} className="p-4"><SkipForward className="h-10 w-10" /></button>
              <button onClick={toggleLike} className={`flex flex-col items-center ${liked ? 'text-red-500' : 'text-muted-foreground'}`}>
                <Heart className={`h-8 w-8 mb-1 ${liked ? 'fill-current' : ''}`} />
                <span className="text-xs">{liked ? 'Liké' : 'Like'}</span>
              </button>
            </div>
          </>
        ) : (
          <p className="text-xl text-muted-foreground">Aucune musique en cours</p>
        )}
      </div>
    </div>
  );
}