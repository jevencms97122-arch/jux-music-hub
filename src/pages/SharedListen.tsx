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
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(new Audio());
  const { user } = useAuth();
  const { playCurrentSongOnly } = usePlayer();

  useEffect(() => {
    const loadSong = async () => {
      if (!songId) return;
      try {
        const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000));
        const songData = await Promise.race([pb.collection('songs').getOne(songId, { expand: 'uploadedBy' }), timeout]);
        setSong(songData as unknown as Song);
        if (user) {
          // If logged in, play the song in the app and redirect to home
          playCurrentSongOnly(songData as unknown as Song);
          navigate('/');
          return;
        }
        audioRef.current.src = getSongAudioUrl(songData as unknown as Song);
        audioRef.current.load();
        audioRef.current.addEventListener('loadeddata', () => setIsLoading(false));
        audioRef.current.addEventListener('error', () => {
          setError(true);
          setIsLoading(false);
        });
        // Timeout if loading takes too long
        setTimeout(() => {
          if (isLoading) {
            setError(true);
            setIsLoading(false);
          }
        }, 10000);
      } catch (error) {
        console.error('Erreur lors du chargement de la musique:', error);
        setError(true);
        setIsLoading(false);
      }
    };
    loadSong();
  }, [songId, user, playCurrentSongOnly, navigate]);

  useEffect(() => {
    const audio = audioRef.current;

    const onDur = () => setDuration(audio.duration || 0);
    const onTimeUpdate = () => setProgress(audio.currentTime);
    const onEnded = () => setIsPlaying(false);

    audio.addEventListener('loadedmetadata', onDur);
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('ended', onEnded);

    return () => {
      audio.removeEventListener('loadedmetadata', onDur);
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('ended', onEnded);
    };
  }, []);

  const togglePlay = () => {
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().catch(console.error);
      setIsPlaying(true);
    }
  };

  const seek = (time: number) => {
    audioRef.current.currentTime = time;
  };

  if (!song && !isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Musique introuvable</p>
          <button
            onClick={() => navigate('/')}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg"
          >
            Retour à l'accueil
          </button>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Erreur lors du chargement de la musique</p>
          <button
            onClick={() => navigate('/')}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg"
          >
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

  const uploaderPseudo = song.expand?.uploadedBy?.pseudo;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="absolute inset-0 z-0">
        <img
          src={getSongCoverUrl(song)}
          alt=""
          className="w-full h-full object-cover blur-3xl opacity-30"
          onError={(e) => {
            (e.target as HTMLImageElement).src = '/placeholder.svg';
          }}
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
            onError={(e) => {
              (e.target as HTMLImageElement).src = '/placeholder.svg';
            }}
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
              className="absolute top-1/2 left-0 h-1 bg-orange-500 rounded-full transform -translate-y-1/2"
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
              className="absolute h-4 w-4 rounded-full bg-orange-500 pointer-events-none transform -translate-x-1/2 -translate-y-1/2 top-1/2"
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
            Pour accéder à toutes les fonctionnalités communautaires et écouter vos musiques et celles de vos amis sans interruption, connectez-vous !
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