import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Play, Pause } from 'lucide-react';
import { pb, getSongCoverUrl, getSongAudioUrl } from '@/lib/pocketbase';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import type { Song } from '@/types/music';

interface CreateStoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  song: Song;
}

export default function CreateStoryModal({ isOpen, onClose, song }: CreateStoryModalProps) {
  const { user } = useAuth();
  const [startTime, setStartTime] = useState(0);
  const [comment, setComment] = useState('');
  const [posting, setPosting] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [previewAudio] = useState(() => new Audio());

  const endTime = Math.min(startTime + 15, 300); // Max 15 seconds

  const handlePreview = () => {
    if (previewing) {
      previewAudio.pause();
      setPreviewing(false);
      return;
    }
    previewAudio.src = getSongAudioUrl(song);
    previewAudio.currentTime = startTime;
    previewAudio.play();
    setPreviewing(true);

    // Stop after 15 seconds
    setTimeout(() => {
      previewAudio.pause();
      setPreviewing(false);
    }, 15000);
  };

  const handlePost = async () => {
    if (!user) return;
    setPosting(true);
    try {
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);

      await pb.collection('stories').create({
        user: user.id,
        song: song.id,
        startTime,
        endTime,
        comment,
        expiresAt: expiresAt.toISOString(),
      });

      toast.success('Story publiée !');
      previewAudio.pause();
      onClose();
    } catch (error) {
      console.error('Error creating story:', error);
      toast.error('Erreur lors de la publication');
    } finally {
      setPosting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[60] bg-background/95 flex flex-col"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <button onClick={() => { previewAudio.pause(); onClose(); }} className="p-2">
            <X className="h-6 w-6 text-foreground" />
          </button>
          <h2 className="text-sm font-semibold text-foreground">Nouvelle Story</h2>
          <button
            onClick={handlePost}
            disabled={posting}
            className="px-4 py-1.5 bg-primary text-primary-foreground rounded-full text-sm font-medium disabled:opacity-50"
          >
            {posting ? '...' : 'Publier'}
          </button>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center px-6 gap-6">
          {/* Cover */}
          <div className="w-48 h-48 rounded-2xl overflow-hidden shadow-2xl">
            <img src={getSongCoverUrl(song)} alt={song.title} className="w-full h-full object-cover" />
          </div>

          <div className="text-center">
            <h3 className="text-lg font-bold text-foreground">{song.title}</h3>
            <p className="text-sm text-muted-foreground">{song.author}</p>
          </div>

          {/* Time selector */}
          <div className="w-full max-w-sm space-y-3">
            <label className="text-xs text-muted-foreground block text-center">
              Début de l'extrait : {Math.floor(startTime / 60)}:{String(Math.floor(startTime % 60)).padStart(2, '0')} → {Math.floor(endTime / 60)}:{String(Math.floor(endTime % 60)).padStart(2, '0')}
            </label>
            <input
              type="range"
              min={0}
              max={285}
              value={startTime}
              onChange={(e) => setStartTime(Number(e.target.value))}
              className="w-full accent-primary"
            />

            <button
              onClick={handlePreview}
              className="mx-auto flex items-center gap-2 px-4 py-2 bg-secondary rounded-full text-sm"
            >
              {previewing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              {previewing ? 'Arrêter' : 'Écouter l\'extrait'}
            </button>
          </div>

          {/* Comment */}
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Ajouter un commentaire..."
            maxLength={200}
            className="w-full max-w-sm p-3 bg-card border border-border rounded-xl text-sm text-foreground resize-none h-20 placeholder:text-muted-foreground"
          />
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
