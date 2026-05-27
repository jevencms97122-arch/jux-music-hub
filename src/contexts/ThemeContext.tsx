import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { APP_THEMES, type AppTheme } from '@/themes/appThemes';

type ThemeContextValue = {
  themes: AppTheme[];
  currentTheme: AppTheme;
  setTheme: (id: string) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

const STORAGE_KEY = 'app_theme_id';

function applyThemeToCssVars(theme: AppTheme) {
  const root = document.documentElement;
  const { hsl } = theme;

  // Vars generiques (utiles si tu veux les exploiter ailleurs)
  root.style.setProperty('--app-theme-background', theme.background);
  root.style.setProperty('--app-text', theme.textColor);
  root.style.setProperty('--app-accent', theme.accentColor);

  // Vars hsl triplets compatibles avec tailwind config actuelle
  root.style.setProperty('--background', hsl.background);
  root.style.setProperty('--foreground', hsl.foreground);
  root.style.setProperty('--card', hsl.card);
  root.style.setProperty('--card-foreground', hsl.cardForeground);
  root.style.setProperty('--popover', hsl.popover);
  root.style.setProperty('--popover-foreground', hsl.popoverForeground);

  root.style.setProperty('--primary', hsl.primary);
  root.style.setProperty('--primary-foreground', hsl.primaryForeground);
  root.style.setProperty('--primary-glow', hsl.primary);

  root.style.setProperty('--secondary', hsl.secondary);
  root.style.setProperty('--secondary-foreground', hsl.secondaryForeground);

  root.style.setProperty('--muted', hsl.muted);
  root.style.setProperty('--muted-foreground', hsl.mutedForeground);

  root.style.setProperty('--accent', hsl.accent);
  root.style.setProperty('--accent-foreground', hsl.accentForeground);

  root.style.setProperty('--destructive', hsl.destructive);
  root.style.setProperty('--destructive-foreground', hsl.destructiveForeground);

  root.style.setProperty('--border', hsl.border);
  root.style.setProperty('--input', hsl.input);
  root.style.setProperty('--ring', hsl.ring);

  root.style.setProperty('--sidebar-background', hsl.sidebar.background);
  root.style.setProperty('--sidebar-foreground', hsl.sidebar.foreground);
  root.style.setProperty('--sidebar-primary', hsl.sidebar.primary);
  root.style.setProperty('--sidebar-primary-foreground', hsl.sidebar.primaryForeground);
  root.style.setProperty('--sidebar-accent', hsl.sidebar.accent);
  root.style.setProperty('--sidebar-accent-foreground', hsl.sidebar.accentForeground);
  root.style.setProperty('--sidebar-border', hsl.sidebar.border);
  root.style.setProperty('--sidebar-ring', hsl.sidebar.ring);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const themes = useMemo(() => APP_THEMES, []);
  const [currentThemeId, setCurrentThemeId] = useState<string>(
    APP_THEMES[0]?.id ?? 'dark-classique',
  );

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && themes.some((t) => t.id === saved)) {
        setCurrentThemeId(saved);
      }
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const currentTheme = useMemo(() => {
    return themes.find((t) => t.id === currentThemeId) ?? themes[0];
  }, [themes, currentThemeId]);

  useEffect(() => {
    if (!currentTheme) return;
    applyThemeToCssVars(currentTheme);
    try {
      localStorage.setItem(STORAGE_KEY, currentTheme.id);
    } catch {
      // ignore
    }
  }, [currentTheme]);

  const setTheme = (id: string) => {
    if (!themes.some((t) => t.id === id)) return;
    setCurrentThemeId(id);
  };

  const value = useMemo<ThemeContextValue>(
    () => ({
      themes,
      currentTheme,
      setTheme,
    }),
    [themes, currentTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
