import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { usePlayer } from '@/contexts/PlayerContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ArrowLeft, Users, Plus, Copy, LogOut, Radio, UserPlus, Send, Play, Pause, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { avatarUrl, songCoverUrl, songAudioUrl } from '@/lib/storage';
import type { Profile, Song } from '@/types/music';

interface SessionRow {
  id: string;
  code: string | null;
  host_id: string;
  song_id: string | null;
  is_playing: boolean;
  current_time_seconds: number;
  participants: string[];
  ready_participants: string[];
  is_active: boolean;
}

function generate4DigitCode() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

export default function ListenTogether() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { authUser } = useAuth();
  const { currentSong: globalSong } = usePlayer();

  const [activeSession, setActiveSession] = useState<SessionRow | null>(null);
  const [host, setHost] = useState<Profile | null>(null);
  const [hostSong, setHostSong] = useState<Song | null>(null);
  const [participantsProfiles, setParticipantsProfiles] = useState<Profile[]>([]);
  const [joinCode, setJoinCode] = useState('');
  const [following, setFollowing] = useState<Profile[]>([]);
  const [pendingInvites, setPendingInvites] = useState<string[]>([]); // user_ids invités
  const [audioReady, setAudioReady] = useState(false);
  const [isPlayingLocal, setIsPlayingLocal] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const sessionRef = useRef<SessionRow | null>(null);
  useEffect(() => { sessionRef.current = activeSession; }, [activeSession]);

  const isHost = !!(activeSession && authUser && activeSession.host_id === authUser.id);

  // === Audio isolé pour la session synchro ===
  useEffect(() => {
    const a = new Audio();
    a.preload = 'auto';
    a.crossOrigin = 'anonymous';
    audioRef.current = a;
    const onPlay = () => setIsPlayingLocal(true);
    const onPause = () => setIsPlayingLocal(false);
    a.addEventListener('play', onPlay);
    a.addEventListener('pause', onPause);
    return () => {
      a.pause();
      a.removeEventListener('play', onPlay);
      a.removeEventListener('pause', onPause);
      audioRef.current = null;
    };
  }, []);

  const loadHostInfo = useCallback(async (s: SessionRow) => {
    const { data: p } = await supabase.from('profiles').select('*').eq('user_id', s.host_id).maybeSingle();
    setHost(p as Profile | null);
    if (s.song_id) {
      const { data: song } = await supabase.from('songs').select('*').eq('id', s.song_id).maybeSingle();
      setHostSong(song as Song | null);
    } else setHostSong(null);
    if (s.participants?.length) {
      const { data: profs } = await supabase.from('profiles').select('*').in('user_id', s.participants);
      setParticipantsProfiles((profs ?? []) as Profile[]);
    } else setParticipantsProfiles([]);
  }, []);

  // Charger session existante
  useEffect(() => {
    if (!authUser) return;
    (async () => {
      const { data: hosted } = await supabase
        .from('listen_sessions').select('*')
        .eq('host_id', authUser.id).eq('is_active', true).maybeSingle();
      if (hosted) { setActiveSession(hosted as SessionRow); loadHostInfo(hosted as SessionRow); return; }
      const { data: joined } = await supabase
        .from('listen_sessions').select('*')
        .contains('participants', [authUser.id]).eq('is_active', true).limit(1);
      if (joined && joined[0]) { setActiveSession(joined[0] as SessionRow); loadHostInfo(joined[0] as SessionRow); }
    })();
  }, [authUser, loadHostInfo]);

  // Auto-join via ?code=
  useEffect(() => {
    const code = searchParams.get('code');
    if (code && !activeSession) {
      setJoinCode(code);
      setTimeout(() => doJoin(code), 200);
      setSearchParams({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, activeSession]);

  // Marquer participant comme prêt (audio chargé) côté DB
  const markReady = useCallback(async (ready: boolean) => {
    const s = sessionRef.current;
    if (!s || !authUser) return;
    const cur = s.ready_participants ?? [];
    let next = cur;
    if (ready && !cur.includes(authUser.id)) next = [...cur, authUser.id];
    if (!ready && cur.includes(authUser.id)) next = cur.filter((u) => u !== authUser.id);
    if (next === cur) return;
    await supabase.from('listen_sessions').update({ ready_participants: next }).eq('id', s.id);
  }, [authUser]);

  // Quand la session change song_id → charger l'audio et marquer ready quand canplay
  useEffect(() => {
    if (!activeSession || !audioRef.current) return;
    const a = audioRef.current;
    setAudioReady(false);
    if (!activeSession.song_id) { a.pause(); a.removeAttribute('src'); markReady(false); return; }

    // Récupérer la song et charger
    supabase.from('songs').select('*').eq('id', activeSession.song_id).maybeSingle().then(({ data }) => {
      if (!data) return;
      const url = songAudioUrl(data as Song);
      if (a.src !== url) {
        a.src = url;
        a.load();
      }
    });

    const onCanPlay = () => {
      setAudioReady(true);
      markReady(true);
    };
    a.addEventListener('canplaythrough', onCanPlay);
    return () => { a.removeEventListener('canplaythrough', onCanPlay); };
  }, [activeSession?.song_id, markReady, activeSession]);

  // Suivre is_playing + sync time
  useEffect(() => {
    if (!activeSession || !audioRef.current || !audioReady) return;
    const a = audioRef.current;
    // resync time
    if (Math.abs(a.currentTime - activeSession.current_time_seconds) > 1.5) {
      a.currentTime = activeSession.current_time_seconds;
    }
    if (activeSession.is_playing) {
      a.play().catch(console.error);
    } else {
      a.pause();
    }
  }, [activeSession?.is_playing, activeSession?.current_time_seconds, audioReady, activeSession]);

  // Realtime sync
  useEffect(() => {
    if (!activeSession) return;
    const channel = supabase
      .channel('listen-session-' + activeSession.id)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'listen_sessions', filter: `id=eq.${activeSession.id}` }, (payload: any) => {
        const updated = payload.new as SessionRow;
        setActiveSession(updated);
        loadHostInfo(updated);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [activeSession?.id, loadHostInfo]);

  // === HOST: démarrer lecture seulement quand TOUT le monde est prêt ===
  const allReady = activeSession
    ? activeSession.participants.every((p) => activeSession.ready_participants?.includes(p))
    : false;

  // HOST sync time toutes les 1s
  useEffect(() => {
    if (!isHost || !activeSession || !audioRef.current) return;
    const interval = setInterval(() => {
      const a = audioRef.current;
      if (!a) return;
      supabase.from('listen_sessions').update({
        current_time_seconds: a.currentTime,
        updated_at: new Date().toISOString(),
      }).eq('id', activeSession.id).then(() => {});
    }, 1000);
    return () => clearInterval(interval);
  }, [isHost, activeSession?.id, activeSession]);

  // === Charger les amis suivis (pour invitations) ===
  useEffect(() => {
    if (!authUser || !activeSession || !isHost) return;
    (async () => {
      const { data: f } = await supabase.from('follows')
        .select('following_id').eq('follower_id', authUser.id).eq('status', 'accepted');
      const ids = (f ?? []).map((x: any) => x.following_id);
      if (ids.length === 0) { setFollowing([]); return; }
      const { data: profs } = await supabase.from('profiles').select('*').in('user_id', ids);
      setFollowing((profs ?? []) as Profile[]);
    })();
  }, [authUser, activeSession?.id, isHost, activeSession]);

  // === Polling 5s pour resynchroniser invitations / participants ===
  useEffect(() => {
    if (!activeSession || !isHost) return;
    const interval = setInterval(async () => {
      // recharger session
      const { data } = await supabase.from('listen_sessions').select('*').eq('id', activeSession.id).maybeSingle();
      if (data) {
        setActiveSession(data as SessionRow);
        loadHostInfo(data as SessionRow);
        // nettoyer pendingInvites: si user a rejoint, on le retire
        setPendingInvites((p) => p.filter((u) => !(data as SessionRow).participants.includes(u)));
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [activeSession?.id, isHost, loadHostInfo, activeSession]);

  // === Actions ===
  const createSession = async () => {
    if (!authUser) return;
    let code = generate4DigitCode();
    // tenter quelques fois en cas de collision
    for (let i = 0; i < 5; i++) {
      const { data: existing } = await supabase.from('listen_sessions')
        .select('id').eq('code', code).eq('is_active', true).maybeSingle();
      if (!existing) break;
      code = generate4DigitCode();
    }
    const { data, error } = await supabase
      .from('listen_sessions')
      .insert({
        host_id: authUser.id,
        participants: [authUser.id],
        ready_participants: [authUser.id],
        is_active: true,
        code,
      })
      .select().single();
    if (error) { toast.error(error.message); return; }
    setActiveSession(data as SessionRow);
    loadHostInfo(data as SessionRow);
    toast.success(`Session créée ! Code : ${code}`);
  };

  const doJoin = async (codeRaw: string) => {
    if (!authUser) return;
    const code = codeRaw.trim();
    if (!/^\d{4}$/.test(code)) { toast.error('Code invalide (4 chiffres)'); return; }
    const { data: s } = await supabase
      .from('listen_sessions').select('*').eq('code', code).eq('is_active', true).maybeSingle();
    if (!s) { toast.error('Session introuvable'); return; }
    const session = s as SessionRow;
    const newParticipants = Array.from(new Set([...(session.participants ?? []), authUser.id]));
    const { error: upErr } = await supabase.from('listen_sessions')
      .update({ participants: newParticipants })
      .eq('id', session.id);
    if (upErr) { toast.error(upErr.message); return; }
    const updated = { ...session, participants: newParticipants };
    setActiveSession(updated);
    loadHostInfo(updated);
    toast.success('Tu as rejoint la session !');
  };

  const joinSession = () => doJoin(joinCode);

  const leaveSession = async () => {
    if (!activeSession || !authUser) return;
    if (audioRef.current) audioRef.current.pause();
    if (isHost) {
      await supabase.from('listen_sessions').update({ is_active: false }).eq('id', activeSession.id);
    } else {
      const newP = (activeSession.participants ?? []).filter((p) => p !== authUser.id);
      const newR = (activeSession.ready_participants ?? []).filter((p) => p !== authUser.id);
      await supabase.from('listen_sessions').update({ participants: newP, ready_participants: newR }).eq('id', activeSession.id);
    }
    setActiveSession(null);
    setHost(null);
    setHostSong(null);
    setParticipantsProfiles([]);
  };

  const copyCode = () => {
    if (!activeSession?.code) return;
    navigator.clipboard.writeText(activeSession.code);
    toast.success('Code copié !');
  };

  const inviteFriend = async (friend: Profile) => {
    if (!activeSession || !authUser) return;
    const { error } = await supabase.from('notifications').insert({
      recipient_id: friend.user_id,
      type: 'session_invite',
      title: 'Invitation à une écoute synchronisée',
      body: `Rejoins la session avec le code ${activeSession.code}`,
      data: { session_id: activeSession.id, code: activeSession.code, from: authUser.id },
    });
    if (error) { toast.error(error.message); return; }
    setPendingInvites((p) => Array.from(new Set([...p, friend.user_id])));
    toast.success(`Invitation envoyée à ${friend.pseudo}`);
  };

  // Host: choisir une chanson à diffuser (utilise la chanson actuellement jouée globalement)
  const broadcastCurrentGlobal = async () => {
    if (!activeSession || !globalSong) { toast.error('Lance une musique d\'abord'); return; }
    await supabase.from('listen_sessions').update({
      song_id: globalSong.id,
      is_playing: false,
      current_time_seconds: 0,
      ready_participants: [], // reset readiness
    }).eq('id', activeSession.id);
    toast.success('Morceau partagé. En attente que tout le monde charge...');
  };

  const hostTogglePlay = async () => {
    if (!activeSession || !isHost) return;
    if (!allReady) { toast.error('En attente des participants...'); return; }
    await supabase.from('listen_sessions').update({
      is_playing: !activeSession.is_playing,
    }).eq('id', activeSession.id);
  };

  return (
    <div className="min-h-screen pb-40">
      <header className="flex items-center gap-2 p-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}><ArrowLeft className="h-5 w-5" /></Button>
        <h1 className="flex-1 text-xl font-bold">Écoute partagée</h1>
      </header>

      <div className="px-4">
        {!activeSession ? (
          <div className="space-y-6">
            <div className="rounded-2xl border border-border bg-card p-6 text-center">
              <Users className="mx-auto mb-3 h-12 w-12 text-primary" />
              <h2 className="text-lg font-bold">Écoute en synchro avec tes amis</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Crée une session, partage le code à 4 chiffres, et écoutez la même musique en temps réel.
              </p>
              <Button onClick={createSession} className="mt-4 w-full">
                <Plus className="mr-2 h-4 w-4" /> Créer une session
              </Button>
            </div>

            <div className="rounded-2xl border border-border bg-card p-6">
              <h3 className="mb-3 text-sm font-semibold">Rejoindre une session</h3>
              <div className="flex gap-2">
                <Input
                  inputMode="numeric"
                  pattern="\d{4}"
                  maxLength={4}
                  placeholder="Code à 4 chiffres"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
                />
                <Button onClick={joinSession}>Rejoindre</Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-2xl bg-gradient-primary p-6 text-primary-foreground shadow-elegant">
              <div className="flex items-center gap-2">
                <Radio className="h-5 w-5 animate-pulse" />
                <span className="text-sm font-semibold uppercase tracking-wider">En direct</span>
              </div>
              <p className="mt-1 text-xs opacity-80">
                {isHost ? 'Tu es l\'hôte de la session' : `Hôte : ${host?.pseudo ?? '...'}`}
              </p>
              {hostSong ? (
                <div className="mt-4 flex items-center gap-3">
                  <img src={songCoverUrl(hostSong)} alt="" className="h-16 w-16 rounded-lg object-cover" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold">{hostSong.title}</p>
                    <p className="truncate text-sm opacity-80">{hostSong.author}</p>
                    {!audioReady && (
                      <p className="mt-1 flex items-center gap-1 text-xs opacity-80">
                        <Loader2 className="h-3 w-3 animate-spin" /> Chargement...
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <p className="mt-4 text-sm opacity-80">
                  {isHost ? 'Choisis un morceau à partager.' : 'En attente du host...'}
                </p>
              )}
            </div>

            {isHost && (
              <div className="space-y-2">
                <Button variant="secondary" className="w-full" onClick={broadcastCurrentGlobal}>
                  <Send className="mr-2 h-4 w-4" /> Partager la musique en cours
                </Button>
                {hostSong && (
                  <Button className="w-full" onClick={hostTogglePlay} disabled={!allReady}>
                    {activeSession.is_playing ? <><Pause className="mr-2 h-4 w-4" /> Pause</> : <><Play className="mr-2 h-4 w-4" /> {allReady ? 'Lecture' : 'En attente...'}</>}
                  </Button>
                )}
              </div>
            )}

            <div className="rounded-2xl border border-border bg-card p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Code</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 truncate rounded bg-secondary px-3 py-2 text-center text-2xl font-bold tracking-[0.5em]">
                  {activeSession.code ?? '----'}
                </code>
                <Button variant="outline" size="icon" onClick={copyCode}><Copy className="h-4 w-4" /></Button>
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Participants ({activeSession.participants?.length ?? 0})
                </p>
                {isHost && (
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button size="sm" variant="outline"><UserPlus className="mr-1 h-4 w-4" /> Inviter</Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader><DialogTitle>Inviter des amis</DialogTitle></DialogHeader>
                      <div className="space-y-2 max-h-80 overflow-y-auto">
                        {following.length === 0 && <p className="text-sm text-muted-foreground">Aucun ami à inviter.</p>}
                        {following.map((f) => {
                          const joined = activeSession.participants.includes(f.user_id);
                          const invited = pendingInvites.includes(f.user_id);
                          return (
                            <div key={f.user_id} className="flex items-center gap-2 rounded-lg border border-border p-2">
                              <Avatar className="h-9 w-9">
                                <AvatarImage src={avatarUrl(f)} />
                                <AvatarFallback>{f.pseudo?.[0]?.toUpperCase() ?? '?'}</AvatarFallback>
                              </Avatar>
                              <span className="flex-1 truncate text-sm">{f.pseudo}</span>
                              {joined ? (
                                <span className="text-xs text-primary">✓ Rejoint</span>
                              ) : (
                                <Button size="sm" variant={invited ? 'secondary' : 'default'} onClick={() => inviteFriend(f)} disabled={invited}>
                                  {invited ? 'Invité' : 'Inviter'}
                                </Button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </DialogContent>
                  </Dialog>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {participantsProfiles.map((p) => {
                  const ready = activeSession.ready_participants?.includes(p.user_id);
                  return (
                    <div key={p.user_id} className="flex flex-col items-center gap-1">
                      <Avatar className={`h-12 w-12 ring-2 ${ready ? 'ring-primary' : 'ring-muted'}`}>
                        <AvatarImage src={avatarUrl(p)} />
                        <AvatarFallback>{p.pseudo?.[0]?.toUpperCase() ?? '?'}</AvatarFallback>
                      </Avatar>
                      <span className="text-[10px] text-muted-foreground">{ready ? 'prêt' : '...'}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <Button variant="destructive" className="w-full" onClick={leaveSession}>
              <LogOut className="mr-2 h-4 w-4" /> {isHost ? 'Terminer la session' : 'Quitter'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
