import { Suspense, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { pb } from '@/lib/pocketbase';
import { useAuth } from '@/contexts/AuthContext';
import { Headphones } from 'lucide-react';
import { armVulkanOnceAndRelaunch } from '@/lib/gpuAcceleration';
import { randomDotmLoader } from '@/components/ui/dotmLoaders';
import { isLowPerf } from '@/lib/perfProfile';
import { getPlatform } from '@/lib/platform';

const LOW_PERF = isLowPerf();

/**
 * Animation de chargement affichée sous "Nexora-Music", tirée au sort à chaque
 * démarrage. Le composant est chargé à la demande (voir ui/dotmLoaders) : les
 * 89 variantes ne sont plus dans le bundle initial.
 *
 * Sur un appareil modeste on ne la tire pas du tout : ces animations font battre
 * plusieurs dizaines de points à chaque frame, pile au moment où l'appareil
 * monte l'application derrière l'écran de démarrage. Un indicateur CSS simple
 * tient le même rôle pour une fraction du coût.
 */
function pickLoadingAnimation() {
  if (LOW_PERF) return null;
  return randomDotmLoader();
}

/** Repli léger : un seul élément animé en rotation, composité par le GPU. */
const SplashSpinner = () => (
  <div className="h-7 w-7 rounded-full border-2 border-foreground/25 border-t-foreground animate-spin" />
);

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
  const [LoadingAnim] = useState(pickLoadingAnimation);

  // Splash : 4000ms visible → fade 800ms → onComplete à 4800ms
  // onDismiss à 6600ms : laisse le widget finir ses 4s même si le fetch est lent
  useEffect(() => {
    const hide    = setTimeout(() => setSplashVisible(false), 4000);
    const done    = setTimeout(() => onComplete(),            4800);
    const dismiss = setTimeout(() => onDismiss(),             6600);
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

  // Combo secret (Ctrl+Alt+V) pendant l'animation de démarrage : relance l'app
  // en Vulkan pour ce seul lancement (voir gpuAcceleration.ts — one-shot, à
  // refaire à chaque fois, pour ne jamais rester bloqué si le pilote ne suit pas).
  const vulkanTriggeredRef = useRef(false);
  useEffect(() => {
    if (!splashVisible) return;
    let cancelled = false;
    let cleanup: (() => void) | undefined;
    getPlatform().then((platform) => {
      // Mode développeur GPU réservé à Windows (ANGLE/Direct3D) — le combo n'a
      // aucun effet ailleurs, inutile d'écouter les touches sur les autres OS.
      if (cancelled || platform !== 'windows') return;
      const onKeyDown = (e: KeyboardEvent) => {
        if (vulkanTriggeredRef.current) return;
        if (e.ctrlKey && e.altKey && e.key.toLowerCase() === 'v') {
          vulkanTriggeredRef.current = true;
          void armVulkanOnceAndRelaunch();
        }
      };
      window.addEventListener('keydown', onKeyDown);
      cleanup = () => window.removeEventListener('keydown', onKeyDown);
    });
    return () => { cancelled = true; cleanup?.(); };
  }, [splashVisible]);

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
            <motion.div
              className="w-48 h-48 rounded-2xl shadow-2xl overflow-hidden"
              initial={{ opacity: 0, y: -16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
            >
              {/* Le zoom animé sur une vidéo en lecture force le navigateur à
                  recomposer une couche vidéo à chaque frame, exactement pendant
                  que React monte l'application derrière cet écran. Sur un
                  appareil modeste on garde l'image du logo, sans la vidéo. */}
              {LOW_PERF ? (
                <img
                  src="/jux-icon-512.png"
                  alt=""
                  className="w-full h-full object-cover"
                />
              ) : (
                <motion.video
                  src="/MiniMax_H3_00004_.mp4"
                  autoPlay
                  muted
                  loop
                  playsInline
                  className="w-full h-full object-cover"
                  initial={{ scale: 1 }}
                  animate={{ scale: 1.3 }}
                  transition={{ duration: 4, ease: 'linear' }}
                />
              )}
            </motion.div>
            <motion.h1
              className="text-4xl font-bold tracking-widest text-foreground"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.35, ease: 'easeOut' }}
            >
              Nexora-Music
            </motion.h1>
            <motion.div
              className="text-foreground"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.55, ease: 'easeOut' }}
            >
              {LoadingAnim ? (
                <Suspense fallback={<SplashSpinner />}>
                  <LoadingAnim size={28} dotSize={4} speed={1.2} bloom halo={1} />
                </Suspense>
              ) : (
                <SplashSpinner />
              )}
            </motion.div>
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
