import { useState, useRef, useEffect, useCallback } from 'react';
import { pb } from '@/lib/pocketbase';
import { useAuth } from '@/contexts/AuthContext';
import { useOfflineMode } from '@/contexts/OfflineModeContext';
import { addLocalTrack } from '@/lib/offlineLibrary';
import { useSeo } from '@/lib/useSeo';
import { extractYoutubeId } from '@/lib/storage';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Upload as UploadIcon, Music2, Youtube, X, Camera, User, ShieldAlert, Play, Pause } from 'lucide-react';
import { toast } from 'sonner';
import { MUSIC_GENRES } from '@/types/music';

interface ArtistEntry {
  name: string;
  coverFile?: File;
  coverPreview?: string;
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
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

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

  const addArtist = (name: string, isExisting: boolean) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (artists.some(a => a.name.toLowerCase() === trimmed.toLowerCase())) return;
    setArtists(prev => [...prev, { name: trimmed, isExisting }]);
    setArtistInput('');
    setSuggestions([]);
    setShowSuggestions(false);
  };

  const removeArtist = (index: number) => {
    setArtists(prev => {
      const next = [...prev];
      if (next[index].coverPreview) URL.revokeObjectURL(next[index].coverPreview!);
      next.splice(index, 1);
      return next;
    });
  };

  const handleArtistCover = (index: number, file: File) => {
    const preview = URL.createObjectURL(file);
    setArtists(prev => prev.map((a, i) => i === index ? { ...a, coverFile: file, coverPreview: preview } : a));
  };

  const handleArtistKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if ((e.key === 'Enter' || e.key === ',') && artistInput.trim()) {
      e.preventDefault();
      addArtist(artistInput, false);
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
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
    if (!profile?.badge) { toast.error('Réservé aux membres avec le badge PDG de Jux Music'); return; }
    if (!audioFile && !youtubeUrl.trim()) { toast.error('Ajoute un fichier audio ou une URL YouTube'); return; }
    setUploading(true);
    try {
      for (const artist of artists) {
        if (!artist.isExisting && artist.coverFile) {
          try {
            const fd = new FormData();
            fd.append('name', artist.name);
            fd.append('cover', artist.coverFile);
            await pb.collection('artists').create(fd);
          } catch { /* collection artists pas encore créée */ }
        }
      }

      const formData = new FormData();
      formData.append('title', title.trim());
      formData.append('author', artists.map(a => a.name).join(', '));
      formData.append('uploaded_by', user.id);
      if (genre) formData.append('genre', genre);
      if (youtubeUrl.trim()) {
        const id = extractYoutubeId(youtubeUrl.trim());
        if (id) {
          formData.append('youtube_id', id);
          formData.append('audio_url', `https://www.youtube.com/watch?v=${id}`);
        } else {
          formData.append('video_url', youtubeUrl.trim());
        }
      }
      if (audioFile) formData.append('audio', audioFile);
      if (coverFile) formData.append('cover', coverFile);
      await pb.collection('songs').create(formData);
      toast.success('Musique uploadée !');
      navigate('/jux');
    } catch (e: any) {
      toast.error(e.message || 'Erreur upload');
    }
    setUploading(false);
  };

  if (!offline && !profile?.badge) {
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
          <p className="text-xs text-muted-foreground">Seuls les membres avec le badge "PDG de Jux Music" peuvent publier des musiques.</p>
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
      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium">Titre *</label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Titre de la musique" />
        </div>

        <div>
          <label className="text-sm font-medium">Artiste(s) *</label>

          {artists.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2 mt-1">
              {artists.map((artist, i) => (
                <div key={i} className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-1 bg-secondary rounded-full px-3 py-1 text-sm">
                    {artist.coverPreview && (
                      <img src={artist.coverPreview} alt="" className="w-5 h-5 rounded-full object-cover" />
                    )}
                    <span>{artist.name}</span>
                    {!artist.isExisting && (
                      <span className="text-xs text-muted-foreground ml-0.5">(nouveau)</span>
                    )}
                    <button type="button" onClick={() => removeArtist(i)} className="ml-1 hover:text-destructive">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                  {!artist.isExisting && (
                    <label className="flex items-center gap-1 text-xs text-muted-foreground cursor-pointer hover:text-foreground pl-3">
                      <Camera className="w-3 h-3" />
                      <span>{artist.coverFile ? 'Cover ajoutée ✓' : 'Ajouter une cover'}</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleArtistCover(i, f); }}
                      />
                    </label>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="relative" ref={wrapperRef}>
            <Input
              value={artistInput}
              onChange={handleArtistInputChange}
              onKeyDown={handleArtistKeyDown}
              onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
              placeholder={artists.length === 0 ? "Nom de l'artiste" : "Ajouter un artiste..."}
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
          </div>
          {artistInput.trim() && !suggestions.some(s => s.toLowerCase() === artistInput.trim().toLowerCase()) && (
            <p className="text-xs text-muted-foreground mt-1">
              Appuie sur <kbd className="px-1 bg-muted rounded text-xs">Entrée</kbd> pour ajouter "{artistInput.trim()}" comme nouvel artiste
            </p>
          )}
        </div>

        <div>
          <label className="text-sm font-medium">Genre</label>
          <select value={genre} onChange={(e) => setGenre(e.target.value)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
            <option value="">Sélectionner un genre</option>
            {MUSIC_GENRES.map((g) => (<option key={g} value={g}>{g}</option>))}
          </select>
        </div>
        <div>
          <label className="text-sm font-medium flex items-center gap-2"><Music2 className="h-4 w-4" />Fichier audio</label>
          <Input type="file" accept="audio/*" onChange={(e) => setAudioFile(e.target.files?.[0] || null)} className="cursor-pointer" />
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
        </div>
        <div>
          <label className="text-sm font-medium flex items-center gap-2"><Youtube className="h-4 w-4" />URL YouTube (optionnel)</label>
          <Input value={youtubeUrl} onChange={(e) => setYoutubeUrl(e.target.value)} placeholder="https://youtube.com/watch?v=..." />
        </div>
        <div>
          <label className="text-sm font-medium">Cover (image)</label>
          <Input type="file" accept="image/*" onChange={(e) => setCoverFile(e.target.files?.[0] || null)} className="cursor-pointer" />
        </div>
        <Button className="w-full" onClick={submit} disabled={uploading}>
          <UploadIcon className="h-4 w-4 mr-2" /> {uploading ? 'Upload en cours...' : 'Uploader'}
        </Button>
      </div>
    </div>
  );
}
