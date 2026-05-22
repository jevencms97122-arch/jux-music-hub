import { usePlayer } from '@/contexts/PlayerContext';
import { songCoverUrl } from '@/lib/storage';
import { useNavigate } from 'react-router-dom';
import { Play, Pause, SkipBack, SkipForward, X, Heart, Radio } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

/**
 * Mode Voiture : interface plein écran avec très gros boutons
 * pensée pour utilisation en conduisant.
 */
export default function CarMode() {
  const navigate = useNavigate();
  const { authUser } = useAuth();
  const { currentSong, isPlaying, togglePlay, next, previous, startRadio, refreshSongStats } = usePlayer();
  const [liked, setLiked] = useState(false);

  useEffect(() => {
    if (!authUser || !currentSong) { setLiked(false); return; }
    supabase.from('song_likes').select('id')
      .eq('song_id', currentSong.id).eq('user_id', authUser.id).maybeSingle()
      .then(({ data }) => setLiked(!!data));
  }, [authUser, currentSong]);

  const toggleLike = async () => {
    if (!authUser || !currentSong) return;
    if (liked) {
      const { error } = await supabase.from('song_likes').delete()
        .eq('song_id', currentSong.id).eq('user_id', authUser.id);
      if (error) { toast.error("Impossible de retirer le j'aime", { position: 'bottom-center' }); return; }
      setLiked(false);
      await refreshSongStats(currentSong.id);
      toast('Like retiré', { description: currentSong.title, position: 'bottom-center' });
    } else {
      const { error } = await supabase.from('song_likes').insert({ song_id: currentSong.id, user_id: authUser.id });
      if (error) { toast.error("Impossible d'ajouter le j'aime", { position: 'bottom-center' }); return; }
      setLiked(true);
      await refreshSongStats(currentSong.id);
      toast.success('Ajouté aux titres likés', { description: currentSong.title, position: 'bottom-center' });
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-background">
      <div className="absolute inset-0 bg-gradient-hero opacity-40" />
      <div className="relative flex items-center justify-between p-6" style={{ animation: 'fadeSlideUp 0.6s cubic-bezier(0.16,1,0.3,1) both' }}>
        <span className="text-2xl font-bold uppercase tracking-wider text-foreground">Mode Voiture</span>
        <button
          onClick={() => navigate(-1)}
          aria-label="Quitter le mode voiture"
          className="flex h-16 w-16 items-center justify-center rounded-full bg-secondary hover:bg-secondary/80"
          style={{ animation: 'fadeSlideUp 0.5s cubic-bezier(0.16,1,0.3,1) both', animationDelay: '0.1s' }}
        >
          <X className="h-8 w-8" />
        </button>
      </div>

      <div className="relative flex flex-1 flex-col items-center justify-center gap-8 px-6" style={{ animation: 'fadeIn 0.6s ease-out both', animationDelay: '0.2s' }}>
        {currentSong ? (
          <>
            <img
              src={songCoverUrl(currentSong)}
              alt={currentSong.title}
              className="h-64 w-64 rounded-3xl object-cover shadow-elegant"
              style={{ animation: 'scaleIn 0.6s cubic-bezier(0.16,1,0.3,1) both', animationDelay: '0.3s' }}
            />
            <div className="text-center" style={{ animation: 'fadeSlideUp 0.5s cubic-bezier(0.16,1,0.3,1) both', animationDelay: '0.45s' }}>
              <h1 className="text-4xl font-bold text-foreground">{currentSong.title}</h1>
              <p className="mt-2 text-2xl text-muted-foreground">{currentSong.author}</p>
            </div>
          </>
        ) : (
          <p className="text-2xl text-muted-foreground">Aucune musique en cours</p>
        )}
      </div>

      <div className="relative grid grid-cols-3 items-center gap-4 p-8" style={{ animation: 'fadeSlideUp 0.6s cubic-bezier(0.16,1,0.3,1) both', animationDelay: '0.5s' }}>
        <button
          onClick={previous}
          aria-label="Précédent"
          className="flex h-28 items-center justify-center rounded-3xl bg-secondary hover:bg-secondary/80 active:scale-95"
        >
          <SkipBack className="h-12 w-12 fill-current" />
        </button>
        <button
          onClick={togglePlay}
          aria-label={isPlaying ? 'Pause' : 'Lecture'}
          className="flex h-32 items-center justify-center rounded-3xl bg-gradient-primary text-primary-foreground shadow-elegant active:scale-95"
        >
          {isPlaying ? <Pause className="h-16 w-16 fill-current" /> : <Play className="h-16 w-16 fill-current" />}
        </button>
        <button
          onClick={next}
          aria-label="Suivant"
          className="flex h-28 items-center justify-center rounded-3xl bg-secondary hover:bg-secondary/80 active:scale-95"
        >
          <SkipForward className="h-12 w-12 fill-current" />
        </button>
      </div>

      <div className="relative grid grid-cols-2 gap-4 px-8 pb-12" style={{ animation: 'fadeSlideUp 0.6s cubic-bezier(0.16,1,0.3,1) both', animationDelay: '0.6s' }}>
        <button
          onClick={toggleLike}
          disabled={!currentSong}
          className={`flex h-20 items-center justify-center gap-3 rounded-2xl text-xl font-bold transition-colors active:scale-95 ${
            liked ? 'bg-primary text-primary-foreground' : 'bg-secondary hover:bg-secondary/80'
          } disabled:opacity-50`}
        >
          <Heart className={`h-7 w-7 ${liked ? 'fill-current' : ''}`} /> J'aime
        </button>
        <button
          onClick={() => currentSong && startRadio(currentSong)}
          disabled={!currentSong}
          className="flex h-20 items-center justify-center gap-3 rounded-2xl bg-secondary text-xl font-bold transition-colors hover:bg-secondary/80 active:scale-95 disabled:opacity-50"
        >
          <Radio className="h-7 w-7" /> Radio
        </button>
      </div>
    </div>
  );
}