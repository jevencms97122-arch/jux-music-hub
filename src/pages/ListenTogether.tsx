import { useEffect, useState, useCallback } from 'react';
import { pb } from '@/lib/pocketbase';
import { useAuth } from '@/contexts/AuthContext';
import { useSeo } from '@/lib/useSeo';
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

function generateSessionCode() { return String(Math.floor(10000000 + Math.random() * 90000000)); }

const pbGetFirst = async (collection: string, filter: string) => {
  try { const r = await pb.collection(collection).getList(1, 1, { filter, requestKey: null }); return r.items[0] || null; } catch { return null; }
};

const fetchProfiles = async (ids: string[]) => {
  if (!ids.length) return [] as Profile[];
  const result: Profile[] = [];
  for (const uid of ids) {
    try {
      const r = await pbGetFirst('profiles', `user_id = "${uid}"`);
      if (r) result.push({ id: r.id, user_id: r.user_id, pseudo: r.pseudo, first_name: r.first_name, last_name: r.last_name, avatar_url: r.avatar ? 'avatar' : null, bio: r.bio, profile_completed: r.profile_completed, created_at: r.created || r.created, updated_at: r.updated || r.updated } as Profile);
    } catch {}
  }
  return result;
};

export default function ListenTogether() {
  useSeo({ title: 'Écoute ensemble — Nexora Music', description: 'Écoute de la musique en synchronisé avec tes amis sur Nexora Music.', path: '/listen-together' });
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, profile } = useAuth();
  const { activeSession, isSessionHost, setActiveSession, refreshSession, stopAudio, currentSong } = usePlayer();
  const [host, setHost] = useState<Profile | null>(null);
  const [hostSong, setHostSong] = useState<Song | null>(null);
  const [participantsProfiles, setParticipantsProfiles] = useState<Profile[]>([]);
  const [joinCode, setJoinCode] = useState('');
  const [following, setFollowing] = useState<Profile[]>([]);
  const [pendingInvites, setPendingInvites] = useState<string[]>([]);

  const loadHostInfo = useCallback(async (s: ListenSessionRow) => {
    const p = await pbGetFirst('profiles', `user_id = "${s.host_id}"`);
    setHost(p ? { id: p.id, user_id: p.user_id, pseudo: p.pseudo, first_name: p.first_name, last_name: p.last_name, avatar_url: p.avatar ? 'avatar' : null, bio: p.bio, profile_completed: p.profile_completed, created_at: p.created || p.created, updated_at: p.updated || p.updated } as Profile : null);
    if (s.song_id) {
      const songRec = await pbGetFirst('songs', `id = "${s.song_id}"`);
      setHostSong(songRec ? { id: songRec.id, title: songRec.title, author: songRec.author, audio_url: songRec.audio_url, cover_url: songRec.cover_url, video_url: songRec.video_url, genre: songRec.genre, uploaded_by: songRec.uploaded_by, play_count: songRec.play_count, likes_count: songRec.likes_count, created_at: songRec.created || songRec.created, updated_at: songRec.updated || songRec.updated } as Song : null);
    } else setHostSong(null);
    if (s.participants?.length) setParticipantsProfiles(await fetchProfiles(s.participants));
    else setParticipantsProfiles([]);
  }, []);

  useEffect(() => { if (activeSession) loadHostInfo(activeSession); }, [activeSession, loadHostInfo]);

  const doJoin = useCallback(async (codeRaw: string) => {
    if (!user) { toast.error('Connecte-toi d\'abord'); return; }
    const code = codeRaw.trim();
    if (!code) return;
    try {
      const s = await pbGetFirst('listen_sessions', `code = "${code}" && is_active = true`);
      if (!s) { toast.error('Session introuvable'); return; }
      const participants = s.participants as string[] || [];
      if (participants.includes(user.id)) { toast.info('Tu es déjà dans cette session'); return; }
      await pb.collection('listen_sessions').update(s.id, {
        participants: [...participants, user.id],
      });
      setActiveSession({ id: s.id, host_id: s.host_id, song_id: s.song_id, position: s.position ?? 0, tempo: s.tempo || 1, is_playing: s.is_playing, participants: [...participants, user.id], is_active: true, code: s.code } as ListenSessionRow);
      refreshSession();
      navigate('/listen-together');
    } catch { toast.error('Code invalide'); }
  }, [user, setActiveSession, refreshSession, navigate]);

  const createSession = async () => {
    if (!user) return;
    try {
      const code = generateSessionCode();
      const newS = await pb.collection('listen_sessions').create({
        host_id: user.id, code, is_active: true, is_playing: false, position: 0, tempo: 1,
        participants: [user.id],
      });
      setActiveSession({ id: newS.id, host_id: user.id, song_id: null, position: 0, tempo: 1, is_playing: false, participants: [user.id], is_active: true, code } as ListenSessionRow);
      refreshSession();
      toast.success('Session créée ! Code : ' + code);
    } catch (e: any) { toast.error(e.message); }
  };

  const endSession = async () => {
    if (!activeSession || !user || !isSessionHost) return;
    try { await pb.collection('listen_sessions').update(activeSession.id, { is_active: false }); stopAudio(); setActiveSession(null); navigate('/home'); } catch {}
  };

  const leaveSession = async () => {
    if (!activeSession || !user) return;
    try {
      const participants = (activeSession.participants || []).filter((p: string) => p !== user.id);
      await pb.collection('listen_sessions').update(activeSession.id, { participants });
      setActiveSession(null);
      stopAudio();
      navigate('/home');
    } catch {}
  };

  const inviteFriend = async (friendId: string) => {
    if (!user) return;
    try {
      const senderName = profile?.pseudo || user.email;
      await pb.collection('notifications').create({ recipient_id: friendId, type: 'session_invite', title: `${senderName} t'invite à écouter ensemble`, body: `Code : ${activeSession?.code}`, data: { code: activeSession?.code } });
      toast.success('Invitation envoyée');
    } catch {}
  };

  const codeParam = searchParams.get('code');
  useEffect(() => { if (codeParam) { doJoin(codeParam); navigate('/listen-together', { replace: true }); } }, [codeParam]);
  useEffect(() => { if (user) fetchProfiles(([] as any)).then(() => {}); loadHostInfo; }, [user]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const outF = await pb.collection('follows').getList(1, 200, { filter: `follower_id = "${user.id}" && status = "accepted"`, requestKey: null });
      const ids = outF.items.map((f: any) => f.following_id);
      setFollowing(await fetchProfiles(ids));
    })();
  }, [user]);

  return (
    <div className="relative min-h-screen pb-40 p-4">
      <header className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}><ArrowLeft className="h-5 w-5" /></Button>
        <h1 className="text-xl font-bold">Écouter ensemble</h1>
      </header>

      {activeSession ? (
        <div className="space-y-4">
          <div className="rounded-xl bg-gradient-primary p-4 text-primary-foreground">
            <p className="text-sm opacity-80">Session active</p>
            <p className="text-2xl font-bold">Code: {activeSession.code}</p>
          </div>
          <div className="rounded-xl bg-card p-4">
            <p className="font-semibold mb-2">Hôte: {host?.pseudo || 'Chargement...'}</p>
            {hostSong && <p className="text-sm text-muted-foreground">En cours: {hostSong.title}</p>}
          </div>
          <div className="rounded-xl bg-card p-4">
            <p className="font-semibold mb-2">Participants ({participantsProfiles.length})</p>
            <div className="flex flex-wrap gap-2">
              {participantsProfiles.map((p) => (
                <div key={p.user_id} className="flex items-center gap-2 rounded-full bg-secondary px-3 py-1">
                  <Avatar className="h-6 w-6"><AvatarImage src={p.avatar_url || ''} /><AvatarFallback>{p.pseudo?.[0] || '?'}</AvatarFallback></Avatar>
                  <span className="text-xs">{p.pseudo}</span>
                </div>
              ))}
            </div>
          </div>
          {following.length > 0 && isSessionHost && (
            <div className="rounded-xl bg-card p-4">
              <p className="font-semibold mb-2">Inviter des amis</p>
              <div className="flex flex-wrap gap-2">
                {following.filter((f) => !activeSession.participants?.includes(f.user_id)).map((f) => (
                  <Button key={f.user_id} size="sm" variant="outline" onClick={() => inviteFriend(f.user_id)}>
                    <UserPlus className="h-3 w-3 mr-1" />{f.pseudo}
                  </Button>
                ))}
              </div>
            </div>
          )}
          {isSessionHost ? (
            <Button variant="destructive" className="w-full" onClick={endSession}><LogOut className="h-4 w-4 mr-2" />Terminer la session</Button>
          ) : (
            <Button variant="destructive" className="w-full" onClick={leaveSession}><LogOut className="h-4 w-4 mr-2" />Quitter la session</Button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <Button className="w-full" onClick={createSession}><Radio className="h-4 w-4 mr-2" />Créer une session</Button>
          <div className="relative"><div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div><div className="relative flex justify-center text-xs uppercase"><span className="bg-background px-2 text-muted-foreground">ou</span></div></div>
          <div className="flex gap-2">
            <Input placeholder="Code à 8 chiffres" value={joinCode} onChange={(e) => setJoinCode(e.target.value)} maxLength={8} className="text-center text-lg tracking-widest" />
            <Button onClick={() => doJoin(joinCode)}>Rejoindre</Button>
          </div>
        </div>
      )}
    </div>
  );
}