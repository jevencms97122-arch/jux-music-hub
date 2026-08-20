import { useEffect, useState } from 'react';
import { pb } from '@/lib/pocketbase';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Crown, Users } from 'lucide-react';
import { avatarUrl } from '@/lib/storage';
import type { ListenSessionRow } from '@/contexts/PlayerContext';

interface ParticipantInfo {
  user_id: string;
  pseudo: string;
  avatar_url: string;
}

export default function SessionParticipantsSheet({ session, open, onOpenChange }: {
  session: ListenSessionRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [participants, setParticipants] = useState<ParticipantInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open || !session) return;
    setLoading(true);
    (async () => {
      const ids = session.participants || [];
      if (ids.length === 0) { setParticipants([]); setLoading(false); return; }
      try {
        const filter = ids.map((id) => `user_id = "${id}"`).join(' || ');
        const res = await pb.collection('profiles').getList(1, 100, { filter, requestKey: null });
        const byId = new Map(res.items.map((r: any) => [r.user_id, r]));
        const ordered = ids
          .map((id) => byId.get(id))
          .filter(Boolean)
          .map((r: any) => ({ user_id: r.user_id, pseudo: r.pseudo, avatar_url: avatarUrl(r) }));
        setParticipants(ordered);
      } catch {
        setParticipants([]);
      }
      setLoading(false);
    })();
  }, [open, session]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl pb-safe max-h-[70vh] flex flex-col overflow-hidden">
        <SheetHeader className="mb-4 flex-shrink-0">
          <SheetTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Participants ({session?.participants?.length ?? 0})
          </SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
          {loading ? (
            <p className="text-center text-xs text-muted-foreground py-8">Chargement…</p>
          ) : participants.length === 0 ? (
            <p className="text-center text-xs text-muted-foreground py-8">Aucun participant</p>
          ) : (
            participants.map((p) => {
              const isAdmin = p.user_id === session?.host_id;
              return (
                <div key={p.user_id} className="flex items-center gap-3 rounded-xl bg-card/60 border border-white/[0.06] px-3.5 py-2.5">
                  <Avatar className="h-9 w-9 shrink-0">
                    <AvatarImage src={p.avatar_url || ''} />
                    <AvatarFallback>{p.pseudo?.[0]?.toUpperCase() || '?'}</AvatarFallback>
                  </Avatar>
                  <p className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">{p.pseudo}</p>
                  <span className={
                    isAdmin
                      ? 'flex items-center gap-1 rounded-full bg-primary/15 px-2.5 py-1 text-[10px] font-bold text-primary shrink-0'
                      : 'rounded-full bg-secondary px-2.5 py-1 text-[10px] font-semibold text-muted-foreground shrink-0'
                  }>
                    {isAdmin && <Crown className="h-3 w-3" />}
                    {isAdmin ? 'Admin' : 'Auditeur'}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
