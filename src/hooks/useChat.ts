import { useCallback, useEffect, useRef, useState } from 'react';
import { pb } from '@/lib/pocketbase';
import { useAuth } from '@/contexts/AuthContext';
import type { ChatMessage } from '@/types/music';

export function recordToChatMessage(r: any): ChatMessage {
  return {
    id: r.id,
    sender_id: r.sender_id,
    recipient_id: r.recipient_id,
    type: r.type,
    text: r.text ?? null,
    voice: r.voice ?? null,
    voice_duration: r.voice_duration ?? null,
    song_id: r.song_id ?? null,
    clip_start: r.clip_start ?? null,
    clip_end: r.clip_end ?? null,
    is_read: !!r.is_read,
    created_at: r.created,
    collectionId: r.collectionId,
    collectionName: r.collectionName,
  };
}

/** URL du fichier vocal d'un message */
export function voiceUrl(m: ChatMessage): string {
  if (!m.voice) return '';
  return pb.files.getURL({ id: m.id, collectionName: 'messages' } as any, m.voice);
}

/** Envoie un message texte */
export async function sendTextMessage(senderId: string, recipientId: string, text: string) {
  return pb.collection('messages').create({
    sender_id: senderId, recipient_id: recipientId, type: 'text', text, is_read: false,
  });
}

/** Envoie un message vocal (blob audio) */
export async function sendVoiceMessage(senderId: string, recipientId: string, blob: Blob, duration: number) {
  const fd = new FormData();
  fd.append('sender_id', senderId);
  fd.append('recipient_id', recipientId);
  fd.append('type', 'voice');
  fd.append('voice_duration', String(Math.round(duration)));
  fd.append('is_read', 'false');
  const ext = blob.type.includes('ogg') ? 'ogg' : blob.type.includes('mp4') ? 'm4a' : 'webm';
  fd.append('voice', new File([blob], `vocal-${Date.now()}.${ext}`, { type: blob.type }));
  return pb.collection('messages').create(fd);
}

/** Supprime un message (chez l'expéditeur uniquement, comme sur Instagram) */
export async function deleteMessage(id: string) {
  return pb.collection('messages').delete(id);
}

/** Envoie un partage de musique (avec clip personnalisé) */
export async function sendSongShareMessage(
  senderId: string, recipientId: string, songId: string,
  clipStart: number, clipEnd: number, text?: string,
) {
  return pb.collection('messages').create({
    sender_id: senderId, recipient_id: recipientId, type: 'song_share',
    song_id: songId, clip_start: clipStart, clip_end: clipEnd,
    text: text || '', is_read: false,
  });
}

/**
 * Nombre de messages non lus, global + par expéditeur.
 * Polling léger + realtime PocketBase.
 */
export function useUnreadMessages() {
  const { user } = useAuth();
  const [unreadTotal, setUnreadTotal] = useState(0);
  const [unreadBySender, setUnreadBySender] = useState<Record<string, number>>({});

  const refresh = useCallback(async () => {
    if (!user) return;
    try {
      const res = await pb.collection('messages').getList(1, 200, {
        filter: `recipient_id = "${user.id}" && is_read = false`,
        fields: 'id,sender_id',
        requestKey: null,
      });
      const bySender: Record<string, number> = {};
      for (const m of res.items as any[]) bySender[m.sender_id] = (bySender[m.sender_id] || 0) + 1;
      setUnreadBySender(bySender);
      setUnreadTotal(res.totalItems);
    } catch {}
  }, [user]);

  useEffect(() => {
    if (!user) return;
    refresh();
    const interval = setInterval(refresh, 15000);
    let unsub: (() => void) | undefined;
    (async () => {
      try {
        unsub = await pb.collection('messages').subscribe('*', (e) => {
          const r: any = e.record;
          if (r.recipient_id === user.id || r.sender_id === user.id) refresh();
        });
      } catch {}
    })();
    return () => { clearInterval(interval); if (unsub) unsub(); };
  }, [user, refresh]);

  return { unreadTotal, unreadBySender, refresh };
}

/**
 * Conversation temps réel avec un autre utilisateur.
 * Charge l'historique, s'abonne aux nouveaux messages, marque comme lus.
 */
export function useConversation(otherUserId: string | undefined) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const seenIds = useRef<Set<string>>(new Set());

  const markAsRead = useCallback(async (items: ChatMessage[]) => {
    if (!user) return;
    const toMark = items.filter((m) => m.recipient_id === user.id && !m.is_read);
    await Promise.all(toMark.map((m) =>
      pb.collection('messages').update(m.id, { is_read: true }, { requestKey: null }).catch(() => {})
    ));
  }, [user]);

  useEffect(() => {
    if (!user || !otherUserId) return;
    seenIds.current = new Set();
    setLoading(true);
    let cancelled = false;

    (async () => {
      try {
        const res = await pb.collection('messages').getList(1, 200, {
          filter: `(sender_id = "${user.id}" && recipient_id = "${otherUserId}") || (sender_id = "${otherUserId}" && recipient_id = "${user.id}")`,
          sort: 'created',
          requestKey: null,
        });
        if (cancelled) return;
        const items = res.items.map(recordToChatMessage);
        for (const m of items) seenIds.current.add(m.id);
        setMessages(items);
        markAsRead(items);
      } catch {}
      if (!cancelled) setLoading(false);
    })();

    let unsub: (() => void) | undefined;
    (async () => {
      try {
        unsub = await pb.collection('messages').subscribe('*', (e) => {
          const r: any = e.record;
          const isMine = r.sender_id === user.id && r.recipient_id === otherUserId;
          const isTheirs = r.sender_id === otherUserId && r.recipient_id === user.id;
          if (!isMine && !isTheirs) return;

          if (e.action === 'delete') {
            seenIds.current.delete(r.id);
            setMessages((prev) => prev.filter((m) => m.id !== r.id));
            return;
          }
          if (e.action === 'update') {
            setMessages((prev) => prev.map((m) => (m.id === r.id ? recordToChatMessage(r) : m)));
            return;
          }
          if (e.action !== 'create') return;
          if (seenIds.current.has(r.id)) return;
          seenIds.current.add(r.id);
          const msg = recordToChatMessage(r);
          setMessages((prev) => [...prev, msg]);
          if (isTheirs) markAsRead([msg]);
        });
      } catch {}
    })();

    return () => { cancelled = true; if (unsub) unsub(); };
  }, [user, otherUserId, markAsRead]);

  /** Ajout optimiste après envoi local */
  const appendLocal = useCallback((r: any) => {
    if (seenIds.current.has(r.id)) return;
    seenIds.current.add(r.id);
    setMessages((prev) => [...prev, recordToChatMessage(r)]);
  }, []);

  /** Retrait optimiste après suppression locale */
  const removeLocal = useCallback((id: string) => {
    seenIds.current.delete(id);
    setMessages((prev) => prev.filter((m) => m.id !== id));
  }, []);

  return { messages, loading, appendLocal, removeLocal };
}
