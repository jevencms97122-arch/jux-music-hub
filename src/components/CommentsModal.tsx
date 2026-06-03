import { useEffect, useState } from 'react';
import { pb } from '@/lib/pocketbase';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, Trash2, User } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  songId: string;
}

export default function CommentsModal({ open, onOpenChange, songId }: Props) {
  const { user } = useAuth();
  const [comments, setComments] = useState<any[]>([]);
  const [text, setText] = useState('');
  const [profileMap, setProfileMap] = useState<Record<string, any>>({});

  useEffect(() => {
    if (!open || !songId) return;
    (async () => {
      const res = await pb.collection('song_comments').getList(1, 100, { filter: `song_id = "${songId}"`, sort: '-created', requestKey: null });
      setComments(res.items);
      const userIds = [...new Set(res.items.map((r: any) => r.get('user_id')))].filter(Boolean);
      for (const uid of userIds) {
        try {
          const prof = await pb.collection('profiles').getList(1, 1, { filter: `user_id = "${uid}"`, requestKey: null });
          if (prof.items[0]) profileMap[uid] = prof.items[0];
        } catch {}
      }
      setProfileMap({...profileMap});
    })();
  }, [open, songId]);

  const addComment = async () => {
    if (!user || !text.trim()) return;
    try {
      await pb.collection('song_comments').create({ song_id: songId, user_id: user.id, content: text.trim() });
      setText('');
      const res = await pb.collection('song_comments').getList(1, 100, { filter: `song_id = "${songId}"`, sort: '-created', requestKey: null });
      setComments(res.items);
    } catch (e: any) { toast.error(e.message); }
  };

  const deleteComment = async (id: string) => {
    try { await pb.collection('song_comments').delete(id); setComments((c) => c.filter((c) => c.id !== id)); } catch {}
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Commentaires</DialogTitle></DialogHeader>
        <div className="max-h-64 space-y-3 overflow-y-auto">
          {comments.length === 0 && <p className="text-sm text-muted-foreground">Aucun commentaire</p>}
          {comments.map((c: any) => (
            <div key={c.id} className="flex items-start gap-2 rounded-lg bg-card/50 p-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary"><User className="h-4 w-4" /></div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium">{profileMap[c.get('user_id')]?.get('pseudo') || 'Anonyme'}</p>
                <p className="text-sm">{c.get('content')}</p>
              </div>
              {user?.id === c.get('user_id') && (
                <Button variant="ghost" size="icon" className="shrink-0" onClick={() => deleteComment(c.id)}><Trash2 className="h-3 w-3" /></Button>
              )}
            </div>
          ))}
        </div>
        {user && (
          <div className="flex gap-2">
            <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Écris un commentaire..." onKeyDown={(e) => e.key === 'Enter' && addComment()} />
            <Button size="icon" onClick={addComment}><Send className="h-4 w-4" /></Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}