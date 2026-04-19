import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import juxLogo from '@/assets/jux-logo.png';
import { CheckCircle2 } from 'lucide-react';

export default function Login() {
  const { sendMagicLink } = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await sendMagicLink(email);
      setSent(true);
    } catch (err: any) {
      setError(err?.message || 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
        <CheckCircle2 className="mb-6 h-16 w-16 text-primary" />
        <h1 className="mb-2 text-2xl font-bold text-foreground">Vérifie ta boîte mail</h1>
        <p className="mb-6 max-w-sm text-sm text-muted-foreground">
          On vient d'envoyer un lien de connexion à <strong>{email}</strong>.
          Clique dessus pour te connecter à Jux.
        </p>
        <button
          onClick={() => { setSent(false); setEmail(''); }}
          className="text-sm text-primary hover:underline"
        >
          Utiliser une autre adresse
        </button>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6">
      <img src={juxLogo} alt="Jux" className="mb-8 h-16 w-auto" />
      <h1 className="mb-2 text-2xl font-bold text-foreground">Connexion à Jux</h1>
      <p className="mb-8 text-sm text-muted-foreground">
        Entre ton email, on t'envoie un lien magique.
      </p>

      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
        <Input
          type="email"
          placeholder="ton@email.com"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
          className="bg-secondary border-border text-foreground placeholder:text-muted-foreground"
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" className="w-full" disabled={loading || !email}>
          {loading ? 'Envoi...' : 'Recevoir le lien magique'}
        </Button>
      </form>

      <p className="mt-6 text-xs text-muted-foreground text-center max-w-sm">
        Pas de mot de passe à retenir. À chaque connexion, on t'envoie un lien sécurisé.
      </p>
    </div>
  );
}
