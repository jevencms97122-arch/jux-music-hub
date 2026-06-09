import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { useNavigate, useLocation } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Pencil, Upload as UploadIcon, LogOut, Sparkles, Award, Music2, Settings, PlusCircle, History, Flame, ListMusic } from 'lucide-react';
import { avatarUrl, songCoverUrl } from '@/lib/storage';
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
import SettingsSheet from '@/components/SettingsSheet';

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

export default function ProfilePage() {
  const { profile, user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { playSongFromList } = usePlayer();

  const [badges, setBadges] = useState<Badge[]>([]);
  const [songs, setSongs] = useState<Song[]>([]);
  const [counts, setCounts] = useState({ followers: 0, following: 0 });
  const [streak, setStreak] = useState(0);
  const [totalListens, setTotalListens] = useState(0);
  const [recentHistory, setRecentHistory] = useState<{ song: Song; listenedAt: string }[]>([]);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    if (!user) return;
    // Réinitialiser les songs avant le chargement
    setSongs([]);

    getBadges(user.id).then(setBadges);
    getUserStats(user.id).then((s: any) => {
      setStreak(s?.current_streak ?? 0);
      setTotalListens(s?.total_listens ?? 0);
    });

    (async () => {
      const [songRes, followersRes, followingRes, historyRes] = await Promise.all([
        pb.collection('songs').getList(1, 100, { filter: `uploaded_by = "${user.id}"`, sort: '-created', requestKey: null }),
        pb.collection('follows').getList(1, 1, { filter: `following_id = "${user.id}" && status = "accepted"`, requestKey: null }),
        pb.collection('follows').getList(1, 1, { filter: `follower_id = "${user.id}" && status = "accepted"`, requestKey: null }),
        pb.collection('listen_history').getList(1, 10, { filter: `user_id = "${user.id}"`, sort: '-listened_at', requestKey: null }),
      ]);
      setSongs(songRes.items.map(recordToSong));
      setCounts({ followers: followersRes.totalItems, following: followingRes.totalItems });

      if (historyRes.items.length > 0) {
        const songIds = [...new Set(historyRes.items.map((r: any) => r.song_id))].filter(Boolean) as string[];
        const songMap: Record<string, Song> = {};
        if (songIds.length > 0) {
          const filters = songIds.map((sid) => `id = "${sid}"`).join(' || ');
          const songRes2 = await pb.collection('songs').getList(1, 50, { filter: filters, requestKey: null });
          for (const r of songRes2.items) songMap[r.id] = recordToSong(r);
        }
        setRecentHistory(
          historyRes.items
            .filter((r: any) => songMap[r.song_id])
            .map((r: any) => ({ song: songMap[r.song_id], listenedAt: r.listened_at }))
        );
      }
    })();
  }, [user, location.pathname]);

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
        </div>

        <div className="mt-4">
          <h1 className="text-xl font-bold">{profile?.pseudo ?? 'Utilisateur'}</h1>
          {profile?.bio && <p className="text-sm text-muted-foreground mt-1">{profile.bio}</p>}
        </div>

        <div className="mt-4 flex gap-2">
          <Button size="sm" className="flex-1" onClick={() => navigate('/profile-edit')}><Pencil className="h-4 w-4 mr-1" />Modifier</Button>
          <Button size="sm" variant="outline" onClick={() => navigate('/upload')}><PlusCircle className="h-4 w-4 mr-1" />Publier</Button>
          <SettingsSheet
            trigger={
              <Button size="sm" variant="outline" aria-label="Paramètres">
                <Settings className="h-4 w-4" />
              </Button>
            }
          />
        </div>
      </header>

      {(streak > 0 || totalListens > 0) && (
        <section className="px-6 mt-4">
          <div className="flex gap-3">
            {streak > 0 && (
              <div className="flex-1 flex flex-col items-center gap-1 rounded-2xl bg-card/60 py-3 px-2 border border-border/50">
                <Flame className="h-5 w-5 text-orange-400" />
                <span className="text-lg font-bold">{streak}</span>
                <span className="text-[10px] text-muted-foreground">Série en cours</span>
              </div>
            )}
            {totalListens > 0 && (
              <div className="flex-1 flex flex-col items-center gap-1 rounded-2xl bg-card/60 py-3 px-2 border border-border/50">
                <Music2 className="h-5 w-5 text-primary" />
                <span className="text-lg font-bold">{totalListens}</span>
                <span className="text-[10px] text-muted-foreground">Écoutes totales</span>
              </div>
            )}
            <button
              onClick={() => navigate('/wrapped')}
              className="flex-1 flex flex-col items-center gap-1 rounded-2xl bg-gradient-primary py-3 px-2"
            >
              <Sparkles className="h-5 w-5 text-primary-foreground" />
              <span className="text-lg font-bold text-primary-foreground">Wrapped</span>
              <span className="text-[10px] text-primary-foreground/70">Mes stats</span>
            </button>
          </div>
        </section>
      )}

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

      {recentHistory.length > 0 && (
        <section className="px-6 mt-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold flex items-center gap-2"><History className="h-5 w-5 text-primary" />Écoutes récentes</h2>
            <button onClick={() => navigate('/favorites')} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
              <ListMusic className="h-3.5 w-3.5" /> Favoris
            </button>
          </div>
          <div className="space-y-2">
            {recentHistory.map(({ song, listenedAt }, i) => (
              <button
                key={`${song.id}-${i}`}
                onClick={() => playSongFromList(song, recentHistory.map((h) => h.song))}
                className="flex w-full items-center gap-3 rounded-xl bg-card/50 p-2 text-left hover:bg-card"
              >
                <img src={songCoverUrl(song)} alt="" className="h-11 w-11 rounded-lg object-cover flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{song.title}</p>
                  <p className="truncate text-xs text-muted-foreground">{song.author}</p>
                </div>
                <span className="text-[10px] text-muted-foreground flex-shrink-0">
                  {new Date(listenedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      <NativeAppSettings />
    </div>
  );
}