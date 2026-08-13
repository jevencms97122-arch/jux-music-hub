import { useEffect, useState } from 'react';
import { getPlatform, type NativePlatform } from '@/lib/platform';

/** `null` tant que non résolu (ou hors Tauri). Résolu une seule fois puis mis en cache. */
export function usePlatform(): NativePlatform | null {
  const [platform, setPlatform] = useState<NativePlatform | null>(null);
  useEffect(() => {
    let cancelled = false;
    getPlatform().then((p) => { if (!cancelled) setPlatform(p); });
    return () => { cancelled = true; };
  }, []);
  return platform;
}
