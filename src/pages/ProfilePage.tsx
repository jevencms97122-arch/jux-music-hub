import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Pencil, Upload as UploadIcon, LogOut, Sparkles, Award } from 'lucide-react';
import { avatarUrl } from '@/lib/storage';
import { useEffect, useState } from 'react';
import { getBadges, type Badge } from '@/lib/badges';

export default function ProfilePage() {
  const { profile, authUser, logout } = useAuth();
  const navigate = useNavigate();
  const [badges, setBadges] = useState<Badge[]>([]);

  useEffect(() => {
    if (!authUser) return;
    getBadges(authUser.id).then(setBadges);
  }, [authUser]);

  const unlocked = badges.filter((b) => b.unlocked);

  return (
    <div className="min-h-screen px-6 py-6 pb-32">
      <div className="flex flex-col items-center gap-3">
        <Avatar className="h-24 w-24">
          <AvatarImage src={profile ? avatarUrl(profile) : ''} />
          <AvatarFallback>{profile?.pseudo?.[0]?.toUpperCase() ?? '?'}</AvatarFallback>
        </Avatar>
        <h1 className="text-xl font-bold">{profile?.pseudo}</h1>
        <p className="text-sm text-muted-foreground">{authUser?.email}</p>
        {profile?.bio && <p className="max-w-md text-center text-sm">{profile.bio}</p>}
      </div>

      {badges.length > 0 && (
        <section className="mt-8">
          <div className="mb-3 flex items-center gap-2">
            <Award className="h-5 w-5 text-primary" />
            <h2 className="font-bold">Badges ({unlocked.length}/{badges.length})</h2>
          </div>
          <div className="grid grid-cols-4 gap-3 sm:grid-cols-6">
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
                <span className="text-2xl">{b.emoji}</span>
                <span className="mt-1 line-clamp-1 text-[9px] font-semibold uppercase tracking-wide">
                  {b.name}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="mt-8 space-y-3">
        <Button variant="outline" className="w-full" onClick={() => navigate('/wrapped')}>
          <Sparkles className="mr-2 h-4 w-4" /> Mon Wrapped du mois
        </Button>
        <Button variant="outline" className="w-full" onClick={() => navigate('/upload')}>
          <UploadIcon className="mr-2 h-4 w-4" /> Publier un morceau
        </Button>
        <Button variant="outline" className="w-full" onClick={() => navigate('/profile-edit')}>
          <Pencil className="mr-2 h-4 w-4" /> Modifier le profil
        </Button>
        <Button variant="ghost" className="w-full text-destructive" onClick={logout}>
          <LogOut className="mr-2 h-4 w-4" /> Se déconnecter
        </Button>
      </div>
    </div>
  );
}
