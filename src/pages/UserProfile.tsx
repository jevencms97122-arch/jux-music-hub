import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { pb, getUserAvatarUrl } from '@/lib/pocketbase';
import { useAuth } from '@/contexts/AuthContext';
import { usePlayer } from '@/contexts/PlayerContext';
import type { PBUser, Song, Follow } from '@/types/music';
import SongCard from '@/components/SongCard';
import { User, ArrowLeft, UserPlus, UserCheck, Clock, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export default function UserProfile() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const { playSong, currentSong, isPlaying } = usePlayer();

  const [profileUser, setProfileUser] = useState<PBUser | null>(null);
  const [songs, setSongs] = useState<Song[]>([]);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [followStatus, setFollowStatus] = useState<'none' | 'pending' | 'accepted' | 'self'>('none');
  const [followRecord, setFollowRecord] = useState<string | null>(null);
  const [mutualFriends, setMutualFriends] = useState<PBUser[]>([]);
  const [showMutualModal, setShowMutualModal] = useState(false);
  const [loading, setLoading] = useState(true);

  const isOwnProfile = currentUser?.id === userId;

  useEffect(() => {
    if (!userId) return;
    const load = async () => {
      setLoading(true);
      try {
        const [u, songsRes, followersRes, followingRes] = await Promise.all([
          pb.collection('users').getOne(userId),
          pb.collection('songs').getList(1, 50, {
            filter: `uploadedBy="${userId}"`,
            sort: '-created',
            expand: 'uploadedBy',
          }),
          pb.collection('follows').getList(1, 1, {
            filter: `following="${userId}" && status="accepted"`,
            skipTotal: false,
          }),
          pb.collection('follows').getList(1, 1, {
            filter: `follower="${userId}" && status="accepted"`,
            skipTotal: false,
          }),
        ]);
        setProfileUser(u as unknown as PBUser);
        setSongs(songsRes.items as unknown as Song[]);
        setFollowersCount(followersRes.totalItems);
        setFollowingCount(followingRes.totalItems);

        if (currentUser && currentUser.id !== userId) {
          // Check if current user follows this user
          const existingFollow = await pb.collection('follows').getList(1, 1, {
            filter: `follower="${currentUser.id}" && following="${userId}"`,
          });
          if (existingFollow.items.length > 0) {
            setFollowStatus(existingFollow.items[0].status as 'pending' | 'accepted');
            setFollowRecord(existingFollow.items[0].id);
          } else {
            setFollowStatus('none');
            setFollowRecord(null);
          }

          // Load mutual friends
          loadMutualFriends(currentUser.id, userId);
        } else if (isOwnProfile) {
          setFollowStatus('self');
        }
      } catch (e) {
        console.error('Error loading profile:', e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [userId, currentUser]);

  const loadMutualFriends = async (myId: string, theirId: string) => {
    try {
      // Get people who follow this profile (accepted)
      const theirFollowers = await pb.collection('follows').getFullList({
        filter: `following="${theirId}" && status="accepted"`,
        expand: 'follower',
      });
      // Get my friends (accepted follows in both directions)
      const myFollowing = await pb.collection('follows').getFullList({
        filter: `follower="${myId}" && status="accepted"`,
      });
      const myFollowingIds = new Set(myFollowing.map((f: any) => f.following));

      const mutuals: PBUser[] = [];
      for (const f of theirFollowers) {
        const followerId = (f as any).follower;
        if (myFollowingIds.has(followerId) && followerId !== myId) {
          const expanded = (f as any).expand?.follower;
          if (expanded) mutuals.push(expanded as PBUser);
        }
      }
      setMutualFriends(mutuals);
    } catch (e) {
      console.error('Error loading mutual friends:', e);
    }
  };

  const handleFollow = async () => {
    if (!currentUser || !userId) return;
    try {
      if (followStatus === 'none') {
        const record = await pb.collection('follows').create({
          follower: currentUser.id,
          following: userId,
          status: 'pending',
        });
        setFollowStatus('pending');
        setFollowRecord(record.id);
      } else if (followStatus === 'pending' || followStatus === 'accepted') {
        if (followRecord) {
          await pb.collection('follows').delete(followRecord);
        }
        setFollowStatus('none');
        setFollowRecord(null);
        if (followStatus === 'accepted') {
          setFollowersCount(c => Math.max(0, c - 1));
        }
      }
    } catch (e) {
      console.error('Error toggling follow:', e);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!profileUser) {
    return (
      <div className="pb-28 pt-4 px-4 text-center">
        <p className="text-muted-foreground">Utilisateur introuvable</p>
      </div>
    );
  }

  return (
    <div className="pb-28">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3">
        <button onClick={() => navigate(-1)} className="p-2 text-foreground" type="button">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-bold text-foreground">{profileUser.pseudo}</h1>
      </div>

      {/* Profile info */}
      <div className="flex flex-col items-center px-4 pb-6">
        <div className="h-24 w-24 rounded-full overflow-hidden mb-3">
          {profileUser.avatar ? (
            <img src={getUserAvatarUrl(profileUser as any)} alt={profileUser.pseudo} className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full bg-secondary flex items-center justify-center">
              <User className="h-10 w-10 text-muted-foreground" />
            </div>
          )}
        </div>
        <h2 className="text-xl font-bold text-foreground">{profileUser.pseudo}</h2>
        <p className="text-sm text-muted-foreground">{profileUser.firstName} {profileUser.lastName}</p>

        {/* Stats */}
        <div className="flex items-center gap-6 mt-4">
          <div className="text-center">
            <p className="text-lg font-bold text-foreground">{songs.length}</p>
            <p className="text-xs text-muted-foreground">Publications</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-foreground">{followersCount}</p>
            <p className="text-xs text-muted-foreground">Followers</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-foreground">{followingCount}</p>
            <p className="text-xs text-muted-foreground">Suivis</p>
          </div>
        </div>

        {/* Follow button */}
        {!isOwnProfile && currentUser && (
          <Button
            onClick={handleFollow}
            variant={followStatus === 'accepted' ? 'secondary' : followStatus === 'pending' ? 'outline' : 'default'}
            className="mt-4 gap-2"
          >
            {followStatus === 'none' && <><UserPlus className="h-4 w-4" /> Suivre</>}
            {followStatus === 'pending' && <><Clock className="h-4 w-4" /> En attente</>}
            {followStatus === 'accepted' && <><UserCheck className="h-4 w-4" /> Ami</>}
          </Button>
        )}

        {isOwnProfile && (
          <Button
            onClick={() => navigate('/profile-edit')}
            variant="outline"
            className="mt-4"
          >
            Modifier le profil
          </Button>
        )}

        {/* Mutual friends */}
        {!isOwnProfile && mutualFriends.length > 0 && (
          <button
            onClick={() => setShowMutualModal(true)}
            className="mt-3 flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <div className="flex -space-x-2">
              {mutualFriends.slice(0, 3).map(f => (
                <div key={f.id} className="h-5 w-5 rounded-full overflow-hidden border border-background">
                  {f.avatar ? (
                    <img src={getUserAvatarUrl(f as any)} alt={f.pseudo} className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full bg-secondary flex items-center justify-center">
                      <User className="h-2.5 w-2.5 text-muted-foreground" />
                    </div>
                  )}
                </div>
              ))}
            </div>
            <span>
              Suivi par {mutualFriends[0].pseudo}
              {mutualFriends.length > 1 && ` et ${mutualFriends.length - 1} autre${mutualFriends.length > 2 ? 's' : ''}`}
            </span>
          </button>
        )}
      </div>

      {/* Separator */}
      <div className="border-t border-border" />

      {/* Publications */}
      <section className="px-4 pt-4">
        <h3 className="text-sm font-semibold text-muted-foreground mb-3">Publications</h3>
        {songs.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {songs.map(s => (
              <SongCard
                key={s.id}
                song={s}
                size="sm"
                isActive={currentSong?.id === s.id}
                isPlaying={isPlaying}
                onPlay={playSong}
              />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-8">Aucune publication</p>
        )}
      </section>

      {/* Mutual friends modal */}
      <Dialog open={showMutualModal} onOpenChange={setShowMutualModal}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">Amis en commun</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {mutualFriends.map(f => (
              <button
                key={f.id}
                onClick={() => { setShowMutualModal(false); navigate(`/profile/${f.id}`); }}
                className="flex items-center gap-3 w-full p-2 rounded-lg hover:bg-secondary transition-colors"
              >
                <div className="h-10 w-10 rounded-full overflow-hidden">
                  {f.avatar ? (
                    <img src={getUserAvatarUrl(f as any)} alt={f.pseudo} className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full bg-secondary flex items-center justify-center">
                      <User className="h-5 w-5 text-muted-foreground" />
                    </div>
                  )}
                </div>
                <div className="text-left">
                  <p className="text-sm font-medium text-foreground">{f.pseudo}</p>
                  <p className="text-xs text-muted-foreground">{f.firstName} {f.lastName}</p>
                </div>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
