import { useEffect, useState } from 'react';
import { pb } from '@/lib/pocketbase';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { ScrollText, Sparkles, Info, CheckCircle2, AlertTriangle, AlertCircle, Tag } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BannerRecord {
  id: string;
  created: string;
  active: boolean;
  title: string;
  message: string;
  color: 'info' | 'success' | 'warning' | 'error' | 'primary';
  version_webapp?: string;
}

const VARIANTS: Record<string, { icon: string; label: string; Icon: typeof Info }> = {
  info:    { icon: 'text-sky-400',     label: 'bg-sky-500/15 text-sky-300',       Icon: Info },
  success: { icon: 'text-emerald-400', label: 'bg-emerald-500/15 text-emerald-300', Icon: CheckCircle2 },
  warning: { icon: 'text-amber-400',   label: 'bg-amber-500/15 text-amber-300',   Icon: AlertTriangle },
  error:   { icon: 'text-red-400',     label: 'bg-red-500/15 text-red-300',       Icon: AlertCircle },
  primary: { icon: 'text-primary',     label: 'bg-primary/15 text-primary',       Icon: Sparkles },
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function PatchNotesSheet({ trigger }: { trigger: React.ReactNode }) {
  const [banners, setBanners] = useState<BannerRecord[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    if (banners.length > 0) return;
    setLoading(true);
    try {
      const res = await pb.collection('app_banners').getList(1, 100, { filter: 'active = true', sort: '-created', requestKey: null });
      setBanners(res.items as unknown as BannerRecord[]);
    } catch {
      setBanners([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Sheet onOpenChange={(open) => open && load()}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent side="bottom" className="rounded-t-3xl pb-safe max-h-[85vh] flex flex-col">
        <SheetHeader className="mb-4 flex-shrink-0">
          <SheetTitle className="flex items-center gap-2">
            <ScrollText className="h-4 w-4 text-primary" />
            Notes de mise à jour
          </SheetTitle>
        </SheetHeader>

        <div className="overflow-y-auto flex-1 space-y-3 pr-1">
          {loading && (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 animate-pulse rounded-2xl bg-secondary" />
              ))}
            </div>
          )}

          {!loading && banners.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">Aucune note de mise à jour.</p>
          )}

          {!loading && banners.map((b) => {
            const v = VARIANTS[b.color] ?? VARIANTS.info;
            return (
              <div key={b.id} className="rounded-2xl border border-border/40 bg-card/50 px-4 py-3.5">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <v.Icon className={cn('h-3.5 w-3.5 flex-shrink-0', v.icon)} />
                    <p className="text-sm font-semibold text-foreground truncate">{b.title}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {b.version_webapp && (
                      <span className={cn('flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold', v.label)}>
                        <Tag className="h-2.5 w-2.5" />
                        {b.version_webapp}
                      </span>
                    )}
                    <span className="text-[10px] text-muted-foreground">{fmtDate(b.created)}</span>
                  </div>
                </div>
                <p className="text-xs leading-relaxed text-muted-foreground">{b.message}</p>
              </div>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}
