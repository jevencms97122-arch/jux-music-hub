import { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { pb } from '@/lib/pocketbase';
import { useAuth } from '@/contexts/AuthContext';
import { usePlayer } from '@/contexts/PlayerContext';
import { songCoverUrl, songAudioUrl } from '@/lib/storage';
import { ArrowLeft, Play, Pause, ImagePlus, Trash2, Camera } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import StoryLayoutEditor from '@/components/StoryLayoutEditor';
import {
  DEFAULT_MUSIC_LAYOUT,
  LAYOUT_FIELD,
  serializeStoryLayout,
  type MusicLayout,
} from '@/lib/storyLayout';

/** Durée min/max d'un extrait de story — modifiable par l'utilisateur entre les deux. */
const MIN_CLIP_SECONDS = 5;
const MAX_CLIP_SECONDS = 30;
const DEFAULT_CLIP_SECONDS = 15;

/** Au-delà, PocketBase refuse l'upload et l'utilisateur n'aurait qu'une erreur serveur opaque. */
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

/**
 * Page dédiée de composition d'une story. Elle remplace l'ancienne feuille du bas,
 * trop à l'étroit : l'aperçu 9:16 a besoin de hauteur, et sur desktop les réglages
 * s'étalaient sur toute la largeur de l'écran.
 */
export default function CreateStory() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { currentSong, duration } = usePlayer();

  const [comment, setComment] = useState('');
  const [startTime, setStartTime] = useState(0);
  const [clipLength, setClipLength] = useState(DEFAULT_CLIP_SECONDS);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const [previewProgress, setPreviewProgress] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [musicLayout, setMusicLayout] = useState<MusicLayout>({ ...DEFAULT_MUSIC_LAYOUT });

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const rangeRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const objectUrlRef = useRef<string | null>(null);
  const rafRef = useRef<number>(0);

  const endTime = Math.min(startTime + clipLength, duration);

  // Refs pour éviter les closures périmées dans les handlers de drag
  const startTimeRef = useRef(startTime);
  const endTimeRef = useRef(endTime);
  const clipLengthRef = useRef(clipLength);

  useEffect(() => { startTimeRef.current = startTime; }, [startTime]);
  useEffect(() => { endTimeRef.current = endTime; }, [endTime]);
  useEffect(() => { clipLengthRef.current = clipLength; }, [clipLength]);

  // Sans morceau en cours il n'y a rien à composer : on renvoie l'utilisateur d'où il vient.
  useEffect(() => {
    if (!currentSong) {
      toast.error('Lance un morceau pour créer une story');
      navigate(-1);
    }
  }, [currentSong, navigate]);

  // Cale l'extrait par défaut dès que la durée du morceau est connue.
  useEffect(() => {
    if (!duration) return;
    setClipLength((l) => Math.max(MIN_CLIP_SECONDS, Math.min(l || DEFAULT_CLIP_SECONDS, duration)));
  }, [duration]);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const setImage = (file: File | null) => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    setImageFile(file);
    if (!file) { setImageUrl(null); return; }
    const url = URL.createObjectURL(file);
    objectUrlRef.current = url;
    setImageUrl(url);
  };

  const handleImagePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Réinitialise l'input pour que re-choisir le même fichier redéclenche l'événement
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Choisis un fichier image'); return; }
    if (file.size > MAX_IMAGE_BYTES) { toast.error('Image trop lourde (8 Mo max)'); return; }
    setImage(file);
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const getClientX = (e: MouseEvent | TouchEvent): number =>
    'touches' in e ? e.touches[0].clientX : e.clientX;

  /** Fabrique un handler de drag sur la piste : `apply` reçoit le delta en secondes. */
  const makeTrackDrag = (apply: (deltaSeconds: number) => void) =>
    (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const rect = rangeRef.current?.getBoundingClientRect();
      if (!rect || duration <= 0) return;

      const pointerStartX = getClientX(e.nativeEvent as MouseEvent | TouchEvent);
      setDragging(true);

      const onMove = (ev: MouseEvent | TouchEvent) => {
        apply(((getClientX(ev) - pointerStartX) / rect.width) * duration);
      };
      const onUp = () => {
        setDragging(false);
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        document.removeEventListener('touchmove', onMove);
        document.removeEventListener('touchend', onUp);
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
      document.addEventListener('touchmove', onMove, { passive: false });
      document.addEventListener('touchend', onUp);
    };

  // Glisse toute la fenêtre le long de la piste, comme le sélecteur de musique d'Instagram —
  // la durée de l'extrait reste fixe, seule sa position change.
  const handleWindowDrag = (e: React.MouseEvent | React.TouchEvent) => {
    const from = startTimeRef.current;
    makeTrackDrag((delta) => {
      const maxStart = Math.max(0, duration - clipLengthRef.current);
      setStartTime(Math.max(0, Math.min(from + delta, maxStart)));
    })(e);
  };

  // Poignée gauche : déplace le début, l'autre bord reste fixe — la durée est donc
  // recalculée en direct, entre MIN_CLIP_SECONDS et MAX_CLIP_SECONDS.
  const handleLeftHandleDrag = (e: React.MouseEvent | React.TouchEvent) => {
    const fixedEnd = endTimeRef.current;
    const from = startTimeRef.current;
    makeTrackDrag((delta) => {
      const clampedStart = Math.max(0, Math.min(from + delta, fixedEnd - MIN_CLIP_SECONDS));
      const newLength = Math.max(MIN_CLIP_SECONDS, Math.min(MAX_CLIP_SECONDS, fixedEnd - clampedStart));
      setStartTime(fixedEnd - newLength);
      setClipLength(newLength);
    })(e);
  };

  // Poignée droite : déplace la fin, le début reste fixe.
  const handleRightHandleDrag = (e: React.MouseEvent | React.TouchEvent) => {
    const fixedStart = startTimeRef.current;
    const from = endTimeRef.current;
    makeTrackDrag((delta) => {
      const clampedEnd = Math.min(duration, Math.max(from + delta, fixedStart + MIN_CLIP_SECONDS));
      setClipLength(Math.max(MIN_CLIP_SECONDS, Math.min(MAX_CLIP_SECONDS, clampedEnd - fixedStart)));
    })(e);
  };

  const togglePreview = useCallback(() => {
    if (isPreviewPlaying) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      cancelAnimationFrame(rafRef.current);
      setIsPreviewPlaying(false);
      setPreviewProgress(0);
      return;
    }

    if (!currentSong) return;
    const audioUrl = songAudioUrl(currentSong);
    if (!audioUrl) { toast.error("Impossible de lire l'aperçu"); return; }

    const audio = new Audio(audioUrl);
    audio.currentTime = startTimeRef.current;
    audioRef.current = audio;

    audio.play().then(() => {
      setIsPreviewPlaying(true);
      const updateProgress = () => {
        if (audioRef.current) {
          const current = audioRef.current.currentTime;
          setPreviewProgress(current);
          if (current >= endTimeRef.current) {
            audioRef.current.pause();
            audioRef.current = null;
            setIsPreviewPlaying(false);
            setPreviewProgress(0);
            cancelAnimationFrame(rafRef.current);
            return;
          }
        }
        rafRef.current = requestAnimationFrame(updateProgress);
      };
      rafRef.current = requestAnimationFrame(updateProgress);
    }).catch(() => {
      toast.error("Impossible de lire l'aperçu");
    });
  }, [currentSong, isPreviewPlaying]);

  const handleSubmit = async () => {
    if (!user || !currentSong) return;
    setIsSubmitting(true);
    try {
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      // FormData plutôt qu'un objet : c'est le seul moyen de joindre le fichier image.
      const formData = new FormData();
      formData.append('user_id', user.id);
      formData.append('song_id', currentSong.id);
      if (comment) formData.append('comment', comment);
      formData.append('start_time', String(Math.round(startTime)));
      formData.append('end_time', String(Math.round(endTime)));
      formData.append('expires_at', expiresAt);
      formData.append(LAYOUT_FIELD, serializeStoryLayout(musicLayout));
      if (imageFile) formData.append('image', imageFile);

      await pb.collection('stories').create(formData);
      toast.success('Story publiée !');
      navigate(-1);
    } catch (err: any) {
      toast.error(err?.message || 'Erreur lors de la création de la story');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!currentSong) return null;

  const startPercent = duration > 0 ? (startTime / duration) * 100 : 0;
  const endPercent = duration > 0 ? (endTime / duration) * 100 : 100;
  const coverUrl = songCoverUrl(currentSong);
  const hasCover = coverUrl && coverUrl !== '/placeholder.svg';

  return (
    <div className="min-h-screen bg-background pb-safe">
      {/* Barre d'action : le bouton Publier reste atteignable sans scroller */}
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border/40 bg-background/80 px-4 py-3 backdrop-blur-xl">
        <button
          onClick={() => navigate(-1)}
          aria-label="Retour"
          className="rounded-xl p-2 text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="flex-1 text-base font-bold">Nouvelle story</h1>
        <button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="flex items-center gap-2 rounded-xl bg-gradient-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-elegant-sm transition-transform active:scale-95 disabled:opacity-50"
        >
          {isSubmitting ? (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
          ) : (
            <Camera className="h-4 w-4" />
          )}
          Publier
        </button>
      </header>

      {/* Aperçu à gauche, réglages à droite ; empilés sur mobile */}
      <div className="mx-auto grid max-w-5xl gap-8 px-4 py-6 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] lg:items-start lg:gap-10">
        <div className="lg:sticky lg:top-20">
          <StoryLayoutEditor
            imageUrl={imageUrl}
            coverUrl={coverUrl}
            title={currentSong.title}
            author={currentSong.author}
            layout={musicLayout}
            onChange={setMusicLayout}
            heightCss="min(60vh, 520px)"
          />
        </div>

        <div className="space-y-7">
          {/* Morceau + image de fond */}
          <div className="space-y-3">
            <div className="flex items-center gap-3 rounded-2xl bg-card p-3">
              <div className="h-14 w-14 flex-shrink-0 overflow-hidden rounded-xl bg-muted">
                {hasCover && (
                  <img src={coverUrl} alt={currentSong.title} className="h-full w-full object-cover" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{currentSong.title}</p>
                <p className="truncate text-sm text-muted-foreground">{currentSong.author}</p>
              </div>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImagePick}
            />
            <div className="flex items-center gap-2">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-white/[0.06] py-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-white/[0.10] hover:text-foreground"
              >
                <ImagePlus className="h-4 w-4" />
                {imageFile ? "Changer l'image de fond" : 'Ajouter une image de fond'}
              </button>
              {imageFile && (
                <button
                  onClick={() => setImage(null)}
                  aria-label="Retirer l'image"
                  className="rounded-xl bg-white/[0.06] p-3 text-muted-foreground transition-colors hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {/* Sélecteur d'extrait */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Sélectionne l'extrait</span>
              <span className="text-xs font-medium text-muted-foreground">
                {formatTime(startTime)} — {formatTime(endTime)} ({Math.round(clipLength)}s)
              </span>
            </div>

            <div ref={rangeRef} className="relative h-14 w-full select-none overflow-hidden rounded-xl bg-muted touch-none">
              {/* Fond track — fausse waveform pour repère visuel */}
              <div className="absolute inset-0 flex items-center justify-between gap-[2px] px-2 opacity-40">
                {Array.from({ length: 40 }).map((_, i) => (
                  <span
                    key={i}
                    className="w-full rounded-full bg-muted-foreground/50"
                    style={{ height: `${20 + ((i * 37) % 60)}%` }}
                  />
                ))}
              </div>

              {/* Curseur preview */}
              {isPreviewPlaying && (
                <div
                  className="pointer-events-none absolute bottom-0 top-0 z-20 w-0.5 bg-white/90"
                  style={{ left: `${duration > 0 ? (previewProgress / duration) * 100 : 0}%` }}
                />
              )}

              {/* Fenêtre d'extrait — glisser au centre déplace l'extrait, les poignées aux
                  bords redimensionnent (entre MIN_CLIP_SECONDS et MAX_CLIP_SECONDS) */}
              <div
                className={cn(
                  'absolute bottom-0 top-0 z-10 rounded-lg border-2 border-primary bg-primary/15 shadow-lg',
                  dragging && 'ring-2 ring-primary/40'
                )}
                style={{ left: `${startPercent}%`, width: `${endPercent - startPercent}%` }}
              >
                <div
                  className="absolute inset-y-0 left-0 right-0 flex cursor-grab items-center justify-center active:cursor-grabbing"
                  onMouseDown={handleWindowDrag}
                  onTouchStart={handleWindowDrag}
                >
                  <div className="pointer-events-none flex items-center gap-1 rounded-full bg-primary/90 px-1.5 py-2.5">
                    <span className="h-3 w-0.5 rounded-full bg-primary-foreground/90" />
                    <span className="h-3 w-0.5 rounded-full bg-primary-foreground/90" />
                  </div>
                </div>

                {/* Poignée de redimensionnement gauche */}
                <div
                  className="absolute inset-y-0 -left-2 z-20 flex w-6 cursor-ew-resize items-center justify-center touch-none"
                  onMouseDown={handleLeftHandleDrag}
                  onTouchStart={handleLeftHandleDrag}
                >
                  <div className="h-8 w-1.5 rounded-full bg-primary shadow" />
                </div>
                {/* Poignée de redimensionnement droite */}
                <div
                  className="absolute inset-y-0 -right-2 z-20 flex w-6 cursor-ew-resize items-center justify-center touch-none"
                  onMouseDown={handleRightHandleDrag}
                  onTouchStart={handleRightHandleDrag}
                >
                  <div className="h-8 w-1.5 rounded-full bg-primary shadow" />
                </div>
              </div>
            </div>

            {/* Marqueurs de temps */}
            <div className="flex justify-between text-[10px] text-muted-foreground/60">
              <span>0:00</span>
              <span>{formatTime(duration / 2)}</span>
              <span>{formatTime(duration)}</span>
            </div>

            <button
              onClick={togglePreview}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-white/[0.06] py-3 transition-colors hover:bg-white/[0.10]"
            >
              {isPreviewPlaying ? (
                <>
                  <Pause className="h-4 w-4" />
                  <span className="text-sm font-medium">Arrêter l'aperçu</span>
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" />
                  <span className="text-sm font-medium">Aperçu de l'extrait</span>
                </>
              )}
            </button>
          </div>

          {/* Commentaire */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Commentaire (optionnel)</label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Quelque chose à dire sur cet extrait ?"
              maxLength={200}
              rows={3}
              className="w-full resize-none rounded-xl border border-border bg-muted px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <p className="text-right text-[10px] text-muted-foreground/60">{comment.length}/200</p>
          </div>
        </div>
      </div>
    </div>
  );
}
