import { useEffect, useState, useCallback } from 'react';

const ENABLED_KEY = 'jux_assistant_enabled';
const WAKEWORD_KEY = 'jux_assistant_wakeword';
const SETTINGS_EVENT = 'jux:assistant-settings-changed';

export type WakeWord = 'jux' | 'nexora';

export function isAssistantEnabled(): boolean {
  try { return localStorage.getItem(ENABLED_KEY) === 'true'; } catch { return false; }
}

export function getWakeWord(): WakeWord {
  try { return localStorage.getItem(WAKEWORD_KEY) === 'nexora' ? 'nexora' : 'jux'; } catch { return 'jux'; }
}

/** Réglages de l'assistant vocal — synchronisés entre composants sans rechargement */
export function useVoiceAssistantSettings() {
  const [enabled, setEnabledState] = useState(isAssistantEnabled);
  const [wakeWord, setWakeWordState] = useState<WakeWord>(getWakeWord);

  useEffect(() => {
    const sync = () => { setEnabledState(isAssistantEnabled()); setWakeWordState(getWakeWord()); };
    window.addEventListener(SETTINGS_EVENT, sync);
    return () => window.removeEventListener(SETTINGS_EVENT, sync);
  }, []);

  const setEnabled = useCallback((v: boolean) => {
    localStorage.setItem(ENABLED_KEY, String(v));
    setEnabledState(v);
    window.dispatchEvent(new Event(SETTINGS_EVENT));
  }, []);

  const setWakeWord = useCallback((w: WakeWord) => {
    localStorage.setItem(WAKEWORD_KEY, w);
    setWakeWordState(w);
    window.dispatchEvent(new Event(SETTINGS_EVENT));
  }, []);

  return { enabled, setEnabled, wakeWord, setWakeWord };
}

/** La reconnaissance vocale est-elle disponible dans ce navigateur ? */
export function isSpeechRecognitionSupported(): boolean {
  return typeof window !== 'undefined' && !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
}
