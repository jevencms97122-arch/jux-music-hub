import { toast } from 'sonner';

/**
 * Notifications intelligentes : anti-spam par type (plafond journalier),
 * heures silencieuses pour les notifs non critiques, et regroupement (batching)
 * des notifs de même type qui arrivent en rafale.
 *
 * Les types critiques (message privé, demande d'ami, invitation de session)
 * passent toujours immédiatement.
 */

export type SmartNotifType =
  | 'friend_request'
  | 'session_invite'
  | 'new_message'
  | 'friend_listening'
  | 'generic';

interface NotifConfig {
  /** Regroupable si plusieurs arrivent dans la fenêtre de batching */
  batchable: boolean;
  /** Plafond de notifs par jour (au-delà : silencieux) */
  maxPerDay: number;
  /** Heures silencieuses [début, fin] (ex: [22, 8] = 22h → 8h) — non critique seulement */
  quietHours?: [number, number];
  /** Libellé groupé : (count) => titre */
  batchTitle?: (count: number) => string;
}

const CONFIGS: Record<SmartNotifType, NotifConfig> = {
  friend_request: { batchable: false, maxPerDay: 999 },
  session_invite: { batchable: false, maxPerDay: 999 },
  new_message: { batchable: false, maxPerDay: 999 },
  friend_listening: {
    batchable: true,
    maxPerDay: 6,
    quietHours: [22, 8],
    batchTitle: (n) => `${n} amis écoutent de la musique 🎵`,
  },
  generic: { batchable: true, maxPerDay: 30, quietHours: [23, 7], batchTitle: (n) => `${n} nouvelles notifications` },
};

const CRITICAL_TYPES: SmartNotifType[] = ['friend_request', 'session_invite', 'new_message'];
const BATCH_WINDOW_MS = 4000;
const DAILY_COUNT_KEY = 'jux_smart_notif_daily';

export interface SmartNotifData {
  title: string;
  body?: string;
  action?: { label: string; onClick: () => void };
  duration?: number;
}

function isQuietNow(config: NotifConfig): boolean {
  if (!config.quietHours) return false;
  const [start, end] = config.quietHours;
  const hour = new Date().getHours();
  // Fenêtre qui traverse minuit (ex: 22 → 8) ou pas (ex: 13 → 15)
  return start <= end ? hour >= start && hour < end : hour >= start || hour < end;
}

function underDailyCap(type: SmartNotifType, config: NotifConfig): boolean {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const raw = JSON.parse(localStorage.getItem(DAILY_COUNT_KEY) ?? '{}');
    const counts = raw.date === today ? raw.counts ?? {} : {};
    const current = counts[type] ?? 0;
    if (current >= config.maxPerDay) return false;
    counts[type] = current + 1;
    localStorage.setItem(DAILY_COUNT_KEY, JSON.stringify({ date: today, counts }));
    return true;
  } catch {
    return true;
  }
}

function show(data: SmartNotifData) {
  toast(data.title, {
    description: data.body,
    duration: data.duration ?? 8000,
    action: data.action,
  });
  if ('Notification' in window && Notification.permission === 'granted') {
    try { new Notification(data.title, { body: data.body || '' }); } catch {}
  }
}

// File de batching par type : les notifs regroupables attendent BATCH_WINDOW_MS ;
// si d'autres du même type arrivent entre-temps, une seule notif groupée sort.
const pendingBatches = new Map<SmartNotifType, { items: SmartNotifData[]; timer: ReturnType<typeof setTimeout> }>();

function flushBatch(type: SmartNotifType) {
  const batch = pendingBatches.get(type);
  if (!batch) return;
  pendingBatches.delete(type);
  const config = CONFIGS[type];
  if (batch.items.length === 1) {
    show(batch.items[0]);
  } else {
    show({
      title: config.batchTitle?.(batch.items.length) ?? `${batch.items.length} notifications`,
      body: batch.items.slice(0, 3).map((i) => i.title).join(' · '),
    });
  }
}

/**
 * Point d'entrée unique. Applique dans l'ordre : criticité → heures
 * silencieuses → plafond journalier → batching.
 */
export function sendSmartNotification(type: SmartNotifType, data: SmartNotifData): void {
  const config = CONFIGS[type] ?? CONFIGS.generic;
  const critical = CRITICAL_TYPES.includes(type);

  if (!critical && isQuietNow(config)) return;
  if (!critical && !underDailyCap(type, config)) return;

  if (config.batchable) {
    const existing = pendingBatches.get(type);
    if (existing) {
      existing.items.push(data);
    } else {
      pendingBatches.set(type, {
        items: [data],
        timer: setTimeout(() => flushBatch(type), BATCH_WINDOW_MS),
      });
    }
    return;
  }

  show(data);
}
