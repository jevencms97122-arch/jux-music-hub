import { useEffect, useState } from 'react';
import { Heart, Play } from 'lucide-react';
import { pb } from '@/lib/pocketbase';
import { useAuth } from '@/contexts/AuthContext';
import { usePlayer } from '@/contexts/PlayerContext';
import { recordToSong } from '@/lib/pbUtils';
import { songCoverUrl } from '@/lib/storage';
import CachedImage from '@/components/CachedImage';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import type { Song } from '@/types/music';

interface FriendLike {
  friendId: string;
  friendPseudo: string;
  friendAvatar: string | null;
  song: Song;
  likedAt: string;
}

/** Nombre maximum de titres likés récents affichés par ami. */
const MAX_PER_FRIEND = 3;

/**
 * Section "Ce que tes amis aiment" (page d'accueil) : les derniers titres likés
 * par les personnes que l'utilisateur suit — jusqu'à MAX_PER_FRIEND titres par
 * ami (les plus récents), affichés en rangée horizontale scrollable.
 */
export default function FriendsLikeSection() {
  const { user } = useAuth();
  const { playSongFromList } = usePlayer();
  const [items, setItems] = useState<FriendLike[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    let cancelled = false;

    (async () => {
      try {
        // 1. Amis suivis
        const follows = await pb.collection('follows').getList(1, 200, {
          filter: `follower_id = "${user.id}" && status = "accepted"`,
          requestKey: null,
        });
        const friendIds = follows.items.map((f: any) => f.following_id as string);
        if (friendIds.length === 0) { if (!cancelled) setLoading(false); return; }

        // 2. Leurs likes des 7 derniers jours
        const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const idFilter = friendIds.map((id) => `user_id = "${id}"`).join(' || ');
        const likesRes = await pb.collection('song_likes').getList(1, 60, {
          filter: `(${idFilter}) && created >= "${since}"`,
          sort: '-created',
          requestKey: null,
        });
        if (likesRes.items.length === 0) { if (!cancelled) setLoading(false); return; }

        // 3. Jusqu'à MAX_PER_FRIEND likes (les plus récents) par ami
        const byFriend = new Map<string, any[]>();
        for (const l of likesRes.items as any[]) {
          const list = byFriend.get(l.user_id) ?? [];
          if (list.length < MAX_PER_FRIEND) { list.push(l); byFriend.set(l.user_id, list); }
        }
        const picked = [...byFriend.values()].flat().slice(0, 36);

        // 4. Résolution songs + profiles en lot
        const songIds = [...new Set(picked.map((l) => l.song_id as string))];
        const friendUserIds = [...new Set(picked.map((l) => l.user_id as string))];
        const songFilter = songIds.map((id) => `id = "${id}"`).join(' || ');
        const profFilter = friendUserIds.map((id) => `user_id = "${id}"`).join(' || ');
        const [songsRes, profsRes] = await Promise.all([
          pb.collection('songs').getList(1, songIds.length, { filter: songFilter, requestKey: null }),
          pb.collection('profiles').getList(1, friendUserIds.length, { filter: profFilter, requestKey: null }),
        ]);
        const songMap = new Map(songsRes.items.map((s: any) => [s.id, recordToSong(s)]));
        const profMap = new Map(profsRes.items.map((p: any) => [p.user_id, p]));

        const result: FriendLike[] = [];
        for (const l of picked) {
          const song = songMap.get(l.song_id);
          const prof = profMap.get(l.user_id);
          if (!song || !prof) continue;
          result.push({
            friendId: l.user_id,
            friendPseudo: prof.pseudo || 'Ami',
            friendAvatar: prof.avatar ? pb.files.getUrl(prof, prof.avatar) : null,
            song,
            likedAt: l.created,
          });
        }
        if (!cancelled) setItems(result);
      } catch {
        // Silencieux : la section est simplement masquée
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [user]);

  if (loading || items.length === 0) return null;

  const allSongs = items.map((i) => i.song);

  return (
    <section className="relative px-4 mb-8 animate-fade-slide-up">
      <div className="mb-4 flex items-center gap-2.5">
        <Heart className="h-4 w-4 text-primary" strokeWidth={2} />
        <h2 className="text-base font-bold tracking-tight text-foreground">Ce que tes amis aiment</h2>
      </div>
      <div className="scrollbar-none -mx-4 flex gap-3 overflow-x-auto px-4 pb-1">
        {items.map((item) => (
          <button
            key={`${item.friendId}-${item.song.id}`}
            onClick={() => playSongFromList(item.song, allSongs)}
            className="group w-36 shrink-0 text-left"
          >
            <div className="relative mb-2 aspect-square overflow-hidden rounded-2xl bg-secondary shadow-soft">
              <CachedImage
                src={songCoverUrl(item.song)}
                alt={item.song.title}
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
              <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-primary text-primary-foreground shadow-elegant">
                  <Play className="h-4.5 w-4.5 fill-current ml-0.5" />
                </span>
              </div>
              {/* Badge ami en bas de la cover */}
              <div className="absolute bottom-1.5 left-1.5 flex items-center gap-1.5 rounded-full bg-black/60 py-1 pl-1 pr-2.5 backdrop-blur-sm">
                <Avatar className="h-5 w-5">
                  <AvatarImage src={item.friendAvatar || ''} />
                  <AvatarFallback className="text-[9px]">{item.friendPseudo[0]?.toUpperCase()}</AvatarFallback>
                </Avatar>
                <span className="max-w-20 truncate text-[10px] font-semibold text-white">{item.friendPseudo}</span>
                <Heart className="h-2.5 w-2.5 shrink-0 fill-red-500 text-red-500" />
              </div>
            </div>
            <p className="truncate text-sm font-semibold text-foreground">{item.song.title}</p>
            <p className="truncate text-xs text-muted-foreground">{item.song.author}</p>
          </button>
        ))}
      </div>
    </section>
  );
}
