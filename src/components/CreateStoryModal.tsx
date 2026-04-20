import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { usePlayer } from '@/contexts/PlayerContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export default function CreateStoryModal({ open, onOpenChange }: Props) {
  const { authUser } = useAuth();
  const { currentSong, duration } = usePlayer();
  const [start, setStart] = useState(0);
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!authUser || !currentSong) return;
    setSaving(true);
    const { error } = await supabase.from('stories').insert({
      user_id: authUser.id,
      song_id: currentSong.id,
      start_time: start,
      end_time: Math.min(start + 15, duration || start + 15),
      comment: comment.trim() || null,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Story publiée');
    onOpenChange(false);
    setComment('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Publier une story</DialogTitle></DialogHeader>
        {!currentSong ? (
          <p className="text-sm text-muted-foreground">Lance une musique d'abord.</p>
        ) : (
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium">{currentSong.title}</p>
              <p className="text-xs text-muted-foreground">{currentSong.author}</p>
            </div>
            <div>
              <p className="mb-2 text-xs text-muted-foreground">Début : {Math.floor(start)}s — Durée : 15s</p>
              <Slider value={[start]} max={Math.max(0, (duration || 0) - 15)} step={1} onValueChange={(v) => setStart(v[0])} />
            </div>
            <Textarea placeholder="Commentaire (optionnel)" value={comment} onChange={(e) => setComment(e.target.value)} maxLength={200} />
            <Button className="w-full" onClick={submit} disabled={saving}>
              {saving ? 'Publication...' : 'Publier'}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
