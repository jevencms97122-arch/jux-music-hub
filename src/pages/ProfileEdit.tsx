import { useState, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getUserAvatarUrl } from '@/lib/pocketbase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Camera, ArrowLeft } from 'lucide-react';

interface ProfileEditProps {
  onBack: () => void;
}

export default function ProfileEdit({ onBack }: ProfileEditProps) {
  const { user, updateProfile } = useAuth();
  const [pseudo, setPseudo] = useState(user?.pseudo || '');
  const [firstName, setFirstName] = useState(user?.firstName || '');
  const [lastName, setLastName] = useState(user?.lastName || '');
  const [avatarPreview, setAvatarPreview] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const currentAvatar = avatarPreview || (user?.avatar ? getUserAvatarUrl(user as any) : '');

  const handleAvatar = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAvatarFile(file);
      setAvatarPreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pseudo.trim() || !firstName.trim() || !lastName.trim()) {
      setError('Tous les champs sont obligatoires');
      return;
    }
    setLoading(true);
    setError('');
    setSuccess(false);
    try {
      const fd = new FormData();
      fd.append('pseudo', pseudo);
      fd.append('firstName', firstName);
      fd.append('lastName', lastName);
      if (avatarFile) fd.append('avatar', avatarFile);
      await updateProfile(fd);
      setSuccess(true);
    } catch (err: any) {
      setError(err?.message || 'Erreur lors de la mise à jour');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pb-28 pt-4 px-4">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={onBack} className="p-1 text-foreground">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-xl font-bold text-foreground">Modifier le profil</h1>
      </div>

      <form onSubmit={handleSubmit} className="max-w-sm mx-auto space-y-6">
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="relative h-24 w-24 rounded-full bg-secondary flex items-center justify-center overflow-hidden border-2 border-border hover:border-primary transition-colors"
          >
            {currentAvatar ? (
              <img src={currentAvatar} alt="Avatar" className="h-full w-full object-cover" />
            ) : (
              <Camera className="h-8 w-8 text-muted-foreground" />
            )}
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatar} />
        </div>

        <Input placeholder="Pseudo" value={pseudo} onChange={e => setPseudo(e.target.value)} required className="bg-secondary border-border text-foreground placeholder:text-muted-foreground" />
        <Input placeholder="Prénom" value={firstName} onChange={e => setFirstName(e.target.value)} required className="bg-secondary border-border text-foreground placeholder:text-muted-foreground" />
        <Input placeholder="Nom" value={lastName} onChange={e => setLastName(e.target.value)} required className="bg-secondary border-border text-foreground placeholder:text-muted-foreground" />

        {error && <p className="text-sm text-destructive">{error}</p>}
        {success && <p className="text-sm text-primary">✓ Profil mis à jour !</p>}

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? 'Enregistrement...' : 'Sauvegarder'}
        </Button>
      </form>
    </div>
  );
}
