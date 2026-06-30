import { useEffect, useRef, useState, useCallback } from 'react';
import { pb } from '@/lib/pocketbase';
import { RefreshCw, Clock } from 'lucide-react';

const SNOOZED_KEY = 'jux_update_snoozed_created';
const INTERVAL_MS = 60_000; // 1 minute

interface Banner { id: string; created: string; title: string; }

export default function WebAppUpdateNotifier() {
  const baselineRef = useRef<string | null>(null);   // created du dernier banner au chargement
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [pending, setPending] = useState<Banner[]>([]);

  // Enregistre le baseline au montage (sans déclencher de notif)
  useEffect(() => {
    pb.collection('app_banners')
      .getList(1, 1, { filter: 'active = true', sort: '-created', requestKey: null })
      .then((res) => { baselineRef.current = (res.items[0] as any)?.created ?? null; })
      .catch(() => {});
  }, []);

  const check = useCallback(async () => {
    try {
      const res = await pb.collection('app_banners').getList(1, 100, {
        filter: 'active = true',
        sort: '-created',
        requestKey: null,
      });
      const all = res.items as unknown as Banner[];
      const baseline = baselineRef.current;

      // Banners apparus après le chargement de la page
      const newer = baseline
        ? all.filter((b) => new Date(b.created).getTime() > new Date(baseline).getTime())
        : [];

      if (newer.length === 0) return;

      // Si le plus récent avait déjà été "Plus tard"-snoozé, on ne re-notifie pas
      const snoozed = localStorage.getItem(SNOOZED_KEY);
      if (snoozed && newer[0].created <= snoozed) return;

      setPending(newer);
    } catch {}
  }, []);

  // Démarre le polling : premier check après 1 min, puis toutes les 1 min
  useEffect(() => {
    const kickoff = setTimeout(() => {
      check();
      intervalRef.current = setInterval(check, INTERVAL_MS);
    }, INTERVAL_MS);

    return () => {
      clearTimeout(kickoff);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [check]);

  const handleUpdate = () => window.location.reload();

  const handleSnooze = () => {
    if (pending.length > 0) localStorage.setItem(SNOOZED_KEY, pending[0].created);
    setPending([]);
  };

  if (pending.length === 0) return null;

  const multi = pending.length > 1;

  return (
    <div className="fixed bottom-24 right-4 z-[200] w-80 rounded-2xl border border-border/60 bg-card shadow-2xl animate-fade-slide-up">
      <div className="px-4 pt-4 pb-3">
        <p className="text-sm font-bold text-foreground">
          {multi
            ? `${pending.length} nouvelles mises à jour disponibles`
            : 'Nouvelle mise à jour disponible'}
        </p>
        <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
          {multi
            ? pending.map((b) => b.title).join(' · ')
            : pending[0].title}
        </p>
      </div>
      <div className="flex gap-2 border-t border-border/40 px-4 py-3">
        <button
          onClick={handleUpdate}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-gradient-primary px-3 py-2 text-xs font-semibold text-primary-foreground shadow-elegant-sm hover:opacity-90 transition-opacity"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          {multi ? 'Tout mettre à jour' : 'Mettre à jour'}
        </button>
        <button
          onClick={handleSnooze}
          className="flex items-center gap-1.5 rounded-xl border border-border/50 bg-secondary/50 px-3 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
        >
          <Clock className="h-3.5 w-3.5" />
          Plus tard
        </button>
      </div>
    </div>
  );
}
