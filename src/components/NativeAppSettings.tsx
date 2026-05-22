import { useEffect, useState } from 'react';
import { Smartphone, RefreshCw } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import {
  isNativeAppSettingsAvailable, getNativePreferences, setNativePreference,
  normalizePref, humanizeKey, type NativePrefs, type NativePrefValue,
} from '@/lib/nativeSettings';

/**
 * Affiche dynamiquement tous les paramètres exposés par l'app native.
 * Les nouveaux paramètres ajoutés côté Android/Windows apparaissent
 * automatiquement, sans modification du site.
 */
export default function NativeAppSettings() {
  const [available, setAvailable] = useState(false);
  const [prefs, setPrefs] = useState<NativePrefs | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = async () => {
    setLoading(true);
    const p = await getNativePreferences();
    setPrefs(p);
    setLoading(false);
  };

  useEffect(() => {
    const ok = isNativeAppSettingsAvailable();
    setAvailable(ok);
    if (ok) refresh();
  }, []);

  if (!available) return null;

  const update = async (key: string, value: NativePrefValue) => {
    setPrefs((prev) => {
      if (!prev) return prev;
      const cur = prev[key];
      const isMeta = cur !== null && typeof cur === 'object' && 'value' in (cur as any);
      return { ...prev, [key]: isMeta ? { ...(cur as any), value } : value } as NativePrefs;
    });
    const ok = await setNativePreference(key, value);
    if (!ok) {
      toast.error('Impossible de mettre à jour ce paramètre');
      refresh();
    } else {
      toast.success('Paramètre mis à jour', { position: 'bottom-center' });
    }
  };

  const entries = Object.entries(prefs ?? {});

  return (
    <section className="mt-6 border-t border-border px-6 pt-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <Smartphone className="h-4 w-4" /> Réglages de l'appareil
        </div>
        <button
          onClick={refresh}
          aria-label="Rafraîchir"
          className="rounded-full p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {entries.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          {loading ? 'Chargement…' : 'Aucun paramètre disponible.'}
        </p>
      ) : (
        <div className="space-y-2">
          {entries.map(([key, raw]) => {
            const meta = normalizePref(raw);
            const label = meta.label ?? humanizeKey(key);
            const type = meta.type ?? (typeof meta.value as any);
            return (
              <div
                key={key}
                className="flex items-center justify-between gap-3 rounded-xl bg-secondary/40 px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{label}</div>
                  {meta.description && (
                    <div className="mt-0.5 text-xs text-muted-foreground">{meta.description}</div>
                  )}
                </div>
                <div className="shrink-0">
                  {type === 'boolean' ? (
                    <Switch
                      checked={!!meta.value}
                      onCheckedChange={(v) => update(key, v)}
                    />
                  ) : meta.options && meta.options.length > 0 ? (
                    <Select
                      value={String(meta.value)}
                      onValueChange={(v) => update(key, type === 'number' ? Number(v) : v)}
                    >
                      <SelectTrigger className="h-9 w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {meta.options.map((o) => (
                          <SelectItem key={String(o.value)} value={String(o.value)}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      type={type === 'number' ? 'number' : 'text'}
                      defaultValue={String(meta.value ?? '')}
                      onBlur={(e) => {
                        const v = type === 'number' ? Number(e.target.value) : e.target.value;
                        if (v !== meta.value) update(key, v as NativePrefValue);
                      }}
                      className="h-9 w-40"
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
