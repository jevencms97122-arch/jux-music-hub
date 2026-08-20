import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/contexts/AuthContext';
import { useReactiveBg } from '@/hooks/useReactiveBg';
import { useThemeEnabled } from '@/hooks/useThemeEnabled';
import { useTheme } from '@/contexts/ThemeContext';
import { usePlayer, TRANSITION_MODES } from '@/contexts/PlayerContext';
import { LogOut, Sparkles, Palette, ChevronRight, RefreshCw, Zap, AudioLines, Glasses, Sliders, Mic, Settings2, Volume2, Gamepad2, BellOff, PictureInPicture2, Cpu, Code2, Download, Radio } from 'lucide-react';
import { useVoiceAssistantSettings, isSpeechRecognitionSupported } from '@/hooks/useVoiceAssistant';
import { usePerformanceMode } from '@/hooks/usePerformanceMode';
import { useVRMode } from '@/hooks/useVRMode';
import ThemeSelectorSheet from '@/components/ThemeSelectorSheet';
import CrossfadeSelectorSheet from '@/components/CrossfadeSelectorSheet';
import NotificationSfxSheet from '@/components/NotificationSfxSheet';
import { isSoundOnlyMode, setSoundOnlyMode } from '@/lib/notificationSfx';
import { isCloseToTrayEnabled, setCloseToTrayEnabled } from '@/lib/closeToTray';
import {
  isGpuAccelerationEnabled, setGpuAccelerationEnabled,
  getGpuBackend, setGpuBackend, type GpuBackend,
  getGpuAdapter, setGpuAdapter, type GpuAdapter,
} from '@/lib/gpuAcceleration';
import { isDevOptionsEnabled, setDevOptionsEnabled } from '@/lib/devOptions';
import { relaunch } from '@tauri-apps/plugin-process';
import { cn } from '@/lib/utils';
import { usePlatform } from '@/hooks/usePlatform';
import { isDesktopPlatform, isWindowsPlatform } from '@/lib/platform';
import GamepadMappingSheet from '@/components/GamepadMappingSheet';
import { isGamepadEnabled, setGamepadEnabled } from '@/lib/gamepadMapping';
import EqualizerSheet from '@/components/EqualizerSheet';
import MicTestSheet from '@/components/MicTestSheet';
import { EQ_PRESETS } from '@/lib/eqPresets';
import { isAutoDownloadEnabled, setAutoDownloadEnabled } from '@/lib/autoDownloadManager';
import DownloadedSongsSheet from '@/components/DownloadedSongsSheet';

export default function SettingsSheet({ trigger }: { trigger: React.ReactNode }) {
  const { logout } = useAuth();
  const platform = usePlatform();
  const isDesktop = isDesktopPlatform(platform);
  const isWindows = isWindowsPlatform(platform);
  const { enabled, setEnabled } = useReactiveBg();
  const { enabled: themesEnabled, setEnabled: setThemesEnabled } = useThemeEnabled();
  const { enabled: performanceMode, setEnabled: setPerformanceMode } = usePerformanceMode();
  const { enabled: vrMode, setEnabled: setVrMode } = useVRMode();
  const { currentTheme } = useTheme();
  const { crossfadeSeconds, transitionMode, currentEqPreset, permanentSessionEnabled, setPermanentSessionEnabled } = usePlayer();
  const [showEq, setShowEq] = useState(false);
  const currentCrossfadeLabel = crossfadeSeconds > 0
    ? (TRANSITION_MODES.find((m) => m.value === transitionMode)?.label ?? 'Linear')
    : 'Aucun';
  const { enabled: assistantEnabled, setEnabled: setAssistantEnabled } = useVoiceAssistantSettings();
  const [reactiveBgChanged, setReactiveBgChanged] = useState(false);
  const [themesChanged, setThemesChanged] = useState(false);
  const [gamepadEnabled, setGamepadEnabledState] = useState(() => isGamepadEnabled());
  const [soundOnly, setSoundOnlyState] = useState(() => isSoundOnlyMode());
  const [closeToTray, setCloseToTrayState] = useState(() => isCloseToTrayEnabled());
  const [devOptions, setDevOptionsState] = useState(() => isDevOptionsEnabled());
  const [gpuAccel, setGpuAccelState] = useState(() => isGpuAccelerationEnabled());
  const [gpuBackend, setGpuBackendState] = useState<GpuBackend>(() => getGpuBackend());
  const [gpuAdapter, setGpuAdapterState] = useState<GpuAdapter>(() => getGpuAdapter());
  const [gpuChanged, setGpuChanged] = useState(false);
  const [autoDownload, setAutoDownloadState] = useState(true);

  useEffect(() => {
    isAutoDownloadEnabled(platform).then((enabled) => {
      setAutoDownloadState(enabled);
    });
  }, [platform]);

  const handleDevOptionsToggle = (v: boolean) => {
    setDevOptionsState(v);
    setDevOptionsEnabled(v);
  };

  const handleGpuToggle = (v: boolean) => {
    setGpuAccelState(v);
    setGpuAccelerationEnabled(v);
    setGpuChanged(true);
  };

  const handleGpuBackendChange = (v: GpuBackend) => {
    setGpuBackendState(v);
    setGpuBackend(v);
    setGpuChanged(true);
  };

  const handleGpuAdapterChange = (v: GpuAdapter) => {
    setGpuAdapterState(v);
    setGpuAdapter(v);
    setGpuChanged(true);
  };

  const handleGamepadToggle = (v: boolean) => {
    setGamepadEnabledState(v);
    setGamepadEnabled(v);
  };

  const handleSoundOnlyToggle = (v: boolean) => {
    setSoundOnlyState(v);
    setSoundOnlyMode(v);
  };

  const handleAutoDownloadToggle = (v: boolean) => {
    setAutoDownloadState(v);
    setAutoDownloadEnabled(v);
  };

  const handleCloseToTrayToggle = (v: boolean) => {
    setCloseToTrayState(v);
    setCloseToTrayEnabled(v);
  };

  const handleReactiveBgToggle = (v: boolean) => {
    setEnabled(v);
    setReactiveBgChanged(true);
  };

  const handleThemesToggle = (v: boolean) => {
    setThemesEnabled(v);
    setThemesChanged(true);
  };

  return (
    <Sheet>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent
        side="bottom"
        className="rounded-t-3xl pb-safe max-h-[85vh] flex flex-col overflow-hidden"
      >
        <SheetHeader className="mb-6 flex-shrink-0">
          <SheetTitle>Paramètres</SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto pr-1">
          <div className="space-y-2">
          {/* Mode Performance */}
          <div className="rounded-2xl border border-white/[0.06] bg-card/60 backdrop-blur-md overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3.5">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-green-500/15">
                  <Zap className="h-4.5 w-4.5 text-green-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold">Mode Performance</p>
                  <p className="text-xs text-muted-foreground">Désactive le chargement des images</p>
                </div>
              </div>
              <Switch checked={performanceMode} onCheckedChange={(v) => { setPerformanceMode(v); window.location.reload(); }} />
            </div>
          </div>

          {/* Mode VR */}
          <div className="rounded-2xl border border-white/[0.06] bg-card/60 backdrop-blur-md overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3.5">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/15">
                  <Glasses className="h-4.5 w-4.5 text-blue-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold">Mode VR</p>
                  <p className="text-xs text-muted-foreground">Interface agrandie pour casques VR et autres appareils non-standards</p>
                </div>
              </div>
              <Switch checked={vrMode} onCheckedChange={(v) => { setVrMode(v); window.location.reload(); }} />
            </div>
          </div>

          {/* Arrière-plan réactif */}
          <div className="rounded-2xl border border-white/[0.06] bg-card/60 backdrop-blur-md overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3.5">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-500/15">
                  <Sparkles className="h-4.5 w-4.5 text-purple-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold">Arrière-plan réactif</p>
                  <p className="text-xs text-muted-foreground">Le fond du lecteur s'anime avec la musique</p>
                </div>
              </div>
              <Switch checked={enabled} onCheckedChange={handleReactiveBgToggle} />
            </div>
            {reactiveBgChanged && (
              <div className="border-t border-border/40 px-4 pb-3.5 pt-3 flex items-center justify-between gap-3">
                <p className="text-xs text-amber-400">Rechargez la page pour appliquer le changement.</p>
                <button
                  onClick={() => window.location.reload()}
                  className="flex items-center gap-1.5 rounded-xl bg-amber-500/15 px-3 py-1.5 text-xs font-semibold text-amber-400 transition-[background-color,transform] duration-150 ease-out hover:bg-amber-500/25 active:scale-90 flex-shrink-0"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Recharger
                </button>
              </div>
            )}
          </div>

          {/* Thèmes */}
          <div className="rounded-2xl border border-white/[0.06] bg-card/60 backdrop-blur-md overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3.5">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500/15">
                  <Palette className="h-4.5 w-4.5 text-indigo-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold">Thèmes</p>
                  <p className="text-xs text-muted-foreground">Dégradés et couleurs personnalisés</p>
                </div>
              </div>
              <Switch checked={themesEnabled} onCheckedChange={handleThemesToggle} />
            </div>

            {themesChanged && (
              <div className="border-t border-border/40 px-4 pb-3 pt-3 flex items-center justify-between gap-3">
                <p className="text-xs text-amber-400">Rechargez la page pour appliquer le changement.</p>
                <button
                  onClick={() => window.location.reload()}
                  className="flex items-center gap-1.5 rounded-xl bg-amber-500/15 px-3 py-1.5 text-xs font-semibold text-amber-400 transition-[background-color,transform] duration-150 ease-out hover:bg-amber-500/25 active:scale-90 flex-shrink-0"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Recharger
                </button>
              </div>
            )}
            {themesEnabled && (
              <div className="border-t border-border/40 px-4 pb-3.5 pt-2">
                <ThemeSelectorSheet
                  triggerLabel={
                    <button className="flex w-full items-center gap-3 rounded-xl bg-secondary/50 px-3 py-2.5 transition-[background-color,transform] duration-150 ease-out hover:bg-secondary/80 active:scale-[0.98]">
                      {/* Aperçu miniature du thème actif */}
                      <span
                        className="h-6 w-6 rounded-md flex-shrink-0 border border-white/10"
                        style={{
                          background: currentTheme.background,
                          backgroundSize: '300% 300%',
                          animation: currentTheme.backgroundAnimation ?? undefined,
                        }}
                      />
                      <span className="text-sm font-medium flex-1 text-left">{currentTheme.name}</span>
                      {currentTheme.backgroundAnimation && (
                        <span className="text-[10px] font-bold text-purple-400 bg-purple-500/15 px-1.5 py-0.5 rounded-full">✦ animé</span>
                      )}
                      <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    </button>
                  }
                />
              </div>
            )}
          </div>

          {/* Assistant vocal */}
          <div className="rounded-2xl border border-white/[0.06] bg-card/60 backdrop-blur-md overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3.5">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-500/15">
                  <Mic className="h-4.5 w-4.5 text-rose-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold">Assistant</p>
                  <p className="text-xs text-muted-foreground">Commandes vocales en français pendant la lecture</p>
                </div>
              </div>
              <Switch
                checked={assistantEnabled}
                disabled={!isSpeechRecognitionSupported()}
                onCheckedChange={setAssistantEnabled}
              />
            </div>
            {!isSpeechRecognitionSupported() && (
              <div className="border-t border-border/40 px-4 pb-3.5 pt-3">
                <p className="text-xs text-amber-400">Reconnaissance vocale non disponible sur ce navigateur.</p>
              </div>
            )}
            {assistantEnabled && (
              <div className="border-t border-border/40 px-4 pb-3.5 pt-3 space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Phrase magique</p>
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  Dis « Jux » ou « Nexora », suivi de « pause », « reprendre », « musique suivante » ou « précédente ».
                  Les deux mots magiques sont acceptés en même temps. Le micro s'active uniquement quand une musique est lancée.
                </p>
                <MicTestSheet
                  trigger={
                    <button className="flex w-full items-center gap-3 rounded-xl bg-secondary/50 px-3 py-2.5 transition-[background-color,transform] duration-150 ease-out hover:bg-secondary/80 active:scale-[0.98]">
                      <Settings2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <span className="text-sm font-medium flex-1 text-left">Périphérique &amp; test du micro</span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    </button>
                  }
                />
              </div>
            )}
          </div>

          {/* Égaliseur */}
          <div className="rounded-2xl border border-white/[0.06] bg-card/60 backdrop-blur-md overflow-hidden">
            <button
              onClick={() => setShowEq(true)}
              className="flex w-full items-center justify-between px-4 py-3.5 transition-transform duration-150 ease-out active:scale-[0.98]"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/15">
                  <Sliders className="h-4.5 w-4.5 text-emerald-400" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-semibold">Égaliseur</p>
                  <p className="text-xs text-muted-foreground">
                    {EQ_PRESETS.find((p) => p.id === currentEqPreset)?.name ?? 'Normal'}
                  </p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>

          {/* Manette */}
          <div className="rounded-2xl border border-white/[0.06] bg-card/60 backdrop-blur-md overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3.5">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-500/15">
                  <Gamepad2 className="h-4.5 w-4.5 text-teal-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold">Manette</p>
                  <p className="text-xs text-muted-foreground">Contrôler l'interface avec une manette</p>
                </div>
              </div>
              <Switch checked={gamepadEnabled} onCheckedChange={handleGamepadToggle} />
            </div>
            {gamepadEnabled && (
              <div className="border-t border-border/40 px-4 pb-3.5 pt-2">
                <GamepadMappingSheet
                  trigger={
                    <button className="flex w-full items-center gap-3 rounded-xl bg-secondary/50 px-3 py-2.5 transition-[background-color,transform] duration-150 ease-out hover:bg-secondary/80 active:scale-[0.98]">
                      <span className="text-sm font-medium flex-1 text-left">Voir / modifier le mappage des boutons</span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    </button>
                  }
                />
              </div>
            )}
          </div>

          {/* Session permanente — accessible sur toutes les plateformes */}
          <div className="rounded-2xl border border-white/[0.06] bg-card/60 backdrop-blur-md overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3.5">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-fuchsia-500/15">
                  <Radio className="h-4.5 w-4.5 text-fuchsia-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold">Session permanente</p>
                  <p className="text-xs text-muted-foreground">Tes abonnés voient ta musique en cours et peuvent rejoindre à tout moment</p>
                </div>
              </div>
              <Switch checked={permanentSessionEnabled} onCheckedChange={setPermanentSessionEnabled} />
            </div>
          </div>

          {/* Son de notification */}
          <div className="rounded-2xl border border-white/[0.06] bg-card/60 backdrop-blur-md overflow-hidden">
            <NotificationSfxSheet
              trigger={
                <button className="flex w-full items-center justify-between px-4 py-3.5 transition-transform duration-150 ease-out active:scale-[0.98]">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-500/15">
                      <Volume2 className="h-4.5 w-4.5 text-orange-400" />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-semibold">Son de notification</p>
                      <p className="text-xs text-muted-foreground">Nouveau message reçu</p>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </button>
              }
            />
          </div>

          {/* Son seul sans notification (Windows uniquement) */}
          {isWindows && (
            <div className="rounded-2xl border border-white/[0.06] bg-card/60 backdrop-blur-md overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3.5">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/15">
                    <BellOff className="h-4.5 w-4.5 text-amber-400" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">Son seul, sans notification</p>
                    <p className="text-xs text-muted-foreground">Joue le son de notif sans afficher le popup Windows</p>
                  </div>
                </div>
                <Switch checked={soundOnly} onCheckedChange={handleSoundOnlyToggle} />
              </div>
            </div>
          )}

          {/* Téléchargement automatique de musique (Windows uniquement) */}
          {isWindows && (
            <DownloadedSongsSheet
              trigger={
                <div className="rounded-2xl border border-white/[0.06] bg-card/60 backdrop-blur-md overflow-hidden cursor-pointer">
                  <div className="flex items-center justify-between px-4 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/15">
                        <Download className="h-4.5 w-4.5 text-blue-400" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold">Téléchargement automatique</p>
                        <p className="text-xs text-muted-foreground">Télécharge les titres écoutés · touche pour gérer les fichiers</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Switch checked={autoDownload} onCheckedChange={handleAutoDownloadToggle} onClick={(e) => e.stopPropagation()} />
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                </div>
              }
            />
          )}

          {/* Rester actif en arrière-plan (desktop uniquement — pas de barre des tâches sur mobile) */}
          {isDesktop && (
            <div className="rounded-2xl border border-white/[0.06] bg-card/60 backdrop-blur-md overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3.5">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-500/15">
                    <PictureInPicture2 className="h-4.5 w-4.5 text-sky-400" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">Rester actif en arrière-plan</p>
                    <p className="text-xs text-muted-foreground">La croix minimise dans la barre des tâches système au lieu de fermer</p>
                  </div>
                </div>
                <Switch checked={closeToTray} onCheckedChange={handleCloseToTrayToggle} />
              </div>
            </div>
          )}

          {/* Options développeur (Windows uniquement) */}
          {isWindows && (
            <div className="rounded-2xl border border-white/[0.06] bg-card/60 backdrop-blur-md overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3.5">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-lime-500/15">
                    <Code2 className="h-4.5 w-4.5 text-lime-400" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">Options développeur</p>
                    <p className="text-xs text-muted-foreground">Réglages avancés de rendu graphique</p>
                  </div>
                </div>
                <Switch checked={devOptions} onCheckedChange={handleDevOptionsToggle} />
              </div>

              {devOptions && (
                <div className="border-t border-border/40 px-4 pb-4 pt-3.5 space-y-4">
                  {/* Accélération GPU */}
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-lime-500/15">
                        <Cpu className="h-4.5 w-4.5 text-lime-400" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold">Accélération GPU</p>
                        <p className="text-xs text-muted-foreground">Force le rendu par la carte graphique</p>
                      </div>
                    </div>
                    <Switch checked={gpuAccel} onCheckedChange={handleGpuToggle} />
                  </div>

                  {gpuAccel && (
                    <>
                      {/* Backend Direct3D */}
                      <div>
                        <p className="mb-2 text-xs font-semibold text-muted-foreground">Backend Direct3D</p>
                        <div className="flex gap-2">
                          {([
                            { value: 'd3d11', label: 'D3D11 (recommandé)' },
                            { value: 'd3d11on12', label: 'D3D11on12' },
                            { value: 'd3d9', label: 'D3D9 (compatibilité)' },
                          ] as { value: GpuBackend; label: string }[]).map((opt) => (
                            <button
                              key={opt.value}
                              onClick={() => handleGpuBackendChange(opt.value)}
                              className={cn(
                                'flex-1 rounded-xl px-2 py-2 text-center text-[11px] font-semibold transition-[background-color,color,transform] duration-150 ease-out active:scale-95',
                                gpuBackend === opt.value
                                  ? 'bg-primary text-primary-foreground'
                                  : 'bg-secondary/60 text-muted-foreground hover:text-foreground'
                              )}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Vulkan expérimental — activable uniquement via combo au démarrage */}
                      <div className="rounded-xl bg-secondary/40 px-3 py-3">
                        <div className="mb-1 flex items-center gap-2">
                          <p className="text-sm font-semibold">Vulkan</p>
                          <span className="rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-400">
                            Expérimental
                          </span>
                        </div>
                        <p className="text-xs leading-relaxed text-muted-foreground">
                          Appuie sur <span className="font-semibold text-foreground">Ctrl+Alt+V</span> pendant l'animation
                          de démarrage pour lancer cette session en Vulkan. Non permanent : à refaire à chaque lancement —
                          si ton pilote ne suit pas, un simple redémarrage revient automatiquement à Direct3D.
                        </p>
                      </div>

                      {/* Carte graphique utilisée */}
                      <div>
                        <p className="mb-2 text-xs font-semibold text-muted-foreground">Carte graphique utilisée</p>
                        <div className="flex gap-2">
                          {([
                            { value: 'auto', label: 'Automatique' },
                            { value: 'high', label: 'Dédiée' },
                            { value: 'low', label: 'Intégrée' },
                          ] as { value: GpuAdapter; label: string }[]).map((opt) => (
                            <button
                              key={opt.value}
                              onClick={() => handleGpuAdapterChange(opt.value)}
                              className={cn(
                                'flex-1 rounded-xl px-2 py-2 text-center text-[11px] font-semibold transition-[background-color,color,transform] duration-150 ease-out active:scale-95',
                                gpuAdapter === opt.value
                                  ? 'bg-primary text-primary-foreground'
                                  : 'bg-secondary/60 text-muted-foreground hover:text-foreground'
                              )}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </>
                  )}

                  {gpuChanged && (
                    <div className="flex items-center justify-between gap-3 rounded-xl bg-amber-500/10 px-3 py-2.5">
                      <p className="text-xs text-amber-400">Redémarrez l'app pour appliquer le changement.</p>
                      <button
                        onClick={() => relaunch()}
                        className="flex items-center gap-1.5 rounded-xl bg-amber-500/15 px-3 py-1.5 text-xs font-semibold text-amber-400 transition-[background-color,transform] duration-150 ease-out hover:bg-amber-500/25 active:scale-90 flex-shrink-0"
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                        Redémarrer
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Crossfade */}
          <div className="rounded-2xl border border-white/[0.06] bg-card/60 backdrop-blur-md overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3.5">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-500/15">
                  <AudioLines className="h-4.5 w-4.5 text-cyan-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold">Crossfade</p>
                  <p className="text-xs text-muted-foreground">Enchaînement entre les morceaux</p>
                </div>
              </div>
            </div>

            <div className="border-t border-border/40 px-4 pb-3.5 pt-2">
              <CrossfadeSelectorSheet
                triggerLabel={
                  <button className="flex w-full items-center gap-3 rounded-xl bg-secondary/50 px-3 py-2.5 transition-[background-color,transform] duration-150 ease-out hover:bg-secondary/80 active:scale-[0.98]">
                    <span className="text-sm font-medium flex-1 text-left">{currentCrossfadeLabel}</span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  </button>
                }
              />
            </div>
          </div>

          {/* Séparateur */}
          <div className="my-6 h-px bg-border/50" />

          {/* Déconnexion */}
          <button
            onClick={logout}
            className="flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-red-400 transition-[background-color,transform] duration-150 ease-out hover:bg-red-500/10 active:scale-[0.98]"
          >
            <LogOut className="h-5 w-5" />
            <span className="text-sm font-semibold">Se déconnecter</span>
          </button>
          </div>
        </div>

        <EqualizerSheet open={showEq} onClose={() => setShowEq(false)} />
      </SheetContent>
    </Sheet>
  );
}
