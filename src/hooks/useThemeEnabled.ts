import { useState, useCallback } from 'react';

const KEY = 'jux_themes_enabled';

export function useThemeEnabled() {
  const [enabled, setEnabledState] = useState(() => localStorage.getItem(KEY) === 'true');
  const setEnabled = useCallback((v: boolean) => {
    localStorage.setItem(KEY, String(v));
    setEnabledState(v);
  }, []);
  return { enabled, setEnabled };
}
