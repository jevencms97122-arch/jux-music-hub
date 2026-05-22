import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { avatarUrl } from '@/lib/storage';
import { Send, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface CommentRow {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  profile?: { pseudo: string | null; avatar_url: string | null } | null;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  songId: string;
  onCountChange?: (n: number) => void;
}

export default function CommentsModal({ open, onOpenChange, songId, onCountChange }: Props) {
  const { authUser } = useAuth();
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);

  const load = async () => {
    const { data } = await supabase
      .from('song_comments')
      .select('id, content, created_at, user_id')
      .eq('song_id', songId)
      .order('created_at', { ascending: false });
    const rows = (data ?? []) as CommentRow[];
    const ids = Array.from(new Set(rows.map((r) => r.user_id)));
    if (ids.length) {
      const { data: profs } = await supabase
        .from('profiles').select('user_id, pseudo, avatar_url').in('user_id', ids);
      const map = new Map((profs ?? []).map((p: any) => [p.user_id, p]));
      rows.forEach((r) => { r.profile = map.get(r.user_id) ?? null; });
    }
    setComments(rows);
    onCountChange?.(rows.length);
  };

  useEffect(() => {
    if (open && songId) load();
  }, [open, songId]);

  const submit = async () => {
    const content = text.trim();
    if (!content || !authUser) return;
    if (content.length > 500) { toast.error('500 caractères max'); return; }
    setLoading(true);
    const { error } = await supabase.from('song_comments').insert({
      song_id: songId, user_id: authUser.id, content,
    });
    setLoading(false);
    if (error) { toast.error("Impossible d'envoyer le commentaire"); return; }
    setText('');
    await load();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from('song_comments').delete().eq('id', id);
    if (error) { toast.error('Suppression impossible'); return; }
    await load();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Commentaires ({comments.length})</DialogTitle>
        </DialogHeader>
        <div className="max-h-80 space-y-3 overflow-y-auto pr-1">
          {comments.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">Sois le premier à réagir</p>
          )}
          {comments.map((c) => (
            <div key={c.id} className="flex items-start gap-2 rounded-lg bg-secondary/40 p-2">
              <Avatar className="h-8 w-8">
                <AvatarImage src={avatarUrl({ avatar_url: c.profile?.avatar_url ?? null })} />
                <AvatarFallback className="text-xs">
                  {(c.profile?.pseudo ?? '?').slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-foreground">{c.profile?.pseudo ?? 'Utilisateur'}</p>
                <p className="break-words text-sm text-foreground/90">{c.content}</p>
              </div>
              {authUser?.id === c.user_id && (
                <button onClick={() => remove(c.id)} className="rounded p-1 text-muted-foreground hover:text-destructive">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2 pt-2">
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Écrire un commentaire..."
            maxLength={500}
            onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
          />
          <Button size="icon" onClick={submit} disabled={loading || !text.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
