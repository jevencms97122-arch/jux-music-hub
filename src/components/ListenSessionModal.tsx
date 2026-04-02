import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Radio, Users, Copy, Play, Pause } from 'lucide-react';
import { pb, getSongCoverUrl, getUserAvatarUrl } from '@/lib/pocketbase';
import { useAuth } from '@/contexts/AuthContext';
import { usePlayer, usePlayerProgress } from '@/contexts/PlayerContext';
import { toast } from 'sonner';
import type { ListenSession, Song } from '@/types/music';

interface ListenSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ListenSessionModal({ isOpen, onClose }: ListenSessionModalProps) {
  const { user } = useAuth();
  const { currentSong, isPlaying, togglePlay, pause, resume, seek, playCurrentSongOnly } = usePlayer();
  const { progress } = usePlayerProgress();
  const [session, setSession] = useState<ListenSession | null>(null);
  const [participants, setParticipants] = useState<any[]>([]);
  const [joinCode, setJoinCode] = useState('');
  const syncIntervalRef = useRef<NodeJS.Timeout>();
  const isPlayingRef = useRef(isPlaying);
  const currentSongRef = useRef<Song | null>(null);
  const progressRef = useRef(0);
  
  // Keep ref in sync with state
  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    currentSongRef.current = currentSong;
  }, [currentSong]);

  useEffect(() => {
    progressRef.current = progress;
  }, [progress]);

  useEffect(() => {
    if (!isOpen) return;
    return () => {
      clearInterval(syncIntervalRef.current);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!session || !user || session.host !== user.id) return;
    if (!currentSong) return;
    if (session.song === currentSong.id) return;

    // Host changed song, push to session so participants switch too
    pb.collection('listen_sessions').update(session.id, {
      song: currentSong.id,
      currentTime: progress,
      isPlaying,
      isActive: true,
    }).catch(console.error);
  }, [session, currentSong, progress, isPlaying, user]);

  const createSession = async () => {
    if (!user || !currentSong) return;
    try {
      const newSession = await pb.collection('listen_sessions').create({
        host: user.id,
        song: currentSong.id,
        currentTime: progress,
        isPlaying,
        participants: [user.id],
        isActive: true,
      });
      setSession(newSession as unknown as ListenSession);
      loadParticipants((newSession as any).participants || []);
      toast.success('Session créée !');

      // Start syncing (host publishes current song, time and play state)
      syncIntervalRef.current = setInterval(async () => {
        try {
          await pb.collection('listen_sessions').update(newSession.id, {
            song: currentSong.id,
            currentTime: progress,
            isPlaying,
            isActive: true,
          });
        } catch (err) {
          console.error('Listen session sync failed:', err);
        }
      }, 1000);

      // Subscribe to changes
      pb.collection('listen_sessions').subscribe(newSession.id, (e) => {
        if (e.action === 'update') {
          setSession(e.record as unknown as ListenSession);
          loadParticipants(e.record.participants || []);
        }
      }).catch(console.error);
    } catch (error) {
      console.error('Error creating session:', error);
      toast.error('Erreur lors de la création');
    }
  };

  const joinSession = async () => {
    if (!user || !joinCode.trim()) return;
    try {
      const res = await pb.collection('listen_sessions').getOne(joinCode.trim(), {
        expand: 'song,host',
      });
      if (!(res.isActive ?? res.active)) {
        toast.error('Session terminée');
        return;
      }

      // Add self to participants
      const currentParticipants = res.participants || [];
      let sessionToUse = res as unknown as ListenSession;

      if (!currentParticipants.includes(user.id)) {
        const updated = await pb.collection('listen_sessions').update(res.id, {
          'participants+': user.id,
        });
        sessionToUse = updated as unknown as ListenSession;
      }

      setSession(sessionToUse);
      loadParticipants(sessionToUse.participants || []);
      
      // Load the song first before syncing position
      if (res.expand?.song) {
        await playCurrentSongOnly(res.expand.song);
      }
      
      // Sync playback position
      seek(res.currentTime || 0);
      
      // Sync play state using ref to get current value
      if (res.isPlaying !== isPlayingRef.current) {
        togglePlay();
      }
      
      toast.success('Rejoint !');

      // Subscribe for sync
      pb.collection('listen_sessions').subscribe(res.id, async (e) => {
        if (e.action !== 'update') return;

        const updated = e.record as unknown as ListenSession;
        setSession(updated);
        loadParticipants(updated.participants || []);

        // Handle song change
        if (updated.song && updated.song !== currentSongRef.current?.id) {
          try {
            const song = await pb.collection('songs').getOne(updated.song, { expand: 'uploadedBy' }) as unknown as any;
            if (song) {
              await playCurrentSongOnly(song);
            }
          } catch (err) {
            console.error('Failed loading updated session song:', err);
          }
        }

        // Sync playback position with tolerance to avoid jitter
        const hostTime = updated.currentTime ?? 0;
        if (Math.abs(hostTime - progressRef.current) > 0.7) {
          seek(hostTime);
        }

        // Sync play state
        if (updated.isPlaying && !isPlayingRef.current) {
          resume();
        } else if (!updated.isPlaying && isPlayingRef.current) {
          pause();
        }
      }).catch(console.error);
    } catch (error) {
      toast.error('Session introuvable');
    }
  };

  const loadParticipants = async (ids: string[]) => {
    try {
      const users = await Promise.all(
        ids.map(id => pb.collection('users').getOne(id).catch(() => null))
      );
      setParticipants(users.filter(Boolean));
    } catch { }
  };

  const endSession = async () => {
    if (!session) return;
    try {
      await pb.collection('listen_sessions').update(session.id, { isActive: false });
      pb.collection('listen_sessions').unsubscribe(session.id).catch(() => {});
      clearInterval(syncIntervalRef.current);
      setSession(null);
      toast.success('Session terminée');
    } catch { }
  };

  const copySessionId = () => {
    if (session) {
      navigator.clipboard.writeText(session.id);
      toast.success('Code copié !');
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 50 }}
        className="fixed inset-x-0 bottom-0 z-[60] bg-card border-t border-border rounded-t-2xl max-h-[70vh] overflow-y-auto safe-bottom"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Radio className="h-5 w-5 text-primary" />
            <h2 className="font-semibold text-foreground">Écoute synchrone</h2>
          </div>
          <button onClick={onClose} className="p-2">
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        <div className="p-4">
          {!session ? (
            <div className="space-y-4">
              <button
                onClick={createSession}
                disabled={!currentSong}
                className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-medium disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Radio className="h-4 w-4" />
                Créer une session
              </button>

              <div className="flex items-center gap-2">
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs text-muted-foreground">ou</span>
                <div className="flex-1 h-px bg-border" />
              </div>

              <div className="flex gap-2">
                <input
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value)}
                  placeholder="Code de session"
                  className="flex-1 bg-secondary border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground"
                />
                <button
                  onClick={joinSession}
                  className="px-4 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium"
                >
                  Rejoindre
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Session info */}
              <div className="flex items-center gap-3 p-3 bg-secondary/50 rounded-xl">
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground">Code de session</p>
                  <p className="text-sm font-mono text-foreground truncate">{session.id}</p>
                </div>
                <button onClick={copySessionId} className="p-2 text-primary">
                  <Copy className="h-4 w-4" />
                </button>
              </div>

              {/* Participants */}
              <div>
                <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                  <Users className="h-3.5 w-3.5" />
                  {participants.length} participant(s)
                </p>
                <div className="flex -space-x-2">
                  {participants.map((p: any) => (
                    <div key={p.id} className="h-8 w-8 rounded-full overflow-hidden border-2 border-card">
                      {p.avatar ? (
                        <img src={getUserAvatarUrl(p)} className="h-full w-full object-cover" />
                      ) : (
                        <div className="h-full w-full bg-secondary flex items-center justify-center text-xs text-muted-foreground">
                          {p.pseudo?.[0]}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <button
                onClick={endSession}
                className="w-full py-2.5 bg-destructive/10 text-destructive rounded-xl text-sm font-medium"
              >
                Terminer la session
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
