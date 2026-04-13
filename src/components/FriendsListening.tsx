import { useState, useEffect } from 'react';
import { pb, getUserAvatarUrl, getSongCoverUrl } from '@/lib/pocketbase';
import { useAuth } from '@/contexts/AuthContext';
import { usePlayer } from '@/contexts/PlayerContext';
import type { PBUser, Song } from '@/types/music';
import { Headphones, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface FriendActivity {
  user: PBUser;
  song: Song;
  listenedAt: string;
}

export default function FriendsListening() {
  const { user } = useAuth();
  const { playSong } = usePlayer();
  const navigate = useNavigate();
  const [activities, setActivities] = useState<FriendActivity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const loadActivity = async () => {
      try {
        // Get friends
        const myFollowing = await pb.collection('follows').getFullList({
          filter: `follower="${user.id}" && status="accepted"`,
        });
        const friendIds = myFollowing.map((f: any) => f.following);
        if (friendIds.length === 0) {
          setActivities([]);
          setLoading(false);
          return;
        }

        // Get recent listens from friends (last 5 minutes = "currently listening")
        const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
        const filter = friendIds.map(id => `user="${id}"`).join('||');
        
        const listens = await pb.collection('listen_history').getList(1, 20, {
          filter: `(${filter}) && listenedAt>="${fiveMinAgo}"`,
          expand: 'user,song,song.uploadedBy',
          sort: '-listenedAt',
        });

        // Deduplicate: keep only latest per user
        const seen = new Set<string>();
        const result: FriendActivity[] = [];
        for (const item of listens.items) {
          const userId = (item as any).user;
          if (seen.has(userId)) continue;
          seen.add(userId);
          const u = (item as any).expand?.user;
          const s = (item as any).expand?.song;
          if (u && s) {
            result.push({ user: u as PBUser, song: s as Song, listenedAt: item.created });
          }
        }
        setActivities(result);
      } catch (e) {
        console.error('Error loading friends activity:', e);
      } finally {
        setLoading(false);
      }
    };

    loadActivity();
    const interval = setInterval(loadActivity, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, [user]);

  if (loading || activities.length === 0) return null;

  return (
    <div className="px-4 mb-6">
      <div className="flex items-center gap-2 mb-3">
        <Headphones className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">Amis en écoute</h3>
        <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
        {activities.map(act => (
          <button
            key={act.user.id}
            onClick={() => playSong(act.song)}
            className="flex-shrink-0 flex flex-col items-center gap-2 w-20"
          >
            <div className="relative">
              <div className="h-14 w-14 rounded-full overflow-hidden ring-2 ring-primary/50">
                {act.user.avatar ? (
                  <img src={getUserAvatarUrl(act.user as any)} alt={act.user.pseudo} className="h-full w-full object-cover" />
                ) : (
                  <div className="h-full w-full bg-secondary flex items-center justify-center">
                    <User className="h-6 w-6 text-muted-foreground" />
                  </div>
                )}
              </div>
              <div className="absolute -bottom-1 -right-1 h-5 w-5 rounded-md overflow-hidden shadow-md">
                <img src={getSongCoverUrl(act.song)} alt="" className="h-full w-full object-cover" />
              </div>
            </div>
            <span className="text-[10px] text-muted-foreground truncate w-full text-center">{act.user.pseudo}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
