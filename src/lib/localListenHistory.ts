const KEY = 'local_listen_history';
const MAX_ENTRIES = 200;

/**
 * Historique d'écoute local (localStorage) — alimenté à chaque lecture, en ligne
 * comme hors ligne. Sert de source pour la section "Réécouter" quand il n'y a
 * pas de backend (mode offline) et de miroir rapide sinon.
 */
export function recordLocalListen(songId: string) {
  try {
    const arr: string[] = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    const next = [songId, ...arr.filter((id) => id !== songId)].slice(0, MAX_ENTRIES);
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // ignore (stockage plein ou indisponible)
  }
}

/** IDs des sons déjà écoutés, du plus récent au plus ancien. */
export function getLocalListenHistory(): string[] {
  try {
    const arr = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(arr) ? arr.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

/** Retire de l'historique local les entrées de sons locaux (id `local_…`). */
export function pruneLocalOnlyListenHistory() {
  try {
    const arr = getLocalListenHistory().filter((id) => !id.startsWith('local_'));
    localStorage.setItem(KEY, JSON.stringify(arr));
  } catch {
    // ignore
  }
}
