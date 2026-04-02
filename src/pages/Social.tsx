import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { pb, getUserAvatarUrl, getSongCoverUrl } from '@/lib/pocketbase';
import { useAuth } from '@/contexts/AuthContext';
import { usePlayer } from '@/contexts/PlayerContext';
import type { PBUser, Follow, Song } from '@/types/music';
import { User, UserCheck, UserX, Users, Bell, Newspaper, Heart, Music, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';

type Tab = 'feed' | 'requests' | 'friends' | 'following';

interface FeedItem {
  id: string;
  type: 'like' | 'publish';
  user: PBUser;
  song: Song;
  created: string;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "à l'instant";
  if (mins < 60) return `il y a ${mins}min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `il y a ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `il y a ${days}j`;
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

export default function Social() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { playSong, currentSong, isPlaying } = usePlayer();
  const [tab, setTab] = useState<Tab>('feed');
  const [pendingRequests, setPendingRequests] = useState<Follow[]>([]);
  const [friends, setFriends] = useState<PBUser[]>([]);
  const [following, setFollowing] = useState<Follow[]>([]);
  const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    loadData();
  }, [user, tab]);

  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      if (tab === 'feed') {
        await loadFeed();
      } else if (tab === 'requests') {
        const res = await pb.collection('follows').getFullList({
          filter: `following="${user.id}" && status="pending"`,
          expand: 'follower',
          sort: '-created',
        });
        setPendingRequests(res as unknown as Follow[]);
      } else if (tab === 'friends') {
        const myFollowers = await pb.collection('follows').getFullList({
          filter: `following="${user.id}" && status="accepted"`,
          expand: 'follower',
        });
        const myFollowing = await pb.collection('follows').getFullList({
          filter: `follower="${user.id}" && status="accepted"`,
        });
        const followingIds = new Set(myFollowing.map((f: any) => f.following));
        const mutualFriends: PBUser[] = [];
        for (const f of myFollowers) {
          const followerId = (f as any).follower;
          if (followingIds.has(followerId)) {
            const expanded = (f as any).expand?.follower;
            if (expanded) mutualFriends.push(expanded as PBUser);
          }
        }
        setFriends(mutualFriends);
      } else {
        const res = await pb.collection('follows').getFullList({
          filter: `follower="${user.id}" && status="accepted"`,
          expand: 'following',
          sort: '-created',
        });
        setFollowing(res as unknown as Follow[]);
      }
    } catch (e) {
      console.error('Error loading social data:', e);
    } finally {
      setLoading(false);
    }
  };

  const loadFeed = async () => {
    if (!user) return;
    try {
      // Get friends IDs
      const myFollowing = await pb.collection('follows').getFullList({
        filter: `follower="${user.id}" && status="accepted"`,
      });
      const friendIds = myFollowing.map((f: any) => f.following);
      if (friendIds.length === 0) {
        setFeedItems([]);
        return;
      }

      const friendFilter = friendIds.map(id => `user="${id}"`).join('||');
      const uploaderFilter = friendIds.map(id => `uploadedBy="${id}"`).join('||');

      // Load recent likes and publications from friends in parallel
      const [likesRes, songsRes] = await Promise.all([
        pb.collection('song_likes').getList(1, 30, {
          filter: friendFilter,
          expand: 'user,song,song.uploadedBy',
          sort: '-created',
        }),
        pb.collection('songs').getList(1, 20, {
          filter: uploaderFilter,
          expand: 'uploadedBy',
          sort: '-created',
        }),
      ]);

      const items: FeedItem[] = [];

      for (const like of likesRes.items) {
        const likeUser = (like as any).expand?.user;
        const likeSong = (like as any).expand?.song;
        if (likeUser && likeSong) {
          items.push({
            id: `like-${like.id}`,
            type: 'like',
            user: likeUser as PBUser,
            song: likeSong as Song,
            created: like.created,
          });
        }
      }

      for (const song of songsRes.items) {
        const uploader = (song as any).expand?.uploadedBy;
        if (uploader) {
          items.push({
            id: `pub-${song.id}`,
            type: 'publish',
            user: uploader as PBUser,
            song: song as unknown as Song,
            created: song.created,
          });
        }
      }

      // Sort by date descending
      items.sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime());
      setFeedItems(items);
    } catch (e) {
      console.error('Error loading feed:', e);
    }
  };

  const acceptRequest = async (followId: string) => {
    try {
      await pb.collection('follows').update(followId, { status: 'accepted' });
      const follow = pendingRequests.find(f => f.id === followId);
      if (follow && user) {
        const existing = await pb.collection('follows').getList(1, 1, {
          filter: `follower="${user.id}" && following="${follow.follower}"`,
        });
        if (existing.items.length === 0) {
          await pb.collection('follows').create({
            follower: user.id,
            following: follow.follower,
            status: 'accepted',
          });
        }
      }
      setPendingRequests(prev => prev.filter(r => r.id !== followId));
    } catch (e) {
      console.error('Error accepting request:', e);
    }
  };

  const rejectRequest = async (followId: string) => {
    try {
      await pb.collection('follows').delete(followId);
      setPendingRequests(prev => prev.filter(r => r.id !== followId));
    } catch (e) {
      console.error('Error rejecting request:', e);
    }
  };

  const tabs: { key: Tab; label: string; icon: any }[] = [
    { key: 'feed', label: 'Fil', icon: Newspaper },
    { key: 'requests', label: 'Demandes', icon: Bell },
    { key: 'friends', label: 'Amis', icon: Users },
    { key: 'following', label: 'Suivis', icon: UserCheck },
  ];

  return (
    <div className="pb-28">
      <div className="px-4 py-4">
        <h1 className="text-xl font-bold text-foreground">Espace Social</h1>
      </div>

      {/* Stories */}
      <StoryCircles />

      {/* Tabs */}
      <div className="flex border-b border-border overflow-x-auto">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${
              tab === t.key ? 'text-foreground border-b-2 border-primary' : 'text-muted-foreground'
            }`}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
            {t.key === 'requests' && pendingRequests.length > 0 && (
              <span className="h-4 w-4 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center">
                {pendingRequests.length}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="px-4 pt-4">
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="h-6 w-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          </div>
        ) : (
          <>
            {/* Feed tab */}
            {tab === 'feed' && (
              feedItems.length === 0 ? (
                <div className="text-center py-12">
                  <Newspaper className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">Aucune activité récente</p>
                  <p className="text-xs text-muted-foreground mt-1">Suivez des amis pour voir leur activité ici</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {feedItems.map(item => (
                    <div key={item.id} className="flex gap-3 p-3 rounded-xl bg-card">
                      {/* User avatar */}
                      <button onClick={() => navigate(`/profile/${item.user.id}`)} className="shrink-0">
                        <div className="h-10 w-10 rounded-full overflow-hidden">
                          {item.user.avatar ? (
                            <img src={getUserAvatarUrl(item.user as any)} alt={item.user.pseudo} className="h-full w-full object-cover" />
                          ) : (
                            <div className="h-full w-full bg-secondary flex items-center justify-center">
                              <User className="h-5 w-5 text-muted-foreground" />
                            </div>
                          )}
                        </div>
                      </button>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-foreground">
                          <button onClick={() => navigate(`/profile/${item.user.id}`)} className="font-semibold hover:underline">
                            {item.user.pseudo}
                          </button>
                          {item.type === 'like' ? (
                            <span className="text-muted-foreground"> a aimé </span>
                          ) : (
                            <span className="text-muted-foreground"> a publié </span>
                          )}
                          <span className="font-medium">{item.song.title}</span>
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">{timeAgo(item.created)}</p>

                        {/* Song card */}
                        <button
                          onClick={() => playSong(item.song)}
                          className="flex items-center gap-3 mt-2 p-2 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors w-full text-left"
                        >
                          <img
                            src={getSongCoverUrl(item.song)}
                            alt={item.song.title}
                            className="h-12 w-12 rounded-md object-cover shrink-0"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-foreground truncate">{item.song.title}</p>
                            <p className="text-xs text-muted-foreground truncate">{item.song.author}</p>
                          </div>
                          <div className="shrink-0">
                            {item.type === 'like' ? (
                              <Heart className="h-4 w-4 text-primary fill-primary" />
                            ) : (
                              <Upload className="h-4 w-4 text-primary" />
                            )}
                          </div>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}

            {/* Requests tab */}
            {tab === 'requests' && (
              pendingRequests.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Aucune demande en attente</p>
              ) : (
                <div className="space-y-3">
                  {pendingRequests.map(req => {
                    const follower = req.expand?.follower;
                    if (!follower) return null;
                    return (
                      <div key={req.id} className="flex items-center gap-3 p-3 rounded-lg bg-card">
                        <button onClick={() => navigate(`/profile/${follower.id}`)} className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="h-10 w-10 rounded-full overflow-hidden shrink-0">
                            {follower.avatar ? (
                              <img src={getUserAvatarUrl(follower as any)} alt={follower.pseudo} className="h-full w-full object-cover" />
                            ) : (
                              <div className="h-full w-full bg-secondary flex items-center justify-center">
                                <User className="h-5 w-5 text-muted-foreground" />
                              </div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{follower.pseudo}</p>
                            <p className="text-xs text-muted-foreground truncate">{follower.firstName} {follower.lastName}</p>
                          </div>
                        </button>
                        <div className="flex gap-2 shrink-0">
                          <Button size="sm" onClick={() => acceptRequest(req.id)}>
                            <UserCheck className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => rejectRequest(req.id)}>
                            <UserX className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            )}

            {/* Friends tab */}
            {tab === 'friends' && (
              friends.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Aucun ami pour le moment</p>
              ) : (
                <div className="space-y-2">
                  {friends.map(f => (
                    <button
                      key={f.id}
                      onClick={() => navigate(`/profile/${f.id}`)}
                      className="flex items-center gap-3 w-full p-3 rounded-lg bg-card hover:bg-secondary transition-colors"
                    >
                      <div className="h-10 w-10 rounded-full overflow-hidden shrink-0">
                        {f.avatar ? (
                          <img src={getUserAvatarUrl(f as any)} alt={f.pseudo} className="h-full w-full object-cover" />
                        ) : (
                          <div className="h-full w-full bg-secondary flex items-center justify-center">
                            <User className="h-5 w-5 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                      <div className="text-left min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{f.pseudo}</p>
                        <p className="text-xs text-muted-foreground truncate">{f.firstName} {f.lastName}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )
            )}

            {/* Following tab */}
            {tab === 'following' && (
              following.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Vous ne suivez personne</p>
              ) : (
                <div className="space-y-2">
                  {following.map(f => {
                    const u = f.expand?.following;
                    if (!u) return null;
                    return (
                      <button
                        key={f.id}
                        onClick={() => navigate(`/profile/${u.id}`)}
                        className="flex items-center gap-3 w-full p-3 rounded-lg bg-card hover:bg-secondary transition-colors"
                      >
                        <div className="h-10 w-10 rounded-full overflow-hidden shrink-0">
                          {u.avatar ? (
                            <img src={getUserAvatarUrl(u as any)} alt={u.pseudo} className="h-full w-full object-cover" />
                          ) : (
                            <div className="h-full w-full bg-secondary flex items-center justify-center">
                              <User className="h-5 w-5 text-muted-foreground" />
                            </div>
                          )}
                        </div>
                        <div className="text-left min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{u.pseudo}</p>
                          <p className="text-xs text-muted-foreground truncate">{u.firstName} {u.lastName}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )
            )}
          </>
        )}
      </div>
    </div>
  );
}
