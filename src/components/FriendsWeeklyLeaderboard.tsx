import { useEffect, useState } from 'react';
import { pb } from '@/lib/pocketbase';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { avatarUrl } from '@/lib/storage';
import { Trophy } from 'lucide-react';
import type { Profile } from '@/types/music';

interface Props {
  currentUserId: string;
  currentUserProfile: Profile | null;
  friends: Profile[];
}

interface RankedEntry {
  userId: string;
  profile: Profile | null;
  isMe: boolean;
  count: number;
}

function startOfCurrentWeek(): Date {
  const now = new Date();
  const day = now.getDay(); // 0 = dimanche
  const diffToMonday = (day + 6) % 7;
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - diffToMonday);
}

export default function FriendsWeeklyLeaderboard({ currentUserId, currentUserProfile, friends }: Props) {
  const [entries, setEntries] = useState<RankedEntry[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const ids = [currentUserId, ...friends.map((f) => f.user_id)];
        if (ids.length === 0) { setEntries([]); return; }
        const startStr = startOfCurrentWeek().toISOString().replace('T', ' ');
        const counts = new Map<string, number>();

        for (let i = 0; i < ids.length; i += 50) {
          const batch = ids.slice(i, i + 50);
          const idsFilter = batch.map((id) => `user_id = "${id}"`).join(' || ');
          const items = await pb.collection('listen_history').getFullList({
            filter: `(${idsFilter}) && listened_at >= "${startStr}"`,
            fields: 'user_id',
            requestKey: null,
          });
          items.forEach((h: any) => counts.set(h.user_id, (counts.get(h.user_id) ?? 0) + 1));
        }

        const profileById = new Map(friends.map((f) => [f.user_id, f]));
        const ranked: RankedEntry[] = ids
          .map((id) => ({
            userId: id,
            profile: id === currentUserId ? currentUserProfile : (profileById.get(id) ?? null),
            isMe: id === currentUserId,
            count: counts.get(id) ?? 0,
          }))
          .filter((e) => e.count > 0)
          .sort((a, b) => b.count - a.count);

        if (!cancelled) setEntries(ranked);
      } catch {
        if (!cancelled) setEntries([]);
      }
    })();
    return () => { cancelled = true; };
  }, [currentUserId, currentUserProfile, friends]);

  if (entries === null || entries.length === 0) return null;

  return (
    <section>
      <h2 className="mb-3 flex items-center gap-2 text-base font-bold">
        <Trophy className="h-4 w-4 text-primary" />
        Les plus actifs cette semaine
      </h2>
      <div className="max-h-[75vh] space-y-2 overflow-y-auto rounded-2xl border border-white/[0.06] bg-card/50 p-2 backdrop-blur-md">
        {entries.map((entry, i) => (
          <div
            key={entry.userId}
            className={`flex items-center gap-3 rounded-xl p-2.5 ${entry.isMe ? 'bg-primary/10 ring-1 ring-primary/30' : ''}`}
          >
            <span className="w-5 shrink-0 text-center text-sm font-extrabold text-muted-foreground">{i + 1}</span>
            <Avatar className="h-9 w-9 shrink-0">
              <AvatarImage src={avatarUrl(entry.profile as any) || ''} />
              <AvatarFallback>{entry.profile?.pseudo?.[0] || '?'}</AvatarFallback>
            </Avatar>
            <span className="min-w-0 flex-1 truncate text-sm font-semibold">
              {entry.isMe ? 'Toi' : (entry.profile?.pseudo || 'Anonyme')}
            </span>
            <span className="shrink-0 text-xs font-bold text-muted-foreground">
              {entry.count} écoute{entry.count > 1 ? 's' : ''}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
