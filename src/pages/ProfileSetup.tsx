import { useState, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Camera } from 'lucide-react';

export default function ProfileSetup() {
  const { updateProfile } = useAuth();
  const [pseudo, setPseudo] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [avatarPreview, setAvatarPreview] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

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
    try {
      const fd = new FormData();
      fd.append('pseudo', pseudo);
      fd.append('firstName', firstName);
      fd.append('lastName', lastName);
      if (avatarFile) fd.append('avatar', avatarFile);
      await updateProfile(fd);
      // Rediriger vers la page d'accueil après succès
      window.location.href = '/';
    } catch (err: any) {
      setError(err?.message || 'Erreur lors de la mise à jour');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6">
      <h1 className="mb-2 text-2xl font-bold text-foreground">Configure ton profil</h1>
      <p className="mb-8 text-sm text-muted-foreground">Dis-nous en plus sur toi</p>

      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-6">
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="relative h-24 w-24 rounded-full bg-secondary flex items-center justify-center overflow-hidden border-2 border-border hover:border-primary transition-colors"
          >
            {avatarPreview ? (
              <img src={avatarPreview} alt="Avatar" className="h-full w-full object-cover" />
            ) : (
              <Camera className="h-8 w-8 text-muted-foreground" />
            )}
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatar} />
        </div>

        <Input
          placeholder="Pseudo"
          value={pseudo}
          onChange={e => setPseudo(e.target.value)}
          required
          className="bg-secondary border-border text-foreground placeholder:text-muted-foreground"
        />
        <Input
          placeholder="Prénom"
          value={firstName}
          onChange={e => setFirstName(e.target.value)}
          required
          className="bg-secondary border-border text-foreground placeholder:text-muted-foreground"
        />
        <Input
          placeholder="Nom"
          value={lastName}
          onChange={e => setLastName(e.target.value)}
          required
          className="bg-secondary border-border text-foreground placeholder:text-muted-foreground"
        />

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? 'Enregistrement...' : 'Continuer'}
        </Button>
      </form>
    </div>
  );
}
