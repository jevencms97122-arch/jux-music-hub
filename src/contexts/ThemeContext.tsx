import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { APP_THEMES, type AppTheme } from '@/themes/appThemes';
import { storeThemeAccents } from '@/lib/dominantColor';

type ThemeContextValue = {
  themes: AppTheme[];
  currentTheme: AppTheme;
  setTheme: (id: string) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

const STORAGE_KEY = 'app_theme_id';

function readSavedThemeId(): string {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && APP_THEMES.some((t) => t.id === saved)) return saved;
  } catch {
    // ignore
  }
  return APP_THEMES[0]?.id ?? 'dark-classique';
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

  const [currentThemeId, setCurrentThemeId] = useState<string>(readSavedThemeId);
  const [animPaused, setAnimPaused] = useState(false);

  const currentTheme = useMemo(() => {
    return themes.find((t) => t.id === currentThemeId) ?? themes[0];
  }, [themes, currentThemeId]);

  // Applique les CSS vars + nettoie l'ancien style body
  useEffect(() => {
    if (!currentTheme) return;
    applyThemeToCssVars(currentTheme);

    // Nettoie l'ancienne approche body inline (si elle était active)
    document.body.style.background = '';
    document.body.style.backgroundSize = '';
    document.body.style.animation = '';
    document.body.removeAttribute('data-animated-bg');

    storeThemeAccents({
      primary: currentTheme.hsl.primary,
      accent: currentTheme.hsl.accent,
      ring: currentTheme.hsl.ring,
      sidebarPrimary: currentTheme.hsl.sidebar.primary,
      sidebarRing: currentTheme.hsl.sidebar.ring,
    });

    try {
      localStorage.setItem(STORAGE_KEY, currentTheme.id);
    } catch {
      // ignore
    }
  }, [currentTheme]);

  // Pause/resume basé sur visibilité et focus — utilise React state
  useEffect(() => {
    const pause = () => setAnimPaused(true);
    const resume = () => setAnimPaused(false);
    const onVisibility = () => document.hidden ? pause() : resume();

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('blur', pause);
    window.addEventListener('focus', resume);

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('blur', pause);
      window.removeEventListener('focus', resume);
    };
  }, []);

  // Notification de redémarrage
  const notifyRestart = useCallback(() => {
    toast(
      <div className="flex w-full items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">Redémarrage recommandé</p>
          <p className="text-xs text-muted-foreground mt-0.5">Rechargez pour appliquer complètement le thème.</p>
        </div>
        <button
          onClick={() => window.location.reload()}
          className="flex-shrink-0 rounded-lg bg-primary/20 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/30 transition-colors"
        >
          Recharger
        </button>
      </div>,
      { duration: 20000 }
    );
  }, []);

  const setTheme = useCallback((id: string) => {
    if (!themes.some((t) => t.id === id)) return;
    setCurrentThemeId(id);
    notifyRestart();
  }, [themes, notifyRestart]);

  const value = useMemo<ThemeContextValue>(
    () => ({ themes, currentTheme, setTheme }),
    [themes, currentTheme, setTheme],
  );

  return (
    <ThemeContext.Provider value={value}>
      {/* Backdrop animé : fixe, z-index -1, toujours visible derrière tout le contenu */}
      {currentTheme.backgroundAnimation && (
        <div
          aria-hidden
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: -1,
            pointerEvents: 'none',
            background: currentTheme.background,
            backgroundSize: '300% 300%',
            animation: currentTheme.backgroundAnimation,
            animationPlayState: animPaused ? 'paused' : 'running',
          }}
        />
      )}
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}