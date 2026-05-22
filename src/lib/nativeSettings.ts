/**
 * Bridge avec les paramètres natifs de l'app (Android / Windows).
 * L'app expose getAppPreferences()/setAppPreference(key,value).
 * Les nouveaux paramètres ajoutés côté natif apparaissent automatiquement
 * dans l'UI Web sans avoir à mettre à jour le site.
 */

declare global {
  interface Window {
    Android?: {
      getAppPreferences?: () => string;
      setAppPreference?: (key: string, value: unknown) => void;
    };
    JuxAndroid?: {
      getAppPreferences?: () => string;
      setAppPreference?: (key: string, value: unknown) => void;
    };
    JuxDesktop?: {
      getAppPreferences?: () => string | Promise<string>;
      setAppPreference?: (key: string, value: unknown) => void | Promise<void>;
    };
  }
}

export type NativePrefValue = boolean | string | number;

export interface NativePrefMeta {
  value: NativePrefValue;
  label?: string;
  description?: string;
  type?: 'boolean' | 'string' | 'number';
  options?: Array<{ value: string | number; label: string }>;
}

export type NativePref = NativePrefValue | NativePrefMeta;
export type NativePrefs = Record<string, NativePref>;

function bridge() {
  if (typeof window === 'undefined') return null;
  return window.JuxAndroid ?? window.Android ?? window.JuxDesktop ?? null;
}

export function isNativeAppSettingsAvailable(): boolean {
  const b = bridge();
  return !!(b && typeof (b as any).getAppPreferences === 'function');
}

export async function getNativePreferences(): Promise<NativePrefs | null> {
  const b: any = bridge();
  if (!b?.getAppPreferences) return null;
  try {
    const raw = await Promise.resolve(b.getAppPreferences());
    if (!raw) return {};
    return typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch (e) {
    console.error('getNativePreferences failed', e);
    return null;
  }
}

export async function setNativePreference(key: string, value: NativePrefValue): Promise<boolean> {
  const b: any = bridge();
  if (!b?.setAppPreference) return false;
  try {
    await Promise.resolve(b.setAppPreference(key, value));
    return true;
  } catch (e) {
    console.error('setNativePreference failed', e);
    return false;
  }
}

/** Normalise une entrée de pref (valeur brute ou objet meta) */
export function normalizePref(pref: NativePref): NativePrefMeta {
  if (pref !== null && typeof pref === 'object' && 'value' in (pref as any)) {
    return pref as NativePrefMeta;
  }
  const value = pref as NativePrefValue;
  return { value, type: typeof value as NativePrefMeta['type'] };
}

/** Transforme `biometric_enabled` → `Biometric Enabled` */
export function humanizeKey(key: string): string {
  return key
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}
