import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { pb } from '@/lib/pocketbase';
import { useAuth } from '@/contexts/AuthContext';
import { useConversation, sendTextMessage, sendVoiceMessage, voiceUrl, deleteMessage } from '@/hooks/useChat';
import { avatarUrl } from '@/lib/storage';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import ChatSongCard from '@/components/ChatSongCard';
import AttachSongSheet from '@/components/AttachSongSheet';
import { toast } from 'sonner';
import { ArrowLeft, Send, Mic, Play, Pause, Trash2, User, MessageCircle, Music2, Check, CheckCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Profile, ChatMessage } from '@/types/music';
import { useSeo } from '@/lib/useSeo';

const fmtDuration = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

function fmtTime(date: string): string {
  const d = new Date(date);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const time = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  if (sameDay) return time;
  return `${d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} ${time}`;
}

/** Bulle de message vocal avec lecture */
function VoiceBubble({ message, mine }: { message: ChatMessage; mine: boolean }) {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => () => { audioRef.current?.pause(); }, []);

  const toggle = () => {
    if (!audioRef.current) {
      const audio = new Audio(voiceUrl(message));
      audio.addEventListener('timeupdate', () => {
        if (audio.duration) setProgress(audio.currentTime / audio.duration);
      });
      audio.addEventListener('ended', () => { setPlaying(false); setProgress(0); });
      audioRef.current = audio;
    }
    if (playing) { audioRef.current.pause(); setPlaying(false); }
    else { audioRef.current.play().then(() => setPlaying(true)).catch(() => toast.error('Lecture impossible')); }
  };

  return (
    <div className="flex items-center gap-2.5 min-w-[160px]">
      <button
        onClick={toggle}
        aria-label={playing ? 'Pause' : 'Écouter le vocal'}
        className={cn(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-full active:scale-95 transition-transform',
          mine ? 'bg-white/20' : 'bg-primary text-primary-foreground'
        )}
      >
        {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
      </button>
      {/* Fausse waveform */}
      <div className="flex h-6 flex-1 items-center gap-[2px]">
        {Array.from({ length: 24 }).map((_, i) => {
          const h = 6 + ((i * 37) % 14);
          const active = progress * 24 > i;
          return (
            <span
              key={i}
              className={cn('w-[3px] rounded-full transition-colors', active ? (mine ? 'bg-white' : 'bg-primary') : (mine ? 'bg-white/35' : 'bg-muted-foreground/35'))}
              style={{ height: h }}
            />
          );
        })}
      </div>
      <span className="text-[10px] opacity-70 shrink-0">{fmtDuration(message.voice_duration || 0)}</span>
    </div>
  );
}

export default function Chat() {
  const { userId } = useParams<{ userId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { messages, loading, appendLocal, removeLocal } = useConversation(userId);
  const [other, setOther] = useState<Profile | null>(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [showAttachSong, setShowAttachSong] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Enregistrement vocal
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval>>();
  const cancelledRef = useRef(false);

  useSeo({ title: `${other?.pseudo || 'Chat'} — Nexora Music`, description: 'Discute avec tes amis sur Nexora Music.', path: `/chat/${userId}` });

  useEffect(() => {
    if (!userId) return;
    pb.collection('profiles').getList(1, 1, { filter: `user_id = "${userId}"`, requestKey: null })
      .then((res) => { if (res.items[0]) setOther(res.items[0] as any as Profile); })
      .catch(() => {});
  }, [userId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const send = async () => {
    const trimmed = text.trim();
    if (!trimmed || !user || !userId || sending) return;
    setSending(true);
    setText('');
    try {
      const rec = await sendTextMessage(user.id, userId, trimmed);
      appendLocal(rec);
    } catch (e: any) {
      toast.error(e?.message || 'Envoi impossible');
      setText(trimmed);
    }
    setSending(false);
  };

  const removeMessage = async (id: string) => {
    removeLocal(id);
    try {
      await deleteMessage(id);
    } catch {
      toast.error('Suppression impossible');
    }
  };

  const startRecording = async () => {
    if (!user || !userId) return;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      toast.error('Message vocal non supporté par ce navigateur');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm'
        : MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4' : '';
      const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunksRef.current = [];
      cancelledRef.current = false;
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        clearInterval(timerRef.current);
        const duration = recordSecondsRef.current;
        setRecording(false);
        setRecordSeconds(0);
        if (cancelledRef.current || duration < 1) return;
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        try {
          const rec = await sendVoiceMessage(user.id, userId, blob, duration);
          appendLocal(rec);
        } catch (e: any) {
          toast.error(e?.message || 'Envoi du vocal impossible');
        }
      };
      recorderRef.current = recorder;
      recorder.start();
      setRecording(true);
      setRecordSeconds(0);
      recordSecondsRef.current = 0;
      timerRef.current = setInterval(() => {
        recordSecondsRef.current += 1;
        setRecordSeconds(recordSecondsRef.current);
        if (recordSecondsRef.current >= 120) stopRecording(false); // max 2 min
      }, 1000);
    } catch {
      toast.error('Micro indisponible ou accès refusé');
    }
  };
  const recordSecondsRef = useRef(0);

  const stopRecording = (cancel: boolean) => {
    cancelledRef.current = cancel;
    recorderRef.current?.stop();
  };

  useEffect(() => () => {
    clearInterval(timerRef.current);
    if (recorderRef.current?.state === 'recording') { cancelledRef.current = true; recorderRef.current.stop(); }
  }, []);

  const grouped = useMemo(() => messages, [messages]);

  return (
    <div className="flex h-[100dvh] flex-col">
      {/* ── Header ── */}
      <header className="flex items-center gap-3 border-b border-border/40 bg-card/60 px-4 py-3 backdrop-blur-xl">
        <button onClick={() => navigate(-1)} aria-label="Retour" className="flex h-9 w-9 items-center justify-center rounded-xl hover:bg-white/[0.06] transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <button onClick={() => navigate(`/u/${userId}`)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
          <Avatar className="h-10 w-10">
            <AvatarImage src={other ? avatarUrl(other as any) : ''} />
            <AvatarFallback>{other?.pseudo?.[0] || '?'}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold">{other?.pseudo || '...'}</p>
            <p className="text-[11px] text-muted-foreground">Appuie pour voir le profil</p>
          </div>
        </button>
        <button onClick={() => navigate(`/u/${userId}`)} aria-label="Profil" className="flex h-9 w-9 items-center justify-center rounded-xl hover:bg-white/[0.06] transition-colors">
          <User className="h-4.5 w-4.5 text-muted-foreground" />
        </button>
      </header>

      {/* ── Messages ── */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2 pb-32">
        {loading ? (
          <div className="space-y-3 pt-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className={cn('flex', i % 2 === 0 ? 'justify-start' : 'justify-end')}>
                <div className={cn('h-10 animate-pulse rounded-2xl bg-secondary', i % 3 === 0 ? 'w-48' : 'w-32')} />
              </div>
            ))}
          </div>
        ) : grouped.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
              <MessageCircle className="h-7 w-7 text-primary" />
            </div>
            <p className="text-sm font-bold">Aucun message</p>
            <p className="text-xs text-muted-foreground max-w-[220px]">Envoie le premier message à {other?.pseudo || 'ton ami'} !</p>
          </div>
        ) : (
          grouped.map((m, idx) => {
            const mine = m.sender_id === user?.id;
            const prev = grouped[idx - 1];
            const showTime = !prev || new Date(m.created_at).getTime() - new Date(prev.created_at).getTime() > 10 * 60 * 1000;
            const isLastMine = mine && !grouped.slice(idx + 1).some((n) => n.sender_id === user?.id);
            return (
              <div key={m.id}>
                {showTime && (
                  <p className="my-3 text-center text-[10px] font-medium text-muted-foreground">{fmtTime(m.created_at)}</p>
                )}
                <div className={cn('group flex items-center gap-1.5', mine ? 'justify-end' : 'justify-start')}>
                  {mine && (
                    <button
                      onClick={() => removeMessage(m.id)}
                      aria-label="Supprimer"
                      className="rounded-lg p-1 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                  {m.type === 'song_share' ? (
                    <div className={cn('max-w-[80%]', mine && 'items-end')}>
                      {m.text && (
                        <div className={cn(
                          'mb-1 rounded-2xl px-3.5 py-2 text-sm',
                          mine ? 'bg-gradient-primary text-primary-foreground rounded-br-md ml-auto w-fit' : 'bg-card border border-border/50 rounded-bl-md w-fit'
                        )}>{m.text}</div>
                      )}
                      <ChatSongCard message={m} mine={mine} />
                    </div>
                  ) : (
                    <div className={cn(
                      'max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm break-words',
                      mine
                        ? 'bg-gradient-primary text-primary-foreground rounded-br-md shadow-elegant-sm'
                        : 'bg-card border border-border/50 rounded-bl-md'
                    )}>
                      {m.type === 'voice' ? <VoiceBubble message={m} mine={mine} /> : m.text}
                    </div>
                  )}
                </div>
                {isLastMine && (
                  <p className="mt-1 flex items-center justify-end gap-1 text-[10px] text-muted-foreground">
                    {m.is_read ? (
                      <><CheckCheck className="h-3 w-3 text-primary" />Vu</>
                    ) : (
                      <><Check className="h-3 w-3" />Envoyé</>
                    )}
                  </p>
                )}
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* ── Barre d'envoi ── */}
      <div className="fixed inset-x-0 bottom-0 border-t border-border/40 bg-background/90 px-4 pb-[max(env(safe-area-inset-bottom),12px)] pt-3 backdrop-blur-xl">
        {recording ? (
          <div className="flex items-center gap-3">
            <button
              onClick={() => stopRecording(true)}
              aria-label="Annuler"
              className="flex h-11 w-11 items-center justify-center rounded-full bg-secondary text-muted-foreground active:scale-95 transition-transform"
            >
              <Trash2 className="h-5 w-5" />
            </button>
            <div className="flex flex-1 items-center gap-2 rounded-full bg-red-500/10 border border-red-500/30 px-4 py-2.5">
              <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-500" />
              <span className="text-sm font-semibold text-red-400">Enregistrement… {fmtDuration(recordSeconds)}</span>
            </div>
            <button
              onClick={() => stopRecording(false)}
              aria-label="Envoyer le vocal"
              className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-primary text-primary-foreground shadow-elegant-sm active:scale-95 transition-transform"
            >
              <Send className="h-5 w-5" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAttachSong(true)}
              aria-label="Joindre une musique"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-secondary text-foreground active:scale-95 transition-transform hover:bg-secondary/80"
            >
              <Music2 className="h-5 w-5" />
            </button>
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder="Envoyer un message..."
              className="h-11 flex-1 rounded-full border border-border/50 bg-card/60 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
            {text.trim() ? (
              <button
                onClick={send}
                disabled={sending}
                aria-label="Envoyer"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-primary text-primary-foreground shadow-elegant-sm active:scale-95 transition-transform disabled:opacity-60"
              >
                <Send className="h-5 w-5" />
              </button>
            ) : (
              <button
                onClick={startRecording}
                aria-label="Message vocal"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-secondary text-foreground active:scale-95 transition-transform hover:bg-secondary/80"
              >
                <Mic className="h-5 w-5" />
              </button>
            )}
          </div>
        )}
      </div>

      {userId && (
        <AttachSongSheet
          open={showAttachSong}
          onOpenChange={setShowAttachSong}
          recipientId={userId}
          onSent={appendLocal}
        />
      )}
    </div>
  );
}
