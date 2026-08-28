import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { ChevronRight, Volume2, BellOff, Sparkles } from 'lucide-react';
import NotificationSfxSheet from '@/components/NotificationSfxSheet';
import InterfaceSoundPickerSheet from '@/components/InterfaceSoundPickerSheet';
import { INTERFACE_SOUND_CATEGORIES } from '@/lib/interfaceSounds';
import { isSoundOnlyMode, setSoundOnlyMode } from '@/lib/notificationSfx';

interface Props {
  trigger: React.ReactNode;
  isWindows: boolean;
}

export default function SoundEffectsSettingsSheet({ trigger, isWindows }: Props) {
  const [soundOnly, setSoundOnlyState] = useState(() => isSoundOnlyMode());

  const handleSoundOnlyToggle = (v: boolean) => {
    setSoundOnlyState(v);
    setSoundOnlyMode(v);
  };

  return (
    <Sheet>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent side="bottom" className="rounded-t-3xl pb-safe max-h-[85vh] flex flex-col overflow-hidden">
        <SheetHeader className="mb-6 flex-shrink-0">
          <SheetTitle>Effets sonores</SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto pr-1 space-y-6">
          {/* ── Dossier Notifications ── */}
          <div>
            <h3 className="mb-2 px-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">Notifications</h3>
            <div className="space-y-2">
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
            </div>
          </div>

          {/* ── Dossier Interface ── */}
          <div>
            <h3 className="mb-2 px-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">Interface</h3>
            <div className="space-y-2">
              {INTERFACE_SOUND_CATEGORIES.map((cat) => (
                <div key={cat.id} className="rounded-2xl border border-white/[0.06] bg-card/60 backdrop-blur-md overflow-hidden">
                  <InterfaceSoundPickerSheet
                    categoryId={cat.id}
                    categoryLabel={cat.label}
                    trigger={
                      <button className="flex w-full items-center justify-between px-4 py-3.5 transition-transform duration-150 ease-out active:scale-[0.98]">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-500/15">
                            <Sparkles className="h-4.5 w-4.5 text-purple-400" />
                          </div>
                          <div className="text-left">
                            <p className="text-sm font-semibold">{cat.label}</p>
                            <p className="text-xs text-muted-foreground">{cat.description}</p>
                          </div>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </button>
                    }
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
