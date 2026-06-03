import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Pencil, Upload as UploadIcon, LogOut, Sparkles, Award, Music2, Settings } from 'lucide-react';
import { avatarUrl } from '@/lib/storage';
import { useEffect, useState } from 'react';
import { getBadges, type Badge } from '@/lib/badges';
import { getUserStats } from '@/lib/streaks';
import { pb } from '@/lib/pocketbase';
import { usePlayer } from '@/contexts/PlayerContext';
import SongCard from '@/components/SongCard';
import NativeAppSettings from '@/components/NativeAppSettings';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import type { Song } from '@/types/music';
import ThemeSelectorSheet from '@/components/ThemeSelectorSheet';
import ProfileQrCode from '@/components/ProfileQrCode';
import TransitionSettings from '@/components/TransitionSettings';

function recordToSong(r: any): Song {
  return {
    id: r.id, title: r.get('title') || '', author: r.get('author') || '', audio_url: r.get('audio_url') || '',
    cover_url: r.get('cover_url') || null, video_url: r.get('video_url') || null, genre: r.get('genre') || null,
    uploaded_by: r.get('uploaded_by') || '', duration: r.get('duration') || 0, play_count: r.get('play_count') ?? 0,
    weekly_play_count: r.get('weekly_play_count') ?? 0, likes_count: r.get('likes_count') ?? 0,
    created_at: r.get('created') || r.created, updated_at: r.get('updated') || r.updated,
    collectionId: r.collectionId, collectionName: r.collectionName,
  };
}

export default function ProfilePage() {
  const { profile, user, logout } = useAuth();
  const navigate = useNavigate();
  const { playSongFromList } = usePlayer();

  const [badges, setBadges] = useState<Badge[]>([]);
  const [songs, setSongs] = useState<Song[]>([]);
  const [counts, setCounts] = useState({ followers: 0, following: 0 });
  const [streak, setStreak] = useState(0);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    if (!user) return;

    getBadges(user.id).then(setBadges);
    getUserStats(user.id).then((s: any) => setStreak(s?.get('current_streak') ?? 0));

    (async () => {
      const [songRes, followersRes, followingRes] = await Promise.all([
        pb.collection('songs').getList(1, 100, { filter: `uploaded_by = "${user.id}"`, sort: '-created', requestKey: null }),
        pb.collection('follows').getList(1, 1, { filter: `following_id = "${user.id}" && status = "accepted"`, requestKey: null }),
        pb.collection('follows').getList(1, 1, { filter: `follower_id = "${user.id}" && status = "accepted"`, requestKey: null }),
      ]);
      setSongs(songRes.items.map(recordToSong));
      setCounts({ followers: followersRes.totalItems, following: followingRes.totalItems });
    })();
  }, [user]);

  const unlocked = badges.filter((b) => b.unlocked);

  return (
    <div className="min-h-screen pb-32">
      <header className="px-6 pt-6" style={{ animation: 'fadeSlideUp 0.6s cubic-bezier(0.16,1,0.3,1) both' }}>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-5 flex-1">
            <Avatar className="h-20 w-20 ring-2 ring-primary/30">
              <AvatarImage src={profile ? avatarUrl(profile) : ''} />
              <AvatarFallback>{profile?.pseudo?.[0]?.toUpperCase() ?? '?'}</AvatarFallback>
            </Avatar>
            <div className="grid flex-1 grid-cols-3 gap-2 text-center">
              <div><div className="text-lg font-bold">{songs.length}</div><div className="text-xs text-muted-foreground">Sons</div></div>
              <div><div className="text-lg font-bold">{counts.followers}</div><div className="text-xs text-muted-foreground">Abonnés</div></div>
              <div><div className="text-lg font-bold">{counts.following}</div><div className="text-xs text-muted-foreground">Abonnements</div></div>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={() => setShowSettings(true)}><Settings className="h-5 w-5" /></Button>
        </div>

        <div className="mt-4">
          <h1 className="text-xl font-bold">{profile?.pseudo ?? 'Utilisateur'}</h1>
          {profile?.bio && <p className="text-sm text-muted-foreground mt-1">{profile.bio}</p>}
        </div>

        <div className="mt-4 flex gap-2">
          <Button size="sm" className="flex-1" onClick={() => navigate('/profile/edit')}><Pencil className="h-4 w-4 mr-1" />Modifier</Button>
          <Button size="sm" variant="outline" onClick={() => navigate('/wrapped')}><Sparkles className="h-4 w-4 mr-1" />Wrapped</Button>
          <Button size="sm" variant="outline" onClick={logout}><LogOut className="h-4 w-4" /></Button>
        </div>
      </header>

      {unlocked.length > 0 && (
        <section className="px-6 mt-6">
          <h2 className="text-lg font-bold mb-3 flex items-center gap-2"><Award className="h-5 w-5 text-primary" />Badges ({unlocked.length}/{badges.length})</h2>
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
            {badges.map((b) => (
              <div key={b.id} className={`flex flex-col items-center gap-1 flex-shrink-0 ${b.unlocked ? 'opacity-100' : 'opacity-30'}`}>
                <div className={`flex h-14 w-14 items-center justify-center rounded-full text-2xl ${b.unlocked ? 'bg-gradient-primary' : 'bg-secondary'}`}>
                  {b.emoji}
                </div>
                <span className="text-[10px] text-center text-muted-foreground max-w-[72px] truncate">{b.name}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {songs.length > 0 && (
        <section className="px-6 mt-6">
          <h2 className="text-lg font-bold mb-3 flex items-center gap-2"><Music2 className="h-5 w-5 text-primary" />Mes morceaux</h2>
          <div className="grid grid-cols-2 gap-3">
            {songs.map((s) => (<SongCard key={s.id} song={s} onPlay={() => playSongFromList(s, songs)} />))}
          </div>
        </section>
      )}

      <NativeAppSettings />
    </div>
  );
}