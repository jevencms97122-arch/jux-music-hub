import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { pb } from '@/lib/pocketbase';
import { useAuth } from '@/contexts/AuthContext';
import { Headphones } from 'lucide-react';
import { armVulkanOnceAndRelaunch } from '@/lib/gpuAcceleration';
import { getPlatform } from '@/lib/platform';
import { DotmSquare1 } from '@/components/ui/dotm-square-1';
import { DotmSquare2 } from '@/components/ui/dotm-square-2';
import { DotmSquare3 } from '@/components/ui/dotm-square-3';
import { DotmSquare4 } from '@/components/ui/dotm-square-4';
import { DotmSquare5 } from '@/components/ui/dotm-square-5';
import { DotmSquare6 } from '@/components/ui/dotm-square-6';
import { DotmSquare7 } from '@/components/ui/dotm-square-7';
import { DotmSquare8 } from '@/components/ui/dotm-square-8';
import { DotmSquare9 } from '@/components/ui/dotm-square-9';
import { DotmSquare10 } from '@/components/ui/dotm-square-10';
import { DotmSquare11 } from '@/components/ui/dotm-square-11';
import { DotmSquare12 } from '@/components/ui/dotm-square-12';
import { DotmSquare13 } from '@/components/ui/dotm-square-13';
import { DotmSquare14 } from '@/components/ui/dotm-square-14';
import { DotmSquare15 } from '@/components/ui/dotm-square-15';
import { DotmSquare16 } from '@/components/ui/dotm-square-16';
import { DotmSquare17 } from '@/components/ui/dotm-square-17';
import { DotmSquare18 } from '@/components/ui/dotm-square-18';
import { DotmSquare19 } from '@/components/ui/dotm-square-19';
import { DotmSquare20 } from '@/components/ui/dotm-square-20';
import { DotmCircular1 } from '@/components/ui/dotm-circular-1';
import { DotmCircular2 } from '@/components/ui/dotm-circular-2';
import { DotmCircular3 } from '@/components/ui/dotm-circular-3';
import { DotmCircular4 } from '@/components/ui/dotm-circular-4';
import { DotmCircular5 } from '@/components/ui/dotm-circular-5';
import { DotmCircular6 } from '@/components/ui/dotm-circular-6';
import { DotmCircular7 } from '@/components/ui/dotm-circular-7';
import { DotmCircular8 } from '@/components/ui/dotm-circular-8';
import { DotmCircular9 } from '@/components/ui/dotm-circular-9';
import { DotmCircular10 } from '@/components/ui/dotm-circular-10';
import { DotmCircular11 } from '@/components/ui/dotm-circular-11';
import { DotmCircular12 } from '@/components/ui/dotm-circular-12';
import { DotmCircular13 } from '@/components/ui/dotm-circular-13';
import { DotmCircular14 } from '@/components/ui/dotm-circular-14';
import { DotmCircular15 } from '@/components/ui/dotm-circular-15';
import { DotmCircular16 } from '@/components/ui/dotm-circular-16';
import { DotmCircular17 } from '@/components/ui/dotm-circular-17';
import { DotmCircular18 } from '@/components/ui/dotm-circular-18';
import { DotmCircular19 } from '@/components/ui/dotm-circular-19';
import { DotmCircular20 } from '@/components/ui/dotm-circular-20';
import { DotmTriangle1 } from '@/components/ui/dotm-triangle-1';
import { DotmTriangle2 } from '@/components/ui/dotm-triangle-2';
import { DotmTriangle3 } from '@/components/ui/dotm-triangle-3';
import { DotmTriangle4 } from '@/components/ui/dotm-triangle-4';
import { DotmTriangle5 } from '@/components/ui/dotm-triangle-5';
import { DotmTriangle6 } from '@/components/ui/dotm-triangle-6';
import { DotmTriangle7 } from '@/components/ui/dotm-triangle-7';
import { DotmTriangle8 } from '@/components/ui/dotm-triangle-8';
import { DotmTriangle9 } from '@/components/ui/dotm-triangle-9';
import { DotmTriangle10 } from '@/components/ui/dotm-triangle-10';
import { DotmTriangle11 } from '@/components/ui/dotm-triangle-11';
import { DotmTriangle12 } from '@/components/ui/dotm-triangle-12';
import { DotmTriangle13 } from '@/components/ui/dotm-triangle-13';
import { DotmTriangle14 } from '@/components/ui/dotm-triangle-14';
import { DotmTriangle15 } from '@/components/ui/dotm-triangle-15';
import { DotmTriangle16 } from '@/components/ui/dotm-triangle-16';
import { DotmTriangle17 } from '@/components/ui/dotm-triangle-17';
import { DotmTriangle18 } from '@/components/ui/dotm-triangle-18';
import { DotmTriangle19 } from '@/components/ui/dotm-triangle-19';
import { DotmTriangle20 } from '@/components/ui/dotm-triangle-20';
import { DotmHex1 } from '@/components/ui/dotm-hex-1';
import { DotmHex2 } from '@/components/ui/dotm-hex-2';
import { DotmHex3 } from '@/components/ui/dotm-hex-3';
import { DotmHex4 } from '@/components/ui/dotm-hex-4';
import { DotmHex5 } from '@/components/ui/dotm-hex-5';
import { DotmHex6 } from '@/components/ui/dotm-hex-6';
import { DotmHex7 } from '@/components/ui/dotm-hex-7';
import { DotmHex8 } from '@/components/ui/dotm-hex-8';
import { DotmHex9 } from '@/components/ui/dotm-hex-9';
import { DotmHex10 } from '@/components/ui/dotm-hex-10';
import { Dotm3x3_1 } from '@/components/ui/dotm-3x3-1';
import { Dotm3x3_2 } from '@/components/ui/dotm-3x3-2';
import { Dotm3x3_3 } from '@/components/ui/dotm-3x3-3';
import { Dotm3x3_4 } from '@/components/ui/dotm-3x3-4';
import { Dotm3x3_5 } from '@/components/ui/dotm-3x3-5';
import { Dotm3x3_6 } from '@/components/ui/dotm-3x3-6';
import { Dotm3x3_7 } from '@/components/ui/dotm-3x3-7';
import { Dotm3x3_8 } from '@/components/ui/dotm-3x3-8';
import { Dotm3x3_10 } from '@/components/ui/dotm-3x3-10';
import { Dotm3x3_11 } from '@/components/ui/dotm-3x3-11';
import { Dotm3x3_12 } from '@/components/ui/dotm-3x3-12';
import { Dotm3x3_13 } from '@/components/ui/dotm-3x3-13';
import { Dotm3x3_14 } from '@/components/ui/dotm-3x3-14';
import { Dotm3x3_15 } from '@/components/ui/dotm-3x3-15';
import { Dotm3x3_16 } from '@/components/ui/dotm-3x3-16';
import { Dotm3x3_18 } from '@/components/ui/dotm-3x3-18';
import { Dotm3x3_19 } from '@/components/ui/dotm-3x3-19';
import { Dotm3x3_20 } from '@/components/ui/dotm-3x3-20';
import { Dotm3x3_21 } from '@/components/ui/dotm-3x3-21';

// Animations de loading disponibles sous "Nexora-Music" — tirées au sort
// à chaque intro, d'autres seront ajoutées au fil du temps.
const LOADING_ANIMATIONS = [
  () => <DotmSquare1 size={28} dotSize={4} speed={1.2} bloom halo={1} />,
  () => <DotmSquare2 size={28} dotSize={4} speed={1.2} bloom halo={1} />,
  () => <DotmSquare3 size={28} dotSize={4} speed={1.2} bloom halo={1} />,
  () => <DotmSquare4 size={28} dotSize={4} speed={1.2} bloom halo={1} />,
  () => <DotmSquare5 size={28} dotSize={4} speed={1.2} bloom halo={1} />,
  () => <DotmSquare6 size={28} dotSize={4} speed={1.2} bloom halo={1} />,
  () => <DotmSquare7 size={28} dotSize={4} speed={1.2} bloom halo={1} />,
  () => <DotmSquare8 size={28} dotSize={4} speed={1.2} bloom halo={1} />,
  () => <DotmSquare9 size={28} dotSize={4} speed={1.2} bloom halo={1} />,
  () => <DotmSquare10 size={28} dotSize={4} speed={1.2} bloom halo={1} />,
  () => <DotmSquare11 size={28} dotSize={4} speed={1.2} bloom halo={1} />,
  () => <DotmSquare12 size={28} dotSize={4} speed={1.2} bloom halo={1} />,
  () => <DotmSquare13 size={28} dotSize={4} speed={1.2} bloom halo={1} />,
  () => <DotmSquare14 size={28} dotSize={4} speed={1.2} bloom halo={1} />,
  () => <DotmSquare15 size={28} dotSize={4} speed={1.2} bloom halo={1} />,
  () => <DotmSquare16 size={28} dotSize={4} speed={1.2} bloom halo={1} />,
  () => <DotmSquare17 size={28} dotSize={4} speed={1.2} bloom halo={1} />,
  () => <DotmSquare18 size={28} dotSize={4} speed={1.2} bloom halo={1} />,
  () => <DotmSquare19 size={28} dotSize={4} speed={1.2} bloom halo={1} />,
  () => <DotmSquare20 size={28} dotSize={4} speed={1.2} bloom halo={1} />,
  () => <DotmCircular1 size={28} dotSize={4} speed={1.2} bloom halo={1} />,
  () => <DotmCircular2 size={28} dotSize={4} speed={1.2} bloom halo={1} />,
  () => <DotmCircular3 size={28} dotSize={4} speed={1.2} bloom halo={1} />,
  () => <DotmCircular4 size={28} dotSize={4} speed={1.2} bloom halo={1} />,
  () => <DotmCircular5 size={28} dotSize={4} speed={1.2} bloom halo={1} />,
  () => <DotmCircular6 size={28} dotSize={4} speed={1.2} bloom halo={1} />,
  () => <DotmCircular7 size={28} dotSize={4} speed={1.2} bloom halo={1} />,
  () => <DotmCircular8 size={28} dotSize={4} speed={1.2} bloom halo={1} />,
  () => <DotmCircular9 size={28} dotSize={4} speed={1.2} bloom halo={1} />,
  () => <DotmCircular10 size={28} dotSize={4} speed={1.2} bloom halo={1} />,
  () => <DotmCircular11 size={28} dotSize={4} speed={1.2} bloom halo={1} />,
  () => <DotmCircular12 size={28} dotSize={4} speed={1.2} bloom halo={1} />,
  () => <DotmCircular13 size={28} dotSize={4} speed={1.2} bloom halo={1} />,
  () => <DotmCircular14 size={28} dotSize={4} speed={1.2} bloom halo={1} />,
  () => <DotmCircular15 size={28} dotSize={4} speed={1.2} bloom halo={1} />,
  () => <DotmCircular16 size={28} dotSize={4} speed={1.2} bloom halo={1} />,
  () => <DotmCircular17 size={28} dotSize={4} speed={1.2} bloom halo={1} />,
  () => <DotmCircular18 size={28} dotSize={4} speed={1.2} bloom halo={1} />,
  () => <DotmCircular19 size={28} dotSize={4} speed={1.2} bloom halo={1} />,
  () => <DotmCircular20 size={28} dotSize={4} speed={1.2} bloom halo={1} />,
  () => <DotmTriangle1 size={28} dotSize={4} speed={1.2} bloom halo={1} />,
  () => <DotmTriangle2 size={28} dotSize={4} speed={1.2} bloom halo={1} />,
  () => <DotmTriangle3 size={28} dotSize={4} speed={1.2} bloom halo={1} />,
  () => <DotmTriangle4 size={28} dotSize={4} speed={1.2} bloom halo={1} />,
  () => <DotmTriangle5 size={28} dotSize={4} speed={1.2} bloom halo={1} />,
  () => <DotmTriangle6 size={28} dotSize={4} speed={1.2} bloom halo={1} />,
  () => <DotmTriangle7 size={28} dotSize={4} speed={1.2} bloom halo={1} />,
  () => <DotmTriangle8 size={28} dotSize={4} speed={1.2} bloom halo={1} />,
  () => <DotmTriangle9 size={28} dotSize={4} speed={1.2} bloom halo={1} />,
  () => <DotmTriangle10 size={28} dotSize={4} speed={1.2} bloom halo={1} />,
  () => <DotmTriangle11 size={28} dotSize={4} speed={1.2} bloom halo={1} />,
  () => <DotmTriangle12 size={28} dotSize={4} speed={1.2} bloom halo={1} />,
  () => <DotmTriangle13 size={28} dotSize={4} speed={1.2} bloom halo={1} />,
  () => <DotmTriangle14 size={28} dotSize={4} speed={1.2} bloom halo={1} />,
  () => <DotmTriangle15 size={28} dotSize={4} speed={1.2} bloom halo={1} />,
  () => <DotmTriangle16 size={28} dotSize={4} speed={1.2} bloom halo={1} />,
  () => <DotmTriangle17 size={28} dotSize={4} speed={1.2} bloom halo={1} />,
  () => <DotmTriangle18 size={28} dotSize={4} speed={1.2} bloom halo={1} />,
  () => <DotmTriangle19 size={28} dotSize={4} speed={1.2} bloom halo={1} />,
  () => <DotmTriangle20 size={28} dotSize={4} speed={1.2} bloom halo={1} />,
  () => <DotmHex1 size={28} dotSize={4} speed={1.2} bloom halo={1} />,
  () => <DotmHex2 size={28} dotSize={4} speed={1.2} bloom halo={1} />,
  () => <DotmHex3 size={28} dotSize={4} speed={1.2} bloom halo={1} />,
  () => <DotmHex4 size={28} dotSize={4} speed={1.2} bloom halo={1} />,
  () => <DotmHex5 size={28} dotSize={4} speed={1.2} bloom halo={1} />,
  () => <DotmHex6 size={28} dotSize={4} speed={1.2} bloom halo={1} />,
  () => <DotmHex7 size={28} dotSize={4} speed={1.2} bloom halo={1} />,
  () => <DotmHex8 size={28} dotSize={4} speed={1.2} bloom halo={1} />,
  () => <DotmHex9 size={28} dotSize={4} speed={1.2} bloom halo={1} />,
  () => <DotmHex10 size={28} dotSize={4} speed={1.2} bloom halo={1} />,
  () => <Dotm3x3_1 size={28} dotSize={4} speed={1.2} bloom halo={1} />,
  () => <Dotm3x3_2 size={28} dotSize={4} speed={1.2} bloom halo={1} />,
  () => <Dotm3x3_3 size={28} dotSize={4} speed={1.2} bloom halo={1} />,
  () => <Dotm3x3_4 size={28} dotSize={4} speed={1.2} bloom halo={1} />,
  () => <Dotm3x3_5 size={28} dotSize={4} speed={1.2} bloom halo={1} />,
  () => <Dotm3x3_6 size={28} dotSize={4} speed={1.2} bloom halo={1} />,
  () => <Dotm3x3_7 size={28} dotSize={4} speed={1.2} bloom halo={1} />,
  () => <Dotm3x3_8 size={28} dotSize={4} speed={1.2} bloom halo={1} />,
  () => <Dotm3x3_10 size={28} dotSize={4} speed={1.2} bloom halo={1} />,
  () => <Dotm3x3_11 size={28} dotSize={4} speed={1.2} bloom halo={1} />,
  () => <Dotm3x3_12 size={28} dotSize={4} speed={1.2} bloom halo={1} />,
  () => <Dotm3x3_13 size={28} dotSize={4} speed={1.2} bloom halo={1} />,
  () => <Dotm3x3_14 size={28} dotSize={4} speed={1.2} bloom halo={1} />,
  () => <Dotm3x3_15 size={28} dotSize={4} speed={1.2} bloom halo={1} />,
  () => <Dotm3x3_16 size={28} dotSize={4} speed={1.2} bloom halo={1} />,
  () => <Dotm3x3_18 size={28} dotSize={4} speed={1.2} bloom halo={1} />,
  () => <Dotm3x3_19 size={28} dotSize={4} speed={1.2} bloom halo={1} />,
  () => <Dotm3x3_20 size={28} dotSize={4} speed={1.2} bloom halo={1} />,
  () => <Dotm3x3_21 size={28} dotSize={4} speed={1.2} bloom halo={1} />,
];

function pickLoadingAnimation() {
  const Anim = LOADING_ANIMATIONS[Math.floor(Math.random() * LOADING_ANIMATIONS.length)];
  return Anim();
}

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
  const [loadingAnim] = useState(() => pickLoadingAnimation());

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
            <motion.div
              className="text-foreground"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.55, ease: 'easeOut' }}
            >
              {loadingAnim}
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
