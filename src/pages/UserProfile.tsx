import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { pb } from '@/lib/pocketbase';
import { useAuth } from '@/contexts/AuthContext';
import { usePlayer } from '@/contexts/PlayerContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import SongCard from '@/components/SongCard';
import { ArrowLeft } from 'lucide-react';
import { avatarUrl } from '@/lib/storage';
import { toast } from 'sonner';
import { getUserStats } from '@/lib/streaks';
import type { Profile, Song } from '@/types/music';

function recordToSong(r: any): Song {
  return {
    id: r.id, title: r.title || '', author: r.author || '', audio: r.audio || '',
    cover: r.cover || null, audio_url: r.audio_url || '',
    cover_url: r.cover_url || null, video_url: r.video_url || null, genre: r.genre || null,
    uploaded_by: r.uploaded_by || '', duration: r.duration || 0, play_count: r.play_count ?? 0,
    weekly_play_count: r.weekly_play_count ?? 0, likes_count: r.likes_count ?? 0,
    created_at: r.created, updated_at: r.updated,
    collectionId: r.collectionId, collectionName: r.collectionName,
  };
}

export default function UserProfile() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { playSongFromList } = usePlayer();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [songs, setSongs] = useState<Song[]>([]);
  const [followStatus, setFollowStatus] = useState<'none' | 'pending' | 'accepted'>('none');
  const [counts, setCounts] = useState({ followers: 0, following: 0 });
  const [streak, setStreak] = useState(0);

  const pbGetFirst = async (collection: string, filter: string) => {
    try { const r = await pb.collection(collection).getList(1, 1, { filter, requestKey: null }); return r.items[0] || null; } catch { return null; }
  };

  const load = async () => {
    if (!userId) return;
    const pRecord = await pbGetFirst('profiles', `user_id = "${userId}"`);
    setProfile(pRecord ? { id: pRecord.id, user_id: pRecord.get('user_id'), pseudo: pRecord.get('pseudo'), first_name: pRecord.get('first_name'), last_name: pRecord.get('last_name'), avatar_url: pRecord.get('avatar') ? 'avatar' : null, bio: pRecord.get('bio'), profile_completed: pRecord.get('profile_completed'), created_at: pRecord.get('created') || pRecord.created, updated_at: pRecord.get('updated') || pRecord.updated } as Profile : null);

    const songRes = await pb.collection('songs').getList(1, 100, { filter: `uploaded_by = "${userId}"`, sort: '-created', requestKey: null });
    setSongs(songRes.items.map(recordToSong));

    const [fers, fing] = await Promise.all([
      pb.collection('follows').getList(1, 1, { filter: `following_id = "${userId}" && status = "accepted"`, requestKey: null }),
      pb.collection('follows').getList(1, 1, { filter: `follower_id = "${userId}" && status = "accepted"`, requestKey: null }),
    ]);
    setCounts({ followers: fers.totalItems, following: fing.totalItems });

    const statsData = await getUserStats(userId);
    setStreak(statsData?.get('current_streak') ?? 0);

    if (user && user.id !== userId) {
      const fRecord = await pbGetFirst('follows', `follower_id = "${user.id}" && following_id = "${userId}"`);
      setFollowStatus(fRecord?.get('status') || 'none');
    }
  };

  useEffect(() => { load(); }, [userId, user]);

  const follow = async () => {
    if (!user || !userId) return;
    try {
      await pb.collection('follows').create({ follower_id: user.id, following_id: userId, status: 'accepted' });
      await pb.collection('notifications').create({ recipient_id: userId, type: 'friend_request', title: 'Nouvel abonné', body: `${user.email} vous suit` });
      setFollowStatus('accepted');
    } catch (e: any) { toast.error(e.message); }
  };

  const unfollow = async () => {
    if (!user || !userId) return;
    const fRecord = await pbGetFirst('follows', `follower_id = "${user.id}" && following_id = "${userId}"`);
    if (fRecord) await pb.collection('follows').delete(fRecord.id);
    setFollowStatus('none');
  };

  if (!profile) return <div className="p-6 text-sm text-muted-foreground">Chargement...</div>;

  const isMe = user?.id === profile.user_id;

  return (
    <div className="min-h-screen pb-32 p-4">
      <header className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}><ArrowLeft className="h-5 w-5" /></Button>
        <h1 className="text-xl font-bold">Profil</h1>
      </header>

      <div className="flex flex-col items-center mb-6">
        <Avatar className="h-24 w-24 ring-2 ring-primary/30 mb-4">
          <AvatarImage src={avatarUrl(profile)} />
          <AvatarFallback>{profile.pseudo?.[0]?.toUpperCase() ?? '?'}</AvatarFallback>
        </Avatar>
        <h2 className="text-xl font-bold">{profile.pseudo || 'Utilisateur'}</h2>
        {profile.bio && <p className="text-sm text-muted-foreground mt-1">{profile.bio}</p>}
      </div>

      <div className="flex justify-center gap-8 mb-6">
        <div className="text-center"><div className="text-lg font-bold">{songs.length}</div><div className="text-xs text-muted-foreground">Sons</div></div>
        <div className="text-center"><div className="text-lg font-bold">{counts.followers}</div><div className="text-xs text-muted-foreground">Abonnés</div></div>
        <div className="text-center"><div className="text-lg font-bold">{counts.following}</div><div className="text-xs text-muted-foreground">Abonnements</div></div>
      </div>

      {!isMe && user && (
        <div className="text-center mb-6">
          {followStatus === 'accepted' ? (
            <Button variant="outline" onClick={unfollow}>Ne plus suivre</Button>
          ) : (
            <Button onClick={follow}>Suivre</Button>
          )}
        </div>
      )}

      {songs.length > 0 && (
        <div>
          <h3 className="font-bold mb-3">Ses morceaux</h3>
          <div className="grid grid-cols-2 gap-3">
            {songs.map((s) => (<SongCard key={s.id} song={s} onPlay={() => playSongFromList(s, songs)} />))}
          </div>
        </div>
      )}
    </div>
  );
}