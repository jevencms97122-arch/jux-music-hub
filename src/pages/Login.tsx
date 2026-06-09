import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import juxLogo from '@/assets/jux-logo.png';
import { cn } from '@/lib/utils';

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
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-12">
      {/* Ambient glow */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-hero opacity-60" />
      <div className="pointer-events-none absolute left-1/2 top-1/4 h-72 w-72 -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />

      <div
        className="relative z-10 w-full max-w-sm animate-fade-slide-up"
      >
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center gap-4 text-center">
          <img
            src={juxLogo}
            alt="Jux"
            className="h-14 w-auto drop-shadow-[0_0_20px_hsl(var(--primary)/0.4)]"
          />
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Bienvenue sur Jux
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Écoute et partage de la musique entre amis
            </p>
          </div>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] p-6 shadow-[0_16px_48px_rgba(0,0,0,0.4)] backdrop-blur-xl">
          <Tabs
            value={mode}
            onValueChange={(v) => { setMode(v as any); setError(''); }}
            className="w-full"
          >
            <TabsList className="mb-6 grid w-full grid-cols-2 rounded-xl bg-white/[0.06] p-1">
              <TabsTrigger
                value="signin"
                className="rounded-lg text-sm font-medium data-[state=active]:bg-white/10 data-[state=active]:text-foreground data-[state=active]:shadow-none"
              >
                Connexion
              </TabsTrigger>
              <TabsTrigger
                value="signup"
                className="rounded-lg text-sm font-medium data-[state=active]:bg-white/10 data-[state=active]:text-foreground data-[state=active]:shadow-none"
              >
                Inscription
              </TabsTrigger>
            </TabsList>

            <TabsContent value={mode}>
              <form onSubmit={handleSubmit} className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Email
                  </label>
                  <Input
                    type="email"
                    placeholder="ton@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    className="h-11 border-white/10 bg-white/[0.05] text-foreground placeholder:text-muted-foreground/50 focus:border-primary/50 focus:bg-white/[0.07]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Mot de passe
                  </label>
                  <Input
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                    className="h-11 border-white/10 bg-white/[0.05] text-foreground placeholder:text-muted-foreground/50 focus:border-primary/50 focus:bg-white/[0.07]"
                  />
                </div>

                {error && (
                  <div className="rounded-xl border border-destructive/20 bg-destructive/10 px-3 py-2.5">
                    <p className="text-xs text-destructive">{error}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || !email || !password}
                  className={cn(
                    'mt-2 flex h-11 w-full items-center justify-center rounded-xl bg-gradient-primary text-sm font-semibold text-primary-foreground shadow-elegant-sm',
                    'transition-all duration-150 hover:shadow-glow active:scale-[0.98]',
                    'disabled:cursor-not-allowed disabled:opacity-40'
                  )}
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      Chargement…
                    </span>
                  ) : mode === 'signin' ? 'Se connecter' : "S'inscrire"}
                </button>
              </form>
            </TabsContent>
          </Tabs>
        </div>

        <p className="mt-6 text-center text-[11px] text-muted-foreground/60">
          En continuant, tu acceptes les conditions d'utilisation
        </p>
      </div>
    </div>
  );
}
