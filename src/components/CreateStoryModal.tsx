import { useState, useRef, useCallback, useEffect } from 'react';
import { pb } from '@/lib/pocketbase';
import { useAuth } from '@/contexts/AuthContext';
import { songCoverUrl, songAudioUrl } from '@/lib/storage';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Play, Pause, Camera } from 'lucide-react';
import { usePlayer } from '@/contexts/PlayerContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Durée min/max d'un extrait de story — modifiable par l'utilisateur entre les deux. */
const MIN_CLIP_SECONDS = 5;
const MAX_CLIP_SECONDS = 30;
const DEFAULT_CLIP_SECONDS = 15;

export default function CreateStoryModal({ open, onOpenChange }: Props) {
  const { user } = useAuth();
  const { currentSong, duration } = usePlayer();
  const [comment, setComment] = useState('');
  const [startTime, setStartTime] = useState(0);
  const [clipLength, setClipLength] = useState(DEFAULT_CLIP_SECONDS);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const [previewProgress, setPreviewProgress] = useState(0);
  const [dragging, setDragging] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const rangeRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);

  const endTime = Math.min(startTime + clipLength, duration);

  // Refs pour éviter les closures périmées dans les handlers de drag
  const startTimeRef = useRef(startTime);
  const endTimeRef = useRef(endTime);
  const clipLengthRef = useRef(clipLength);

  useEffect(() => { startTimeRef.current = startTime; }, [startTime]);
  useEffect(() => { endTimeRef.current = endTime; }, [endTime]);
  useEffect(() => { clipLengthRef.current = clipLength; }, [clipLength]);

  useEffect(() => {
    if (open) {
      setStartTime(0);
      setClipLength(Math.max(MIN_CLIP_SECONDS, Math.min(DEFAULT_CLIP_SECONDS, duration || DEFAULT_CLIP_SECONDS)));
      setComment('');
      setPreviewProgress(0);
      setIsPreviewPlaying(false);
    }
  }, [open, duration]);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const getClientX = (e: MouseEvent | TouchEvent): number =>
    'touches' in e ? e.touches[0].clientX : e.clientX;

  // Glisse toute la fenêtre le long de la piste, comme le sélecteur de musique d'Instagram —
  // la durée de l'extrait reste fixe, seule sa position change.
  const handleWindowDrag = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = rangeRef.current?.getBoundingClientRect();
    if (!rect || duration <= 0) return;

    const pointerStartX = getClientX(e.nativeEvent as MouseEvent | TouchEvent);
    const timeAtPointerStart = startTimeRef.current;
    setDragging(true);

    const onMove = (ev: MouseEvent | TouchEvent) => {
      const deltaX = getClientX(ev) - pointerStartX;
      const deltaTime = (deltaX / rect.width) * duration;
      const maxStart = Math.max(0, duration - clipLengthRef.current);
      setStartTime(Math.max(0, Math.min(timeAtPointerStart + deltaTime, maxStart)));
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

  // Poignée gauche : déplace le début de l'extrait, l'autre bord reste fixe — la durée
  // (clipLength) est donc recalculée en direct, entre MIN_CLIP_SECONDS et MAX_CLIP_SECONDS.
  const handleLeftHandleDrag = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = rangeRef.current?.getBoundingClientRect();
    if (!rect || duration <= 0) return;

    const pointerStartX = getClientX(e.nativeEvent as MouseEvent | TouchEvent);
    const fixedEnd = endTimeRef.current;
    const timeAtPointerStart = startTimeRef.current;
    setDragging(true);

    const onMove = (ev: MouseEvent | TouchEvent) => {
      const deltaX = getClientX(ev) - pointerStartX;
      const deltaTime = (deltaX / rect.width) * duration;
      const rawStart = timeAtPointerStart + deltaTime;
      const clampedStart = Math.max(0, Math.min(rawStart, fixedEnd - MIN_CLIP_SECONDS));
      const newLength = Math.max(MIN_CLIP_SECONDS, Math.min(MAX_CLIP_SECONDS, fixedEnd - clampedStart));
      setStartTime(fixedEnd - newLength);
      setClipLength(newLength);
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

  // Poignée droite : déplace la fin de l'extrait, le début reste fixe.
  const handleRightHandleDrag = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = rangeRef.current?.getBoundingClientRect();
    if (!rect || duration <= 0) return;

    const pointerStartX = getClientX(e.nativeEvent as MouseEvent | TouchEvent);
    const fixedStart = startTimeRef.current;
    const timeAtPointerStart = endTimeRef.current;
    setDragging(true);

    const onMove = (ev: MouseEvent | TouchEvent) => {
      const deltaX = getClientX(ev) - pointerStartX;
      const deltaTime = (deltaX / rect.width) * duration;
      const rawEnd = timeAtPointerStart + deltaTime;
      const clampedEnd = Math.min(duration, Math.max(rawEnd, fixedStart + MIN_CLIP_SECONDS));
      const newLength = Math.max(MIN_CLIP_SECONDS, Math.min(MAX_CLIP_SECONDS, clampedEnd - fixedStart));
      setClipLength(newLength);
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
      await pb.collection('stories').create({
        user_id: user.id,
        song_id: currentSong.id,
        comment: comment || null,
        start_time: Math.round(startTime),
        end_time: Math.round(endTime),
        expires_at: expiresAt,
      });
      toast.success('Story publiée !');
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.message || 'Erreur lors de la création de la story');
    } finally {
      setIsSubmitting(false);
    }
  };

  const startPercent = duration > 0 ? (startTime / duration) * 100 : 0;
  const endPercent = duration > 0 ? (endTime / duration) * 100 : 100;
  const coverUrl = currentSong ? songCoverUrl(currentSong) : null;

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!isSubmitting) onOpenChange(v); }}>
      <SheetContent side="bottom" className="rounded-t-3xl pb-safe">
        <SheetHeader className="mb-6">
          <SheetTitle>Créer une story musicale</SheetTitle>
        </SheetHeader>

        {currentSong && (
          <div className="space-y-6">
            {/* Song info */}
            <div className="flex items-center gap-3 rounded-2xl bg-card p-3">
              <div className="h-14 w-14 rounded-xl overflow-hidden bg-muted flex-shrink-0">
                {coverUrl && coverUrl !== '/placeholder.svg' && (
                  <img src={coverUrl} alt={currentSong.title} className="h-full w-full object-cover" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold truncate">{currentSong.title}</p>
                <p className="text-sm text-muted-foreground truncate">{currentSong.author}</p>
              </div>
            </div>

            {/* Timeline range selector */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Sélectionne l'extrait</span>
                <span className="text-xs font-medium text-muted-foreground">
                  {formatTime(startTime)} — {formatTime(endTime)} ({Math.round(clipLength)}s)
                </span>
              </div>

              <div ref={rangeRef} className="relative h-14 w-full rounded-xl bg-muted overflow-hidden select-none touch-none">
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
                    className="absolute top-0 bottom-0 w-0.5 bg-white/90 z-20 pointer-events-none"
                    style={{ left: `${duration > 0 ? (previewProgress / duration) * 100 : 0}%` }}
                  />
                )}

                {/* Fenêtre d'extrait — glisser au centre déplace l'extrait, les poignées aux
                    bords redimensionnent (entre MIN_CLIP_SECONDS et MAX_CLIP_SECONDS) */}
                <div
                  className={cn(
                    'absolute top-0 bottom-0 z-10 rounded-lg border-2 border-primary bg-primary/15 shadow-lg',
                    dragging && 'ring-2 ring-primary/40'
                  )}
                  style={{ left: `${startPercent}%`, width: `${endPercent - startPercent}%` }}
                >
                  <div
                    className="absolute inset-y-0 left-0 right-0 flex cursor-grab items-center justify-center active:cursor-grabbing"
                    onMouseDown={handleWindowDrag}
                    onTouchStart={handleWindowDrag}
                  >
                    <div className="flex items-center gap-1 rounded-full bg-primary/90 px-1.5 py-2.5 pointer-events-none">
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

              {/* Bouton aperçu */}
              <button
                onClick={togglePreview}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.10] py-3 transition-colors"
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
                className="w-full rounded-xl border border-border bg-muted px-4 py-3 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <p className="text-right text-[10px] text-muted-foreground/60">{comment.length}/200</p>
            </div>

            {/* Publier */}
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-primary text-primary-foreground py-3.5 font-semibold text-base active:scale-95 transition-transform disabled:opacity-50"
            >
              {isSubmitting ? (
                <div className="h-5 w-5 rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground animate-spin" />
              ) : (
                <>
                  <Camera className="h-5 w-5" />
                  Publier la story
                </>
              )}
            </button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
