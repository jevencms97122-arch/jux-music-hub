import { useState, useRef } from 'react';
import { pb } from '@/lib/pocketbase';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Play, Send, Music2 } from 'lucide-react';
import { toast } from 'sonner';
import { usePlayer } from '@/contexts/PlayerContext';
import type { Song } from '@/types/music';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export default function CreateStoryModal({ open, onOpenChange }: Props) {
  const { user } = useAuth();
  const { currentSong, currentTime } = usePlayer();
  const [comment, setComment] = useState('');

  const create = async () => {
    if (!user || !currentSong) { toast.error('Aucune musique en cours'); return; }
    try {
      const endTime = Math.min(currentTime + 15, currentSong.duration ?? 120);
      await pb.collection('stories').create({
        user_id: user.id,
        song_id: currentSong.id,
        start_time: currentTime,
        end_time: endTime,
        comment: comment.trim() || null,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });
      toast.success('Story publiée !');
      onOpenChange(false);
      setComment('');
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Créer une story</DialogTitle></DialogHeader>
        <div className="space-y-4">
          {currentSong ? (
            <div className="flex items-center gap-3 rounded-xl bg-card p-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-primary"><Music2 className="h-6 w-6 text-primary-foreground" /></div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold truncate">{currentSong.title}</p>
                <p className="text-xs text-muted-foreground">{currentSong.author}</p>
              </div>
            </div>
          ) : <p className="text-sm text-muted-foreground">Lance une musique d'abord</p>}
          <Input placeholder="Ajouter un commentaire..." value={comment} onChange={(e) => setComment(e.target.value)} />
          <Button className="w-full" onClick={create} disabled={!currentSong}>
            <Send className="h-4 w-4 mr-2" /> Publier la story
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}