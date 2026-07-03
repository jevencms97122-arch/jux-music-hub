import { useEffect, useState, useCallback } from 'react';

const ENABLED_KEY = 'jux_assistant_enabled';
const MIC_DEVICE_KEY = 'jux_assistant_mic_device';
const SETTINGS_EVENT = 'jux:assistant-settings-changed';

export function isAssistantEnabled(): boolean {
  try { return localStorage.getItem(ENABLED_KEY) === 'true'; } catch { return false; }
}

/** null = périphérique par défaut du système */
export function getMicDeviceId(): string | null {
  try { return localStorage.getItem(MIC_DEVICE_KEY) || null; } catch { return null; }
}

/** Réglages de l'assistant vocal — synchronisés entre composants sans rechargement */
export function useVoiceAssistantSettings() {
  const [enabled, setEnabledState] = useState(isAssistantEnabled);
  const [micDeviceId, setMicDeviceIdState] = useState<string | null>(getMicDeviceId);

  useEffect(() => {
    const sync = () => { setEnabledState(isAssistantEnabled()); setMicDeviceIdState(getMicDeviceId()); };
    window.addEventListener(SETTINGS_EVENT, sync);
    return () => window.removeEventListener(SETTINGS_EVENT, sync);
  }, []);

  const setEnabled = useCallback((v: boolean) => {
    localStorage.setItem(ENABLED_KEY, String(v));
    setEnabledState(v);
    window.dispatchEvent(new Event(SETTINGS_EVENT));
  }, []);

  const setMicDeviceId = useCallback((id: string | null) => {
    if (id) localStorage.setItem(MIC_DEVICE_KEY, id);
    else localStorage.removeItem(MIC_DEVICE_KEY);
    setMicDeviceIdState(id);
    window.dispatchEvent(new Event(SETTINGS_EVENT));
  }, []);

  return { enabled, setEnabled, micDeviceId, setMicDeviceId };
}

/** La reconnaissance vocale est-elle disponible dans ce navigateur ? */
export function isSpeechRecognitionSupported(): boolean {
  return typeof window !== 'undefined' && !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
}
