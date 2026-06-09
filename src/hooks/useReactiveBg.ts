import { useState, useCallback } from 'react';

const KEY = 'jux_reactive_bg';

export function useReactiveBg() {
  const [enabled, setEnabledState] = useState(() => localStorage.getItem(KEY) === 'true');

  const setEnabled = useCallback((v: boolean) => {
    localStorage.setItem(KEY, String(v));
    setEnabledState(v);
  }, []);

  return { enabled, setEnabled };
}
