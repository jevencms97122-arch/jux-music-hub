import { Component, type ReactNode } from 'react';
import { RefreshCw, AlertTriangle } from 'lucide-react';

interface Props {
  children: ReactNode;
  /** Change de valeur (ex: le pathname) pour effacer l'erreur au lieu d'attendre un F5. */
  resetKey?: unknown;
}

interface State {
  error: Error | null;
}

/**
 * Filet de sécurité global. Sans lui, une exception non interceptée pendant le
 * rendu d'UNE page (crash spécifique au web : API navigateur absente, différence
 * de comportement vs la webview Tauri, etc.) démonte tout l'arbre React — l'app
 * entière devient un écran noir, sans message, sans façon d'en sortir sinon F5.
 *
 * Avec ce filet, seule la zone concernée affiche un fallback, et changer de page
 * (resetKey = pathname) réessaie automatiquement au lieu de rester bloqué.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  componentDidUpdate(prevProps: Props) {
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
          <AlertTriangle className="h-6 w-6 text-destructive" />
        </div>
        <div className="space-y-1">
          <p className="text-base font-semibold text-foreground">Un problème est survenu</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Cette page a rencontré une erreur inattendue. Tu peux réessayer ou revenir à l'accueil.
          </p>
          {import.meta.env.DEV && (
            <pre className="mt-3 max-w-md overflow-x-auto rounded-lg bg-white/[0.05] p-3 text-left text-[11px] text-muted-foreground/80">
              {this.state.error.message}
            </pre>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => this.setState({ error: null })}
            className="flex items-center gap-2 rounded-xl bg-gradient-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-elegant-sm"
          >
            <RefreshCw className="h-4 w-4" />
            Réessayer
          </button>
          <button
            onClick={() => { window.location.href = '/jux'; }}
            className="rounded-xl bg-white/[0.06] px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-white/[0.10]"
          >
            Accueil
          </button>
        </div>
      </div>
    );
  }
}
