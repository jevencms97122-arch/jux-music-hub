import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import juxLogo from '@/assets/jux-logo.png';
import { useNavigate } from 'react-router-dom';

export default function Login() {
  const { login, signup } = useAuth();
  const navigate = useNavigate();
  const [isSignup, setIsSignup] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (isSignup) {
        await signup(email, password);
      } else {
        await login(email, password);
      }
      // Rediriger vers la page d'accueil après connexion/inscription réussie
      navigate('/jux');
    } catch (err: any) {
      setError(err?.message || 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6">
      <img src={juxLogo} alt="Jux" className="mb-8 h-16 w-auto" />
      <h1 className="mb-2 text-2xl font-bold text-foreground">
        {isSignup ? 'Créer un compte' : 'Se connecter'}
      </h1>
      <p className="mb-8 text-sm text-muted-foreground">
        {isSignup ? 'Rejoins Jux et écoute de la musique' : 'Content de te revoir'}
      </p>

      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
        <Input
          type="email"
          placeholder="Email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
          className="bg-secondary border-border text-foreground placeholder:text-muted-foreground"
        />
        <Input
          type="password"
          placeholder="Mot de passe"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
          minLength={8}
          className="bg-secondary border-border text-foreground placeholder:text-muted-foreground"
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? 'Chargement...' : isSignup ? "S'inscrire" : 'Se connecter'}
        </Button>
      </form>

      <button
        onClick={() => { setIsSignup(!isSignup); setError(''); }}
        className="mt-6 text-sm text-muted-foreground hover:text-primary transition-colors"
      >
        {isSignup ? 'Déjà un compte ? Se connecter' : "Pas encore de compte ? S'inscrire"}
      </button>
    </div>
  );
}
