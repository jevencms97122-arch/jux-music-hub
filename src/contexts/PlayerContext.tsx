import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react';
import { pb, getPbUrl } from '@/lib/pocketbase';
import { songAudioUrl, songCoverUrl, songAudioUrlWithCache } from '@/lib/storage';
import { useAuth } from '@/contexts/AuthContext';
import { useOfflineMode } from '@/contexts/OfflineModeContext';
import { extractDominantHsl, applyAccentHsl } from '@/lib/dominantColor';
import { recordListen } from '@/lib/listenStats';
import { recordLocalListen } from '@/lib/localListenHistory';
import { queueOfflinePlay } from '@/lib/offlinePlaySync';
import { ensureCachedForPlayback } from '@/lib/offlineManager';
import { setMediaSessionMetadata, setMediaSessionHandlers, setMediaSessionPosition, setMediaSessionPlaybackState, clearMediaSession } from '@/lib/notifications';
import { sendNowPlayingToNative, sendPlaybackPositionToNative, clearNowPlayingOnNative, onNativeCommand, resolveCoverUrl } from '@/lib/androidMediaBridge';
import type { NativeCommandEvent } from '@/lib/androidMediaBridge';
import { toast } from 'sonner';
import { updatePresence, clearPresence } from '@/lib/userPresence';
import { updateDiscordPresence, clearDiscordPresence } from '@/lib/discordBridge';
import { EQ_BANDS_HZ, EQ_PRESETS, EQ_STORAGE_KEY } from '@/lib/eqPresets';
import { LiveBpmEstimator, tempoCompatibilityScore } from '@/lib/bpmEstimator';
import type { BpmConfidence } from '@/lib/bpmEstimator';
import type { Song } from '@/types/music';
import { triggerAutoDownload, isAutoDownloadedBefore } from '@/lib/autoDownloadManager';
import { getPlatform } from '@/lib/platform';
import {
  isPermanentSessionEnabled, setPermanentSessionEnabledPref,
  getStoredPermanentSessionId, setStoredPermanentSessionId,
} from '@/lib/permanentSession';

export type TransitionMode = 'linear' | 'hardCut' | 'vinylStop' | 'filterSweep' | 'equalPower' | 'autoMix';

/** AutoMix : fenêtre max avant la fin du morceau pour déclencher la préparation
 *  de la transition (la durée réelle, plus courte, est décidée ensuite selon
 *  la compatibilité de tempo détectée). */
const AUTOMIX_TRIGGER_LOOKAHEAD_SEC = 8;
/** AutoMix : au-delà de cette fenêtre, un silence en fin de piste soutenu
 *  (voir `getMsSinceLastAudible`) déclenche quand même la transition — pour
 *  ne pas fondre sur du silence si le morceau se termine avant sa durée réelle. */
const AUTOMIX_SILENCE_TRIGGER_LOOKAHEAD_SEC = AUTOMIX_TRIGGER_LOOKAHEAD_SEC * 2.5;
const AUTOMIX_TRAILING_SILENCE_MS = 600;
/** AutoMix : attente max pour caler le début du fondu sur le prochain beat. */
const AUTOMIX_BEAT_ALIGN_MAX_WAIT_MS = 900;

type AutoMixKind = 'direct' | 'shortMix' | 'dynamicFade';

interface AutoMixPlan {
  kind: AutoMixKind;
  durationSec: number;
  beatAligned: boolean;
}

/** AutoMix : choisit le type de transition (enchaînement direct, mix court, ou
 *  fondu dynamique) et sa durée selon la compatibilité de tempo détectée. Le
 *  calage sur le beat n'a de sens que pour les deux premiers cas — un fondu
 *  dynamique sert justement à masquer des tempos incompatibles. */
function planAutoMixTransition(score: number, activeConfidence: BpmConfidence | undefined): AutoMixPlan {
  if (score > 0.92 && activeConfidence && activeConfidence !== 'low') {
    return { kind: 'direct', durationSec: 0.3, beatAligned: true };
  }
  if (score > 0.75) {
    return { kind: 'shortMix', durationSec: 2, beatAligned: true };
  }
  if (score > 0.55) {
    return { kind: 'dynamicFade', durationSec: 5, beatAligned: false };
  }
  return { kind: 'dynamicFade', durationSec: 7, beatAligned: false };
}

/** Passe-bas (piste sortante) : fréquence de coupure grand ouverte (inaudible). */
const FILTER_SWEEP_LOWPASS_OPEN_HZ = 20000;
/** Passe-bas (piste sortante) : fréquence de coupure au plus fort du sweep — ne laisse
 *  passer que les basses profondes, son étouffé/voilé façon "filter kill" DJ. */
const FILTER_SWEEP_LOWPASS_CLOSED_HZ = 120;
/** Passe-haut (piste entrante) : fréquence de coupure grand ouverte (basses intactes). */
const FILTER_SWEEP_HIGHPASS_OPEN_HZ = 20;
/** Passe-haut (piste entrante) : fréquence de coupure au départ du sweep — coupe
 *  largement les basses, son fin/métallique qui se remplit progressivement. */
const FILTER_SWEEP_HIGHPASS_CLOSED_HZ = 2000;
/** Résonance des filtres — un Q élevé crée le petit "wah" caractéristique des
 *  filtres de table de mix DJ, bien plus perceptible qu'un filtre plat. */
const FILTER_SWEEP_Q = 3.2;

/** Interpolation logarithmique entre deux fréquences (l'oreille perçoit les
 *  fréquences de façon logarithmique — une interpolation linéaire en Hz reste
 *  quasi inaudible sur 90% du sweep et ne se fait sentir qu'à la toute fin). */
function logLerpHz(from: number, to: number, t: number): number {
  return from * Math.pow(to / from, t);
}

export type ConnectionStatus = 'stable' | 'slow' | 'unstable';

export interface ListenSessionRow {
  id: string;
  code: string | null;
  host_id: string;
  song_id: string | null;
  is_playing: boolean;
  position: number;
  tempo: number;
  participants: string[];
  is_active: boolean;
  /** Session ouverte : tous les amis de l'hôte peuvent rejoindre sans code */
  is_open?: boolean;
}

interface PlayerContextType {
  currentSong: Song | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  queue: Song[];
  queueIndex: number;
  isShuffled: boolean;
  repeatMode: 'off' | 'all' | 'one';
  isPlayerOpen: boolean;
  playbackRate: number;
  crossfadeSeconds: number;
  transitionMode: TransitionMode;
  activeSession: ListenSessionRow | null;
  isSessionHost: boolean;
  isSessionGuest: boolean;
  permanentSessionEnabled: boolean;
  setPermanentSessionEnabled: (enabled: boolean) => Promise<void>;
  joinSession: (session: ListenSessionRow) => Promise<boolean>;
  connectionStatus: ConnectionStatus;
  isBuffering: boolean;
  refreshSession: () => Promise<void>;
  setActiveSession: (s: ListenSessionRow | null) => void;
  stopAudio: () => void;
  refreshSongStats: (songId: string) => Promise<void>;
  playSong: (song: Song) => void;
  playSongFromList: (song: Song, list: Song[]) => void;
  playExternalAudio: (payload: {
    videoId: string;
    title: string;
    author: string;
    coverUrl: string;
    audioUrl: string;
  }) => void;
  togglePlay: () => void;
  next: () => void;
  previous: () => void;
  seek: (t: number) => void;
  setVolume: (v: number) => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
  openPlayer: () => void;
  closePlayer: () => void;
  setPlaybackRate: (r: number) => void;
  setCrossfadeSeconds: (s: number) => void;
  setTransitionMode: (mode: TransitionMode) => void;
  addToQueue: (song: Song) => void;
  startRadio: (seed: Song) => Promise<void>;
  signalVideoReady: () => void;
  getAnalyserNode: () => AnalyserNode | null;
  currentEqPreset: string;
  setEqPreset: (id: string) => void;
  sleepTimerMinutes: number | null;
  sleepTimerRemaining: number | null;
  setSleepTimer: (minutes: number | null) => void;
}

const PlayerContext = createContext<PlayerContextType | null>(null);

const CROSSFADE_KEY = 'jux:crossfade';
const TRANSITION_MODE_KEY = 'jux:transitionMode';

export const TRANSITION_MODES: { value: TransitionMode; label: string; description: string }[] = [
  { value: 'linear', label: 'Linear', description: 'Transition linéaire classique' },
  { value: 'hardCut', label: 'Hard Cut', description: 'Passage instantané (pas de fade)' },
  { value: 'equalPower', label: 'Equal Power', description: 'Fondu à puissance constante, comme Spotify' },
  { value: 'vinylStop', label: 'Vinyl Stop', description: 'Freinage vinyle puis relance façon platine DJ' },
  { value: 'filterSweep', label: 'Filter Sweep', description: 'Filtre passe-bas façon table de mix DJ' },
  { value: 'autoMix', label: 'AutoMix', description: 'Détecte le tempo et adapte la durée du fondu, comme Apple Music' },
];

function recordToSong(r: any): Song {
  return {
    id: r.id,
    title: r.title || '',
    author: r.author || '',
    audio: r.audio || '',
    cover: r.cover || null,
    audio_url: r.audio_url || '',
    cover_url: r.cover_url || null,
    video_url: r.video_url || null,
    genre: r.genre || null,
    uploaded_by: r.uploaded_by || '',
    duration: r.duration || 0,
    play_count: r.play_count ?? 0,
    weekly_play_count: r.weekly_play_count ?? 0,
    likes_count: r.likes_count ?? 0,
    created_at: r.created,
    updated_at: r.updated,
    collectionId: r.collectionId,
    collectionName: r.collectionName,
  };
}

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const { user: authUser } = useAuth();
  const { offline } = useOfflineMode();
  const offlineRef = useRef(offline);
  useEffect(() => { offlineRef.current = offline; }, [offline]);
  const audioARef = useRef<HTMLAudioElement | null>(null);
  const audioBRef = useRef<HTMLAudioElement | null>(null);
  const activeRef = useRef<'A' | 'B'>('A');
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const eqFiltersRef = useRef<BiquadFilterNode[]>([]);
  const lowpassARef = useRef<BiquadFilterNode | null>(null);
  const lowpassBRef = useRef<BiquadFilterNode | null>(null);
  // AutoMix — analyseurs dédiés A/B pour estimer le BPM du morceau en cours en
  // continu, + un 3ᵉ audio élément caché (muet) qui pré-analyse le morceau
  // suivant dès qu'on sait lequel c'est, pour avoir un BPM fiable bien avant
  // le moment de la transition.
  const bpmAnalyserARef = useRef<AnalyserNode | null>(null);
  const bpmAnalyserBRef = useRef<AnalyserNode | null>(null);
  const bpmEstimatorARef = useRef<LiveBpmEstimator | null>(null);
  const bpmEstimatorBRef = useRef<LiveBpmEstimator | null>(null);
  const preAnalysisAudioRef = useRef<HTMLAudioElement | null>(null);
  const preAnalysisEstimatorRef = useRef<LiveBpmEstimator | null>(null);
  const preAnalysisSongIdRef = useRef<string | null>(null);
  const crossfadingRef = useRef(false);
  const crossfadeIntervalRef = useRef<number | null>(null);
  const userRef = useRef(authUser);
  const currentSongRef = useRef<Song | null>(null);

  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(1);
  const [queue, setQueue] = useState<Song[]>([]);
  const [queueIndex, setQueueIndex] = useState(0);
  const [isShuffled, setIsShuffled] = useState(false);
  const [repeatMode, setRepeatMode] = useState<'off' | 'all' | 'one'>('off');
  const [isPlayerOpen, setIsPlayerOpen] = useState(false);
  const [playbackRate, setPlaybackRateState] = useState(1);
  const [playedSongIds, setPlayedSongIds] = useState<Set<string>>(new Set());
  const [crossfadeSeconds, setCrossfadeSecondsState] = useState<number>(() => {
    const v = parseFloat(localStorage.getItem(CROSSFADE_KEY) || '3');
    return isNaN(v) ? 3 : Math.max(0, Math.min(12, v));
  });
  const [transitionMode, setTransitionModeState] = useState<TransitionMode>(() => {
    const mode = localStorage.getItem(TRANSITION_MODE_KEY) as TransitionMode | null;
    return (mode && TRANSITION_MODES.some(m => m.value === mode)) ? mode : 'linear';
  });
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('stable');
  const [isBuffering, setIsBuffering] = useState(false);
  const [currentEqPreset, setCurrentEqPreset] = useState<string>(() => localStorage.getItem(EQ_STORAGE_KEY) ?? 'flat');
  const [sleepTimerMinutes, setSleepTimerMinutes] = useState<number | null>(null);
  const [sleepTimerRemaining, setSleepTimerRemaining] = useState<number | null>(null);
  const sleepTimerEndRef = useRef<number | null>(null);

  const videoReadyRef = useRef(false);
  const signalVideoReady = useCallback(() => { videoReadyRef.current = true; }, []);

  // Toast affiché quand un invité tente une action réservée à l'hôte : rappelle
  // comment quitter la session (Social > session en cours > Quitter).
  const notifyGuestBlocked = useCallback((action: string) => {
    toast.info(action, {
      description: 'Pour quitter, va dans Social > session en cours > Quitter la session',
      duration: 4500,
    });
  }, []);

  // Session
  const [activeSession, setActiveSessionState] = useState<ListenSessionRow | null>(null);
  const sessionRef = useRef<ListenSessionRow | null>(null);
  useEffect(() => { sessionRef.current = activeSession; }, [activeSession]);
  const isSessionHost = !!(activeSession && authUser && activeSession.host_id === authUser.id);
  const isSessionGuest = !!(activeSession && authUser && activeSession.host_id !== authUser.id);
  const setActiveSession = useCallback((s: ListenSessionRow | null) => setActiveSessionState(s), []);

  // ── Session permanente ──────────────────────────────────────────────────
  const [permanentSessionEnabled, setPermanentSessionEnabledState] = useState(() => isPermanentSessionEnabled());

  const setPermanentSessionEnabled = useCallback(async (enabled: boolean) => {
    setPermanentSessionEnabledPref(enabled);
    setPermanentSessionEnabledState(enabled);
    if (!enabled) {
      const storedId = getStoredPermanentSessionId();
      const s = sessionRef.current;
      if (storedId && s && s.id === storedId && authUser && s.host_id === authUser.id) {
        try { await pb.collection('listen_sessions').update(s.id, { is_active: false }); } catch {}
        setActiveSessionState(null);
      }
      setStoredPermanentSessionId(null);
    }
  }, [authUser]);

  // Rejoindre une session (via code, invitation, ou activité d'un ami en session permanente) :
  // même mécanique partout — on s'ajoute aux participants, le reste (chargement du titre,
  // synchro position/lecture) est pris en charge par les effets guest existants.
  const joinSession = useCallback(async (s: ListenSessionRow): Promise<boolean> => {
    if (!authUser) return false;
    try {
      // Si j'héberge déjà une session (notamment ma session permanente auto-créée), la
      // fermer avant de rejoindre celle de mon ami — sinon le polling refreshSession()
      // re-sélectionne ma propre session (priorité host) et annule le join quelques
      // secondes plus tard.
      const mine = sessionRef.current;
      if (mine && mine.id !== s.id && mine.host_id === authUser.id) {
        try { await pb.collection('listen_sessions').update(mine.id, { is_active: false }); } catch {}
        if (getStoredPermanentSessionId() === mine.id) setStoredPermanentSessionId(null);
      }

      // Repartir de l'état serveur le plus frais possible : la session passée en argument
      // (venant d'une liste rafraîchie toutes les quelques secondes) peut avoir une position
      // périmée — on doit démarrer exactement là où l'hôte en est.
      const fresh = await pb.collection('listen_sessions').getOne(s.id).catch(() => null) as any;
      const base: ListenSessionRow = fresh
        ? {
            id: fresh.id, code: fresh.code ?? null, host_id: fresh.host_id, song_id: fresh.song_id ?? null,
            is_playing: fresh.is_playing, position: fresh.position ?? 0, tempo: fresh.tempo || 1,
            participants: fresh.participants ?? [], is_active: fresh.is_active, is_open: fresh.is_open ?? false,
          }
        : s;

      const participants = (base.participants || []).filter((p) => p !== authUser.id);
      const nextParticipants = [...participants, authUser.id];
      await pb.collection('listen_sessions').update(base.id, { participants: nextParticipants });
      setActiveSessionState({ ...base, participants: nextParticipants });
      return true;
    } catch {
      return false;
    }
  }, [authUser]);

  // Tant que le mode est activé : dès qu'une musique est jouée en ligne sans
  // session active, on en crée une automatiquement (ouverte) pour que les
  // abonnés puissent voir l'activité et rejoindre. Broadcast/sync ensuite pris
  // en charge par les mécanismes de session existants (broadcastSong, etc.).
  const creatingPermanentSessionRef = useRef(false);
  useEffect(() => {
    if (!authUser || offlineRef.current) return;
    if (!permanentSessionEnabled) return;
    if (!currentSong || !isPlaying) return;
    if (activeSession) return;
    if (connectionStatus === 'unstable') return;
    if (creatingPermanentSessionRef.current) return;
    creatingPermanentSessionRef.current = true;
    let cancelled = false;
    (async () => {
      try {
        const code = String(Math.floor(10000000 + Math.random() * 90000000));
        const newS = await pb.collection('listen_sessions').create({
          host_id: authUser.id, code, is_active: true, is_playing: true,
          position: currentTime || 0, tempo: playbackRate, participants: [authUser.id],
          song_id: currentSong.id, is_open: true,
        });
        if (cancelled) return;
        setStoredPermanentSessionId(newS.id);
        setActiveSessionState({
          id: newS.id, code, host_id: authUser.id, song_id: currentSong.id,
          position: currentTime || 0, tempo: playbackRate, is_playing: true,
          participants: [authUser.id], is_active: true, is_open: true,
        });
      } catch {} finally {
        creatingPermanentSessionRef.current = false;
      }
    })();
    return () => { cancelled = true; };
  }, [authUser, permanentSessionEnabled, currentSong?.id, isPlaying, activeSession, connectionStatus]);

  // Toutes les écritures session de l'hôte passent par cette file pour garantir l'ordre d'arrivée
  // au serveur. Sans ça, le tick de sync (position de l'ANCIENNE musique, ~fin) pouvait arriver
  // APRÈS le broadcast du nouveau titre → la base disait "nouveau titre à 175s" → les invités
  // se téléportaient à la quasi-fin puis la musique se terminait → "pause toute seule".
  const sessionWriteChainRef = useRef<Promise<any>>(Promise.resolve());
  const queueSessionWrite = useCallback((updates: Record<string, any>) => {
    const s = sessionRef.current;
    if (!s) return;
    const id = s.id;
    sessionWriteChainRef.current = sessionWriteChainRef.current
      .then(() => pb.collection('listen_sessions').update(id, updates))
      .catch(() => {});
  }, []);

  const getActive = () => (activeRef.current === 'A' ? audioARef.current! : audioBRef.current!);
  const getInactive = () => (activeRef.current === 'A' ? audioBRef.current! : audioARef.current!);
  const getActiveLowpass = () => (activeRef.current === 'A' ? lowpassARef.current : lowpassBRef.current);
  const getInactiveLowpass = () => (activeRef.current === 'A' ? lowpassBRef.current : lowpassARef.current);

  const calculateFadePosition = useCallback((p: number, mode: TransitionMode): number => {
    if (mode === 'hardCut') return p >= 1 ? 1 : 0;
    if (mode === 'linear') return p;
    return p;
  }, []);

  const nextRef = useRef<() => void>(() => {});
  const previousRef = useRef<() => void>(() => {});
  const togglePlayRef = useRef<() => void>(() => {});
  const seekRef = useRef<(t: number) => void>(() => {});
  const stopAudioRef = useRef<() => void>(() => {});
  const crossfadeSecondsRef = useRef(crossfadeSeconds);
  const transitionModeRef = useRef(transitionMode);
  const repeatModeRef = useRef(repeatMode);
  const isSessionGuestRef = useRef(isSessionGuest);
  const queueRef = useRef(queue);
  const queueIndexRef = useRef(queueIndex);
  const isShuffledRef = useRef(isShuffled);
  const volumeRef = useRef(volume);
  const playbackRateRef = useRef(playbackRate);
  const originalQueueRef = useRef<Song[]>([]);
  // pendingSessionAutoplayRef removed — host plays immediately, no ready-gating
  const sessionGuestRecordedRef = useRef<string | null>(null);
  useEffect(() => { crossfadeSecondsRef.current = crossfadeSeconds; }, [crossfadeSeconds]);
  useEffect(() => { transitionModeRef.current = transitionMode; }, [transitionMode]);
  useEffect(() => { repeatModeRef.current = repeatMode; }, [repeatMode]);
  useEffect(() => { isSessionGuestRef.current = isSessionGuest; }, [isSessionGuest]);
  useEffect(() => { queueRef.current = queue; }, [queue]);
  useEffect(() => { queueIndexRef.current = queueIndex; }, [queueIndex]);
  useEffect(() => { isShuffledRef.current = isShuffled; }, [isShuffled]);
  useEffect(() => { volumeRef.current = volume; }, [volume]);
  useEffect(() => { playbackRateRef.current = playbackRate; }, [playbackRate]);
  useEffect(() => { userRef.current = authUser; }, [authUser]);
  useEffect(() => { currentSongRef.current = currentSong; }, [currentSong]);

  const recordPlayRef = useRef<(s: Song) => void>(() => {});
  const broadcastSongRef = useRef<(s: Song) => void>(() => {});

  const triggerCrossfadeRef = useRef<() => void>(() => {
    if (crossfadingRef.current) return;
    const fadeSec = crossfadeSecondsRef.current;
    if (fadeSec <= 0) return;
    if (isSessionGuestRef.current) return;
    const q = queueRef.current;
    const idx = queueIndexRef.current;
    if (q.length === 0) return;
    let nextIdx: number;
    if (repeatModeRef.current === 'one') return;
    else nextIdx = idx + 1;
    if (nextIdx >= q.length) { if (repeatModeRef.current === 'all') nextIdx = 0; else return; }
    const nextSong = q[nextIdx];
    if (!nextSong) return;
    crossfadingRef.current = true;
    const active = getActive();
    const inactive = getInactive();
    const isAutoMix = transitionModeRef.current === 'autoMix';
    const hasPreAnalysis = preAnalysisSongIdRef.current === nextSong.id;
    // AutoMix : durée + type de transition décidés selon la compatibilité de tempo
    // entre le morceau en cours (BPM accumulé en direct depuis le début de sa
    // lecture) et le suivant (BPM pré-analysé en arrière-plan, voir l'effet dédié)
    // — repli sur un fondu dynamique moyen si l'un des deux BPM n'a pas pu être
    // déterminé avec assez de fiabilité.
    const activeEstimator = activeRef.current === 'A' ? bpmEstimatorARef.current : bpmEstimatorBRef.current;
    let effectiveFadeSec = fadeSec;
    let autoMixPlan: AutoMixPlan | null = null;
    if (isAutoMix) {
      const activeBpm = activeEstimator?.getBpm() ?? null;
      const nextBpm = hasPreAnalysis ? preAnalysisEstimatorRef.current?.getBpm() ?? null : null;
      autoMixPlan = activeBpm && nextBpm
        ? planAutoMixTransition(tempoCompatibilityScore(activeBpm.bpm, nextBpm.bpm), activeBpm.confidence)
        : { kind: 'dynamicFade', durationSec: 4, beatAligned: false };
      effectiveFadeSec = autoMixPlan.durationSec;
    }
    inactive.src = songAudioUrl(nextSong);
    inactive.volume = 0;
    inactive.playbackRate = playbackRateRef.current;
    // Coupe les blancs : si on a pré-analysé une intro silencieuse pour ce
    // morceau, on saute directement dessus au lieu de démarrer à 0.
    inactive.currentTime = isAutoMix && hasPreAnalysis ? preAnalysisEstimatorRef.current?.getIntroSilenceSec() ?? 0 : 0;
    const startFade = () => {
      const startTs = performance.now();
      const mode = transitionModeRef.current;
      const fadeMs = effectiveFadeSec * 1000;
      const startVol = active.volume;
      const targetVol = volumeRef.current;
      const activeLowpass = getActiveLowpass();
      const inactiveLowpass = getInactiveLowpass();
      if (mode === 'filterSweep') {
        // Chaque filtre change de rôle selon quelle piste sort/entre à cette transition :
        // passe-bas sur la sortante, passe-haut sur l'entrante. Le Q monte pour un
        // effet "wah" résonant, bien plus perceptible qu'un filtre plat.
        if (activeLowpass) { activeLowpass.type = 'lowpass'; activeLowpass.Q.value = FILTER_SWEEP_Q; }
        if (inactiveLowpass) { inactiveLowpass.type = 'highpass'; inactiveLowpass.Q.value = FILTER_SWEEP_Q; }
      }
      if (crossfadeIntervalRef.current) clearTimeout(crossfadeIntervalRef.current);
      // setTimeout (~30 fps) et non requestAnimationFrame : rAF est lié au rendu des
      // frames et ne se déclenche JAMAIS quand la page n'est pas visible (app en
      // arrière-plan sur Android) — le fondu restait alors figé, la piste entrante
      // jouait à volume 0 en silence et crossfadingRef bloquait l'enchaînement de
      // secours. La progression étant calculée sur performance.now(), le passage à
      // setTimeout ne change ni la durée ni la courbe du fondu.
      const scheduleTick = (fn: () => void) => window.setTimeout(fn, 33);
      const tick = () => {
        const p = Math.min(1, (performance.now() - startTs) / fadeMs);
        const fadeCurve = calculateFadePosition(p, mode);
        if (mode === 'vinylStop') {
          if (p < 0.5) {
            // Freinage vinyle : décélération agressive jusqu'à un quasi-arrêt, le volume
            // s'éteint avec le ralenti (comme une platine qu'on freine à la main).
            const brakeCurve = p * 2;
            active.playbackRate = Math.max(0.05, playbackRateRef.current * (1 - Math.pow(brakeCurve, 2.2)));
            active.volume = Math.max(0, startVol * (1 - Math.pow(brakeCurve, 3)));
            inactive.volume = 0;
          } else {
            // Relance platine : redémarre lentement puis remonte vite en vitesse et en volume.
            const spinUpCurve = (p - 0.5) * 2;
            inactive.playbackRate = playbackRateRef.current * Math.min(1, 0.15 + Math.pow(spinUpCurve, 1.8) * 0.85);
            inactive.volume = Math.min(1, targetVol * Math.pow(spinUpCurve, 0.6));
            active.volume = 0;
          }
        } else if (mode === 'filterSweep') {
          // Passe-bas qui se ferme sur la piste sortante : elle perd ses aigus et ne
          // garde que les basses, son étouffé/voilé façon "filter kill" DJ.
          // Passe-haut qui s'ouvre sur la piste entrante : elle démarre sans basses
          // (son fin) puis se remplit à mesure qu'elle monte en volume.
          active.volume = Math.max(0, startVol * (1 - fadeCurve));
          inactive.volume = Math.min(1, targetVol * fadeCurve);
          if (activeLowpass) {
            activeLowpass.frequency.value = logLerpHz(FILTER_SWEEP_LOWPASS_OPEN_HZ, FILTER_SWEEP_LOWPASS_CLOSED_HZ, fadeCurve);
          }
          if (inactiveLowpass) {
            inactiveLowpass.frequency.value = logLerpHz(FILTER_SWEEP_HIGHPASS_CLOSED_HZ, FILTER_SWEEP_HIGHPASS_OPEN_HZ, fadeCurve);
          }
        } else if (mode === 'equalPower' || mode === 'autoMix') {
          // Fondu à puissance constante (courbes cos/sin) : contrairement à un fondu
          // linéaire, la somme des deux pistes garde une puissance perçue constante
          // pendant toute la transition, sans creux de volume au milieu. C'est
          // exactement la courbe utilisée par Spotify/Apple Music. AutoMix ne fait
          // que choisir la durée dynamiquement (voir triggerCrossfadeRef) puis
          // exécute le fondu avec cette même courbe.
          active.volume = Math.max(0, startVol * Math.cos(p * Math.PI / 2));
          inactive.volume = Math.min(1, targetVol * Math.sin(p * Math.PI / 2));
        } else {
          active.volume = Math.max(0, startVol * (1 - fadeCurve));
          inactive.volume = Math.min(1, targetVol * fadeCurve);
        }
        if (p >= 1) {
          crossfadeIntervalRef.current = null;
          try { active.pause(); active.currentTime = 0; active.removeAttribute('src'); active.load(); } catch {}
          activeRef.current = activeRef.current === 'A' ? 'B' : 'A';
          inactive.volume = targetVol;
          inactive.playbackRate = playbackRateRef.current;
          // Remet les deux filtres en passe-bas grand ouvert et Q neutre (état par
          // défaut), quel que soit le rôle qu'ils viennent de jouer.
          if (activeLowpass) { activeLowpass.type = 'lowpass'; activeLowpass.frequency.value = FILTER_SWEEP_LOWPASS_OPEN_HZ; activeLowpass.Q.value = 0.7; }
          if (inactiveLowpass) { inactiveLowpass.type = 'lowpass'; inactiveLowpass.frequency.value = FILTER_SWEEP_LOWPASS_OPEN_HZ; inactiveLowpass.Q.value = 0.7; }
          setDuration(inactive.duration || 0);
          setCurrentTime(inactive.currentTime || 0);
          setQueueIndex(nextIdx);
          setCurrentSong(nextSong);
          setPlayedSongIds(prev => new Set([...prev, nextSong.id]));
          setIsPlaying(true);
          recordPlayRef.current(nextSong);
          if (sessionRef.current && authUser && sessionRef.current.host_id === authUser.id) {
            broadcastSongRef.current(nextSong);
          }
          crossfadingRef.current = false;
          return;
        }
        crossfadeIntervalRef.current = scheduleTick(tick);
      };
      crossfadeIntervalRef.current = scheduleTick(tick);
    };
    const onReady = () => {
      inactive.removeEventListener('canplay', onReady);
      inactive.playbackRate = playbackRateRef.current;
      inactive.play().then(() => {
        inactive.playbackRate = playbackRateRef.current;
        // Cale le vrai départ du fondu sur le prochain beat détecté du morceau en
        // cours — sensible surtout pour un enchaînement direct ou un mix court.
        const waitMs = autoMixPlan?.beatAligned ? activeEstimator?.getMsUntilNextBeat(AUTOMIX_BEAT_ALIGN_MAX_WAIT_MS) ?? null : null;
        if (waitMs && waitMs > 20) setTimeout(startFade, waitMs);
        else startFade();
      }).catch((e) => { console.error('Crossfade play failed', e); crossfadingRef.current = false; });
    };
    inactive.addEventListener('canplay', onReady);
    inactive.load();
  });

  // Init audio
  useEffect(() => {
    const create = () => { const a = new Audio(); a.preload = 'auto'; (a as any).preservesPitch = false; (a as any).mozPreservesPitch = false; (a as any).webkitPreservesPitch = false; a.crossOrigin = 'anonymous'; return a; };
    audioARef.current = create();
    audioBRef.current = create();

    // Web Audio API — analyser + EQ filter chain
    try {
      // latencyHint 'playback' (et non le défaut 'interactive') : demande au
      // navigateur un buffer plus large, pensé pour une lecture continue plutôt
      // que la réactivité minimale d'un jeu/instrument. Sans ça, le petit buffer
      // "interactive" est inaudible sur le haut-parleur (buffer matériel local
      // tolérant) mais crépite sur Bluetooth, où la latence radio laisse beaucoup
      // moins de marge avant qu'un underrun ne devienne audible.
      const ctx = new AudioContext({ latencyHint: 'playback' });
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.82;

      // Créer la chaîne EQ : 5 filtres peaking (60Hz, 250Hz, 1kHz, 4kHz, 16kHz)
      const savedPresetId = localStorage.getItem(EQ_STORAGE_KEY) ?? 'flat';
      const savedPreset = EQ_PRESETS.find((p) => p.id === savedPresetId) ?? EQ_PRESETS[0];
      const filters = EQ_BANDS_HZ.map((freq, i) => {
        const f = ctx.createBiquadFilter();
        f.type = 'peaking';
        f.frequency.value = freq;
        f.Q.value = 1.0;
        f.gain.value = savedPreset.gains[i];
        return f;
      });
      // Chaîner : filter[0] → filter[1] → ... → filter[4] → analyser → destination
      filters.forEach((f, i) => {
        if (i < filters.length - 1) f.connect(filters[i + 1]);
        else f.connect(analyser);
      });
      analyser.connect(ctx.destination);

      // Filtre dédié à chaque piste (mode Filter Sweep) — passe-bas grand ouvert
      // (20kHz) par défaut, donc inaudible tant qu'aucun sweep n'est en cours. Son
      // `type` est basculé dynamiquement en lowpass/highpass selon le rôle
      // (sortant/entrant) à chaque transition (voir `startFade`).
      const makeSweepFilter = () => {
        const f = ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.value = FILTER_SWEEP_LOWPASS_OPEN_HZ;
        f.Q.value = 0.7;
        return f;
      };
      const sweepA = makeSweepFilter();
      const sweepB = makeSweepFilter();
      sweepA.connect(filters[0]);
      sweepB.connect(filters[0]);

      // Les deux sources audio passent d'abord par leur filtre dédié
      const sourceA = ctx.createMediaElementSource(audioARef.current);
      const sourceB = ctx.createMediaElementSource(audioBRef.current);
      sourceA.connect(sweepA);
      sourceB.connect(sweepB);

      audioCtxRef.current = ctx;
      analyserRef.current = analyser;
      eqFiltersRef.current = filters;
      lowpassARef.current = sweepA;
      lowpassBRef.current = sweepB;

      // AutoMix — analyseurs dédiés par piste, tapés directement à la source (donc
      // indépendants d'un éventuel sweep Filter Sweep en cours) pour un BPM fiable.
      const makeBpmAnalyser = () => {
        const a = ctx.createAnalyser();
        a.fftSize = 256;
        a.smoothingTimeConstant = 0.3;
        return a;
      };
      const bpmAnalyserA = makeBpmAnalyser();
      const bpmAnalyserB = makeBpmAnalyser();
      sourceA.connect(bpmAnalyserA);
      sourceB.connect(bpmAnalyserB);
      bpmAnalyserARef.current = bpmAnalyserA;
      bpmAnalyserBRef.current = bpmAnalyserB;
      bpmEstimatorARef.current = new LiveBpmEstimator(bpmAnalyserA);
      bpmEstimatorBRef.current = new LiveBpmEstimator(bpmAnalyserB);

      // Élément audio caché dédié à la pré-analyse BPM du morceau suivant — tourne
      // en parallèle du morceau en cours (voir l'effet plus bas), sans jamais
      // produire de son (gain à 0, en plus de `.muted`).
      const preAnalysisAudio = new Audio();
      preAnalysisAudio.preload = 'auto';
      preAnalysisAudio.crossOrigin = 'anonymous';
      preAnalysisAudio.muted = true;
      preAnalysisAudio.volume = 0;
      const preAnalysisSource = ctx.createMediaElementSource(preAnalysisAudio);
      const preAnalysisAnalyser = makeBpmAnalyser();
      const preAnalysisGain = ctx.createGain();
      preAnalysisGain.gain.value = 0;
      preAnalysisSource.connect(preAnalysisAnalyser);
      preAnalysisAnalyser.connect(preAnalysisGain);
      preAnalysisGain.connect(ctx.destination);
      preAnalysisAudioRef.current = preAnalysisAudio;
      preAnalysisEstimatorRef.current = new LiveBpmEstimator(preAnalysisAnalyser);
    } catch {}

    // Factorisé pour être réutilisable en dehors de l'événement 'timeupdate' natif —
    // voir window.__juxBackgroundTick plus bas : quand la WebView est gelée en
    // arrière-plan (Chromium suspend le JS d'une page invisible), 'timeupdate' et
    // 'ended' n'arrivent plus, mais l'audio natif continue de jouer jusqu'au bout.
    // Le code natif Android (MediaPlaybackService) réveille alors périodiquement
    // cette même logique via evaluateJavascript, qui passe même quand les timers
    // internes de la page sont gelés.
    const checkTrackProgress = (a: HTMLAudioElement) => {
      setCurrentTime(a.currentTime);
      const dur = a.duration;
      if (!isFinite(dur) || dur <= 0) return;
      const remaining = dur - a.currentTime;
      // Filet de sécurité : la piste est terminée (ou quasi) mais rien n'a pris le
      // relais — cas du réveil natif après un gel JS qui a duré jusqu'à la fin du
      // morceau. On force l'enchaînement plutôt que d'attendre un 'ended' qui a pu
      // être manqué pendant le gel.
      if (a.ended || remaining <= 0.3) {
        if (!crossfadingRef.current && !isSessionGuestRef.current) nextRef.current();
        return;
      }
      const fadeDuration = crossfadeSecondsRef.current;
      const isAutoMix = transitionModeRef.current === 'autoMix';
      // AutoMix : la durée réelle est décidée dynamiquement (voir triggerCrossfadeRef),
      // mais il faut déjà préparer/précharger la piste suivante un peu avant.
      const triggerWindow = isAutoMix ? AUTOMIX_TRIGGER_LOOKAHEAD_SEC : fadeDuration;
      // Coupe les blancs : si la piste est retombée dans le silence depuis un
      // moment alors qu'on approche de la fin, inutile d'attendre la fin réelle
      // du fichier — on déclenche la transition dès maintenant.
      const activeEstimatorForSilence = activeRef.current === 'A' ? bpmEstimatorARef.current : bpmEstimatorBRef.current;
      const trailingSilence = isAutoMix
        && remaining <= AUTOMIX_SILENCE_TRIGGER_LOOKAHEAD_SEC
        && (activeEstimatorForSilence?.getMsSinceLastAudible() ?? 0) > AUTOMIX_TRAILING_SILENCE_MS;

      if (fadeDuration > 0 && (remaining <= triggerWindow || trailingSilence) && remaining > 0.1 && !crossfadingRef.current && !isSessionGuestRef.current && repeatModeRef.current !== 'one') {
        triggerCrossfadeRef.current();
      }
    };
    const onTime = (e: Event) => {
      const a = getActive();
      if (e.target !== a) return;
      checkTrackProgress(a);
    };
    (window as any).__juxBackgroundTick = () => {
      const a = getActive();
      if (a && a.src) checkTrackProgress(a);
    };
    const onDur = (e: Event) => { if (e.target === getActive()) setDuration(getActive().duration || 0); };
    const onEnd = (e: Event) => { if (e.target !== getActive()) return; if (crossfadingRef.current) return; if (isSessionGuestRef.current) return; nextRef.current(); };
    const onWaiting = (e: Event) => { if (e.target === getActive()) setIsBuffering(true); };
    const onPlaying = (e: Event) => { if (e.target === getActive()) setIsBuffering(false); };
    const onPlay = (e: Event) => {
      if (e.target !== getActive()) return;
      setIsPlaying(true);
      const au = userRef.current;
      const cs = currentSongRef.current;
      if (au && cs) updatePresence({ userId: au.id, isListening: true, songId: cs.id, songTitle: cs.title, songAuthor: cs.author, songCoverUrl: songCoverUrl(cs) });
    };
    const onPause = (e: Event) => { if (e.target !== getActive()) return; if (!crossfadingRef.current) { setIsPlaying(false); setIsBuffering(false); } };
    [audioARef.current, audioBRef.current].forEach((a) => { a.addEventListener('timeupdate', onTime); a.addEventListener('loadedmetadata', onDur); a.addEventListener('ended', onEnd); a.addEventListener('play', onPlay); a.addEventListener('pause', onPause); a.addEventListener('waiting', onWaiting); a.addEventListener('playing', onPlaying); });

    // AutoMix — démarre/arrête/réinitialise l'estimateur BPM de chaque piste
    // indépendamment de son rôle actif/inactif (contrairement aux listeners
    // ci-dessus qui ne suivent que la piste active).
    const onBpmPlayingA = () => { if (transitionModeRef.current === 'autoMix') bpmEstimatorARef.current?.start(); };
    const onBpmPlayingB = () => { if (transitionModeRef.current === 'autoMix') bpmEstimatorBRef.current?.start(); };
    const onBpmStopA = () => bpmEstimatorARef.current?.stop();
    const onBpmStopB = () => bpmEstimatorBRef.current?.stop();
    const onBpmResetA = () => bpmEstimatorARef.current?.reset();
    const onBpmResetB = () => bpmEstimatorBRef.current?.reset();
    audioARef.current.addEventListener('playing', onBpmPlayingA);
    audioARef.current.addEventListener('pause', onBpmStopA);
    audioARef.current.addEventListener('ended', onBpmStopA);
    audioARef.current.addEventListener('loadstart', onBpmResetA);
    audioBRef.current.addEventListener('playing', onBpmPlayingB);
    audioBRef.current.addEventListener('pause', onBpmStopB);
    audioBRef.current.addEventListener('ended', onBpmStopB);
    audioBRef.current.addEventListener('loadstart', onBpmResetB);

    return () => {
      if (crossfadeIntervalRef.current) { clearTimeout(crossfadeIntervalRef.current); crossfadeIntervalRef.current = null; }
      crossfadingRef.current = false;
      [audioARef.current, audioBRef.current].forEach((a) => { if (!a) return; a.pause(); a.removeEventListener('timeupdate', onTime); a.removeEventListener('loadedmetadata', onDur); a.removeEventListener('ended', onEnd); a.removeEventListener('play', onPlay); a.removeEventListener('pause', onPause); a.removeEventListener('waiting', onWaiting); a.removeEventListener('playing', onPlaying); });
      audioARef.current?.removeEventListener('playing', onBpmPlayingA);
      audioARef.current?.removeEventListener('pause', onBpmStopA);
      audioARef.current?.removeEventListener('ended', onBpmStopA);
      audioARef.current?.removeEventListener('loadstart', onBpmResetA);
      audioBRef.current?.removeEventListener('playing', onBpmPlayingB);
      audioBRef.current?.removeEventListener('pause', onBpmStopB);
      audioBRef.current?.removeEventListener('ended', onBpmStopB);
      audioBRef.current?.removeEventListener('loadstart', onBpmResetB);
      bpmEstimatorARef.current?.stop();
      bpmEstimatorBRef.current?.stop();
      preAnalysisEstimatorRef.current?.stop();
      try { preAnalysisAudioRef.current?.pause(); } catch {}
      clearMediaSession();
      delete (window as any).__juxBackgroundTick;
    };
  }, []);

  useEffect(() => { const a = getActive(); if (a) a.volume = volume; }, [volume]);
  useEffect(() => { [audioARef.current, audioBRef.current].forEach((a) => { if (a) a.playbackRate = playbackRate; }); }, [playbackRate]);

  // AutoMix — pré-analyse silencieuse du morceau suivant dès qu'on sait lequel
  // c'est (même logique de calcul du "suivant" que triggerCrossfadeRef), pour
  // avoir un BPM fiable bien avant le moment réel de la transition.
  useEffect(() => {
    const audio = preAnalysisAudioRef.current;
    const estimator = preAnalysisEstimatorRef.current;
    if (!audio || !estimator || transitionMode !== 'autoMix') {
      estimator?.stop();
      return;
    }
    if (queue.length === 0) return;
    let nextIdx = queueIndex + 1;
    if (nextIdx >= queue.length) {
      if (repeatMode === 'all') nextIdx = 0;
      else { estimator.stop(); return; }
    }
    const nextSong = queue[nextIdx];
    if (!nextSong || preAnalysisSongIdRef.current === nextSong.id) return;
    preAnalysisSongIdRef.current = nextSong.id;
    estimator.stop();
    estimator.reset();
    audio.src = songAudioUrl(nextSong);
    audio.currentTime = 0;
    audio.play().then(() => estimator.start()).catch(() => {});
  }, [transitionMode, queue, queueIndex, repeatMode]);

  // Android bridge — métadonnées complètes (titre/auteur/cover/durée/état). Déclenche
  // côté natif un rebuild complet de la notification système (image, MediaSession,
  // actions...) : ne DOIT PAS dépendre de `currentTime`, qui change ~4x/sec via
  // timeupdate — sinon la notification est reconstruite en boucle et ça sature le
  // Binder/CPU du téléphone au point de faire saccader l'audio (voir l'effet suivant
  // pour la position, mise à jour séparément à fréquence réduite et sans rebuild).
  useEffect(() => {
    if (!currentSong) { clearNowPlayingOnNative(); return; }
    const coverUrl = resolveCoverUrl(songCoverUrl(currentSong));
    sendNowPlayingToNative({ songId: currentSong.id, title: currentSong.title || 'Sans titre', author: currentSong.author || 'Inconnu', coverUrl, duration, currentTime: getActive()?.currentTime ?? 0, isPlaying, playbackRate, volume, repeatMode, isShuffled });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSong, isPlaying, duration, playbackRate, volume, repeatMode, isShuffled]);

  // Android bridge — position de lecture seule, throttlée à 1x/sec, sans passer par
  // React state (`currentTime` re-render ~4x/sec) : lit directement l'élément audio actif.
  useEffect(() => {
    if (!currentSong) return;
    const tick = () => { const a = getActive(); sendPlaybackPositionToNative(a?.currentTime ?? 0, isPlaying); };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [currentSong, isPlaying]);

  useEffect(() => {
    const unsubscribe = onNativeCommand((event: NativeCommandEvent) => {
      switch (event.command) {
        case 'play': getActive()?.play().catch(console.error); break;
        case 'pause': getActive()?.pause(); break;
        case 'togglePlay': case 'play_pause': togglePlayRef.current(); break;
        case 'next': nextRef.current(); break;
        case 'previous': case 'prev': previousRef.current(); break;
        case 'seek': if (event.seekTime != null) seekRef.current(event.seekTime); break;
        case 'stop': stopAudioRef.current(); break;
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => { setMediaSessionMetadata(currentSong); }, [currentSong]);
  useEffect(() => { setMediaSessionPlaybackState(currentSong ? (isPlaying ? 'playing' : 'paused') : 'none'); }, [isPlaying, currentSong]);

  // ── Auto-download musique (toute plateforme native Tauri) ──────────────────
  useEffect(() => {
    if (!currentSong || offline) return;
    // Déclencher le téléchargement automatique
    (async () => {
      try {
        const platform = await getPlatform();
        // 'slow' = latence élevée mais connecté ; seul 'unstable' doit bloquer le téléchargement
        const isOnline = connectionStatus !== 'unstable';
        await triggerAutoDownload(currentSong, platform, isOnline, songAudioUrl, songCoverUrl);
      } catch (err) {
        console.error('[PlayerContext] Auto-download failed', err);
      }
    })();
  }, [currentSong, offline, connectionStatus]);

  // ── Égaliseur ─────────────────────────────────────────────────────────────
  const setEqPreset = useCallback((id: string) => {
    const preset = EQ_PRESETS.find((p) => p.id === id);
    if (!preset) return;
    setCurrentEqPreset(id);
    localStorage.setItem(EQ_STORAGE_KEY, id);
    const filters = eqFiltersRef.current;
    if (filters.length === 0) return;
    preset.gains.forEach((gain, i) => {
      if (filters[i]) filters[i].gain.setTargetAtTime(gain, audioCtxRef.current?.currentTime ?? 0, 0.05);
    });
  }, []);

  // ── Sleep timer ───────────────────────────────────────────────────────────
  const setSleepTimer = useCallback((minutes: number | null) => {
    setSleepTimerMinutes(minutes);
    sleepTimerEndRef.current = minutes !== null && minutes > 0
      ? Date.now() + minutes * 60 * 1000
      : null;
    setSleepTimerRemaining(minutes !== null && minutes > 0 ? minutes * 60 : null);
  }, []);

  // Countdown du sleep timer (tick toutes les secondes)
  useEffect(() => {
    if (sleepTimerMinutes === null) { setSleepTimerRemaining(null); return; }
    // Mode "fin du morceau" : -1
    if (sleepTimerMinutes === -1) return;
    const interval = setInterval(() => {
      const end = sleepTimerEndRef.current;
      if (!end) { setSleepTimerRemaining(null); return; }
      const remaining = Math.max(0, Math.round((end - Date.now()) / 1000));
      setSleepTimerRemaining(remaining);
      if (remaining <= 0) {
        [audioARef.current, audioBRef.current].forEach((a) => { if (a) try { a.pause(); } catch {} });
        setSleepTimerMinutes(null);
        sleepTimerEndRef.current = null;
        setSleepTimerRemaining(null);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [sleepTimerMinutes]);

  // Mode "fin du morceau" : arrêt quand la chanson se termine
  useEffect(() => {
    if (sleepTimerMinutes !== -1) return;
    if (!isPlaying && currentTime > 0 && duration > 0 && currentTime >= duration - 0.5) {
      [audioARef.current, audioBRef.current].forEach((a) => { if (a) try { a.pause(); } catch {} });
      setSleepTimerMinutes(null);
    }
  }, [sleepTimerMinutes, isPlaying, currentTime, duration]);

  // Discord Rich Presence — uniquement dans l'app Electron
  const discordStartRef = useRef<number | null>(null);
  const discordSongIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!currentSong) {
      discordStartRef.current = null;
      discordSongIdRef.current = null;
      clearDiscordPresence();
      return;
    }
    // Un nouveau morceau démarre toujours à la position 0 — on ne se fie pas
    // à `currentTime`, qui peut encore contenir la position de l'ancien
    // morceau au moment où cet effet se déclenche (mise à jour asynchrone).
    const isNewSong = discordSongIdRef.current !== currentSong.id;
    discordSongIdRef.current = currentSong.id;
    if (isPlaying) {
      discordStartRef.current = isNewSong ? Date.now() : Date.now() - currentTime * 1000;
    } else {
      discordStartRef.current = null;
    }
    updateDiscordPresence({
      title: currentSong.title || 'Sans titre',
      author: currentSong.author || 'Artiste inconnu',
      coverUrl: songCoverUrl(currentSong) || undefined,
      isPlaying,
      startTimestamp: discordStartRef.current ?? undefined,
      durationSecs: duration > 0 ? duration : undefined,
    });
  // `duration` DOIT être une dépendance : elle arrive de façon asynchrone
  // (loadedmetadata, après le changement de currentSong) — sans ça, Discord
  // recevait la durée de l'ANCIEN morceau (ou aucune) et ne la corrigeait
  // jamais, donc la barre de progression restait fausse toute la lecture.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSong?.id, isPlaying, duration]);

  useEffect(() => {
    if (!currentSong) { applyAccentHsl(null); return; }
    let cancelled = false;
    extractDominantHsl(songCoverUrl(currentSong)).then((hsl) => { if (!cancelled) applyAccentHsl(hsl); });
    return () => { cancelled = true; };
  }, [currentSong]);

  useEffect(() => { setMediaSessionHandlers({ play: () => getActive()?.play(), pause: () => getActive()?.pause(), next: () => next(), previous: () => previous(), seek: (t) => seek(t) }); }, [queue, queueIndex, repeatMode, isShuffled]);
  useEffect(() => { setMediaSessionPosition(duration, currentTime, playbackRate); }, [duration, currentTime, playbackRate]);

  const setCrossfadeSeconds = useCallback((s: number) => {
    const v = s <= 0 ? 0 : Math.max(1, Math.min(12, s));
    setCrossfadeSecondsState(v);
    localStorage.setItem(CROSSFADE_KEY, String(v));
    crossfadeSecondsRef.current = v;
  }, []);

  const setTransitionMode = useCallback((mode: TransitionMode) => {
    setTransitionModeState(mode);
    localStorage.setItem(TRANSITION_MODE_KEY, mode);
    transitionModeRef.current = mode;
  }, []);

  // PocketBase helpers
  const pbGetFirst = async (collection: string, filter: string) => {
    try {
      const result = await pb.collection(collection).getList(1, 1, { filter, requestKey: null });
      return result.items[0] || null;
    } catch { return null; }
  };

  const refreshSongStats = useCallback(async (songId: string) => {
    try {
      const record = await pbGetFirst('songs', `id = "${songId}"`);
      if (record) {
        const data = { play_count: record.play_count ?? 0, likes_count: record.likes_count ?? 0 };
        setCurrentSong((cur) => cur?.id === songId ? { ...cur, ...data } : cur);
        setQueue((q) => q.map((s) => s.id === songId ? { ...s, ...data } : s));
      }
    } catch {}
  }, []);

  // Increment play counts via PocketBase
  const incrementPlayCount = useCallback(async (songId: string) => {
    try {
      const record = await pbGetFirst('songs', `id = "${songId}"`);
      if (record) {
        const current = record.play_count ?? 0;
        await pb.collection('songs').update(record.id, { play_count: current + 1 });
        setCurrentSong((cur) => cur?.id === songId ? { ...cur, play_count: current + 1 } : cur);
        setQueue((q) => q.map((s) => s.id === songId ? { ...s, play_count: current + 1 } : s));
      }
    } catch (e) { console.error('incrementPlayCount', e); }
  }, []);

  const incrementWeeklyPlayCount = useCallback(async (songId: string) => {
    try {
      const record = await pbGetFirst('songs', `id = "${songId}"`);
      if (record) {
        const current = record.weekly_play_count ?? 0;
        await pb.collection('songs').update(record.id, { weekly_play_count: current + 1 });
        setCurrentSong((cur) => cur?.id === songId ? { ...cur, weekly_play_count: current + 1 } : cur);
        setQueue((q) => q.map((s) => s.id === songId ? { ...s, weekly_play_count: current + 1 } : s));
      }
    } catch (e) { console.error('incrementWeeklyPlayCount', e); }
  }, []);

  const incrementTrendingScore = useCallback(async (songId: string) => {
    try {
      const existing = await pbGetFirst('trending_songs', `song_id = "${songId}"`);
      if (existing) {
        await pb.collection('trending_songs').update(existing.id, { score: (existing.score ?? 0) + 1 });
      } else {
        await pb.collection('trending_songs').create({ song_id: songId, score: 1 });
      }
    } catch (e) { console.error('incrementTrendingScore', e); }
  }, []);

  const countedWeeklyRef = useRef<Set<string>>(new Set());
  const countedTrendingRef = useRef<Set<string>>(new Set());
  const weeklyListenStartRef = useRef<Map<string, number>>(new Map());
  const pauseTimeoutRef = useRef<number | null>(null);

  const recordPlay = useCallback((song: Song) => {
    // Historique local (fonctionne aussi hors ligne / sans compte)
    recordLocalListen(song.id);
    if (!authUser) return;
    if (pauseTimeoutRef.current) { clearTimeout(pauseTimeoutRef.current); pauseTimeoutRef.current = null; }

    // Hors connexion : on met l'écoute en file locale — elle sera poussée au
    // serveur (historique + play_count) à la reconnexion.
    if (offlineRef.current) {
      queueOfflinePlay(song.id);
      return;
    }

    // Record listen history
    pb.collection('listen_history').create({ user_id: authUser.id, song_id: song.id, listened_at: new Date().toISOString() }).catch(() => {});

    // Auto-téléchargement : chaque son écouté descend en cache local (audio +
    // cover + métadonnées) pour rester écoutable en mode hors connexion.
    if (!song.id.startsWith('local_')) ensureCachedForPlayback(song);

    recordListen(authUser.id);
    updatePresence({ userId: authUser.id, isListening: true, songId: song.id, songTitle: song.title, songAuthor: song.author, songCoverUrl: songCoverUrl(song) });

    incrementPlayCount(song.id);
    weeklyListenStartRef.current.set(song.id, 0);
    countedWeeklyRef.current.delete(song.id);
    countedTrendingRef.current.delete(song.id);
  }, [authUser, incrementPlayCount]);

  useEffect(() => { recordPlayRef.current = recordPlay; }, [recordPlay]);

  // Weekly play count + trending score after 30s
  useEffect(() => {
    if (!currentSong || !authUser) return;
    const songId = currentSong.id;
    const prev = weeklyListenStartRef.current.get(songId) ?? 0;
    const reached = Math.max(prev, currentTime);
    weeklyListenStartRef.current.set(songId, reached);
    if (reached >= 30) {
      if (!countedWeeklyRef.current.has(songId)) {
        countedWeeklyRef.current.add(songId);
        incrementWeeklyPlayCount(songId);
      }
      if (!countedTrendingRef.current.has(songId)) {
        countedTrendingRef.current.add(songId);
        incrementTrendingScore(songId);
      }
    }
  }, [currentTime, currentSong, authUser, incrementWeeklyPlayCount, incrementTrendingScore]);

  const stopAudio = useCallback(() => {
    [audioARef.current, audioBRef.current].forEach((a) => { if (!a) return; try { a.pause(); a.currentTime = 0; } catch {} });
    setIsPlaying(false);
    if (authUser) clearPresence(authUser.id);
  }, [authUser]);

  const loadAndPlay = useCallback(async (song: Song, autoPlay = true) => {
    setIsBuffering(true);
    if (crossfadeIntervalRef.current) { clearTimeout(crossfadeIntervalRef.current); crossfadeIntervalRef.current = null; }
    crossfadingRef.current = false;
    const inactive = getInactive();
    if (inactive) { try { inactive.pause(); inactive.volume = 0; inactive.removeAttribute('src'); inactive.load(); } catch {} }
    const a = getActive();
    if (!a) return;
    const cachedSrc = await songAudioUrlWithCache(song);
    const serverSrc = songAudioUrl(song);
    a.src = cachedSrc;
    a.volume = volume;
    const applyRate = () => { a.playbackRate = playbackRate; };
    applyRate();
    a.addEventListener('loadedmetadata', applyRate, { once: true });
    a.addEventListener('playing', applyRate, { once: true });
    if (cachedSrc !== serverSrc && serverSrc) {
      const onCachedError = () => {
        console.error('[Player] Cached audio failed to load, falling back to server URL');
        a.src = serverSrc;
        a.load();
        if (autoPlay) { a.play().catch((e) => console.error('Fallback audio play failed', e)); }
      };
      a.addEventListener('error', onCachedError, { once: true });
    }
    if (!autoPlay) { a.load(); return; }
    try { if (audioCtxRef.current?.state === 'suspended') await audioCtxRef.current.resume().catch(() => {}); await a.play(); a.playbackRate = playbackRate; recordPlay(song); } catch (e) { console.error('Audio play failed', e); }
  }, [playbackRate, volume, recordPlay, authUser]);

  const loadAndPlayExternalAudio = useCallback(async (payload: { videoId: string; title: string; author: string; coverUrl: string; audioUrl: string; autoPlay?: boolean }) => {
    if (crossfadeIntervalRef.current) { clearTimeout(crossfadeIntervalRef.current); crossfadeIntervalRef.current = null; }
    crossfadingRef.current = false;
    const inactive = getInactive();
    if (inactive) { try { inactive.pause(); inactive.volume = 0; inactive.removeAttribute('src'); inactive.load(); } catch {} }
    const a = getActive();
    if (!a) return;
    const externalSong: Song = { id: `external:${payload.videoId}`, title: payload.title, author: payload.author, audio_url: '', cover_url: payload.coverUrl ?? null, video_url: payload.videoId ? `external-video:${payload.videoId}` : null, genre: null, uploaded_by: authUser?.id ?? 'external', play_count: 0, weekly_play_count: 0, likes_count: 0, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    setCurrentSong(externalSong); setQueue([externalSong]); setQueueIndex(0);
    a.src = payload.audioUrl; a.volume = volume;
    const applyRate = () => { a.playbackRate = playbackRate; }; applyRate();
    a.addEventListener('loadedmetadata', applyRate, { once: true });
    a.addEventListener('playing', applyRate, { once: true });
    const shouldAutoPlay = payload.autoPlay ?? true;
    if (!shouldAutoPlay) { a.load(); return; }
    try { await a.play(); a.playbackRate = playbackRate; } catch (e) { console.error('External audio play failed', e); }
  }, [playbackRate, volume, authUser]);

  const broadcastSong = useCallback(async (song: Song) => {
    const s = sessionRef.current;
    if (!s || !authUser || s.host_id !== authUser.id) return;
    // Host joue immédiatement et signale is_playing: true — les guests suivent en temps réel
    queueSessionWrite({ song_id: song.id, position: 0, is_playing: true, tempo: playbackRateRef.current });
  }, [authUser, queueSessionWrite]);
  useEffect(() => { broadcastSongRef.current = broadcastSong; }, [broadcastSong]);

  // Ping PocketBase toutes les 3 secondes pour vérifier la qualité de la connexion
  const checkConnectionStatus = useCallback(async () => {
    if (offlineRef.current) { setConnectionStatus('stable'); return; }
    const url = getPbUrl();
    const start = performance.now();
    try {
      const resp = await fetch(`${url}/api/health`, { method: 'HEAD', cache: 'no-store' });
      const elapsed = performance.now() - start;
      if (resp.ok && elapsed < 300) {
        setConnectionStatus('stable');
      } else if (resp.ok) {
        setConnectionStatus('slow');
      } else {
        setConnectionStatus('unstable');
      }
    } catch (e: any) {
      // En cas d'erreur on définit comme instable
      setConnectionStatus('unstable');
    }
  }, []);

  // Intervalle pour mettre à jour le statut de connexion
  useEffect(() => {
    const interval = setInterval(() => {
      checkConnectionStatus();
    }, 6000);
    return () => clearInterval(interval);
  }, [checkConnectionStatus]);

  const playSong = useCallback((song: Song) => {
    if (isSessionGuestRef.current) { notifyGuestBlocked("Seul l'hôte peut changer la musique de la session"); return; }
    if (audioCtxRef.current?.state === 'suspended') audioCtxRef.current.resume().catch(() => {});
    originalQueueRef.current = [song];
    setCurrentSong(song); setQueue([song]); setQueueIndex(0); setPlayedSongIds(new Set([song.id])); setIsPlayerOpen(true);
    checkConnectionStatus();
    loadAndPlay(song);
    if (sessionRef.current && authUser && sessionRef.current.host_id === authUser.id) broadcastSong(song);
    // Auto-queue likes
    if (authUser) {
      (async () => {
        try {
          const likeRecords = await pb.collection('song_likes').getList(1, 1, { filter: `user_id = "${authUser.id}" && song_id = "${song.id}"`, requestKey: null });
          if (likeRecords.items.length === 0) return;
          const allLikes = await pb.collection('song_likes').getList(1, 200, { filter: `user_id = "${authUser.id}"`, requestKey: null });
          const otherIds = allLikes.items.map((l: any) => l.song_id).filter((id: string) => id !== song.id);
          if (otherIds.length === 0) return;
          // Fetch songs by batches
          const songs: Song[] = [];
          for (let i = 0; i < otherIds.length; i += 50) {
            const batch = otherIds.slice(i, i + 50);
            const filters = batch.map((id: string) => `id = "${id}"`).join(' || ');
            const res = await pb.collection('songs').getList(1, 50, { filter: filters, requestKey: null });
            songs.push(...res.items.map(recordToSong));
          }
          setQueue((q) => {
            if (q.length !== 1 || q[0].id !== song.id) return q;
            const newQueue = [song, ...songs];
            originalQueueRef.current = newQueue;
            if (isShuffledRef.current) {
              const shuffled = [...songs];
              for (let i = shuffled.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]; }
              return [song, ...shuffled];
            }
            return newQueue;
          });
        } catch {}
      })();
    }
  }, [loadAndPlay, authUser, broadcastSong]);

  const playSongFromList = useCallback((song: Song, list: Song[]) => {
    if (isSessionGuestRef.current) { notifyGuestBlocked("Seul l'hôte peut changer la musique de la session"); return; }
    if (audioCtxRef.current?.state === 'suspended') audioCtxRef.current.resume().catch(() => {});
    const idx = Math.max(0, list.findIndex((s) => s.id === song.id));
    originalQueueRef.current = [...list];
    setQueue(list); setQueueIndex(idx); setCurrentSong(song); setPlayedSongIds(new Set([song.id])); setIsPlayerOpen(true);
    checkConnectionStatus();
    loadAndPlay(song);
    if (sessionRef.current && authUser && sessionRef.current.host_id === authUser.id) broadcastSong(song);
  }, [loadAndPlay, authUser, broadcastSong, checkConnectionStatus]);

  const togglePlay = useCallback(() => {
    const a = getActive();
    if (!a || !currentSong) return;
    if (isSessionGuestRef.current) { notifyGuestBlocked("Seul l'hôte peut contrôler la lecture"); return; }
    // Resume AudioContext on user gesture (browser autoplay policy)
    if (audioCtxRef.current?.state === 'suspended') audioCtxRef.current.resume().catch(() => {});
    const shouldPlay = a.paused;
    if (shouldPlay) {
      a.play().catch(console.error);
      if (authUser) updatePresence({ userId: authUser.id, isListening: true, songId: currentSong.id, songTitle: currentSong.title, songAuthor: currentSong.author, songCoverUrl: songCoverUrl(currentSong) });
    } else { a.pause(); if (authUser) clearPresence(authUser.id); }
    const s = sessionRef.current;
    if (s && authUser && s.host_id === authUser.id) {
      queueSessionWrite({ is_playing: shouldPlay, position: a.currentTime });
    }
  }, [currentSong, authUser, queueSessionWrite]);

  const findRecommendedSongs = useCallback(async (baseSong: Song): Promise<Song[]> => {
    try {
      const result = await pb.collection('songs').getList(1, 500, { sort: '-play_count', requestKey: null });
      const all = result.items.map(recordToSong);
      const queueIds = new Set(queue.map((s) => s.id));
      const filtered = all.filter((s) => !playedSongIds.has(s.id) && !queueIds.has(s.id) && s.id !== baseSong.id);
      const sameGenre = filtered.filter((s) => s.genre && s.genre === baseSong.genre).sort((a, b) => (b.play_count ?? 0) - (a.play_count ?? 0));
      if (sameGenre.length > 0) return sameGenre.slice(0, 20);
      return filtered.sort((a, b) => (b.play_count ?? 0) - (a.play_count ?? 0)).slice(0, 20);
    } catch { return []; }
  }, [playedSongIds, queue]);

  const playAtIndex = useCallback((idx: number) => {
    if (idx < 0 || idx >= queue.length) return;
    const song = queue[idx];
    setQueueIndex(idx); setCurrentSong(song); setPlayedSongIds((prev) => new Set([...prev, song.id]));
    loadAndPlay(song);
    if (sessionRef.current && authUser && sessionRef.current.host_id === authUser.id) broadcastSong(song);
  }, [queue, loadAndPlay, authUser, broadcastSong]);

  const next = useCallback(() => {
    if (queue.length === 0) return;
    if (repeatMode === 'one') { playAtIndex(queueIndex); return; }
    const nextIdx = queueIndex + 1;
    if (nextIdx >= queue.length) {
      if (repeatMode === 'all') { playAtIndex(0); return; }
      if (currentSong) {
        findRecommendedSongs(currentSong).then((rec) => {
          if (rec.length > 0) {
            const song = rec[0]; const len = queue.length;
            originalQueueRef.current = [...originalQueueRef.current, ...rec];
            setCurrentSong(song); setQueue((q) => [...q, ...(isShuffledRef.current ? rec.slice().sort(() => Math.random() - 0.5) : rec)]); setQueueIndex(len);
            setPlayedSongIds((p) => new Set([...p, song.id])); loadAndPlay(song);
            if (sessionRef.current && authUser && sessionRef.current.host_id === authUser.id) broadcastSong(song);
          } else getActive()?.pause();
        });
      } else getActive()?.pause();
    } else playAtIndex(nextIdx);
  }, [queue, queueIndex, repeatMode, playAtIndex, currentSong, findRecommendedSongs, loadAndPlay, authUser, broadcastSong]);

  const previous = useCallback(() => {
    const a = getActive();
    if (a && a.currentTime > 3) { a.currentTime = 0; return; }
    const prevIdx = queueIndex - 1;
    if (prevIdx >= 0) playAtIndex(prevIdx);
  }, [queueIndex, playAtIndex]);

  const seek = useCallback((t: number) => {
    if (isSessionGuestRef.current) { notifyGuestBlocked("Seul l'hôte peut se déplacer dans la musique de la session"); return; }
    const a = getActive(); if (a) a.currentTime = t;
    const s = sessionRef.current;
    if (s && authUser && s.host_id === authUser.id) queueSessionWrite({ position: t });
  }, [authUser, queueSessionWrite, notifyGuestBlocked]);

  const setVolume = useCallback((v: number) => setVolumeState(Math.max(0, Math.min(1, v))), []);
  const toggleShuffle = useCallback(() => {
    setIsShuffled((prev) => {
      const newShuffled = !prev;
      if (newShuffled) {
        const currentQueue = queueRef.current;
        const currentIdx = queueIndexRef.current;
        originalQueueRef.current = [...currentQueue];
        const played = currentQueue.slice(0, currentIdx + 1);
        const remaining = currentQueue.slice(currentIdx + 1);
        for (let i = remaining.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [remaining[i], remaining[j]] = [remaining[j], remaining[i]];
        }
        setQueue([...played, ...remaining]);
      } else {
        const original = originalQueueRef.current;
        const cs = currentSongRef.current;
        if (original.length > 0 && cs) {
          const newIdx = original.findIndex((s) => s.id === cs.id);
          setQueue(original);
          if (newIdx >= 0) setQueueIndex(newIdx);
        }
        originalQueueRef.current = [];
      }
      return newShuffled;
    });
  }, []);
  const cycleRepeat = useCallback(() => setRepeatMode((m) => m === 'off' ? 'all' : m === 'all' ? 'one' : 'off'), []);
  const openPlayer = useCallback(() => setIsPlayerOpen(true), []);
  const closePlayer = useCallback(() => setIsPlayerOpen(false), []);
  const setPlaybackRate = useCallback((r: number) => {
    if (isSessionGuestRef.current) { notifyGuestBlocked("Seul l'hôte peut changer le tempo de la session"); return; }
    const v = Math.max(0.5, Math.min(2, r));
    setPlaybackRateState(v);
    const s = sessionRef.current;
    if (s && userRef.current && s.host_id === userRef.current.id) queueSessionWrite({ tempo: v });
  }, [queueSessionWrite]);
  const addToQueue = useCallback((song: Song) => {
    setQueue((q) => [...q, song]);
    if (originalQueueRef.current.length > 0) originalQueueRef.current = [...originalQueueRef.current, song];
  }, []);

  useEffect(() => { nextRef.current = next; }, [next]);
  useEffect(() => { previousRef.current = previous; }, [previous]);
  useEffect(() => { togglePlayRef.current = togglePlay; }, [togglePlay]);
  useEffect(() => { seekRef.current = seek; }, [seek]);
  useEffect(() => { stopAudioRef.current = stopAudio; }, [stopAudio]);

  const startRadio = useCallback(async (seed: Song) => {
    const rec = await findRecommendedSongs(seed);
    const list = [seed, ...rec];
    originalQueueRef.current = [...list];
    setQueue(list); setQueueIndex(0); setCurrentSong(seed); setPlayedSongIds(new Set([seed.id])); loadAndPlay(seed);
  }, [findRecommendedSongs, loadAndPlay]);

  // Session management with PocketBase
  const refreshSession = useCallback(async () => {
    if (!authUser) { setActiveSessionState(null); return; }
    try {
      const hosted = await pbGetFirst('listen_sessions', `host_id = "${authUser.id}" && is_active = true`);
      if (hosted) { setActiveSessionState(hosted as unknown as ListenSessionRow); return; }
      // For joined sessions, fetch enough results to find the one containing this user
      const joinedRes = await pb.collection('listen_sessions').getList(1, 20, { filter: `is_active = true`, requestKey: null });
      const joined = joinedRes.items.find((r: any) => {
        const participants = r.participants as string[] || [];
        return participants.includes(authUser.id);
      });
      setActiveSessionState((joined as unknown as ListenSessionRow) ?? null);
    } catch {}
  }, [authUser]);

  useEffect(() => { refreshSession(); }, [refreshSession]);

  // Polling fallback pour détecter les nouvelles sessions (rejoindre, etc.)
  useEffect(() => {
    if (!authUser) return;
    const interval = setInterval(() => { refreshSession(); }, 2000);
    return () => clearInterval(interval);
  }, [authUser, refreshSession]);

  // Souscription temps-réel à la session active — remplace le polling pour la sync
  useEffect(() => {
    const s = activeSession;
    if (!s || !authUser) return;
    let unsubscribe: (() => void) | undefined;
    (async () => {
      try {
        unsubscribe = await pb.collection('listen_sessions').subscribe(s.id, (e) => {
          if (e.action !== 'update') return;
          const r = e.record as any;
          if (!r.is_active) {
            if (getStoredPermanentSessionId() === r.id) setStoredPermanentSessionId(null);
            setActiveSessionState(null);
            return;
          }
          setActiveSessionState({
            id: r.id,
            code: r.code ?? null,
            host_id: r.host_id,
            song_id: r.song_id ?? null,
            is_playing: r.is_playing,
            position: r.position ?? 0,
            tempo: r.tempo || 1,
            participants: r.participants ?? [],
            is_active: r.is_active,
            is_open: r.is_open ?? false,
          });
        });
      } catch (err) {
        console.warn('Session subscribe failed, polling only', err);
      }
    })();
    return () => { if (unsubscribe) unsubscribe(); };
  }, [activeSession?.id, authUser]);

  // Guest: load session song
  const lastLoadedSessionSongRef = useRef<string | null>(null);
  // ID du titre réellement chargé dans l'élément audio du guest — tant qu'il ne correspond pas
  // au song_id de la session, les effets play/pause et drift ne doivent PAS toucher l'audio
  const guestLoadedSongIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!isSessionGuest || !activeSession || !authUser) return;
    if (!activeSession.song_id) return;
    if (lastLoadedSessionSongRef.current === activeSession.song_id) return;
    lastLoadedSessionSongRef.current = activeSession.song_id;
    guestLoadedSongIdRef.current = null;
    (async () => {
      try {
        const record = await pbGetFirst('songs', `id = "${activeSession.song_id}"`);
        if (!record) return;
        const song = recordToSong(record);
        sessionGuestRecordedRef.current = null; setCurrentSong(song); setQueue([song]); setQueueIndex(0);
        const a = getActive(); a.src = songAudioUrl(song); a.volume = volume;
        // audio.load() réinitialise playbackRate à 1 dans certains navigateurs — on doit
        // donc le réappliquer après, pas seulement avant (même piège que loadAndPlay).
        const applyRate = () => { a.playbackRate = playbackRateRef.current; };
        applyRate();
        a.addEventListener('loadedmetadata', applyRate, { once: true });
        a.addEventListener('playing', applyRate, { once: true });
        a.load();
        guestLoadedSongIdRef.current = song.id;
        const onCanPlay = () => {
          a.removeEventListener('canplay', onCanPlay);
          applyRate();
          const cur = sessionRef.current;
          if (!cur) return;
          // Le titre de la session a changé pendant le chargement : ne rien faire
          if (cur.song_id !== song.id) return;
          // Si la session joue déjà, démarrer immédiatement au bon timestamp
          if (cur.is_playing && a.paused) {
            if (audioCtxRef.current?.state === 'suspended') audioCtxRef.current.resume().catch(() => {});
            const drift = Math.abs(a.currentTime - (cur.position ?? 0));
            if (drift > 0.5) a.currentTime = cur.position ?? 0;
            a.play().then(() => {
              applyRate();
              if (sessionGuestRecordedRef.current !== song.id) {
                sessionGuestRecordedRef.current = song.id;
                recordPlayRef.current(song);
              }
            }).catch(console.error);
          }
        };
        a.addEventListener('canplay', onCanPlay);
      } catch {}
    })();
  }, [isSessionGuest, activeSession?.song_id, authUser, volume]);

  // Guest sync play/pause — déclenché uniquement par is_playing, pas par position
  // Évite les seeks parasites toutes les 1s causés par la latence réseau
  useEffect(() => {
    if (!isSessionGuest || !activeSession) return;
    const a = getActive();
    if (!a || !a.src) return;
    // Titre en cours de chargement ou différent de celui de la session : c'est le callback
    // canplay du chargement qui démarrera la lecture, pas cet effet
    if (activeSession.song_id && guestLoadedSongIdRef.current !== activeSession.song_id) return;

    if (activeSession.is_playing) {
      if (a.paused && a.readyState >= 2) {
        // Résumer AudioContext si suspendu (politique autoplay navigateur/mobile)
        if (audioCtxRef.current?.state === 'suspended') audioCtxRef.current.resume().catch(() => {});
        // Sync le temps uniquement au moment du démarrage
        const drift = Math.abs(a.currentTime - activeSession.position);
        if (drift > 0.5) a.currentTime = activeSession.position;
        a.play()
          .then(() => {
            if (currentSong && sessionGuestRecordedRef.current !== currentSong.id) {
              sessionGuestRecordedRef.current = currentSong.id;
              recordPlay(currentSong);
            }
          })
          .catch(console.error);
      }
    } else {
      if (!a.paused) a.pause();
    }
  }, [isSessionGuest, activeSession?.is_playing, currentSong, recordPlay]);

  // Guest drift correction + stall recovery — déclenché toutes les 3s par le host sync
  // NE PAS mettre position dans les deps du sync play/pause pour éviter
  // le seek toutes les 1s qui cause pause + jump
  useEffect(() => {
    if (!isSessionGuest || !activeSession) return;
    const a = getActive();
    if (!a || !a.src) return;
    const cur = sessionRef.current;
    if (!cur) return;
    // La position reçue appartient forcément au titre de la session : si notre audio
    // charge encore un autre titre, ne surtout pas l'appliquer
    if (cur.song_id && guestLoadedSongIdRef.current !== cur.song_id) return;
    if (a.readyState < 2) return;

    if (cur.is_playing && a.paused) {
      // Stall recovery : audio mis en pause par le navigateur (appel, tab switch, buffer)
      // ou terminé trop tôt, alors que la session est censée jouer le même titre
      if (audioCtxRef.current?.state === 'suspended') audioCtxRef.current.resume().catch(() => {});
      const drift = Math.abs(a.currentTime - cur.position);
      if (drift > 0.5) a.currentTime = cur.position;
      a.play().catch(console.error);
    } else if (!a.paused) {
      // Correction des gros décalages seulement (évite seeks parasites)
      const drift = Math.abs(a.currentTime - cur.position);
      if (drift > 8) a.currentTime = cur.position;
    }
  }, [isSessionGuest, activeSession?.position]);

  // Guest: suivre le tempo défini par l'hôte (l'effet existant sur playbackRate
  // l'applique ensuite aux deux éléments audio)
  useEffect(() => {
    if (!isSessionGuest || !activeSession) return;
    const t = activeSession.tempo || 1;
    setPlaybackRateState((prev) => (Math.abs(prev - t) > 0.001 ? Math.max(0.5, Math.min(2, t)) : prev));
  }, [isSessionGuest, activeSession?.tempo]);

  // Host sync time — toutes les 3s, sert uniquement à la correction de drift guest (seuil 8s)
  // Le play/pause se propage via subscribe temps-réel immédiatement
  // IMPORTANT: ne pas inclure 'activeSession' (objet) dans les deps — le polling le recrée toutes les 2s
  // ce qui réinitialiserait l'intervalle avant qu'il se déclenche. On lit sessionRef.current à la place.
  useEffect(() => {
    if (!isSessionHost || !activeSession) return;
    const interval = setInterval(() => {
      const a = getActive();
      if (!a || !sessionRef.current) return;
      // Pendant un crossfade, l'élément actif est l'ANCIEN titre quasi terminé : sa position
      // ne doit jamais être écrite (elle téléportait les invités à la fin du nouveau titre).
      if (crossfadingRef.current) return;
      // Audio en cours de chargement ou de seek : ne rien écrire. Pendant cette fenêtre
      // a.paused est true alors que l'hôte n'a PAS mis pause — écrire is_playing: false ici
      // mettait tous les invités en pause définitivement juste après le lancement d'un titre.
      if (!a.src || a.readyState < 2 || a.seeking) return;
      const updates: any = { position: a.currentTime };
      // Pause réelle de l'hôte uniquement (currentTime > 0 exclut la fenêtre post-chargement)
      if (a.paused && !a.ended && a.currentTime > 0 && sessionRef.current.is_playing) updates.is_playing = false;
      // Auto-réparation : si l'hôte joue mais que la session dit pause, on corrige —
      // tout is_playing: false parasite est annulé en 3s max et les invités reprennent
      if (!a.paused && !sessionRef.current.is_playing) updates.is_playing = true;
      queueSessionWrite(updates);
    }, 3000);
    return () => clearInterval(interval);
  }, [isSessionHost, activeSession?.id, queueSessionWrite]);

  // Host autoplay removed — host plays immediately via loadAndPlay, broadcastSong signals is_playing: true

  const playExternalAudio = useCallback((payload: { videoId: string; title: string; author: string; coverUrl: string; audioUrl: string }) => {
    if (!payload?.audioUrl) return;
    if (isSessionGuestRef.current) { notifyGuestBlocked("Seul l'hôte peut changer la musique de la session"); return; }
    loadAndPlayExternalAudio({ ...payload, autoPlay: true });
  }, [loadAndPlayExternalAudio]);

  return (
    <PlayerContext.Provider value={{
      currentSong, isPlaying, currentTime, duration, volume, queue, queueIndex, isShuffled, repeatMode, isPlayerOpen, playbackRate, crossfadeSeconds, transitionMode,
      activeSession, isSessionHost, isSessionGuest, connectionStatus, isBuffering, refreshSession, setActiveSession, stopAudio, refreshSongStats,
      permanentSessionEnabled, setPermanentSessionEnabled, joinSession,
      playSong, playSongFromList, playExternalAudio, togglePlay, next, previous, seek, setVolume, toggleShuffle, cycleRepeat,
      openPlayer, closePlayer, setPlaybackRate, setCrossfadeSeconds, setTransitionMode, addToQueue, startRadio, signalVideoReady,
      getAnalyserNode: () => analyserRef.current,
      currentEqPreset, setEqPreset,
      sleepTimerMinutes, sleepTimerRemaining, setSleepTimer,
    }}>
      {children}
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error('usePlayer must be used within PlayerProvider');
  return ctx;
}