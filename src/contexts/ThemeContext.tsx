import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { APP_THEMES, type AppTheme } from '@/themes/appThemes';
import { storeThemeAccents } from '@/lib/dominantColor';

type ThemeContextValue = {
  themes: AppTheme[];
  currentTheme: AppTheme;
  setTheme: (id: string) => void;
  /** Si true, la couleur dominante de la cover est appliquée aux éléments de la page */
  dynamicColorEnabled: boolean;
  setDynamicColorEnabled: (v: boolean) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

const STORAGE_KEY = 'app_theme_id';
const DYNAMIC_COLOR_KEY = 'app_dynamic_color';

function readSavedThemeId(): string {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && APP_THEMES.some((t) => t.id === saved)) return saved;
  } catch {
    // ignore
  }
  return APP_THEMES[0]?.id ?? 'dark-classique';
}

function readDynamicColorEnabled(): boolean {
  try {
    return localStorage.getItem(DYNAMIC_COLOR_KEY) === 'true';
  } catch {
    return false;
  }
}

/**
 * Gère l'attribut data-animated-bg et la class 'paused' sur le body
 * pour que les animations de fond s'arrêtent quand l'appli est en arrière-plan.
 */
function applyAnimationState(theme: AppTheme) {
  const body = document.body;
  if (theme.backgroundAnimation) {
    body.setAttribute('data-animated-bg', '');
    body.style.background = theme.background;
    body.style.backgroundSize = '200% 200%';
    body.style.animation = theme.backgroundAnimation;
  } else {
    body.removeAttribute('data-animated-bg');
    body.style.background = '';
    body.style.backgroundSize = '';
    body.style.animation = '';
  }
}

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

  // Initialise depuis localStorage directement dans le state (pas dans un effect)
  const [currentThemeId, setCurrentThemeId] = useState<string>(readSavedThemeId);
  const [dynamicColorEnabled, setDynamicColorEnabled] = useState<boolean>(readDynamicColorEnabled);
  const wasAnimatedRef = useRef(false);

  const currentTheme = useMemo(() => {
    return themes.find((t) => t.id === currentThemeId) ?? themes[0];
  }, [themes, currentThemeId]);

  // Applique le thème + sauvegarde localStorage à chaque changement
  useEffect(() => {
    if (!currentTheme) return;
    applyThemeToCssVars(currentTheme);
    applyAnimationState(currentTheme);
    wasAnimatedRef.current = currentTheme.backgroundAnimation != null;

    // Sauvegarde les accents du thème pour restore quand couleur dynamique est désactivée
    storeThemeAccents({
      primary: currentTheme.hsl.primary,
      accent: currentTheme.hsl.accent,
      ring: currentTheme.hsl.ring,
    });

    try {
      localStorage.setItem(STORAGE_KEY, currentTheme.id);
    } catch {
      // ignore
    }
  }, [currentTheme]);

  // Sauvegarde dynamicColorEnabled dans localStorage
  useEffect(() => {
    try {
      localStorage.setItem(DYNAMIC_COLOR_KEY, dynamicColorEnabled ? 'true' : 'false');
    } catch {
      // ignore
    }
  }, [dynamicColorEnabled]);

  // Pause/resume background animations based on page visibility
  useEffect(() => {
    const handleVisibilityChange = () => {
      const body = document.body;
      if (document.hidden) {
        body.classList.add('paused');
      } else {
        body.classList.remove('paused');
      }
    };

    const handleBlur = () => document.body.classList.add('paused');
    const handleFocus = () => document.body.classList.remove('paused');

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  // Notification de redémarrage
  const notifyRestart = useCallback(() => {
    toast.info(
      'Redémarrage recommandé',
      {
        description: 'Un redémarrage de l\'application est recommandé pour appliquer complètement les changements.',
        duration: 10000,
      }
    );
  }, []);

  const setTheme = useCallback((id: string) => {
    if (!themes.some((t) => t.id === id)) return;
    setCurrentThemeId(id);
    notifyRestart();
  }, [themes, notifyRestart]);

  const handleSetDynamicColor = useCallback((v: boolean) => {
    setDynamicColorEnabled(v);
    notifyRestart();
  }, [notifyRestart]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      themes,
      currentTheme,
      setTheme,
      dynamicColorEnabled,
      setDynamicColorEnabled: handleSetDynamicColor,
    }),
    [themes, currentTheme, setTheme, dynamicColorEnabled, handleSetDynamicColor],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}