const STORAGE_KEY = 'jux:devOptions';

export function isDevOptionsEnabled(): boolean {
  return localStorage.getItem(STORAGE_KEY) === 'true';
}

export function setDevOptionsEnabled(enabled: boolean): void {
  localStorage.setItem(STORAGE_KEY, String(enabled));
}
