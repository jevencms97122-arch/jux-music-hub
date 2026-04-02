import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Radio, Users, Copy, Play, Pause } from 'lucide-react';
import { pb, getSongCoverUrl, getUserAvatarUrl } from '@/lib/pocketbase';
import { useAuth } from '@/contexts/AuthContext';
import { usePlayer, usePlayerProgress } from '@/contexts/PlayerContext';
import { toast } from 'sonner';
import type { ListenSession } from '@/types/music';

interface ListenSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ListenSessionModal({ isOpen, onClose }: ListenSessionModalProps) {
  const { user } = useAuth();
  const { currentSong, isPlaying, togglePlay, seek } = usePlayer();
  const { progress } = usePlayerProgress();
  const [session, setSession] = useState<ListenSession | null>(null);
  const [participants, setParticipants] = useState<any[]>([]);
  const [joinCode, setJoinCode] = useState('');
  const syncIntervalRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (!isOpen) return;
    return () => {
      clearInterval(syncIntervalRef.current);
    };
  }, [isOpen]);

  const createSession = async () => {
    if (!user || !currentSong) return;
    try {
      const newSession = await pb.collection('listen_sessions').create({
        host: user.id,
        song: currentSong.id,
        currentTime: progress,
        isPlaying,
        participants: [user.id],
        active: true,
      });
      setSession(newSession as unknown as ListenSession);
      toast.success('Session créée !');

      // Start syncing
      syncIntervalRef.current = setInterval(async () => {
        try {
          await pb.collection('listen_sessions').update(newSession.id, {
            currentTime: progress,
            isPlaying,
          });
        } catch { }
      }, 2000);

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
      if (!res.active) {
        toast.error('Session terminée');
        return;
      }

      // Add self to participants
      const currentParticipants = res.participants || [];
      if (!currentParticipants.includes(user.id)) {
        await pb.collection('listen_sessions').update(res.id, {
          'participants+': user.id,
        });
      }

      setSession(res as unknown as ListenSession);
      seek(res.currentTime || 0);
      toast.success('Rejoint !');

      // Subscribe for sync
      pb.collection('listen_sessions').subscribe(res.id, (e) => {
        if (e.action === 'update') {
          const updated = e.record as unknown as ListenSession;
          setSession(updated);
          // Sync playback
          seek(updated.currentTime);
          loadParticipants(updated.participants || []);
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
      await pb.collection('listen_sessions').update(session.id, { active: false });
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
