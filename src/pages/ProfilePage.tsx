import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Pencil, Upload as UploadIcon, LogOut } from 'lucide-react';
import { avatarUrl } from '@/lib/storage';

export default function ProfilePage() {
  const { profile, authUser, logout } = useAuth();
  const navigate = useNavigate();

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

      <div className="mt-8 space-y-3">
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
