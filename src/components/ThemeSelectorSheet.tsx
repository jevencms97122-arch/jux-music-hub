import { useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Shuffle, RotateCcw, Upload, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { useTheme, CUSTOM_VIDEO_THEME_ID } from '@/contexts/ThemeContext';
import { MAX_VIDEO_BYTES } from '@/lib/customVideoTheme';
import { NEBULA_DEFAULT_HEX } from '@/lib/ultraNebulaPalette';
import { SYMBOL_PRESETS, SYMBOL_PRESET_DEFAULT_ID } from '@/lib/ultraSymbolPresets';
import { cn } from '@/lib/utils';

const PREVIEW_SIZE_CLASS = 'h-10 w-10 sm:h-11 sm:w-11';

export default function ThemeSelectorSheet({
  triggerLabel,
  triggerClassName,
}: {
  triggerLabel: React.ReactNode;
  triggerClassName?: string;
}) {
  const {
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
  } = useTheme();

  const hasAnimation = currentTheme.backgroundAnimation != null;
  const isUltraActive = currentTheme.isUltra === true;
  const isCustomVideoActive = currentTheme.id === CUSTOM_VIDEO_THEME_ID;
  const isColorCustomizable = currentTheme.customizable === true && currentTheme.customizeType !== 'preset';
  const isPresetCustomizable = currentTheme.customizable === true && currentTheme.customizeType === 'preset';

  const videoInputRef = useRef<HTMLInputElement>(null);
  const [uploadingVideo, setUploadingVideo] = useState(false);

  const handlePickVideo = () => videoInputRef.current?.click();

  const handleVideoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('video/')) {
      toast.error('Choisis un fichier vidéo.');
      return;
    }
    if (file.size > MAX_VIDEO_BYTES) {
      toast.error(`Vidéo trop lourde (max ${Math.round(MAX_VIDEO_BYTES / (1024 * 1024))} Mo).`);
      return;
    }
    setUploadingVideo(true);
    try {
      await setCustomVideoTheme(file);
      toast.success('Thème vidéo appliqué');
    } catch {
      toast.error("Échec de l'enregistrement de la vidéo");
    } finally {
      setUploadingVideo(false);
    }
  };

  const handleRemoveVideo = async () => {
    await clearCustomVideoTheme();
    toast.success('Vidéo supprimée');
  };

  const renderThemeButton = (t: (typeof themes)[number]) => {
    const isActive = t.id === currentTheme.id;

    return (
      <button
        key={t.id}
        type="button"
        onClick={() => setTheme(t.id)}
        aria-label={`Theme ${t.name}`}
        title={t.name}
        className={cn(
          'relative inline-flex items-center justify-center rounded-xl border p-[2px] transition-transform',
          'hover:scale-[1.03]',
          isActive ? 'border-white/90' : 'border-transparent',
        )}
      >
        <span
          className={cn(
            PREVIEW_SIZE_CLASS,
            'rounded-[9px]'
          )}
          style={{
            background: t.background,
            backgroundSize: t.backgroundAnimation ? '300% 300%' : undefined,
            animation: t.backgroundAnimation
              ? t.backgroundAnimation.replace(/\d+s/, '3s')
              : undefined,
          }}
        />
        {t.isUltra && (
          <span className="pointer-events-none absolute -right-1 -top-1 rounded-full bg-gradient-to-br from-amber-400 to-red-500 px-1 text-[8px] font-bold text-white leading-none py-[1px]">
            ✦✦
          </span>
        )}
        {t.backgroundAnimation && !t.isUltra && (
          <span className="pointer-events-none absolute -right-1 -top-1 rounded-full bg-gradient-to-br from-purple-400 to-pink-500 px-1 text-[8px] font-bold text-white leading-none py-[1px]">
            ✦
          </span>
        )}
        {!t.backgroundAnimation && !t.isUltra && isActive && (
          <span className="pointer-events-none absolute -right-1 -top-1 rounded-full bg-white p-1">
            <span className="block h-2.5 w-2.5 rounded-full bg-black/80" />
          </span>
        )}
      </button>
    );
  };

  const staticThemeButtons = useMemo(
    () => themes.filter((t) => !t.backgroundAnimation && !t.isUltra).map(renderThemeButton),
    [currentTheme.id, setTheme, themes],
  );

  const animatedThemeButtons = useMemo(
    () => themes.filter((t) => t.backgroundAnimation && !t.isUltra).map(renderThemeButton),
    [currentTheme.id, setTheme, themes],
  );

  const ultraThemeButtons = useMemo(
    () => themes.filter((t) => t.isUltra).map(renderThemeButton),
    [currentTheme.id, setTheme, themes],
  );

  return (
    <Sheet>
      <SheetTrigger asChild>
        {typeof triggerLabel === 'string' ? (
          <Button variant="secondary" size="sm" className={triggerClassName}>
            {triggerLabel}
          </Button>
        ) : (
          triggerLabel
        )}
      </SheetTrigger>

      <SheetContent side="left" className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Thème de l’application</SheetTitle>
          <SheetDescription>
            Choisis une ambiance (statiques ou animées).
            {hasAnimation && !isUltraActive && (
              <span className="mt-1 block text-xs text-purple-400">
                ✦ Animé • se met en pause au focus perdu
              </span>
            )}
            {isUltraActive && (
              <span className="mt-1 block text-xs text-amber-400">
                ✦✦ Ultra • effet le plus riche, consomme plus de ressources • pause au focus perdu
              </span>
            )}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4">
          <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Thèmes classiques
          </div>
          <div className="flex flex-wrap gap-3">
            {staticThemeButtons}
          </div>

          <div className="mb-3 mt-6 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Thèmes animés ✦
          </div>
          <div className="flex flex-wrap gap-3">
            {animatedThemeButtons}
          </div>

          {ultraThemeButtons.length > 0 && (
            <>
              <div className="mb-1 mt-6 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-400">
                Thèmes Ultra ✦✦
              </div>
              <p className="mb-3 text-[11px] text-muted-foreground">
                Effets les plus riches (particules, halos). Consomment plus de ressources que les thèmes classiques et animés.
              </p>
              <div className="flex flex-wrap gap-3">
                {ultraThemeButtons}
              </div>
            </>
          )}

          <div className="mb-1 mt-6 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-cyan-400">
            Thème personnalisé 🎬
          </div>
          <p className="mb-3 text-[11px] text-muted-foreground">
            Choisis une vidéo : elle joue en fond et les couleurs de l'app suivent celles de l'image en direct.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            {hasCustomVideo && (
              <button
                type="button"
                onClick={() => setTheme(CUSTOM_VIDEO_THEME_ID)}
                aria-label="Thème vidéo personnalisée"
                title="Vidéo personnalisée"
                className={cn(
                  'relative inline-flex items-center justify-center overflow-hidden rounded-xl border p-[2px] transition-transform',
                  'hover:scale-[1.03]',
                  isCustomVideoActive ? 'border-white/90' : 'border-transparent',
                )}
              >
                <video
                  src={customVideoUrl ?? undefined}
                  muted
                  playsInline
                  preload="metadata"
                  className={cn(PREVIEW_SIZE_CLASS, 'rounded-[9px] object-cover')}
                />
                <span className="pointer-events-none absolute -right-1 -top-1 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 px-1 text-[8px] font-bold text-white leading-none py-[1px]">
                  🎬
                </span>
              </button>
            )}
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handlePickVideo}
              disabled={uploadingVideo}
              className="flex items-center gap-1.5"
            >
              <Upload className="h-3.5 w-3.5" />
              {uploadingVideo ? 'Enregistrement...' : hasCustomVideo ? 'Changer la vidéo' : 'Choisir une vidéo'}
            </Button>
            {hasCustomVideo && (
              <button
                type="button"
                onClick={handleRemoveVideo}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Supprimer
              </button>
            )}
          </div>
          <input
            ref={videoInputRef}
            type="file"
            accept="video/*"
            className="hidden"
            onChange={handleVideoFileChange}
          />

          <div className="mt-5 rounded-xl border bg-secondary/40 p-4">
            <div className="text-sm font-semibold">Actif</div>
            <div className="mt-1 text-xs text-muted-foreground">{currentTheme.name}</div>

            {isCustomVideoActive && customVideoUrl ? (
              <video
                src={customVideoUrl}
                autoPlay
                loop
                muted
                playsInline
                className="mt-3 h-16 w-full rounded-lg border object-cover"
              />
            ) : (
              <div
                className="mt-3 h-16 w-full rounded-lg border"
                style={{
                  background: currentTheme.background,
                  backgroundSize: currentTheme.backgroundAnimation ? '300% 300%' : undefined,
                  animation: currentTheme.backgroundAnimation ?? undefined,
                }}
              />
            )}

            {isColorCustomizable && (
              <div className="mt-4 border-t border-border/50 pt-4">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-semibold">Couleur personnalisée</span>
                  {nebulaBaseHex && (
                    <button
                      type="button"
                      onClick={resetNebulaColor}
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                    >
                      <RotateCcw className="h-3 w-3" />
                      Par défaut
                    </button>
                  )}
                </div>
                <p className="mb-3 text-[11px] text-muted-foreground">
                  Choisis une couleur d'accent ou laisse l'aléatoire faire. Par défaut sans réglage.
                </p>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    aria-label="Couleur d'accent du thème"
                    value={nebulaBaseHex ?? NEBULA_DEFAULT_HEX}
                    onChange={(e) => setNebulaColor(e.target.value)}
                    className="h-10 w-14 cursor-pointer rounded-lg border border-border bg-transparent p-1"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={randomizeNebulaColor}
                    className="flex items-center gap-1.5"
                  >
                    <Shuffle className="h-3.5 w-3.5" />
                    Aléatoire
                  </Button>
                </div>

                <div className="mt-4">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-semibold">Vitesse de l'animation</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs tabular-nums text-muted-foreground">{nebulaSpeed.toFixed(2)}x</span>
                      {nebulaSpeed !== 1 && (
                        <button
                          type="button"
                          onClick={() => setNebulaSpeed(1)}
                          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                        >
                          <RotateCcw className="h-3 w-3" />
                          Par défaut
                        </button>
                      )}
                    </div>
                  </div>
                  <input
                    type="range"
                    aria-label="Vitesse de l'animation"
                    min={0.25}
                    max={3}
                    step={0.25}
                    value={nebulaSpeed}
                    onChange={(e) => setNebulaSpeed(parseFloat(e.target.value))}
                    className="w-full accent-primary"
                  />
                  <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
                    <span>Très lent</span>
                    <span>Rapide</span>
                  </div>
                </div>
              </div>
            )}

            {isPresetCustomizable && (
              <div className="mt-4 border-t border-border/50 pt-4">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-semibold">Preset d'animation</span>
                  {symbolPresetId !== SYMBOL_PRESET_DEFAULT_ID && (
                    <button
                      type="button"
                      onClick={() => setSymbolPreset(SYMBOL_PRESET_DEFAULT_ID)}
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                    >
                      <RotateCcw className="h-3 w-3" />
                      Par défaut
                    </button>
                  )}
                </div>
                <p className="mb-3 text-[11px] text-muted-foreground">
                  Choisis la palette de pulsation des symboles.
                </p>
                <div className="flex flex-wrap gap-2">
                  {SYMBOL_PRESETS.map((preset) => {
                    const isActivePreset = symbolPresetId === preset.id;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => setSymbolPreset(preset.id)}
                        className={cn(
                          'flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors',
                          isActivePreset
                            ? 'border-white/90 bg-secondary/60 text-foreground'
                            : 'border-border/50 text-muted-foreground hover:text-foreground',
                        )}
                      >
                        <span
                          className="h-3 w-3 rounded-full"
                          style={{ background: preset.c2, boxShadow: `0 0 6px ${preset.c1}` }}
                        />
                        {preset.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

        </div>
      </SheetContent>
    </Sheet>
  );
}
