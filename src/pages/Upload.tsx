import { useState, useRef, useEffect, useCallback } from 'react';
import { pb } from '@/lib/pocketbase';
import { useAuth } from '@/contexts/AuthContext';
import { useOfflineMode } from '@/contexts/OfflineModeContext';
import { addLocalTrack } from '@/lib/offlineLibrary';
import { useSeo } from '@/lib/useSeo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Upload as UploadIcon, Music2, X, User, ShieldAlert, Play, Pause, FolderOpen, Zap, PenLine, Image as ImageIcon, Search, HardDrive, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { MUSIC_GENRES } from '@/types/music';
import { computeAudioFingerprint } from '@/lib/audioFingerprint';
import { canPublish } from '@/lib/badges';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { CoverSearchModal } from '@/components/CoverSearchModal';

// Déduit un titre lisible à partir du nom de fichier (retire l'extension, remplace _ et - par des espaces).
function titleFromFilename(filename: string): string {
  const withoutExt = filename.replace(/\.[^/.]+$/, '');
  return withoutExt.replace(/[_-]+/g, ' ').trim() || filename;
}

/** SHA-256 du fichier brut — détecte un même fichier réuploadé tel quel (voir
 * aussi computeAudioFingerprint pour détecter une même musique ré-encodée). */
async function computeFileHash(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

interface ArtistEntry {
  name: string;
  isExisting: boolean;
}

export default function Upload() {
  useSeo({ title: 'Upload — Nexora Music', description: 'Partage ta musique avec la communauté Nexora Music.', path: '/upload' });
  const { user, profile } = useAuth();
  const { offline } = useOfflineMode();
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [artists, setArtists] = useState<ArtistEntry[]>([]);
  const [artistInput, setArtistInput] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [genre, setGenre] = useState('');
  const [genreAutoSuggested, setGenreAutoSuggested] = useState(false);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [coverSearchOpen, setCoverSearchOpen] = useState(false);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [offlineMode, setOfflineMode] = useState<'manual' | 'quick'>('manual');
  const [quickProgress, setQuickProgress] = useState<{ done: number; total: number } | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const quickFilesInputRef = useRef<HTMLInputElement>(null);
  const quickFolderInputRef = useRef<HTMLInputElement>(null);

  // Aperçu audio
  const audioPreviewRef = useRef<HTMLAudioElement | null>(null);
  const audioObjectUrlRef = useRef<string | null>(null);
  const [previewPlaying, setPreviewPlaying] = useState(false);
  const [previewTime, setPreviewTime] = useState(0);
  const [previewDuration, setPreviewDuration] = useState(0);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Initialise l'aperçu audio quand le fichier change
  useEffect(() => {
    if (audioObjectUrlRef.current) URL.revokeObjectURL(audioObjectUrlRef.current);
    if (audioPreviewRef.current) {
      audioPreviewRef.current.pause();
      audioPreviewRef.current = null;
    }
    setPreviewPlaying(false);
    setPreviewTime(0);
    setPreviewDuration(0);

    if (!audioFile) return;

    const url = URL.createObjectURL(audioFile);
    audioObjectUrlRef.current = url;
    const audio = new Audio(url);
    audioPreviewRef.current = audio;

    audio.addEventListener('loadedmetadata', () => setPreviewDuration(audio.duration));
    audio.addEventListener('timeupdate', () => setPreviewTime(audio.currentTime));
    audio.addEventListener('ended', () => setPreviewPlaying(false));

    return () => {
      audio.pause();
      URL.revokeObjectURL(url);
    };
  }, [audioFile]);

  // Aperçu de la cover choisie (fichier local ou téléchargée depuis la recherche internet)
  useEffect(() => {
    if (!coverFile) { setCoverPreview(null); return; }
    const url = URL.createObjectURL(coverFile);
    setCoverPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [coverFile]);

  const togglePreview = useCallback(() => {
    const audio = audioPreviewRef.current;
    if (!audio) return;
    if (previewPlaying) {
      audio.pause();
      setPreviewPlaying(false);
    } else {
      audio.play().catch(() => {});
      setPreviewPlaying(true);
    }
  }, [previewPlaying]);

  const seekPreview = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioPreviewRef.current;
    if (!audio || !previewDuration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    audio.currentTime = ratio * previewDuration;
  }, [previewDuration]);

  const handleAudioFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] || null;
    setAudioFile(f);
    if (f && !title.trim()) setTitle(titleFromFilename(f.name));
  };

  const fmtTime = (s: number) => {
    if (!isFinite(s) || s < 0) return '0:00';
    return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  };

  const searchArtists = async (query: string) => {
    if (!query.trim() || query.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    try {
      const results = await pb.collection('songs').getList(1, 30, {
        filter: `author ~ "${query.replace(/"/g, '')}"`,
        fields: 'author',
      });
      const existing = new Set(artists.map(a => a.name.toLowerCase()));
      const names = new Set<string>();
      for (const song of results.items) {
        for (const part of (song.author as string).split(/[,&+]/)) {
          const name = part.trim();
          if (name && name.toLowerCase().includes(query.toLowerCase()) && !existing.has(name.toLowerCase())) {
            names.add(name);
          }
        }
      }
      const list = [...names].slice(0, 6);
      setSuggestions(list);
      setShowSuggestions(list.length > 0);
    } catch {
      setSuggestions([]);
    }
  };

  const handleArtistInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setArtistInput(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchArtists(val), 280);
  };

  // Suggère le genre le plus fréquent du catalogue existant de cet artiste — reste
  // clairement marqué "suggéré automatiquement" tant que l'utilisateur ne l'a pas
  // modifié à la main (voir genreAutoSuggested).
  const suggestGenreForArtist = async (name: string) => {
    try {
      const results = await pb.collection('songs').getList(1, 50, {
        filter: `author ~ "${name.replace(/"/g, '')}"`,
        fields: 'genre',
        requestKey: null,
      });
      const counts = new Map<string, number>();
      for (const r of results.items) {
        const g = (r as any).genre;
        if (g) counts.set(g, (counts.get(g) ?? 0) + 1);
      }
      if (counts.size === 0) return;
      const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
      setGenre((current) => current === '' ? top : current);
      setGenreAutoSuggested(true);
    } catch { /* pas grave, l'utilisateur choisira manuellement */ }
  };

  const addArtist = (name: string, isExisting: boolean) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (artists.some(a => a.name.toLowerCase() === trimmed.toLowerCase())) return;
    setArtists(prev => [...prev, { name: trimmed, isExisting }]);
    setArtistInput('');
    setSuggestions([]);
    setShowSuggestions(false);
    if (isExisting && !genre) suggestGenreForArtist(trimmed);
  };

  const removeArtist = (index: number) => {
    setArtists(prev => prev.filter((_, i) => i !== index));
  };

  // La touche "Entrée" est aussi gérée par le <form onSubmit> qui entoure ce champ
  // (voir plus bas) — c'est ce qui capture fiablement le bouton "Suivant"/"OK" du
  // clavier virtuel mobile, contrairement à onKeyDown seul qui ne se déclenche pas
  // toujours pour cette touche sur clavier tactile (le focus passait alors direct
  // au champ genre en dessous). On garde ici uniquement la virgule et Echap.
  const handleArtistKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === ',' && artistInput.trim()) {
      e.preventDefault();
      addArtist(artistInput, false);
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  const handleArtistFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (artistInput.trim()) addArtist(artistInput, false);
  };

  const submit = async () => {
    if (!title.trim() || artists.length === 0) { toast.error('Titre et au moins un artiste requis'); return; }

    if (offline) {
      if (!audioFile) { toast.error('Ajoute un fichier audio'); return; }
      setUploading(true);
      try {
        await addLocalTrack({
          title: title.trim(),
          author: artists.map(a => a.name).join(', '),
          genre: genre || null,
          audioFile,
          coverFile,
        });
        toast.success('Musique ajoutée à ta bibliothèque locale !');
        navigate('/jux');
      } catch (e: any) {
        toast.error(e.message || 'Erreur ajout local');
      }
      setUploading(false);
      return;
    }

    if (!user) { toast.error('Connecte-toi d\'abord'); return; }
    if (!canPublish(profile?.badge)) { toast.error('Réservé aux membres ayant le rôle Publicateur — demande-le sur le Discord Nexora Music'); return; }
    if (!audioFile) { toast.error('Ajoute un fichier audio'); return; }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('title', title.trim());
      formData.append('author', artists.map(a => a.name).join(', '));
      formData.append('uploaded_by', user.id);
      if (genre) formData.append('genre', genre);
      formData.append('audio', audioFile);
      setAnalyzing(true);
      try {
        const [hash, fingerprint] = await Promise.all([
          computeFileHash(audioFile),
          computeAudioFingerprint(audioFile),
        ]);
        formData.append('file_hash', hash);
        if (fingerprint) formData.append('audio_fingerprint', fingerprint);
      } finally {
        setAnalyzing(false);
      }
      if (coverFile) formData.append('cover', coverFile);
      await pb.collection('songs').create(formData);
      toast.success('Musique uploadée !');
      navigate('/jux');
    } catch (e: any) {
      toast.error(e.message || 'Erreur upload');
    }
    setUploading(false);
  };

  const quickAddFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const mp3Files = Array.from(fileList).filter(f => /\.(mp3|opus)$/i.test(f.name) || f.type === 'audio/mpeg' || f.type === 'audio/opus' || f.type === 'audio/ogg');
    if (mp3Files.length === 0) { toast.error('Aucun fichier mp3 ou opus trouvé'); return; }

    const defaultAuthor = profile?.pseudo || [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || 'Artiste inconnu';
    setUploading(true);
    setQuickProgress({ done: 0, total: mp3Files.length });
    let successCount = 0;
    for (let i = 0; i < mp3Files.length; i++) {
      try {
        await addLocalTrack({
          title: titleFromFilename(mp3Files[i].name),
          author: defaultAuthor,
          genre: null,
          audioFile: mp3Files[i],
        });
        successCount++;
      } catch {
        // on continue avec les fichiers suivants même en cas d'échec
      }
      setQuickProgress({ done: i + 1, total: mp3Files.length });
    }
    setUploading(false);
    setQuickProgress(null);
    if (successCount > 0) {
      toast.success(`${successCount} musique${successCount > 1 ? 's' : ''} ajoutée${successCount > 1 ? 's' : ''} à ta bibliothèque locale !`);
      navigate('/jux');
    } else {
      toast.error('Aucune musique n\'a pu être ajoutée');
    }
  };

  if (!offline && !canPublish(profile?.badge)) {
    return (
      <div className="relative min-h-screen pb-40 p-4">
        <header className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}><ArrowLeft className="h-5 w-5" /></Button>
          <h1 className="text-xl font-bold">Upload</h1>
        </header>
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border/60 bg-card/30 px-6 py-12 text-center">
          <div className="mb-1 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
            <ShieldAlert className="h-6 w-6 text-primary" />
          </div>
          <p className="text-sm font-bold">Publication réservée</p>
          <p className="text-xs text-muted-foreground">Seuls les membres avec le rôle "PDG" ou "Publicateur" peuvent publier des musiques.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen pb-40 p-4">
      <header className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}><ArrowLeft className="h-5 w-5" /></Button>
        <h1 className="text-xl font-bold">Upload</h1>
      </header>

      {offline && (
        <div className="mb-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => { setOfflineMode('manual'); setStep(0); }}
            className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-colors ${offlineMode === 'manual' ? 'border-primary bg-primary/10 text-primary' : 'border-border/50 bg-card/40 text-muted-foreground'}`}
          >
            <PenLine className="h-4 w-4" /> Manuel
          </button>
          <button
            type="button"
            onClick={() => setOfflineMode('quick')}
            className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-colors ${offlineMode === 'quick' ? 'border-primary bg-primary/10 text-primary' : 'border-border/50 bg-card/40 text-muted-foreground'}`}
          >
            <Zap className="h-4 w-4" /> Ajout rapide
          </button>
        </div>
      )}

      {offline && offlineMode === 'quick' ? (
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Le titre est déduit automatiquement du nom du fichier, sans passer par le formulaire. Choisis des fichiers mp3/opus ou un dossier entier.
          </p>

          <input
            ref={quickFilesInputRef}
            type="file"
            accept=".mp3,.opus,audio/mpeg,audio/opus,audio/ogg"
            multiple
            className="hidden"
            onChange={(e) => { quickAddFiles(e.target.files); e.target.value = ''; }}
          />
          <input
            ref={quickFolderInputRef}
            type="file"
            multiple
            className="hidden"
            // @ts-expect-error attribut non typé mais supporté par les navigateurs pour la sélection de dossier
            webkitdirectory="true"
            directory="true"
            onChange={(e) => { quickAddFiles(e.target.files); e.target.value = ''; }}
          />

          <button
            type="button"
            disabled={uploading}
            onClick={() => quickFilesInputRef.current?.click()}
            className="flex w-full flex-col items-center gap-2 rounded-2xl border border-dashed border-border/60 bg-card/30 px-6 py-8 text-center disabled:opacity-50"
          >
            <Music2 className="h-6 w-6 text-primary" />
            <span className="text-sm font-bold">Choisir des fichiers mp3/opus</span>
            <span className="text-xs text-muted-foreground">Un ou plusieurs fichiers, ajoutés instantanément</span>
          </button>

          <button
            type="button"
            disabled={uploading}
            onClick={() => quickFolderInputRef.current?.click()}
            className="flex w-full flex-col items-center gap-2 rounded-2xl border border-dashed border-border/60 bg-card/30 px-6 py-8 text-center disabled:opacity-50"
          >
            <FolderOpen className="h-6 w-6 text-primary" />
            <span className="text-sm font-bold">Choisir un dossier</span>
            <span className="text-xs text-muted-foreground">Tous les mp3/opus du dossier seront ajoutés</span>
          </button>

          {quickProgress && (
            <div className="rounded-xl border border-border/50 bg-card/60 px-4 py-3 text-center text-sm">
              Ajout en cours... {quickProgress.done} / {quickProgress.total}
            </div>
          )}
        </div>
      ) : (
      <div className="space-y-5">
        {/* Indicateur d'étapes */}
        <div className="flex items-center gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${i <= step ? 'bg-primary' : 'bg-secondary'}`} />
          ))}
        </div>

        <div className="overflow-hidden">
          <div
            className="flex transition-transform duration-300 ease-out"
            style={{ width: '300%', transform: `translateX(-${step * (100 / 3)}%)` }}
          >
            {/* ── Étape 1 : fichier audio ── */}
            <div className="w-1/3 shrink-0 pr-2">
              <label className="text-sm font-medium flex items-center gap-2"><Music2 className="h-4 w-4" />Fichier audio *</label>
              <Input type="file" accept="audio/*" onChange={handleAudioFileSelect} className="cursor-pointer" />
              {audioFile && previewDuration > 0 && (
                <div className="mt-2 flex items-center gap-3 rounded-xl border border-border/50 bg-card/60 px-3 py-2">
                  <button type="button" onClick={togglePreview} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    {previewPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5 translate-x-0.5" />}
                  </button>
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <div
                      className="relative h-1.5 w-full cursor-pointer overflow-hidden rounded-full bg-secondary"
                      onClick={seekPreview}
                    >
                      <div
                        className="absolute inset-y-0 left-0 rounded-full bg-primary transition-none"
                        style={{ width: `${previewDuration ? (previewTime / previewDuration) * 100 : 0}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-muted-foreground">
                      <span>{fmtTime(previewTime)}</span>
                      <span>{fmtTime(previewDuration)}</span>
                    </div>
                  </div>
                </div>
              )}
              {!audioFile && (
                <p className="mt-2 text-xs text-muted-foreground">Choisis le fichier audio à publier pour continuer.</p>
              )}
            </div>

            {/* ── Étape 2 : titre / artiste / genre ── */}
            <div className="w-1/3 shrink-0 px-2 space-y-4">
              <div>
                <label className="text-sm font-medium">Titre *</label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Titre de la musique" />
              </div>

              <div>
                <label className="text-sm font-medium">Artiste(s) *</label>

                {artists.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2 mt-1">
                    {artists.map((artist, i) => (
                      <div key={i} className="flex items-center gap-1 bg-secondary rounded-full px-3 py-1 text-sm">
                        <span>{artist.name}</span>
                        {!artist.isExisting && (
                          <span className="text-xs text-muted-foreground ml-0.5">(nouveau)</span>
                        )}
                        <button type="button" onClick={() => removeArtist(i)} className="ml-1 hover:text-destructive">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <form className="relative" ref={wrapperRef} onSubmit={handleArtistFormSubmit}>
                  <Input
                    value={artistInput}
                    onChange={handleArtistInputChange}
                    onKeyDown={handleArtistKeyDown}
                    onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
                    placeholder={artists.length === 0 ? "Nom de l'artiste" : "Ajouter un artiste..."}
                    enterKeyHint="done"
                  />
                  {showSuggestions && suggestions.length > 0 && (
                    <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-background border rounded-md shadow-lg overflow-hidden">
                      {suggestions.map((s) => (
                        <button
                          key={s}
                          type="button"
                          className="w-full text-left px-3 py-2 text-sm hover:bg-secondary flex items-center gap-2"
                          onMouseDown={(e) => { e.preventDefault(); addArtist(s, true); }}
                        >
                          <User className="w-4 h-4 text-muted-foreground" />
                          {s}
                        </button>
                      ))}
                    </div>
                  )}
                </form>
                {artistInput.trim() && !suggestions.some(s => s.toLowerCase() === artistInput.trim().toLowerCase()) && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Appuie sur <kbd className="px-1 bg-muted rounded text-xs">Entrée</kbd> pour ajouter "{artistInput.trim()}" comme nouvel artiste
                  </p>
                )}
              </div>

              <div>
                <label className="text-sm font-medium">Genre</label>
                <select
                  value={genre}
                  onChange={(e) => { setGenre(e.target.value); setGenreAutoSuggested(false); }}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Sélectionner un genre</option>
                  {MUSIC_GENRES.map((g) => (<option key={g} value={g}>{g}</option>))}
                </select>
                {genreAutoSuggested && genre && (
                  <p className="mt-1 flex items-center gap-1 text-xs text-primary">
                    <Sparkles className="h-3 w-3" />
                    Suggéré automatiquement d'après le catalogue de cet artiste — modifie-le si besoin
                  </p>
                )}
              </div>
            </div>

            {/* ── Étape 3 : cover + publication ── */}
            <div className="w-1/3 shrink-0 pl-2">
              <label className="text-sm font-medium flex items-center gap-2"><ImageIcon className="h-4 w-4" />Cover (image)</label>
              <input
                ref={coverInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0] || null; setCoverFile(f); e.target.value = ''; }}
              />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="mt-1 flex w-full items-center gap-3 rounded-xl border border-dashed border-border/60 bg-card/30 px-3 py-2 text-left"
                  >
                    {coverPreview ? (
                      <img src={coverPreview} alt="Cover" className="h-12 w-12 rounded-lg object-cover" />
                    ) : (
                      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-secondary">
                        <ImageIcon className="h-5 w-5 text-muted-foreground" />
                      </div>
                    )}
                    <span className="text-sm font-medium">{coverFile ? 'Changer la cover' : 'Ajouter une cover'}</span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-64">
                  <DropdownMenuItem onClick={() => setCoverSearchOpen(true)}>
                    <Search className="h-4 w-4 mr-2" /> Chercher une image sur internet
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => coverInputRef.current?.click()}>
                    <HardDrive className="h-4 w-4 mr-2" /> Choisir depuis l'appareil
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <CoverSearchModal
                open={coverSearchOpen}
                onOpenChange={setCoverSearchOpen}
                title={title}
                author={artists.map((a) => a.name).join(', ')}
                onSelect={setCoverFile}
              />
            </div>
          </div>
        </div>

        {/* Navigation entre étapes */}
        <div className="flex gap-2">
          {step > 0 && (
            <Button type="button" variant="outline" className="flex-1" onClick={() => setStep((s) => s - 1)}>
              <ArrowLeft className="h-4 w-4 mr-2" /> Précédent
            </Button>
          )}
          {step < 2 ? (
            <Button
              type="button"
              className="flex-1"
              disabled={step === 0 ? !audioFile : !title.trim() || artists.length === 0}
              onClick={() => setStep((s) => s + 1)}
            >
              Suivant <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          ) : (
            <Button className="flex-1" onClick={submit} disabled={uploading}>
              <UploadIcon className="h-4 w-4 mr-2" />
              {analyzing ? "Analyse de l'audio..." : uploading ? 'Upload en cours...' : 'Publier'}
            </Button>
          )}
        </div>
      </div>
      )}
    </div>
  );
}
