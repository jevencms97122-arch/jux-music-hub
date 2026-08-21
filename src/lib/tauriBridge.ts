/**
 * Bridge natif pour l'app desktop Tauri — équivalent de l'ancien
 * `electron/preload.cjs`. Reproduit exactement la même surface sur
 * `window` (`window.electronAPI`, `window.JuxDesktop`) pour que le
 * reste du code (discordBridge.ts, versionCheck.ts, platform.ts,
 * offlineMode.ts...) fonctionne sans aucune modification.
 *
 * Doit être importé avant tout le reste dans main.tsx.
 */

import { invoke } from "@tauri-apps/api/core";
import { getVersion } from "@tauri-apps/api/app";
import { getCurrentWindow } from "@tauri-apps/api/window";

function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

if (isTauri()) {
  (window as any).electronAPI = {
    isElectron: true,
    updateDiscordPresence: (data: {
      title: string;
      author: string;
      coverUrl?: string;
      isPlaying: boolean;
      startTimestamp?: number;
      durationSecs?: number;
    }) => {
      invoke("discord_update_presence", {
        title: data.title,
        author: data.author,
        coverUrl: data.coverUrl ?? null,
        isPlaying: data.isPlaying,
        startTimestamp: data.startTimestamp ?? null,
        durationSecs: data.durationSecs ?? null,
      }).catch(() => {});
    },
    clearDiscordPresence: () => {
      invoke("discord_clear_presence").catch(() => {});
    },
    quitApp: () => {
      getCurrentWindow().close().catch(() => {});
    },
  };

  (window as any).JuxDesktop = {
    ...(window.JuxDesktop || {}),
    getAppVersion: () => getVersion(),
  };
}
