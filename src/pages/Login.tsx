import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import juxLogo from '@/assets/jux-logo.png';

export default function Login() {
  const { signIn, signUp } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'signin') await signIn(email, password);
      else await signUp(email, password);
    } catch (err: any) {
      setError(err?.message || 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-background via-secondary to-background">
      <div className="flex w-full items-center justify-center px-6 py-12">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center">
            <img src={juxLogo} alt="Jux" className="mx-auto mb-8 h-20 w-auto" />
            <h1 className="text-3xl font-bold text-foreground">Bienvenue sur Jux</h1>
            <p className="mt-2 text-muted-foreground">Connecte-toi pour découvrir de nouvelles musiques</p>
          </div>

          <Tabs value={mode} onValueChange={(v) => { setMode(v as any); setError(''); }} className="w-full">
            <TabsList className="grid w-full grid-cols-2 bg-secondary">
              <TabsTrigger value="signin" className="text-sm">Connexion</TabsTrigger>
              <TabsTrigger value="signup" className="text-sm">Inscription</TabsTrigger>
            </TabsList>

            <TabsContent value={mode} className="mt-6">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Email</label>
                  <Input
                    type="email"
                    placeholder="ton@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    className="h-12"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Mot de passe</label>
                  <Input
                    type="password"
                    placeholder="Mot de passe"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                    className="h-12"
                  />
                </div>
                {error && (
                  <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3">
                    <p className="text-sm text-destructive">{error}</p>
                  </div>
                )}
                <Button type="submit" className="h-12 w-full bg-gradient-primary text-primary-foreground hover:opacity-90" disabled={loading || !email || !password}>
                  {loading ? 'Chargement...' : mode === 'signin' ? 'Se connecter' : "S'inscrire"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>

          <p className="text-center text-xs text-muted-foreground">
            Pense à désactiver "Confirm email" dans les paramètres Auth Supabase pour une inscription instantanée.
          </p>
        </div>
      </div>
    </div>
  );
}
