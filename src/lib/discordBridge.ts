declare global {
  interface Window {
    electronAPI?: {
      isElectron: boolean;
      updateDiscordPresence: (data: DiscordPresenceData) => void;
      clearDiscordPresence: () => void;
    };
  }
}

export interface DiscordPresenceData {
  title: string;
  author: string;
  coverUrl?: string;
  isPlaying: boolean;
  startTimestamp?: number;
}

export function isElectron(): boolean {
  return typeof window !== 'undefined' && !!window.electronAPI?.isElectron;
}

export function updateDiscordPresence(data: DiscordPresenceData): void {
  if (!isElectron()) return;
  try {
    window.electronAPI!.updateDiscordPresence(data);
  } catch {}
}

export function clearDiscordPresence(): void {
  if (!isElectron()) return;
  try {
    window.electronAPI!.clearDiscordPresence();
  } catch {}
}
