import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { pb } from '@/lib/pocketbase';
import { useAuth } from '@/contexts/AuthContext';
import { Headphones } from 'lucide-react';

interface LiveFriend {
  pseudo: string;
  avatarUrl: string | null;
  songTitle: string;
  songAuthor: string | null;
  songCoverUrl: string | null;
}

interface Props {
  onComplete: () => void;
  onDismiss: () => void;
}

function isPresenceFresh(lastSeenAt: string): boolean {
  if (!lastSeenAt) return false;
  return Date.now() - new Date(lastSeenAt).getTime() < 45_000;
}

export default function SplashScreen({ onComplete, onDismiss }: Props) {
  const { user } = useAuth();
  const [splashVisible, setSplashVisible] = useState(true);
  const [widgetVisible, setWidgetVisible] = useState(false);
  const [liveFriend, setLiveFriend] = useState<LiveFriend | null>(null);
  const mountedAt = useRef(Date.now());

  // Splash : 2800ms visible → fade 800ms → onComplete à 3600ms
  // onDismiss à 4400ms : laisse le widget finir ses 4s même si le fetch est lent
  useEffect(() => {
    const hide    = setTimeout(() => setSplashVisible(false), 2800);
    const done    = setTimeout(() => onComplete(),            3600);
    const dismiss = setTimeout(() => onDismiss(),             5400);
    return () => {
      clearTimeout(hide);
      clearTimeout(done);
      clearTimeout(dismiss);
    };
  }, [onComplete, onDismiss]);

  // Quand un ami est trouvé : affiche le widget
  // Le widget doit être totalement disparu 4s après le mount (fade 400ms → cache à 3600ms)
  useEffect(() => {
    if (!liveFriend) return;

    const elapsed = Date.now() - mountedAt.current;
    // Si les requêtes ont pris trop de temps, inutile d'afficher le widget
    if (elapsed > 4200) return;

    setWidgetVisible(true);

    // Fade-out à (5000 - 400)ms depuis le mount = 4600ms, ajusté par le temps déjà écoulé
    const hideIn = Math.max(0, 4600 - elapsed);
    const t = setTimeout(() => setWidgetVisible(false), hideIn);
    return () => clearTimeout(t);
  }, [liveFriend]);

  // Fetch présences — même logique que Social.tsx
  useEffect(() => {
    if (!user || !pb.authStore.isValid) {
      setLiveFriend(null);
      return;
    }
    const authId = user.id;

    (async () => {
      try {
        const followsRes = await pb.collection('follows').getList(1, 200, {
          filter: `follower_id = "${authId}" && status = "accepted"`,
          requestKey: null,
        });
        const followingIds: string[] = followsRes.items.map((f: any) => f.following_id);
        if (followingIds.length === 0) return;

        const allPresences: any[] = [];
        for (let i = 0; i < followingIds.length; i += 50) {
          const batch = followingIds.slice(i, i + 50);
          const filter = batch.map((uid) => `user_id = "${uid}"`).join(' || ');
          try {
            const res = await pb.collection('user_presence').getList(1, 50, {
              filter,
              requestKey: null,
            });
            allPresences.push(...res.items);
          } catch {}
        }

        const livePresences = allPresences.filter(
          (p) => p.is_listening && p.current_song_title && isPresenceFresh(p.last_seen_at)
        );
        if (livePresences.length === 0) return;

        const pr = livePresences[0];
        const profileRes = await pb.collection('profiles').getList(1, 1, {
          filter: `user_id = "${pr.user_id}"`,
          requestKey: null,
        });
        if (profileRes.items.length === 0) return;

        const p = profileRes.items[0];
        const avatar = p.avatar
          ? pb.files.getURL({ id: p.id, collectionName: 'profiles' } as any, p.avatar)
          : null;

        setLiveFriend({
          pseudo: p.pseudo || 'Anonyme',
          avatarUrl: avatar,
          songTitle: pr.current_song_title,
          songAuthor: pr.current_song_author || null,
          songCoverUrl: pr.current_song_cover_url || null,
        });
      } catch {}
    })();
  }, [user]);

  return (
    <>
      {/* Splash principal */}
      <AnimatePresence>
        {splashVisible && (
          <motion.div
            key="splash"
            className="fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-6 bg-background"
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8, ease: 'easeInOut' }}
          >
            <motion.img
              src="/jux-icon-511.png"
              alt="Nexora-Music"
              className="w-48 h-48 rounded-2xl shadow-2xl"
              initial={{ opacity: 0, scale: 0.85, y: -16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
            />
            <motion.h1
              className="text-4xl font-bold tracking-widest text-foreground"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.35, ease: 'easeOut' }}
            >
              Nexora-Music
            </motion.h1>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Widget ami — flotte sur la page d'accueil déjà chargée */}
      <AnimatePresence>
        {widgetVisible && liveFriend && (
          <motion.div
            key="live-friend"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            className="fixed bottom-8 right-5 z-[9999] flex items-center gap-3 rounded-2xl border border-border/40 bg-card/90 p-3 shadow-xl backdrop-blur-md max-w-[230px]"
          >
            {liveFriend.songCoverUrl ? (
              <img
                src={liveFriend.songCoverUrl}
                alt=""
                className="h-12 w-12 shrink-0 rounded-xl object-cover"
              />
            ) : (
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/20">
                <Headphones className="h-5 w-5 text-primary" />
              </div>
            )}

            <div className="min-w-0 flex-1">
              <div className="mb-0.5 flex items-center gap-1.5">
                <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-green-500" />
                <div className="flex items-center gap-1.5">
                  {liveFriend.avatarUrl && (
                    <img
                      src={liveFriend.avatarUrl}
                      alt=""
                      className="h-4 w-4 rounded-full object-cover"
                    />
                  )}
                  <p className="truncate text-[10px] font-semibold text-green-400">
                    {liveFriend.pseudo}
                  </p>
                </div>
              </div>
              <p className="truncate text-xs font-bold leading-tight text-foreground">
                {liveFriend.songTitle}
              </p>
              {liveFriend.songAuthor && (
                <p className="truncate text-[10px] text-muted-foreground">
                  {liveFriend.songAuthor}
                </p>
              )}
            </div>

            <Headphones className="h-3.5 w-3.5 shrink-0 text-green-500" />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
