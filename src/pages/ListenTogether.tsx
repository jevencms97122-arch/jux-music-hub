import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { usePlayer, type ListenSessionRow } from '@/contexts/PlayerContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ArrowLeft, Users, Plus, Copy, LogOut, Radio, UserPlus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { avatarUrl, songCoverUrl } from '@/lib/storage';
import type { Profile, Song } from '@/types/music';

function generate4DigitCode() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

export default function ListenTogether() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { authUser } = useAuth();
  const {
    activeSession, isSessionHost, allParticipantsReady,
    setActiveSession, refreshSession, stopAudio, currentSong,
  } = usePlayer();

  const [host, setHost] = useState<Profile | null>(null);
  const [hostSong, setHostSong] = useState<Song | null>(null);
  const [participantsProfiles, setParticipantsProfiles] = useState<Profile[]>([]);
  const [joinCode, setJoinCode] = useState('');
  const [following, setFollowing] = useState<Profile[]>([]);
  const [pendingInvites, setPendingInvites] = useState<string[]>([]);

  const loadHostInfo = useCallback(async (s: ListenSessionRow) => {
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

  useEffect(() => { if (activeSession) loadHostInfo(activeSession); }, [activeSession, loadHostInfo]);

  const doJoin = useCallback(async (codeRaw: string) => {
    if (!authUser) return;
    const code = codeRaw.trim();
    if (!/^\d{4}$/.test(code)) { toast.error('Code invalide (4 chiffres)'); return; }
    const { data: s } = await supabase
      .from('listen_sessions').select('*').eq('code', code).eq('is_active', true).maybeSingle();
    if (!s) { toast.error('Session introuvable'); return; }
    const session = s as ListenSessionRow;
    stopAudio();
    const newParticipants = Array.from(new Set([...(session.participants ?? []), authUser.id]));
    const { error: upErr } = await supabase.from('listen_sessions')
      .update({ participants: newParticipants })
      .eq('id', session.id);
    if (upErr) { toast.error(upErr.message); return; }
    await refreshSession();
    toast.success('Tu as rejoint la session !');
  }, [authUser, refreshSession, stopAudio]);

  // Auto-join via ?code=
  useEffect(() => {
    const code = searchParams.get('code');
    if (code && !activeSession) {
      setJoinCode(code);
      setTimeout(() => doJoin(code), 200);
      setSearchParams({});
    }
  }, [searchParams, activeSession, doJoin, setSearchParams]);

  // Charger amis (host)
  useEffect(() => {
    if (!authUser || !activeSession || !isSessionHost) return;
    (async () => {
      const { data: f } = await supabase.from('follows')
        .select('following_id').eq('follower_id', authUser.id).eq('status', 'accepted');
      const ids = (f ?? []).map((x: any) => x.following_id);
      if (ids.length === 0) { setFollowing([]); return; }
      const { data: profs } = await supabase.from('profiles').select('*').in('user_id', ids);
      setFollowing((profs ?? []) as Profile[]);
    })();
  }, [authUser, activeSession?.id, isSessionHost, activeSession]);

  // Polling 5s pour invitations
  useEffect(() => {
    if (!activeSession || !isSessionHost) return;
    const interval = setInterval(() => {
      refreshSession();
      setPendingInvites((p) => p.filter((u) => !activeSession.participants.includes(u)));
    }, 5000);
    return () => clearInterval(interval);
  }, [activeSession, isSessionHost, refreshSession]);

  const createSession = async () => {
    if (!authUser) return;
    // Stop la musique en cours
    stopAudio();
    let code = generate4DigitCode();
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
    setActiveSession(data as ListenSessionRow);
    toast.success(`Session créée ! Code : ${code}`);
  };

  const joinSession = () => doJoin(joinCode);

  const leaveSession = async () => {
    if (!activeSession || !authUser) return;
    stopAudio();
    if (isSessionHost) {
      await supabase.from('listen_sessions').update({ is_active: false }).eq('id', activeSession.id);
    } else {
      const newP = (activeSession.participants ?? []).filter((p) => p !== authUser.id);
      const newR = (activeSession.ready_participants ?? []).filter((p) => p !== authUser.id);
      await supabase.from('listen_sessions').update({ participants: newP, ready_participants: newR }).eq('id', activeSession.id);
    }
    setActiveSession(null);
    setHost(null); setHostSong(null); setParticipantsProfiles([]);
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
      body: `${'Rejoins la session avec le code'} ${activeSession.code}`,
      data: { session_id: activeSession.id, code: activeSession.code, from: authUser.id },
    });
    if (error) { toast.error(error.message); return; }
    setPendingInvites((p) => Array.from(new Set([...p, friend.user_id])));
    toast.success(`Invitation envoyée à ${friend.pseudo}`);
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
                Crée une session, partage le code à 4 chiffres, et lance n'importe quelle musique : elle sera diffusée à tout le groupe.
              </p>
              <Button onClick={createSession} className="mt-4 w-full">
                <Plus className="mr-2 h-4 w-4" /> Créer une session
              </Button>
            </div>

            <div className="rounded-2xl border border-border bg-card p-6">
              <h3 className="mb-3 text-sm font-semibold">Rejoindre une session</h3>
              <div className="flex gap-2">
                <Input
                  inputMode="numeric" pattern="\d{4}" maxLength={4}
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
                {isSessionHost ? "Tu es l'hôte. Lance n'importe quelle musique depuis l'app, elle sera diffusée à tout le monde." : `Hôte : ${host?.pseudo ?? '...'}`}
              </p>
              {(hostSong || currentSong) ? (
                <div className="mt-4 flex items-center gap-3">
                  <img src={songCoverUrl(hostSong ?? currentSong!)} alt="" className="h-16 w-16 rounded-lg object-cover" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold">{(hostSong ?? currentSong)?.title}</p>
                    <p className="truncate text-sm opacity-80">{(hostSong ?? currentSong)?.author}</p>
                    {!allParticipantsReady && (
                      <p className="mt-1 flex items-center gap-1 text-xs opacity-80">
                        <Loader2 className="h-3 w-3 animate-spin" /> En attente des participants...
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <p className="mt-4 text-sm opacity-80">
                  {isSessionHost ? "Va sur l'accueil et lance un morceau, il sera diffusé." : "En attente du host..."}
                </p>
              )}
            </div>

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
                {isSessionHost && (
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
              <LogOut className="mr-2 h-4 w-4" /> {isSessionHost ? 'Terminer la session' : 'Quitter'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
