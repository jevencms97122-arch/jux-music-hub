import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { uploadFileSmart } from '@/lib/storage';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';

export default function ProfileSetup() {
  const { authUser, updateProfile } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [pseudo, setPseudo] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [bio, setBio] = useState('');
  const [avatar, setAvatar] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authUser) return;
    setSubmitting(true);
    try {
      let avatar_url: string | undefined;
      if (avatar) avatar_url = await uploadFileSmart('avatars', authUser.id, avatar);

      await updateProfile({
        pseudo: pseudo.trim(),
        first_name: firstName.trim() || null,
        last_name: lastName.trim() || null,
        bio: bio.trim() || null,
        ...(avatar_url ? { avatar_url } : {}),
        profile_completed: true,
      });
      toast({ title: 'Profil créé 🎉' });
      navigate('/jux');
    } catch (err: any) {
      toast({ title: 'Erreur', description: err.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen px-6 py-8">
      <h1 className="mb-2 text-2xl font-bold" style={{ animation: 'fadeSlideUp 0.6s cubic-bezier(0.16,1,0.3,1) both' }}>Bienvenue sur Jux 👋</h1>
      <p className="mb-6 text-sm text-muted-foreground" style={{ animation: 'fadeSlideUp 0.6s cubic-bezier(0.16,1,0.3,1) both', animationDelay: '0.1s' }}>
        Complète ton profil pour commencer.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4" style={{ animation: 'fadeSlideUp 0.6s cubic-bezier(0.16,1,0.3,1) both', animationDelay: '0.2s' }}>
        <div>
          <Label htmlFor="pseudo">Pseudo *</Label>
          <Input id="pseudo" value={pseudo} onChange={(e) => setPseudo(e.target.value)} required />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="firstName">Prénom</Label>
            <Input id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="lastName">Nom</Label>
            <Input id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} />
          </div>
        </div>
        <div>
          <Label htmlFor="bio">Bio</Label>
          <Textarea id="bio" value={bio} onChange={(e) => setBio(e.target.value)} maxLength={200} />
        </div>
        <div>
          <Label htmlFor="avatar">Avatar</Label>
          <Input id="avatar" type="file" accept="image/*" onChange={(e) => setAvatar(e.target.files?.[0] ?? null)} />
        </div>
        <Button type="submit" className="w-full" disabled={submitting || !pseudo}>
          {submitting ? 'Enregistrement...' : 'Continuer'}
        </Button>
      </form>
    </div>
  );
}