import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Pencil,
  Upload as UploadIcon,
  LogOut,
  Sparkles,
  Award,
  Music2,
} from 'lucide-react';
import { avatarUrl } from '@/lib/storage';
import { useEffect, useState } from 'react';
import { getBadges, type Badge } from '@/lib/badges';
import { supabase } from '@/integrations/supabase/client';
import { usePlayer } from '@/contexts/PlayerContext';
import SongCard from '@/components/SongCard';
import NativeAppSettings from '@/components/NativeAppSettings';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import type { Song } from '@/types/music';
import ThemeSelectorSheet from '@/components/ThemeSelectorSheet';

export default function ProfilePage() {
  const { profile, authUser, logout } = useAuth();
  const navigate = useNavigate();
  const { playSongFromList } = usePlayer();

  const [badges, setBadges] = useState<Badge[]>([]);
  const [songs, setSongs] = useState<Song[]>([]);
  const [counts, setCounts] = useState({ followers: 0, following: 0 });

  useEffect(() => {
    if (!authUser) return;

    getBadges(authUser.id).then(setBadges);

    supabase
      .from('songs')
      .select('*')
      .eq('uploaded_by', authUser.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => setSongs((data ?? []) as Song[]));

    supabase
      .from('follows')
      .select('id', { count: 'exact', head: true })
      .eq('following_id', authUser.id)
      .eq('status', 'accepted')
      .then(({ count }) => setCounts((c) => ({ ...c, followers: count ?? 0 })));

    supabase
      .from('follows')
      .select('id', { count: 'exact', head: true })
      .eq('follower_id', authUser.id)
      .eq('status', 'accepted')
      .then(({ count }) => setCounts((c) => ({ ...c, following: count ?? 0 })));
  }, [authUser]);

  const unlocked = badges.filter((b) => b.unlocked);

  return (
    <div className="min-h-screen pb-32">
      <header
        className="px-6 pt-6"
        style={{ animation: 'fadeSlideUp 0.6s cubic-bezier(0.16,1,0.3,1) both' }}
      >
        <div className="flex items-center gap-5">
          <Avatar className="h-20 w-20 ring-2 ring-primary/30">
            <AvatarImage src={profile ? avatarUrl(profile) : ''} />
            <AvatarFallback>
              {profile?.pseudo?.[0]?.toUpperCase() ?? '?'}
            </AvatarFallback>
          </Avatar>

          <div className="grid flex-1 grid-cols-3 gap-2 text-center">
            <div>
              <div className="text-lg font-bold">{songs.length}</div>
              <div className="text-xs text-muted-foreground">Sons</div>
            </div>
            <div>
              <div className="text-lg font-bold">{counts.followers}</div>
              <div className="text-xs text-muted-foreground">Abonnés</div>
            </div>
            <div>
              <div className="text-lg font-bold">{counts.following}</div>
              <div className="text-xs text-muted-foreground">Abonnements</div>
            </div>
          </div>
        </div>

        <div className="mt-4">
          <h1 className="text-base font-bold">{profile?.pseudo}</h1>
          {profile?.first_name || profile?.last_name ? (
            <p className="text-sm text-muted-foreground">
              {profile?.first_name} {profile?.last_name}
            </p>
          ) : null}
          {profile?.bio && <p className="mt-1 text-sm">{profile.bio}</p>}
        </div>

        <div
          className="mt-4 grid grid-cols-2 gap-2"
          style={{
            animation: 'fadeSlideUp 0.6s cubic-bezier(0.16,1,0.3,1) both',
            animationDelay: '0.1s',
          }}
        >
          <Button
            variant="secondary"
            size="sm"
            onClick={() => navigate('/profile-edit')}
          >
            <Pencil className="mr-2 h-4 w-4" /> Modifier
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={() => navigate('/upload')}
          >
            <UploadIcon className="mr-2 h-4 w-4" /> Publier
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={() => navigate('/wrapped')}
          >
            <Sparkles className="mr-2 h-4 w-4" /> Wrapped
          </Button>

          <Dialog>
            <DialogTrigger asChild>
              <Button variant="secondary" size="sm">
                <Award className="mr-2 h-4 w-4" /> Badges ({unlocked.length})
              </Button>
            </DialogTrigger>

            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>
                  Badges ({unlocked.length}/{badges.length})
                </DialogTitle>
              </DialogHeader>

              <div className="grid grid-cols-3 gap-3">
                {badges.map((b) => (
                  <div
                    key={b.id}
                    title={`${b.name} — ${b.description}`}
                    className={`flex aspect-square flex-col items-center justify-center rounded-xl border p-2 text-center transition-all ${
                      b.unlocked
                        ? 'border-primary/30 bg-gradient-primary text-primary-foreground shadow-elegant'
                        : 'border-border bg-secondary/40 opacity-40 grayscale'
                    }`}
                  >
                    <span className="text-3xl">{b.emoji}</span>
                    <span className="mt-1 line-clamp-1 text-[10px] font-semibold uppercase tracking-wide">
                      {b.name}
                    </span>
                  </div>
                ))}
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Paramètres (à gauche) + Déconnexion */}
        <div className="mt-2 flex gap-2">
          <div className="flex-1">
            <ThemeSelectorSheet triggerLabel="Paramètres" />
          </div>

          <Button
            variant="ghost"
            size="sm"
            className="flex-1 text-destructive hover:text-destructive"
            onClick={logout}
          >
            <LogOut className="mr-2 h-4 w-4" /> Se déconnecter
          </Button>
        </div>
      </header>

      <NativeAppSettings />

      <div
        className="mt-6 border-t border-border pt-4"
        style={{ animation: 'fadeIn 0.6s ease-out both', animationDelay: '0.2s' }}
      >
        <div className="mb-3 flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <Music2 className="h-4 w-4" /> Publications
        </div>

        {songs.length === 0 ? (
          <p className="px-6 py-12 text-center text-sm text-muted-foreground">
            Aucun morceau publié pour l'instant.
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-1 px-1 sm:grid-cols-4 md:grid-cols-5">
            {songs.map((s, i) => (
              <div
                key={s.id}
                style={{
                  animation: 'scaleIn 0.4s cubic-bezier(0.16,1,0.3,1) both',
                  animationDelay: `${0.25 + i * 0.03}s`,
                }}
              >
                <SongCard song={s} onPlay={() => playSongFromList(s, songs)} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
