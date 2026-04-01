import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { pb, getSongCoverUrl, getSongAudioUrl } from '@/lib/pocketbase';
import { Play, Pause, Loader2, LogIn } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { usePlayer } from '@/contexts/PlayerContext';
import type { Song } from '@/types/music';

function formatTime(s: number) {
  if (!s || isNaN(s)) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

export default function SharedListen() {
  const { songId } = useParams<{ songId: string }>();
  const navigate = useNavigate();
  const [song, setSong] = useState<Song | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [audioReady, setAudioReady] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { user } = useAuth();
  const { playSongFromList } = usePlayer();

  useEffect(() => {
    let cancelled = false;

    const loadSong = async () => {
      if (!songId) {
        setError(true);
        setIsLoading(false);
        return;
      }

      try {
        const songData = await pb.collection('songs').getOne(songId, { expand: 'uploadedBy' });
        if (cancelled) return;

        const s = songData as unknown as Song;
        setSong(s);

        if (user) {
          playSongFromList(s, [s], 0);
          navigate('/');
          return;
        }

        // Create audio for non-logged-in users
        const audio = new Audio();
        audioRef.current = audio;

        audio.addEventListener('loadedmetadata', () => {
          if (!cancelled) {
            setDuration(audio.duration || 0);
            setAudioReady(true);
            setIsLoading(false);
          }
        });

        audio.addEventListener('canplay', () => {
          if (!cancelled) {
            setAudioReady(true);
            setIsLoading(false);
          }
        });

        audio.addEventListener('timeupdate', () => {
          if (!cancelled) setProgress(audio.currentTime);
        });

        audio.addEventListener('ended', () => {
          if (!cancelled) setIsPlaying(false);
        });

        audio.addEventListener('error', () => {
          if (!cancelled) {
            setError(true);
            setIsLoading(false);
          }
        });

        audio.src = getSongAudioUrl(s);
        audio.load();

        // Fallback timeout
        setTimeout(() => {
          if (!cancelled && isLoading) {
            setIsLoading(false);
          }
        }, 8000);
      } catch (err) {
        console.error('Erreur chargement musique:', err);
        if (!cancelled) {
          setError(true);
          setIsLoading(false);
        }
      }
    };

    loadSong();

    return () => {
      cancelled = true;
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [songId]);

  // If user logs in while on this page, redirect
  useEffect(() => {
    if (user && song) {
      playSongFromList(song, [song], 0);
      navigate('/');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().catch(console.error);
      setIsPlaying(true);
    }
  };

  const seek = (time: number) => {
    if (audioRef.current) audioRef.current.currentTime = time;
  };

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Musique introuvable ou erreur de chargement</p>
          <button onClick={() => navigate('/')} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg">
            Retour à l'accueil
          </button>
        </div>
      </div>
    );
  }

  if (isLoading || !song) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const uploaderPseudo = (song as any).expand?.uploadedBy?.pseudo;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="absolute inset-0 z-0">
        <img
          src={getSongCoverUrl(song)}
          alt=""
          className="w-full h-full object-cover blur-3xl opacity-30"
          onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder.svg'; }}
        />
        <div className="absolute inset-0 bg-background/80 backdrop-blur-md" />
      </div>

      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-8 py-12">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-64 h-64 sm:w-72 sm:h-72 md:w-80 md:h-80 rounded-xl overflow-hidden shadow-2xl mb-8"
        >
          <img
            src={getSongCoverUrl(song)}
            alt={song.title}
            className="h-full w-full object-cover"
            onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder.svg'; }}
          />
        </motion.div>

        <div className="w-full text-center mb-8 max-w-md">
          <h2 className="text-2xl font-bold text-foreground truncate mb-2">{song.title}</h2>
          <p className="text-muted-foreground truncate">
            {song.author}
            {uploaderPseudo && <span> · publié par {uploaderPseudo}</span>}
          </p>
        </div>

        <div className="flex items-center gap-4 mb-8 w-full max-w-md px-4">
          <span className="text-xs text-muted-foreground w-12 text-right flex-shrink-0">{formatTime(progress)}</span>
          <div className="flex-1 relative flex items-center h-3">
            <div className="absolute top-1/2 left-0 h-1 bg-secondary rounded-full w-full transform -translate-y-1/2" />
            <div
              className="absolute top-1/2 left-0 h-1 bg-primary rounded-full transform -translate-y-1/2"
              style={{ width: duration > 0 ? `${(Math.min(progress, duration) / duration) * 100}%` : '0%' }}
            />
            <input
              type="range"
              min={0}
              max={duration || 0}
              value={progress}
              onChange={(e) => seek(Number(e.target.value))}
              className="absolute w-full h-4 opacity-0 cursor-pointer"
            />
            <div
              className="absolute h-4 w-4 rounded-full bg-primary pointer-events-none transform -translate-x-1/2 -translate-y-1/2 top-1/2"
              style={{ left: duration > 0 ? `${(Math.min(progress, duration) / duration) * 100}%` : '0%' }}
            />
          </div>
          <span className="text-xs text-muted-foreground w-12 flex-shrink-0">{formatTime(duration)}</span>
        </div>

        <button
          onClick={togglePlay}
          className="h-16 w-16 rounded-full bg-foreground flex items-center justify-center mb-8"
          type="button"
        >
          {isPlaying ? (
            <Pause className="h-7 w-7 text-background fill-background" />
          ) : (
            <Play className="h-7 w-7 text-background fill-background ml-1" />
          )}
        </button>

        <div className="mt-8 p-6 bg-card/80 backdrop-blur-sm rounded-xl border border-border max-w-md w-full text-center">
          <p className="text-sm text-muted-foreground mb-4">
            Pour accéder à toutes les fonctionnalités, connectez-vous !
          </p>
          <button
            onClick={() => navigate('/')}
            className="w-full px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
          >
            <LogIn className="h-5 w-5" />
            Se connecter
          </button>
        </div>
      </div>
    </div>
  );
}
