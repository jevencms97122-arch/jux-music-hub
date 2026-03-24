import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { pb, getUserAvatarUrl } from '@/lib/pocketbase';
import { useAuth } from '@/contexts/AuthContext';
import type { PBUser, Follow } from '@/types/music';
import { User, UserCheck, UserX, Users, Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';

type Tab = 'requests' | 'friends' | 'following';

export default function Social() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('requests');
  const [pendingRequests, setPendingRequests] = useState<Follow[]>([]);
  const [friends, setFriends] = useState<PBUser[]>([]);
  const [following, setFollowing] = useState<Follow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    loadData();
  }, [user, tab]);

  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      if (tab === 'requests') {
        const res = await pb.collection('follows').getFullList({
          filter: `following="${user.id}" && status="pending"`,
          expand: 'follower',
          sort: '-created',
        });
        setPendingRequests(res as unknown as Follow[]);
      } else if (tab === 'friends') {
        // Friends = mutual accepted follows
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

  const acceptRequest = async (followId: string) => {
    try {
      await pb.collection('follows').update(followId, { status: 'accepted' });
      // Auto-follow back to create friendship
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
    { key: 'requests', label: 'Demandes', icon: Bell },
    { key: 'friends', label: 'Amis', icon: Users },
    { key: 'following', label: 'Suivis', icon: UserCheck },
  ];

  return (
    <div className="pb-28">
      <div className="px-4 py-4">
        <h1 className="text-xl font-bold text-foreground">Espace Social</h1>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors ${
              tab === t.key ? 'text-foreground border-b-2 border-primary' : 'text-muted-foreground'
            }`}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
            {t.key === 'requests' && pendingRequests.length > 0 && (
              <span className="h-5 w-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center">
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
