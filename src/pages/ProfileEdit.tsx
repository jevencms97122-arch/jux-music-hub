import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { avatarUrl, songAudioUrl, songCoverUrl } from '@/lib/storage';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Camera, User, Check, Pin, Play, Pause, Search, X, Film } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { pb } from '@/lib/pocketbase';
import type { Song } from '@/types/music';
import { useBannerMediaMode } from '@/hooks/useBannerMediaMode';
import BannerConfigSheet from '@/components/BannerConfigSheet';

const fmtTime = (s: number) => s < 60 ? `${s}s` : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

interface Props { onBack: () => void }

export default function ProfileEdit({ onBack }: Props) {
  const { authUser, profile, updateProfile } = useAuth();
  const { toast } = useToast();
  const [pseudo, setPseudo] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [bio, setBio] = useState('');
  const [bannerVideoUrl, setBannerVideoUrl] = useState('');
  const [bannerSheetOpen, setBannerSheetOpen] = useState(false);
  const { mode: bannerMode, onVideoError: onBannerVideoError, onImageError: onBannerImageError } = useBannerMediaMode(bannerVideoUrl);
  const [avatar, setAvatar] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Pinned track state
  const [userSongs, setUserSongs] = useState<Song[]>([]);
  const [songSearch, setSongSearch] = useState('');
  const [pinnedSong, setPinnedSong] = useState<Song | null>(null);
  const [pinnedStart, setPinnedStart] = useState(0);
  const [pinnedEnd, setPinnedEnd] = useState(20);
  const [clipDuration, setClipDuration] = useState(0);
  const [previewPlaying, setPreviewPlaying] = useState(false);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const previewRafRef = useRef<number>(0);
  const [previewProgress, setPreviewProgress] = useState(0);

  useEffect(() => {
    if (!profile) return;
    setPseudo(profile.pseudo ?? '');
    setFirstName(profile.first_name ?? '');
    setLastName(profile.last_name ?? '');
    setBio(profile.bio ?? '');
    setBannerVideoUrl(profile.banner_video_url ?? '');
  }, [profile]);

  // Load user songs + existing pinned
  useEffect(() => {
    if (!authUser) return;
    pb.collection('songs').getList(1, 200, { filter: `uploaded_by = "${authUser.id}"`, sort: '-created', requestKey: null })
      .then((res) => {
        const songs: Song[] = res.items.map((r: any) => ({
          id: r.id, title: r.title || '', author: r.author || '', audio: r.audio || '',
          cover: r.cover || null, audio_url: r.audio_url || '',
          cover_url: r.cover_url || null, video_url: r.video_url || null, genre: r.genre || null,
          uploaded_by: r.uploaded_by || '', duration: r.duration || 0, play_count: r.play_count ?? 0,
          weekly_play_count: r.weekly_play_count ?? 0, likes_count: r.likes_count ?? 0,
          created_at: r.created, updated_at: r.updated,
          collectionId: r.collectionId, collectionName: r.collectionName,
        }));
        setUserSongs(songs);
        if (profile?.pinned_song_id) {
          const existing = songs.find((s) => s.id === profile.pinned_song_id);
          if (existing) {
            setPinnedSong(existing);
            const s = profile.pinned_start ?? 0;
            const e = profile.pinned_end ?? Math.min(20, existing.duration || 20);
            setPinnedStart(s);
            setPinnedEnd(e);
          }
        }
      }).catch(() => {});
  }, [authUser, profile]);

  // Load clip duration when pinned song changes
  useEffect(() => {
    if (!pinnedSong) { setClipDuration(0); return; }
    const url = songAudioUrl(pinnedSong);
    const a = new Audio(url);
    a.addEventListener('loadedmetadata', () => {
      const dur = Math.floor(a.duration);
      setClipDuration(dur);
      setPinnedStart((s) => Math.min(s, Math.max(0, dur - 1)));
      setPinnedEnd((e) => Math.min(e, dur));
    });
    a.load();
  }, [pinnedSong]);

  const stopPreview = useCallback(() => {
    if (previewAudioRef.current) previewAudioRef.current.pause();
    cancelAnimationFrame(previewRafRef.current);
    setPreviewPlaying(false);
    setPreviewProgress(0);
  }, []);

  const togglePreview = useCallback(() => {
    if (!pinnedSong) return;
    if (previewPlaying) { stopPreview(); return; }
    if (!previewAudioRef.current) previewAudioRef.current = new Audio();
    const a = previewAudioRef.current;
    const url = songAudioUrl(pinnedSong);
    if (a.src !== url) a.src = url;
    a.currentTime = pinnedStart;
    const dur = pinnedEnd - pinnedStart;
    const tick = () => {
      const elapsed = a.currentTime - pinnedStart;
      if (elapsed >= dur || a.currentTime >= pinnedEnd) { stopPreview(); return; }
      setPreviewProgress(elapsed / dur);
      previewRafRef.current = requestAnimationFrame(tick);
    };
    a.play().then(() => { setPreviewPlaying(true); previewRafRef.current = requestAnimationFrame(tick); }).catch(() => {});
  }, [pinnedSong, pinnedStart, pinnedEnd, previewPlaying, stopPreview]);

  // Stop preview when range changes
  useEffect(() => { stopPreview(); }, [pinnedStart, pinnedEnd, stopPreview]);

  useEffect(() => () => { stopPreview(); }, [stopPreview]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatar(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authUser || !profile) return;
    setSubmitting(true);
    try {
      await updateProfile(
        {
          pseudo: pseudo.trim(),
          first_name: firstName.trim() || null,
          last_name: lastName.trim() || null,
          bio: bio.trim() || null,
          banner_video_url: bannerVideoUrl.trim() || null,
        },
        avatar ?? undefined,
      );
      // Save pinned track separately (extra fields not in updateProfile)
      await pb.collection('profiles').update(profile.id, {
        pinned_song_id: pinnedSong?.id ?? null,
        pinned_start: pinnedSong ? pinnedStart : null,
      });
      toast({ title: 'Profil mis à jour' });
      onBack();
    } catch (err: any) {
      toast({ title: 'Erreur', description: err.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const displayAvatar = avatarPreview ?? (profile ? avatarUrl(profile) : '');

  return (
    <div className="relative min-h-screen pb-32">
      {/* Header */}
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-white/[0.06] bg-background/80 px-4 py-3 backdrop-blur-xl">
        <button
          onClick={onBack}
          className="flex items-center gap-2 rounded-xl p-2 text-muted-foreground hover:text-foreground hover:bg-white/5"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-sm font-semibold text-foreground">Modifier le profil</h1>
        <button
          form="profile-form"
          type="submit"
          disabled={submitting || !pseudo.trim()}
          className={cn(
            'flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-semibold',
            'bg-gradient-primary text-primary-foreground shadow-elegant-sm',
            'hover:shadow-glow active:scale-[0.97] transition-[box-shadow,transform] duration-150',
            'disabled:opacity-40 disabled:cursor-not-allowed'
          )}
        >
          {submitting ? (
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          ) : (
            <Check className="h-3.5 w-3.5" />
          )}
          Sauver
        </button>
      </header>

      <form id="profile-form" onSubmit={handleSubmit} className="px-4 py-6 space-y-6">
        {/* Avatar picker */}
        <div className="flex flex-col items-center gap-3">
          <div className="relative">
            <Avatar className="h-24 w-24 ring-2 ring-white/10">
              <AvatarImage src={displayAvatar} />
              <AvatarFallback className="bg-muted text-2xl">
                <User className="h-10 w-10 text-muted-foreground" />
              </AvatarFallback>
            </Avatar>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-gradient-primary shadow-elegant ring-2 ring-background"
            >
              <Camera className="h-3.5 w-3.5 text-primary-foreground" />
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="text-xs font-medium text-primary hover:text-primary/80"
          >
            Changer la photo
          </button>
        </div>

        {/* Fields */}
        <div className="space-y-4">
          <Field label="Pseudo" required>
            <Input
              value={pseudo}
              onChange={(e) => setPseudo(e.target.value)}
              placeholder="ton_pseudo"
              required
              className="h-11 border-white/10 bg-white/[0.05] text-foreground placeholder:text-muted-foreground/40 focus:border-primary/50"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Prénom">
              <Input
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Prénom"
                className="h-11 border-white/10 bg-white/[0.05] text-foreground placeholder:text-muted-foreground/40 focus:border-primary/50"
              />
            </Field>
            <Field label="Nom">
              <Input
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Nom"
                className="h-11 border-white/10 bg-white/[0.05] text-foreground placeholder:text-muted-foreground/40 focus:border-primary/50"
              />
            </Field>
          </div>

          <Field label="Bio" hint={`${bio.length}/200`}>
            <Textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Dis quelque chose sur toi…"
              maxLength={200}
              rows={3}
              className="resize-none border-white/10 bg-white/[0.05] text-foreground placeholder:text-muted-foreground/40 focus:border-primary/50"
            />
          </Field>

          {/* Bannière de profil */}
          <div className="space-y-2 pt-1">
            <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <Film className="h-3.5 w-3.5 text-primary" />
              Bannière de profil
            </label>

            {bannerVideoUrl && (
              <div className="relative h-28 w-full overflow-hidden rounded-xl bg-black/40 ring-1 ring-white/10">
                {bannerMode === 'failed' ? (
                  <p className="flex h-full items-center justify-center px-4 text-center text-xs text-destructive">
                    Impossible de charger ce lien
                  </p>
                ) : bannerMode === 'video' ? (
                  <video
                    key={bannerVideoUrl}
                    src={bannerVideoUrl}
                    className="h-full w-full object-cover"
                    autoPlay
                    muted
                    loop
                    playsInline
                    onError={onBannerVideoError}
                  />
                ) : (
                  <img
                    key={bannerVideoUrl}
                    src={bannerVideoUrl}
                    alt=""
                    className="h-full w-full object-cover"
                    onError={onBannerImageError}
                  />
                )}
              </div>
            )}

            <button
              type="button"
              onClick={() => setBannerSheetOpen(true)}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-white/[0.06] py-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-white/[0.10] hover:text-foreground"
            >
              <Film className="h-4 w-4" />
              {bannerVideoUrl ? 'Changer la bannière' : 'Configurer ma bannière'}
            </button>

            <BannerConfigSheet
              open={bannerSheetOpen}
              onOpenChange={setBannerSheetOpen}
              value={bannerVideoUrl}
              onChange={setBannerVideoUrl}
            />
          </div>

          {/* Pinned track */}
          <div className="space-y-3 pt-1">
            <div className="flex items-center gap-2">
              <Pin className="h-3.5 w-3.5 text-primary" />
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Titre épinglé</label>
              {pinnedSong && (
                <button type="button" onClick={() => { setPinnedSong(null); stopPreview(); }}
                  className="ml-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                  <X className="h-3 w-3" />Retirer
                </button>
              )}
            </div>

            {/* Song search */}
            {!pinnedSong && (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  value={songSearch}
                  onChange={(e) => setSongSearch(e.target.value)}
                  placeholder="Chercher parmi tes morceaux…"
                  className="pl-8 h-10 border-white/10 bg-white/[0.05] text-foreground placeholder:text-muted-foreground/40 focus:border-primary/50"
                />
                {songSearch && (
                  <div className="mt-1 rounded-xl border border-white/10 bg-card overflow-hidden max-h-52 overflow-y-auto">
                    {userSongs.filter((s) => s.title.toLowerCase().includes(songSearch.toLowerCase())).map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => { setPinnedSong(s); setSongSearch(''); setPinnedStart(0); setPinnedEnd(Math.min(20, s.duration || 20)); }}
                        className="flex w-full items-center gap-3 px-3 py-2.5 hover:bg-white/[0.06] text-left"
                      >
                        {songCoverUrl(s) && <img src={songCoverUrl(s)} alt="" className="h-9 w-9 rounded-lg object-cover shrink-0" />}
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{s.title}</p>
                          <p className="text-xs text-muted-foreground truncate">{s.author}</p>
                        </div>
                      </button>
                    ))}
                    {userSongs.filter((s) => s.title.toLowerCase().includes(songSearch.toLowerCase())).length === 0 && (
                      <p className="px-3 py-3 text-xs text-muted-foreground">Aucun résultat</p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Range editor */}
            {pinnedSong && clipDuration > 0 && (
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 space-y-4">
                {/* Song preview header */}
                <div className="flex items-center gap-3">
                  {songCoverUrl(pinnedSong) && (
                    <img src={songCoverUrl(pinnedSong)} alt="" className="h-11 w-11 rounded-lg object-cover shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{pinnedSong.title}</p>
                    <p className="text-xs text-muted-foreground">{pinnedSong.author}</p>
                  </div>
                  <button
                    type="button"
                    onClick={togglePreview}
                    className={cn(
                      'flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors',
                      previewPlaying ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {previewPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 translate-x-0.5" />}
                  </button>
                </div>

                {/* Preview progress bar */}
                {previewPlaying && (
                  <div className="h-1 rounded-full bg-white/10 overflow-hidden">
                    <div className="h-full w-full origin-left rounded-full bg-primary transition-transform duration-150 ease-linear" style={{ transform: `scaleX(${previewProgress})` }} />
                  </div>
                )}

                {/* Slider début */}
                <div className="space-y-2">
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>Démarrer à</span>
                    <span>{fmtTime(pinnedStart)}</span>
                  </div>
                  <input
                    type="range" min={0} max={Math.max(0, clipDuration - 1)} step={1}
                    value={pinnedStart}
                    onChange={(e) => setPinnedStart(Number(e.target.value))}
                    className="w-full accent-primary"
                  />
                  <p className="text-[10px] text-center text-muted-foreground">
                    La musique démarrera à {fmtTime(pinnedStart)}
                  </p>
                </div>
              </div>
            )}

            {pinnedSong && clipDuration === 0 && (
              <p className="text-xs text-muted-foreground">Chargement de l'audio…</p>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
          {required && <span className="ml-0.5 text-primary">*</span>}
        </label>
        {hint && <span className="text-[10px] text-muted-foreground/60">{hint}</span>}
      </div>
      {children}
    </div>
  );
}
