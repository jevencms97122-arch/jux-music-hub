import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/contexts/AuthContext';
import { useReactiveBg } from '@/hooks/useReactiveBg';
import { useThemeEnabled } from '@/hooks/useThemeEnabled';
import { useTheme } from '@/contexts/ThemeContext';
import { usePlayer, TRANSITION_MODES } from '@/contexts/PlayerContext';
import { LogOut, Sparkles, Palette, ChevronRight, RefreshCw, Zap, AudioLines, Glasses, Sliders, Mic } from 'lucide-react';
import { useVoiceAssistantSettings, isSpeechRecognitionSupported } from '@/hooks/useVoiceAssistant';
import { cn } from '@/lib/utils';
import { usePerformanceMode } from '@/hooks/usePerformanceMode';
import { useVRMode } from '@/hooks/useVRMode';
import ThemeSelectorSheet from '@/components/ThemeSelectorSheet';
import CrossfadeSelectorSheet from '@/components/CrossfadeSelectorSheet';
import EqualizerSheet from '@/components/EqualizerSheet';
import { EQ_PRESETS } from '@/lib/eqPresets';

export default function SettingsSheet({ trigger }: { trigger: React.ReactNode }) {
  const { logout } = useAuth();
  const { enabled, setEnabled } = useReactiveBg();
  const { enabled: themesEnabled, setEnabled: setThemesEnabled } = useThemeEnabled();
  const { enabled: performanceMode, setEnabled: setPerformanceMode } = usePerformanceMode();
  const { enabled: vrMode, setEnabled: setVrMode } = useVRMode();
  const { currentTheme } = useTheme();
  const { crossfadeSeconds, transitionMode, currentEqPreset } = usePlayer();
  const [showEq, setShowEq] = useState(false);
  const currentCrossfadeLabel = crossfadeSeconds > 0
    ? (TRANSITION_MODES.find((m) => m.value === transitionMode)?.label ?? 'Linear')
    : 'Aucun';
  const { enabled: assistantEnabled, setEnabled: setAssistantEnabled, wakeWord, setWakeWord } = useVoiceAssistantSettings();
  const [reactiveBgChanged, setReactiveBgChanged] = useState(false);
  const [themesChanged, setThemesChanged] = useState(false);

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
      <SheetContent side="bottom" className="rounded-t-3xl pb-safe">
        <SheetHeader className="mb-6">
          <SheetTitle>Paramètres</SheetTitle>
        </SheetHeader>

        <div className="space-y-2">
          {/* Mode Performance */}
          <div className="rounded-2xl bg-card/60 overflow-hidden">
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
          <div className="rounded-2xl bg-card/60 overflow-hidden">
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
          <div className="rounded-2xl bg-card/60 overflow-hidden">
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
                  className="flex items-center gap-1.5 rounded-xl bg-amber-500/15 px-3 py-1.5 text-xs font-semibold text-amber-400 hover:bg-amber-500/25 transition-colors flex-shrink-0"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Recharger
                </button>
              </div>
            )}
          </div>

          {/* Thèmes */}
          <div className="rounded-2xl bg-card/60 overflow-hidden">
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
                  className="flex items-center gap-1.5 rounded-xl bg-amber-500/15 px-3 py-1.5 text-xs font-semibold text-amber-400 hover:bg-amber-500/25 transition-colors flex-shrink-0"
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
                    <button className="flex w-full items-center gap-3 rounded-xl bg-secondary/50 px-3 py-2.5 hover:bg-secondary/80 transition-colors">
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

          {/* Assistant vocal Jux */}
          <div className="rounded-2xl bg-card/60 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3.5">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-500/15">
                  <Mic className="h-4.5 w-4.5 text-rose-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold">Assistant Jux</p>
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
                <div className="grid grid-cols-2 gap-2">
                  {(['jux', 'nexora'] as const).map((w) => (
                    <button
                      key={w}
                      onClick={() => setWakeWord(w)}
                      className={cn(
                        'rounded-xl px-3 py-2.5 text-sm font-semibold capitalize transition-colors',
                        wakeWord === w
                          ? 'bg-gradient-primary text-primary-foreground shadow-elegant-sm'
                          : 'bg-secondary/50 text-muted-foreground hover:bg-secondary/80'
                      )}
                    >
                      « {w === 'jux' ? 'Jux' : 'Nexora'} »
                    </button>
                  ))}
                </div>
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  Dis « {wakeWord === 'jux' ? 'Jux' : 'Nexora'}, pause », « reprendre », « musique suivante » ou « précédente ».
                  Le micro s'active uniquement quand une musique est lancée.
                </p>
              </div>
            )}
          </div>

          {/* Égaliseur */}
          <div className="rounded-2xl bg-card/60 overflow-hidden">
            <button
              onClick={() => setShowEq(true)}
              className="flex w-full items-center justify-between px-4 py-3.5"
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

          {/* Crossfade */}
          <div className="rounded-2xl bg-card/60 overflow-hidden">
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
                  <button className="flex w-full items-center gap-3 rounded-xl bg-secondary/50 px-3 py-2.5 hover:bg-secondary/80 transition-colors">
                    <span className="text-sm font-medium flex-1 text-left">{currentCrossfadeLabel}</span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  </button>
                }
              />
            </div>
          </div>
        </div>

        {/* Séparateur */}
        <div className="my-6 h-px bg-border/50" />

        <EqualizerSheet open={showEq} onClose={() => setShowEq(false)} />

        {/* Déconnexion */}
        <button
          onClick={logout}
          className="flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-red-400 hover:bg-red-500/10 transition-colors"
        >
          <LogOut className="h-5 w-5" />
          <span className="text-sm font-semibold">Se déconnecter</span>
        </button>
      </SheetContent>
    </Sheet>
  );
}
