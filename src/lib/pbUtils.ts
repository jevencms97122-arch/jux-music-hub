/**
 * Utilitaires pour le SDK PocketBase v0.26+.
 * Dans les nouvelles versions, les champs sont accessibles directement
 * via r.title plutôt que r.title.
 * Cette fonction gère les deux formats pour la transition.
 */
export function field<T>(record: any, key: string, defaultValue?: T): T | undefined {
  if (!record) return defaultValue;
  // Nouveau format SDK v0.26+ : accès direct
  if (record[key] !== undefined) {
    const val = record[key];
    if (val === null && defaultValue !== undefined) return defaultValue;
    return val;
  }
  // Ancien format : méthode .get()
  if (typeof record.get === 'function') {
    const val = record.get(key);
    if (val === null && defaultValue !== undefined) return defaultValue;
    return val;
  }
  return defaultValue;
}

export function fieldStr(record: any, key: string, fallback = ''): string {
  const val = field(record, key);
  if (val === null || val === undefined) return fallback;
  return String(val);
}

export function fieldNum(record: any, key: string, fallback = 0): number {
  const val = field(record, key);
  if (val === null || val === undefined) return fallback;
  const n = Number(val);
  return isNaN(n) ? fallback : n;
}