import { useEffect, useMemo, useRef, useState } from 'react';
import { pb } from '@/lib/pocketbase';
import { useAuth } from '@/contexts/AuthContext';
import { avatarUrl, songAudioUrl, songCoverUrl } from '@/lib/storage';
import { sendSongShareMessage } from '@/hooks/useChat';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Check, Music2, Play, Pause, Send, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Profile, Song } from '@/types/music';

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

function recordToProfile(r: any): Profile {
  return {
    id: r.id, user_id: r.user_id, pseudo: r.pseudo,
    first_name: r.first_name, last_name: r.last_name,
    avatar: r.avatar ?? null, avatar_url: r.avatar_url ?? null, bio: r.bio,
    profile_completed: r.profile_completed, collectionName: r.collectionName, collectionId: r.collectionId,
    created_at: r.created, updated_at: r.updated,
  } as Profile;
}

interface ShareToFriendSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  song: Song | null;
}

/**
 * Sheet "Envoyer à un ami" : sélection multiple d'amis +
 * personnalisation du début/fin de l'extrait avant envoi.
 */
export default function ShareToFriendSheet({ open, onOpenChange, song }: ShareToFriendSheetProps) {
  const { user } = useAuth();
  const [friends, setFriends] = useState<Profile[]>([]);
  const [loadingFriends, setLoadingFriends] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  // Clip
  const [songDuration, setSongDuration] = useState(0);
  const [clip, setClip] = useState<[number, number]>([0, 30]);
  const [previewing, setPreviewing] = useState(false);
  const previewRef = useRef<HTMLAudioElement | null>(null);
  const rafRef = useRef(0);
  const [previewProgress, setPreviewProgress] = useState(0);

  // Charger les amis (follows acceptés)
  useEffect(() => {
    if (!open || !user) return;
    setLoadingFriends(true);
    (async () => {
      try {
        const res = await pb.collection('follows').getList(1, 200, {
          filter: `follower_id = "${user.id}" && status = "accepted"`,
          requestKey: null,
        });
        const ids = res.items.map((f: any) => f.following_id as string);
        const profiles: Profile[] = [];
        for (let i = 0; i < ids.length; i += 50) {
          const batch = ids.slice(i, i + 50);
          const filter = batch.map((uid) => `user_id = "${uid}"`).join(' || ');
          try {
            const pr = await pb.collection('profiles').getList(1, 50, { filter, requestKey: null });
            profiles.push(...pr.items.map(recordToProfile));
          } catch {}
        }
        setFriends(profiles);
      } catch {}
      setLoadingFriends(false);
    })();
  }, [open, user]);

  // Durée du morceau (metadata si absente)
  useEffect(() => {
    if (!open || !song) return;
    setSelected(new Set());
    setMessage('');
    setPreviewProgress(0);
    const known = song.duration || 0;
    if (known > 0) {
      setSongDuration(known);
      setClip([0, Math.min(30, known)]);
      return;
    }
    const url = songAudioUrl(song);
    if (!url) return;
    const probe = new Audio();
    probe.preload = 'metadata';
    probe.src = url;
    probe.addEventListener('loadedmetadata', () => {
      const d = Math.floor(probe.duration || 0);
      if (d > 0) { setSongDuration(d); setClip([0, Math.min(30, d)]); }
    });
  }, [open, song]);

  const stopPreview = () => {
    cancelAnimationFrame(rafRef.current);
    previewRef.current?.pause();
    setPreviewing(false);
  };

  useEffect(() => {
    if (!open) { stopPreview(); previewRef.current = null; }
  }, [open]);

  const togglePreview = () => {
    if (!song) return;
    if (previewing) { stopPreview(); return; }
    const url = songAudioUrl(song);
    if (!url) { toast.error('Audio introuvable'); return; }
    if (!previewRef.current) previewRef.current = new Audio(url);
    const audio = previewRef.current;
    const [start, end] = clip;
    audio.currentTime = start;
    audio.play().then(() => {
      setPreviewing(true);
      const tick = () => {
        if (!previewRef.current) return;
        const t = previewRef.current.currentTime;
        setPreviewProgress(Math.min(1, Math.max(0, (t - start) / Math.max(1, end - start))));
        if (t >= end || previewRef.current.ended) { stopPreview(); setPreviewProgress(0); return; }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    }).catch(() => toast.error('Lecture impossible'));
  };

  const toggleFriend = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const clipValid = clip[1] > clip[0];

  const send = async () => {
    if (!user || !song || selected.size === 0 || !clipValid || sending) return;
    setSending(true);
    stopPreview();
    try {
      await Promise.all(
        [...selected].map((friendId) =>
          sendSongShareMessage(user.id, friendId, song.id, clip[0], clip[1], message.trim() || undefined)
        )
      );
      toast.success(`Envoyé à ${selected.size} ami${selected.size > 1 ? 's' : ''} !`);
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || 'Erreur lors de l\'envoi');
    }
    setSending(false);
  };

  const cover = useMemo(() => (song ? songCoverUrl(song) : ''), [song]);

  if (!song) return null;

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) stopPreview(); onOpenChange(o); }}>
      <SheetContent side="bottom" className="rounded-t-3xl pb-safe max-h-[90vh] overflow-y-auto">
        <SheetHeader className="mb-4">
          <SheetTitle className="flex items-center gap-2">
            <Send className="h-4 w-4 text-primary" />
            Envoyer à un ami
          </SheetTitle>
        </SheetHeader>

        {/* Titre partagé */}
        <div className="mb-4 flex items-center gap-3 rounded-2xl border border-border/50 bg-card/60 p-3">
          <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl">
            {cover !== '/placeholder.svg'
              ? <img src={cover} alt="" className="h-full w-full object-cover" />
              : <div className="flex h-full w-full items-center justify-center bg-gradient-primary"><Music2 className="h-5 w-5 text-white" /></div>}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold">{song.title}</p>
            <p className="truncate text-xs text-muted-foreground">{song.author}</p>
          </div>
        </div>

        {/* Personnalisation de l'extrait */}
        <div className="mb-5 rounded-2xl border border-border/50 bg-card/40 p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-bold">Personnaliser l'extrait</p>
            <button
              onClick={togglePreview}
              disabled={!clipValid}
              className="flex items-center gap-1.5 rounded-full bg-primary/15 px-3 py-1.5 text-xs font-semibold text-primary active:scale-95 transition-transform disabled:opacity-50"
            >
              {previewing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              {previewing ? 'Stop' : 'Aperçu'}
            </button>
          </div>
          {songDuration > 0 ? (
            <>
              <Slider
                value={clip}
                min={0}
                max={songDuration}
                step={1}
                minStepsBetweenThumbs={3}
                onValueChange={(v) => { stopPreview(); setPreviewProgress(0); setClip([v[0], v[1]] as [number, number]); }}
                className="my-2"
              />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Début : <span className="font-semibold text-foreground">{fmt(clip[0])}</span></span>
                <span className="font-medium text-primary">{fmt(Math.max(0, clip[1] - clip[0]))} d'extrait</span>
                <span>Fin : <span className="font-semibold text-foreground">{fmt(clip[1])}</span></span>
              </div>
              {previewing && (
                <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-secondary">
                  <div className="h-full bg-primary transition-[width] duration-100" style={{ width: `${previewProgress * 100}%` }} />
                </div>
              )}
            </>
          ) : (
            <p className="text-xs text-muted-foreground">Chargement de la durée...</p>
          )}
        </div>

        {/* Message optionnel */}
        <Input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Ajouter un message (optionnel)..."
          className="mb-4 h-11 rounded-xl border-border/50 bg-card/60 text-sm"
        />

        {/* Sélection des amis */}
        <p className="mb-2 flex items-center gap-2 text-sm font-bold">
          <Users className="h-4 w-4 text-primary" />
          Choisir les destinataires
          {selected.size > 0 && (
            <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">{selected.size}</span>
          )}
        </p>
        {loadingFriends ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-14 animate-pulse rounded-2xl bg-secondary/60" />
            ))}
          </div>
        ) : friends.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border/60 bg-card/30 px-4 py-6 text-center text-xs text-muted-foreground">
            Tu ne suis encore personne. Ajoute des amis dans Social pour partager des titres.
          </p>
        ) : (
          <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
            {friends.map((f) => {
              const isSelected = selected.has(f.user_id);
              return (
                <button
                  key={f.user_id}
                  onClick={() => toggleFriend(f.user_id)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition-colors',
                    isSelected ? 'border-primary/50 bg-primary/10' : 'border-border/40 bg-card/50 hover:bg-card'
                  )}
                >
                  <Avatar className="h-10 w-10 shrink-0">
                    <AvatarImage src={avatarUrl(f as any)} />
                    <AvatarFallback>{f.pseudo?.[0] || '?'}</AvatarFallback>
                  </Avatar>
                  <p className="min-w-0 flex-1 truncate text-sm font-semibold">{f.pseudo || 'Anonyme'}</p>
                  <span className={cn(
                    'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
                    isSelected ? 'border-primary bg-primary text-primary-foreground' : 'border-border'
                  )}>
                    {isSelected && <Check className="h-3.5 w-3.5" />}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        <Button
          onClick={send}
          disabled={selected.size === 0 || !clipValid || sending}
          className="mt-4 w-full rounded-xl bg-gradient-primary py-6 text-sm font-bold shadow-elegant-sm"
        >
          <Send className="mr-2 h-4 w-4" />
          {sending ? 'Envoi...' : selected.size > 1 ? `Envoyer à ${selected.size} amis` : 'Envoyer'}
        </Button>
      </SheetContent>
    </Sheet>
  );
}
