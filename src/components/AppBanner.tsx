import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { pb } from '@/lib/pocketbase';
import { AlertTriangle, Info, CheckCircle2, AlertCircle, Sparkles, X } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Bannière d'annonce pilotée par la collection PocketBase `app_banners`.
 * Tout est configurable depuis l'admin PocketBase sans redéployer :
 * activation, couleur, titre, message, 0 à 2 boutons, fermeture par l'utilisateur.
 */

interface BannerRecord {
  id: string;
  updated: string;
  active: boolean;
  title: string;
  message: string;
  color: 'info' | 'success' | 'warning' | 'error' | 'primary';
  dismissible: boolean;
  version_webapp?: string;
  button1_label?: string;
  button1_url?: string;
  button2_label?: string;
  button2_url?: string;
}

const VARIANTS: Record<string, { container: string; icon: string; title: string; text: string; btn: string; Icon: typeof Info }> = {
  info: {
    container: 'border-sky-400/20 bg-sky-500/[0.07]',
    icon: 'text-sky-400/80',
    title: 'text-sky-300/90',
    text: 'text-sky-200/60',
    btn: 'bg-sky-400/15 text-sky-300 hover:bg-sky-400/25',
    Icon: Info,
  },
  success: {
    container: 'border-emerald-400/20 bg-emerald-500/[0.07]',
    icon: 'text-emerald-400/80',
    title: 'text-emerald-300/90',
    text: 'text-emerald-200/60',
    btn: 'bg-emerald-400/15 text-emerald-300 hover:bg-emerald-400/25',
    Icon: CheckCircle2,
  },
  warning: {
    container: 'border-amber-400/20 bg-amber-500/[0.07]',
    icon: 'text-amber-400/80',
    title: 'text-amber-300/90',
    text: 'text-amber-200/60',
    btn: 'bg-amber-400/15 text-amber-300 hover:bg-amber-400/25',
    Icon: AlertTriangle,
  },
  error: {
    container: 'border-red-400/20 bg-red-500/[0.07]',
    icon: 'text-red-400/80',
    title: 'text-red-300/90',
    text: 'text-red-200/60',
    btn: 'bg-red-400/15 text-red-300 hover:bg-red-400/25',
    Icon: AlertCircle,
  },
  primary: {
    container: 'border-primary/25 bg-primary/[0.08]',
    icon: 'text-primary',
    title: 'text-primary',
    text: 'text-foreground/60',
    btn: 'bg-gradient-primary text-primary-foreground shadow-elegant-sm',
    Icon: Sparkles,
  },
};

const dismissKey = (b: BannerRecord) => `banner_dismissed_${b.id}_${b.updated}`;

export default function AppBanner({ className }: { className?: string }) {
  const navigate = useNavigate();
  const [banner, setBanner] = useState<BannerRecord | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    pb.collection('app_banners')
      .getList(1, 1, { filter: 'active = true', sort: '-updated', requestKey: null })
      .then((res) => {
        const b = res.items[0] as unknown as BannerRecord | undefined;
        if (!b) return;
        setBanner(b);
        try { setDismissed(!!localStorage.getItem(dismissKey(b))); } catch {}
      })
      .catch(() => {}); // collection absente ou hors-ligne → pas de bannière
  }, []);

  if (!banner || dismissed) return null;

  const v = VARIANTS[banner.color] ?? VARIANTS.info;

  const openUrl = (url?: string) => {
    if (!url) return;
    if (url.startsWith('/')) navigate(url);
    else window.open(url, '_blank', 'noopener,noreferrer');
  };

  const dismiss = () => {
    setDismissed(true);
    try { localStorage.setItem(dismissKey(banner), '1'); } catch {}
  };

  const buttons = [
    banner.button1_label?.trim() ? { label: banner.button1_label, url: banner.button1_url, solid: true } : null,
    banner.button2_label?.trim() ? { label: banner.button2_label, url: banner.button2_url, solid: false } : null,
  ].filter(Boolean) as { label: string; url?: string; solid: boolean }[];

  return (
    <div className={cn('flex items-start gap-3 rounded-xl border px-4 py-3', v.container, className)}>
      <v.Icon className={cn('mt-0.5 h-4 w-4 flex-shrink-0', v.icon)} />
      <div className="min-w-0 flex-1">
        {banner.title && (
          <p className={cn('text-xs font-semibold flex items-center gap-1.5', v.title)}>
            {banner.title}
            {banner.version_webapp && (
              <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[9px] font-bold tracking-wide">
                {banner.version_webapp}
              </span>
            )}
          </p>
        )}
        {banner.message && <p className={cn('mt-0.5 text-[11px] leading-relaxed', v.text)}>{banner.message}</p>}
        {buttons.length > 0 && (
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            {buttons.map((b) => (
              <button
                key={b.label}
                onClick={() => openUrl(b.url)}
                className={cn(
                  'rounded-lg px-3 py-1.5 text-[11px] font-semibold transition-colors',
                  b.solid ? v.btn : 'text-muted-foreground hover:text-foreground underline underline-offset-2'
                )}
              >
                {b.label}
              </button>
            ))}
          </div>
        )}
      </div>
      {banner.dismissible && (
        <button
          onClick={dismiss}
          aria-label="Fermer la bannière"
          className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-white/[0.06] hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
