import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePlayer } from '@/contexts/PlayerContext';
import { getSongCoverUrl } from '@/lib/pocketbase';
import { ChevronDown, Play, Pause, SkipForward, SkipBack, Shuffle, Repeat } from 'lucide-react';
import QueueView from './QueueView';

function formatTime(s: number) {
  if (!s || isNaN(s)) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

export default function PlayerPage() {
  const { currentSong, isPlaying, progress, duration, togglePlay, next, previous, seek, setPlayerOpen, playerOpen } = usePlayer();
  const [tab, setTab] = useState<'player' | 'queue'>('player');

  if (!currentSong) return null;

  const uploaderPseudo = currentSong.expand?.uploadedBy?.pseudo;

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
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3">
            <button onClick={() => { setPlayerOpen(false); setTab('player'); }} className="p-2 text-foreground">
              <ChevronDown className="h-6 w-6" />
            </button>
            <div className="text-center">
              <p className="text-xs text-muted-foreground">En cours de lecture</p>
            </div>
            <div className="w-10" />
          </div>

          {tab === 'player' ? (
            <div className="flex-1 flex flex-col items-center justify-center px-8">
              {/* Cover */}
              <div className="w-64 h-64 sm:w-72 sm:h-72 rounded-xl overflow-hidden shadow-2xl mb-8">
                <img src={getSongCoverUrl(currentSong)} alt={currentSong.title} className="h-full w-full object-cover" />
              </div>

              {/* Info */}
              <div className="w-full text-center mb-6">
                <h2 className="text-xl font-bold text-foreground truncate">{currentSong.title}</h2>
                <p className="text-sm text-muted-foreground truncate">
                  {currentSong.author}
                  {uploaderPseudo && <span> · publié par {uploaderPseudo}</span>}
                </p>
              </div>

              {/* Progress */}
              <div className="w-full mb-6">
                <input
                  type="range"
                  min={0}
                  max={duration || 0}
                  value={progress}
                  onChange={e => seek(Number(e.target.value))}
                  className="w-full h-1 appearance-none bg-secondary rounded-full [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-foreground"
                />
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>{formatTime(progress)}</span>
                  <span>{formatTime(duration)}</span>
                </div>
              </div>

              {/* Controls */}
              <div className="flex items-center justify-center gap-8">
                <button className="p-2 text-muted-foreground"><Shuffle className="h-5 w-5" /></button>
                <button onClick={previous} className="p-2 text-foreground"><SkipBack className="h-7 w-7 fill-foreground" /></button>
                <button
                  onClick={togglePlay}
                  className="h-16 w-16 rounded-full bg-foreground flex items-center justify-center"
                >
                  {isPlaying
                    ? <Pause className="h-7 w-7 text-background fill-background" />
                    : <Play className="h-7 w-7 text-background fill-background ml-1" />
                  }
                </button>
                <button onClick={next} className="p-2 text-foreground"><SkipForward className="h-7 w-7 fill-foreground" /></button>
                <button className="p-2 text-muted-foreground"><Repeat className="h-5 w-5" /></button>
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto">
              <QueueView />
            </div>
          )}

          {/* Bottom tabs */}
          <div className="flex border-t border-border safe-bottom">
            {(['player', 'queue'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 py-3 text-sm font-medium transition-colors ${tab === t ? 'text-foreground border-b-2 border-foreground' : 'text-muted-foreground'}`}
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
