import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { Lock } from 'lucide-react';
import {
  isNotificationCategoryEnabled,
  setNotificationCategoryEnabled,
  isNotificationCategoryLocked,
} from '@/lib/notificationSettings';
import type { SmartNotifType } from '@/lib/smartNotifications';

interface CategoryDef {
  id: SmartNotifType;
  label: string;
  description: string;
}

const CATEGORIES: CategoryDef[] = [
  { id: 'new_message', label: 'Messages', description: 'Toujours activé' },
  { id: 'friend_request', label: 'Demandes d\'ami', description: 'Nouveaux abonnés' },
  { id: 'session_invite', label: 'Invitations de session', description: 'Écoute ensemble' },
  { id: 'friend_listening', label: 'Amis qui écoutent', description: 'Activité de tes amis' },
  { id: 'generic', label: 'Général', description: 'Le reste des notifications' },
];

export default function NotificationPreferencesSheet({ trigger }: { trigger: React.ReactNode }) {
  const [state, setState] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    for (const c of CATEGORIES) init[c.id] = isNotificationCategoryEnabled(c.id);
    return init;
  });

  const handleToggle = (id: SmartNotifType, value: boolean) => {
    setNotificationCategoryEnabled(id, value);
    setState((prev) => ({ ...prev, [id]: value }));
  };

  return (
    <Sheet>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent side="bottom" className="rounded-t-3xl pb-safe max-h-[85vh] flex flex-col overflow-hidden">
        <SheetHeader className="mb-4 flex-shrink-0">
          <SheetTitle>Notifications</SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto pr-1 space-y-2">
          {CATEGORIES.map((cat) => {
            const locked = isNotificationCategoryLocked(cat.id);
            return (
              <div key={cat.id} className="flex items-center justify-between rounded-2xl border border-white/[0.06] bg-card/60 px-4 py-3.5 backdrop-blur-md">
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{cat.label}</p>
                  <p className="flex items-center gap-1 text-xs text-muted-foreground">
                    {locked && <Lock className="h-3 w-3" />}
                    {cat.description}
                  </p>
                </div>
                <Switch
                  checked={locked ? true : state[cat.id]}
                  disabled={locked}
                  onCheckedChange={(v) => handleToggle(cat.id, v)}
                />
              </div>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}
