import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { APP_THEMES, type AppTheme } from '@/themes/appThemes';
import { storeThemeAccents } from '@/lib/dominantColor';
import UltraBackground from '@/components/ultraThemes/UltraBackground';
import CustomVideoBackground from '@/components/CustomVideoBackground';
import {
  saveCustomVideo,
  loadCustomVideoBlob,
  clearCustomVideo as clearCustomVideoStorage,
} from '@/lib/customVideoTheme';
import {
  nebulaPaletteFromHex,
  randomNebulaHex,
  NEBULA_DEFAULT_HEX,
  type NebulaColors,
} from '@/lib/ultraNebulaPalette';
import { SYMBOL_PRESET_DEFAULT_ID } from '@/lib/ultraSymbolPresets';

export const CUSTOM_VIDEO_THEME_ID = 'custom-video';

function buildCustomVideoTheme(base: AppTheme): AppTheme {
  return {
    ...base,
    id: CUSTOM_VIDEO_THEME_ID,
    name: 'Vidéo personnalisée',
    background: 'transparent',
    backgroundAnimation: undefined,
    isUltra: false,
  };
}

type ThemeContextValue = {
  themes: AppTheme[];
  currentTheme: AppTheme;
  setTheme: (id: string) => void;
  /** Personnalisation du thème Ultra "Nébuleuse Cosmique" (null = couleurs par défaut) */
  nebulaBaseHex: string | null;
  setNebulaColor: (hex: string) => void;
  randomizeNebulaColor: () => void;
  resetNebulaColor: () => void;
  /** Multiplicateur de vitesse de l'animation (0.25x = très lent, 3x = rapide, 1 = par défaut) */
  nebulaSpeed: number;
  setNebulaSpeed: (speed: number) => void;
  /** Personnalisation du thème Ultra "Grille Symbolique" (preset d'animation) */
  symbolPresetId: string;
  setSymbolPreset: (id: string) => void;
  /** Palette dérivée de nebulaBaseHex, prête à passer à UltraBackground */
  nebulaColors: NebulaColors | null;
  /** Vrai quand l'app est en arrière-plan/hors focus : les animations doivent se figer */
  animPaused: boolean;
  /** Thème "Vidéo personnalisée" — l'utilisateur choisit une vidéo, elle joue en
   * fond et les couleurs d'accent suivent en direct sa couleur dominante. */
  customVideoUrl: string | null;
  hasCustomVideo: boolean;
  setCustomVideoTheme: (file: File) => Promise<void>;
  clearCustomVideoTheme: () => Promise<void>;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

const STORAGE_KEY = 'app_theme_id';
const NEBULA_STORAGE_KEY = 'ultra_nebula_base_hex';
const NEBULA_SPEED_STORAGE_KEY = 'ultra_nebula_speed';
const NEBULA_SPEED_DEFAULT = 1;
const SYMBOL_PRESET_STORAGE_KEY = 'ultra_symbol_preset_id';

function readSavedThemeId(): string {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === CUSTOM_VIDEO_THEME_ID) return saved;
    if (saved && APP_THEMES.some((t) => t.id === saved)) return saved;
  } catch {
    // ignore
  }
  return APP_THEMES[0]?.id ?? 'dark-classique';
}

function readSavedNebulaHex(): string | null {
  try {
    return localStorage.getItem(NEBULA_STORAGE_KEY);
  } catch {
    return null;
  }
}

function readSavedNebulaSpeed(): number {
  try {
    const saved = localStorage.getItem(NEBULA_SPEED_STORAGE_KEY);
    const parsed = saved ? parseFloat(saved) : NaN;
    if (!Number.isNaN(parsed) && parsed > 0) return parsed;
  } catch {
    // ignore
  }
  return NEBULA_SPEED_DEFAULT;
}

function readSavedSymbolPreset(): string {
  try {
    return localStorage.getItem(SYMBOL_PRESET_STORAGE_KEY) ?? SYMBOL_PRESET_DEFAULT_ID;
  } catch {
    return SYMBOL_PRESET_DEFAULT_ID;
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

  const [currentThemeId, setCurrentThemeId] = useState<string>(readSavedThemeId);
  const [animPaused, setAnimPaused] = useState(false);
  const [nebulaBaseHex, setNebulaBaseHex] = useState<string | null>(readSavedNebulaHex);
  const [nebulaSpeed, setNebulaSpeedState] = useState<number>(readSavedNebulaSpeed);
  const [symbolPresetId, setSymbolPresetState] = useState<string>(readSavedSymbolPreset);
  const [customVideoUrl, setCustomVideoUrl] = useState<string | null>(null);
  const [hasCustomVideo, setHasCustomVideo] = useState(false);
  const customVideoUrlRef = useRef<string | null>(null);

  const isCustomVideoActive = currentThemeId === CUSTOM_VIDEO_THEME_ID;

  const currentTheme = useMemo(() => {
    if (isCustomVideoActive) return buildCustomVideoTheme(themes[0]);
    return themes.find((t) => t.id === currentThemeId) ?? themes[0];
  }, [themes, currentThemeId, isCustomVideoActive]);

  // Charge la vidéo sauvegardée (IndexedDB) une seule fois au montage. Si le
  // thème vidéo était actif mais qu'il n'y a plus de vidéo (stockage vidé
  // ailleurs), on retombe sur le premier thème classique plutôt qu'un fond vide.
  useEffect(() => {
    let cancelled = false;
    loadCustomVideoBlob().then((blob) => {
      if (cancelled) return;
      if (blob) {
        const url = URL.createObjectURL(blob);
        customVideoUrlRef.current = url;
        setCustomVideoUrl(url);
        setHasCustomVideo(true);
      } else {
        setHasCustomVideo(false);
        setCurrentThemeId((id) => (id === CUSTOM_VIDEO_THEME_ID ? (themes[0]?.id ?? id) : id));
      }
    });
    return () => {
      cancelled = true;
      if (customVideoUrlRef.current) URL.revokeObjectURL(customVideoUrlRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    if (id === CUSTOM_VIDEO_THEME_ID) {
      // Réactive une vidéo déjà enregistrée — s'applique instantanément, pas
      // besoin de redémarrage contrairement aux thèmes classiques/Ultra.
      if (!hasCustomVideo) return;
      setCurrentThemeId(id);
      return;
    }
    if (!themes.some((t) => t.id === id)) return;
    setCurrentThemeId(id);
    notifyRestart();
  }, [themes, notifyRestart, hasCustomVideo]);

  const setCustomVideoTheme = useCallback(async (file: File) => {
    await saveCustomVideo(file);
    if (customVideoUrlRef.current) URL.revokeObjectURL(customVideoUrlRef.current);
    const url = URL.createObjectURL(file);
    customVideoUrlRef.current = url;
    setCustomVideoUrl(url);
    setHasCustomVideo(true);
    setCurrentThemeId(CUSTOM_VIDEO_THEME_ID);
  }, []);

  const clearCustomVideoTheme = useCallback(async () => {
    await clearCustomVideoStorage();
    if (customVideoUrlRef.current) {
      URL.revokeObjectURL(customVideoUrlRef.current);
      customVideoUrlRef.current = null;
    }
    setCustomVideoUrl(null);
    setHasCustomVideo(false);
    setCurrentThemeId((id) => (id === CUSTOM_VIDEO_THEME_ID ? (themes[0]?.id ?? id) : id));
  }, [themes]);

  const setNebulaColor = useCallback((hex: string) => {
    setNebulaBaseHex(hex);
    try {
      localStorage.setItem(NEBULA_STORAGE_KEY, hex);
    } catch {
      // ignore
    }
  }, []);

  const randomizeNebulaColor = useCallback(() => {
    setNebulaColor(randomNebulaHex());
  }, [setNebulaColor]);

  const resetNebulaColor = useCallback(() => {
    setNebulaBaseHex(null);
    try {
      localStorage.removeItem(NEBULA_STORAGE_KEY);
    } catch {
      // ignore
    }
  }, []);

  const setNebulaSpeed = useCallback((speed: number) => {
    const clamped = Math.min(3, Math.max(0.25, speed));
    setNebulaSpeedState(clamped);
    try {
      localStorage.setItem(NEBULA_SPEED_STORAGE_KEY, String(clamped));
    } catch {
      // ignore
    }
  }, []);

  const setSymbolPreset = useCallback((id: string) => {
    setSymbolPresetState(id);
    try {
      localStorage.setItem(SYMBOL_PRESET_STORAGE_KEY, id);
    } catch {
      // ignore
    }
  }, []);

  const nebulaColors = useMemo<NebulaColors | null>(
    () => (nebulaBaseHex ? nebulaPaletteFromHex(nebulaBaseHex) : null),
    [nebulaBaseHex],
  );

  const value = useMemo<ThemeContextValue>(
    () => ({
      themes,
      currentTheme,
      setTheme,
      nebulaBaseHex,
      setNebulaColor,
      randomizeNebulaColor,
      resetNebulaColor,
      nebulaSpeed,
      setNebulaSpeed,
      symbolPresetId,
      setSymbolPreset,
      nebulaColors,
      animPaused,
      customVideoUrl,
      hasCustomVideo,
      setCustomVideoTheme,
      clearCustomVideoTheme,
    }),
    [
      themes,
      currentTheme,
      setTheme,
      nebulaBaseHex,
      setNebulaColor,
      randomizeNebulaColor,
      resetNebulaColor,
      nebulaSpeed,
      setNebulaSpeed,
      symbolPresetId,
      setSymbolPreset,
      customVideoUrl,
      hasCustomVideo,
      setCustomVideoTheme,
      clearCustomVideoTheme,
      nebulaColors,
      animPaused,
    ],
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
      {currentTheme.isUltra && (
        <UltraBackground
          theme={currentTheme}
          paused={animPaused}
          nebulaColors={nebulaColors}
          nebulaSpeed={nebulaSpeed}
          symbolPresetId={symbolPresetId}
        />
      )}
      {isCustomVideoActive && customVideoUrl && (
        <CustomVideoBackground
          videoUrl={customVideoUrl}
          paused={animPaused}
          className="fixed inset-0 -z-10"
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
