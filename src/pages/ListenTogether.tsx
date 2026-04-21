import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { usePlayer } from '@/contexts/PlayerContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ArrowLeft, Users, Plus, Copy, LogOut, Radio } from 'lucide-react';
import { toast } from 'sonner';
import { avatarUrl, songCoverUrl } from '@/lib/storage';
import type { Profile, Song } from '@/types/music';

interface Session {
  id: string;
  host_id: string;
  song_id: string | null;
  is_playing: boolean;
  current_time_seconds: number;
  participants: string[];
  is_active: boolean;
}

export default function ListenTogether() {
  const navigate = useNavigate();
  const { authUser } = useAuth();
  const { currentSong, isPlaying, currentTime, playSong, togglePlay, seek } = usePlayer();
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [host, setHost] = useState<Profile | null>(null);
  const [hostSong, setHostSong] = useState<Song | null>(null);
  const [joinCode, setJoinCode] = useState('');

  const isHost = activeSession && authUser && activeSession.host_id === authUser.id;

  const loadHostInfo = useCallback(async (s: Session) => {
    const { data: p } = await supabase.from('profiles').select('*').eq('user_id', s.host_id).maybeSingle();
    setHost(p as Profile | null);
    if (s.song_id) {
      const { data: song } = await supabase.from('songs').select('*').eq('id', s.song_id).maybeSingle();
      setHostSong(song as Song | null);
    } else setHostSong(null);
  }, []);

  // Charger session existante de l'utilisateur (host ou participant)
  useEffect(() => {
    if (!authUser) return;
    (async () => {
      const { data: hosted } = await supabase
        .from('listen_sessions').select('*')
        .eq('host_id', authUser.id).eq('is_active', true).maybeSingle();
      if (hosted) { setActiveSession(hosted as Session); loadHostInfo(hosted as Session); return; }
      const { data: joined } = await supabase
        .from('listen_sessions').select('*')
        .contains('participants', [authUser.id]).eq('is_active', true).limit(1);
      if (joined && joined[0]) { setActiveSession(joined[0] as Session); loadHostInfo(joined[0] as Session); }
    })();
  }, [authUser, loadHostInfo]);

  // Realtime sync sur la session
  useEffect(() => {
    if (!activeSession) return;
    const channel = supabase
      .channel('listen-session-' + activeSession.id)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'listen_sessions', filter: `id=eq.${activeSession.id}` }, (payload: any) => {
        const updated = payload.new as Session;
        setActiveSession(updated);
        loadHostInfo(updated);

        // Si participant : suivre l'état du host
        if (authUser && updated.host_id !== authUser.id && updated.song_id) {
          if (!currentSong || currentSong.id !== updated.song_id) {
            supabase.from('songs').select('*').eq('id', updated.song_id).maybeSingle().then(({ data }) => {
              if (data) playSong(data as Song);
            });
          }
          // Resync time si écart > 2s
          if (Math.abs(currentTime - updated.current_time_seconds) > 2) {
            seek(updated.current_time_seconds);
          }
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [activeSession?.id, authUser, currentSong, currentTime, playSong, seek, loadHostInfo]);

  // Si host : sync ses changements vers la session toutes les 3s
  useEffect(() => {
    if (!isHost || !activeSession) return;
    const interval = setInterval(() => {
      supabase.from('listen_sessions').update({
        song_id: currentSong?.id ?? null,
        is_playing: isPlaying,
        current_time_seconds: currentTime,
        updated_at: new Date().toISOString(),
      }).eq('id', activeSession.id).then(() => {});
    }, 3000);
    return () => clearInterval(interval);
  }, [isHost, activeSession, currentSong, isPlaying, currentTime]);

  const createSession = async () => {
    if (!authUser) return;
    const { data, error } = await supabase
      .from('listen_sessions')
      .insert({ host_id: authUser.id, participants: [authUser.id], is_active: true })
      .select().single();
    if (error) { toast.error(error.message); return; }
    setActiveSession(data as Session);
    loadHostInfo(data as Session);
    toast.success('Session créée ! Partage le code aux amis.');
  };

  const joinSession = async () => {
    if (!authUser || !joinCode.trim()) return;
    const { data: s } = await supabase
      .from('listen_sessions').select('*').eq('id', joinCode.trim()).eq('is_active', true).maybeSingle();
    if (!s) { toast.error('Session introuvable'); return; }
    const newParticipants = Array.from(new Set([...(s.participants ?? []), authUser.id]));
    await supabase.from('listen_sessions').update({ participants: newParticipants }).eq('id', s.id);
    setActiveSession({ ...(s as Session), participants: newParticipants });
    loadHostInfo(s as Session);
    toast.success('Tu as rejoint la session !');
  };

  const leaveSession = async () => {
    if (!activeSession || !authUser) return;
    if (isHost) {
      await supabase.from('listen_sessions').update({ is_active: false }).eq('id', activeSession.id);
    } else {
      const newP = (activeSession.participants ?? []).filter((p) => p !== authUser.id);
      await supabase.from('listen_sessions').update({ participants: newP }).eq('id', activeSession.id);
    }
    setActiveSession(null);
    setHost(null);
    setHostSong(null);
  };

  const copyCode = () => {
    if (!activeSession) return;
    navigator.clipboard.writeText(activeSession.id);
    toast.success('Code copié !');
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
                Crée une session, partage le code, et écoutez la même musique en temps réel.
              </p>
              <Button onClick={createSession} className="mt-4 w-full">
                <Plus className="mr-2 h-4 w-4" /> Créer une session
              </Button>
            </div>

            <div className="rounded-2xl border border-border bg-card p-6">
              <h3 className="mb-3 text-sm font-semibold">Rejoindre une session</h3>
              <div className="flex gap-2">
                <Input
                  placeholder="Code de la session"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value)}
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
                  </div>
                </div>
              ) : (
                <p className="mt-4 text-sm opacity-80">
                  {isHost ? 'Lance une musique pour la partager.' : 'En attente du host...'}
                </p>
              )}
            </div>

            <div className="rounded-2xl border border-border bg-card p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Code de la session</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 truncate rounded bg-secondary px-3 py-2 text-xs">{activeSession.id}</code>
                <Button variant="outline" size="icon" onClick={copyCode}><Copy className="h-4 w-4" /></Button>
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card p-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Participants ({activeSession.participants?.length ?? 0})
              </p>
              <div className="flex flex-wrap gap-2">
                {host && (
                  <Avatar className="h-10 w-10 ring-2 ring-primary">
                    <AvatarImage src={avatarUrl(host)} />
                    <AvatarFallback>{host.pseudo?.[0]?.toUpperCase() ?? '?'}</AvatarFallback>
                  </Avatar>
                )}
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
