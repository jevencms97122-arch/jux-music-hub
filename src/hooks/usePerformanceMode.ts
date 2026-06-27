import { useState, useCallback } from 'react';

const KEY = 'jux_performance_mode';

export function usePerformanceMode() {
  const [enabled, setEnabledState] = useState(() => localStorage.getItem(KEY) === 'true');

  const setEnabled = useCallback((v: boolean) => {
    localStorage.setItem(KEY, String(v));
    setEnabledState(v);
  }, []);

  return { enabled, setEnabled };
}

export function isPerformanceModeEnabled(): boolean {
  try { return localStorage.getItem(KEY) === 'true'; } catch { return false; }
}
