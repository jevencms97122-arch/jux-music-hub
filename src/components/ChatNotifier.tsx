import { useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { pb } from '@/lib/pocketbase';
import { useAuth } from '@/contexts/AuthContext';
import { playNotificationSfx, isSoundOnlyMode } from '@/lib/notificationSfx';
import { isTauri, invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { listen } from '@tauri-apps/api/event';

/**
 * Écouteur global de nouveaux messages : joue le SFX sélectionné, et si l'app
 * est minimisée/en arrière-plan (desktop Tauri), affiche une vraie notification
 * Windows au lieu de laisser Windows utiliser son propre son par défaut.
 * Un clic sur la notification ramène l'app au premier plan et ouvre la conversation.
 */
export default function ChatNotifier() {
  const { user } = useAuth();
  const userId = user?.id;
  const navigate = useNavigate();
  const location = useLocation();
  const locationRef = useRef(location.pathname);
  locationRef.current = location.pathname;
  const isFocusedRef = useRef(true);
  const senderNameCache = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    const onFocus = () => { isFocusedRef.current = true; };
    const onBlur = () => { isFocusedRef.current = false; };
    window.addEventListener('focus', onFocus);
    window.addEventListener('blur', onBlur);
    isFocusedRef.current = document.hasFocus();
    return () => {
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('blur', onBlur);
    };
  }, []);

  // Clic sur la notification Windows -> premier plan + ouverture de la conversation
  useEffect(() => {
    if (!isTauri()) return;
    let cancelled = false;
    let unlisten: (() => void) | undefined;
    (async () => {
      try {
        // listen() renvoie directement la fonction de désinscription (pas un objet
        // avec .unregister() — c'est l'API de @tauri-apps/plugin-notification qui,
        // elle, fonctionne comme ça. Les confondre plantait toute navigation React
        // dès que ce cleanup s'exécutait, d'où l'écran noir.
        const unlistenFn = await listen<string>('chat-notification-clicked', async (event) => {
          const senderId = event.payload;
          try {
            const win = getCurrentWindow();
            await win.unminimize();
            await win.show();
            await win.setFocus();
          } catch { /* noop */ }
          // Évite de pousser une entrée d'historique en double si on est déjà
          // sur cette conversation (empêchait le bouton retour de fonctionner
          // du premier coup).
          const target = `/chat/${senderId}`;
          if (senderId && locationRef.current !== target) navigate(target);
        });
        if (cancelled) { unlistenFn(); return; }
        unlisten = unlistenFn;
      } catch { /* noop */ }
    })();
    return () => { cancelled = true; if (unlisten) unlisten(); };
  }, [navigate]);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    let unsub: (() => void) | undefined;
    (async () => {
      try {
        const unsubscribe = await pb.collection('messages').subscribe('*', async (e) => {
          if (e.action !== 'create') return;
          const r: any = e.record;
          if (r.recipient_id !== userId || r.sender_id === userId) return;

          playNotificationSfx();

          if (isTauri() && !isFocusedRef.current && !isSoundOnlyMode()) {
            try {
              let senderName = senderNameCache.current.get(r.sender_id);
              if (!senderName) {
                try {
                  const profile = await pb.collection('profiles').getFirstListItem(
                    `user_id = "${r.sender_id}"`,
                    { requestKey: null }
                  );
                  senderName = (profile as any)?.pseudo || 'Nouveau message';
                } catch {
                  senderName = 'Nouveau message';
                }
                senderNameCache.current.set(r.sender_id, senderName!);
              }

              const body =
                r.type === 'text' ? (r.text || '...') :
                r.type === 'voice' ? 'Message vocal' :
                r.type === 'song_share' ? 'A partagé un son' : 'Nouveau message';

              await invoke('show_chat_notification', { title: senderName, body, senderId: r.sender_id });
            } catch { /* noop */ }
          }
        });
        // L'abonnement a pu résoudre APRÈS le démontage/changement de userId :
        // dans ce cas on le referme immédiatement plutôt que de le laisser
        // fuiter en double (source des notifications/navigations dupliquées).
        if (cancelled) { unsubscribe(); return; }
        unsub = unsubscribe;
      } catch { /* noop */ }
    })();
    return () => { cancelled = true; if (unsub) unsub(); };
  }, [userId]);

  return null;
}
