import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { avatarUrl } from '@/lib/storage';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Camera, User, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface Props { onBack: () => void }

export default function ProfileEdit({ onBack }: Props) {
  const { authUser, profile, updateProfile } = useAuth();
  const { toast } = useToast();
  const [pseudo, setPseudo] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [bio, setBio] = useState('');
  const [avatar, setAvatar] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!profile) return;
    setPseudo(profile.pseudo ?? '');
    setFirstName(profile.first_name ?? '');
    setLastName(profile.last_name ?? '');
    setBio(profile.bio ?? '');
  }, [profile]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatar(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authUser) return;
    setSubmitting(true);
    try {
      await updateProfile(
        {
          pseudo: pseudo.trim(),
          first_name: firstName.trim() || null,
          last_name: lastName.trim() || null,
          bio: bio.trim() || null,
        },
        avatar ?? undefined,
      );
      toast({ title: 'Profil mis à jour' });
      onBack();
    } catch (err: any) {
      toast({ title: 'Erreur', description: err.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const displayAvatar = avatarPreview ?? (profile ? avatarUrl(profile) : '');

  return (
    <div className="relative min-h-screen pb-32">
      {/* Header */}
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-white/[0.06] bg-background/80 px-4 py-3 backdrop-blur-xl">
        <button
          onClick={onBack}
          className="flex items-center gap-2 rounded-xl p-2 text-muted-foreground hover:text-foreground hover:bg-white/5"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-sm font-semibold text-foreground">Modifier le profil</h1>
        <button
          form="profile-form"
          type="submit"
          disabled={submitting || !pseudo.trim()}
          className={cn(
            'flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-semibold',
            'bg-gradient-primary text-primary-foreground shadow-elegant-sm',
            'hover:shadow-glow active:scale-[0.97] transition-all duration-150',
            'disabled:opacity-40 disabled:cursor-not-allowed'
          )}
        >
          {submitting ? (
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          ) : (
            <Check className="h-3.5 w-3.5" />
          )}
          Sauver
        </button>
      </header>

      <form id="profile-form" onSubmit={handleSubmit} className="px-4 py-6 space-y-6">
        {/* Avatar picker */}
        <div className="flex flex-col items-center gap-3">
          <div className="relative">
            <Avatar className="h-24 w-24 ring-2 ring-white/10">
              <AvatarImage src={displayAvatar} />
              <AvatarFallback className="bg-muted text-2xl">
                <User className="h-10 w-10 text-muted-foreground" />
              </AvatarFallback>
            </Avatar>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-gradient-primary shadow-elegant ring-2 ring-background"
            >
              <Camera className="h-3.5 w-3.5 text-primary-foreground" />
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="text-xs font-medium text-primary hover:text-primary/80"
          >
            Changer la photo
          </button>
        </div>

        {/* Fields */}
        <div className="space-y-4">
          <Field label="Pseudo" required>
            <Input
              value={pseudo}
              onChange={(e) => setPseudo(e.target.value)}
              placeholder="ton_pseudo"
              required
              className="h-11 border-white/10 bg-white/[0.05] text-foreground placeholder:text-muted-foreground/40 focus:border-primary/50"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Prénom">
              <Input
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Prénom"
                className="h-11 border-white/10 bg-white/[0.05] text-foreground placeholder:text-muted-foreground/40 focus:border-primary/50"
              />
            </Field>
            <Field label="Nom">
              <Input
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Nom"
                className="h-11 border-white/10 bg-white/[0.05] text-foreground placeholder:text-muted-foreground/40 focus:border-primary/50"
              />
            </Field>
          </div>

          <Field label="Bio" hint={`${bio.length}/200`}>
            <Textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Dis quelque chose sur toi…"
              maxLength={200}
              rows={3}
              className="resize-none border-white/10 bg-white/[0.05] text-foreground placeholder:text-muted-foreground/40 focus:border-primary/50"
            />
          </Field>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
          {required && <span className="ml-0.5 text-primary">*</span>}
        </label>
        {hint && <span className="text-[10px] text-muted-foreground/60">{hint}</span>}
      </div>
      {children}
    </div>
  );
}
