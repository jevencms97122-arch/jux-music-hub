import { useState, useRef, useMemo } from 'react';
import { pb } from '@/lib/pocketbase';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Music, Image, Upload as UploadIcon, AlertCircle, ArrowRight, ArrowLeft, Search, Check, X } from 'lucide-react';
import { MUSIC_GENRES } from '@/types/music';

export default function Upload() {
  const { user } = useAuth();
  const [step, setStep] = useState<1 | 2>(1);
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [genre, setGenre] = useState('');
  const [genreSearch, setGenreSearch] = useState('');
  const [showGenres, setShowGenres] = useState(false);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState('');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const audioRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLInputElement>(null);

  const filteredGenres = useMemo(() => {
    if (!genreSearch) return [...MUSIC_GENRES];
    return MUSIC_GENRES.filter(g => g.toLowerCase().includes(genreSearch.toLowerCase()));
  }, [genreSearch]);

  const handleAudio = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 20 * 1024 * 1024) { setError('Le fichier audio ne doit pas dépasser 20 Mo'); return; }
      setAudioFile(file);
      setError('');
    }
  };

  const handleImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 50 * 1024 * 1024) { setError("L'image ne doit pas dépasser 50 Mo"); return; }
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
      setError('');
    }
  };

  const step1Valid = title.trim() && author.trim() && genre;
  const canUpload = step1Valid && audioFile && imageFile;

  const handleUpload = async () => {
    if (!canUpload || !user) return;
    setUploading(true);
    setProgress(0);
    setError('');
    setSuccess(false);

    try {
      const fd = new FormData();
      fd.append('title', title.trim());
      fd.append('author', author.trim());
      fd.append('genre', genre);
      fd.append('audioFile', audioFile);
      fd.append('coverImage', imageFile);
      fd.append('uploadedBy', user.id);
      fd.append('playCount', '0');
      fd.append('likesCount', '0');

      const interval = setInterval(() => {
        setProgress(p => Math.min(p + 5, 90));
      }, 200);

      await pb.collection('songs').create(fd);

      clearInterval(interval);
      setProgress(100);
      setSuccess(true);
      setTitle(''); setAuthor(''); setGenre('');
      setAudioFile(null); setImageFile(null); setImagePreview('');
      setStep(1);
    } catch (err: any) {
      setError(err?.message || "Erreur lors de l'upload");
    } finally {
      setUploading(false);
    }
  };

  const reset = () => {
    setSuccess(false);
    setStep(1);
  };

  if (success) {
    return (
      <div className="px-4 py-6 pb-28 flex flex-col items-center justify-center min-h-[60vh]">
        <div className="h-16 w-16 rounded-full bg-primary/20 flex items-center justify-center mb-4">
          <Check className="h-8 w-8 text-primary" />
        </div>
        <h2 className="text-lg font-bold text-foreground mb-2">Musique publiée !</h2>
        <p className="text-sm text-muted-foreground mb-6">Ta musique est maintenant disponible sur Jux</p>
        <Button onClick={reset}>Publier une autre musique</Button>
      </div>
    );
  }

  return (
    <div className="px-4 py-6 pb-28">
      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-6">
        <div className={`h-1.5 flex-1 rounded-full ${step >= 1 ? 'bg-primary' : 'bg-secondary'}`} />
        <div className={`h-1.5 flex-1 rounded-full ${step >= 2 ? 'bg-primary' : 'bg-secondary'}`} />
      </div>

      {step === 1 && (
        <div className="space-y-4">
          <h1 className="text-xl font-bold text-foreground mb-2">Infos de la musique</h1>
          <p className="text-sm text-muted-foreground mb-4">Renseigne le titre, l'artiste et le genre</p>

          <Input placeholder="Titre de la musique" value={title} onChange={e => setTitle(e.target.value)} className="bg-secondary border-border text-foreground placeholder:text-muted-foreground" />
          <Input placeholder="Auteur / Artiste" value={author} onChange={e => setAuthor(e.target.value)} className="bg-secondary border-border text-foreground placeholder:text-muted-foreground" />

          {/* Genre selector */}
          <div>
            <button
              type="button"
              onClick={() => setShowGenres(!showGenres)}
              className="w-full flex items-center justify-between p-3 rounded-lg bg-secondary border border-border text-sm"
            >
              <span className={genre ? 'text-foreground' : 'text-muted-foreground'}>
                {genre || 'Sélectionner un genre'}
              </span>
              {genre && (
                <button onClick={e => { e.stopPropagation(); setGenre(''); }} className="text-muted-foreground">
                  <X className="h-4 w-4" />
                </button>
              )}
            </button>

            {showGenres && (
              <div className="mt-2 rounded-lg bg-card border border-border overflow-hidden">
                <div className="relative p-2">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="text"
                    value={genreSearch}
                    onChange={e => setGenreSearch(e.target.value)}
                    placeholder="Rechercher un genre..."
                    className="w-full h-9 pl-8 pr-3 rounded-md bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
                    autoFocus
                  />
                </div>
                <div className="max-h-48 overflow-y-auto p-1">
                  {filteredGenres.map(g => (
                    <button
                      key={g}
                      onClick={() => { setGenre(g); setShowGenres(false); setGenreSearch(''); }}
                      className={`w-full text-left px-3 py-2 text-sm rounded-md transition-colors ${genre === g ? 'bg-primary/20 text-primary' : 'text-foreground hover:bg-secondary'}`}
                    >
                      {g}
                    </button>
                  ))}
                  {filteredGenres.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-3">Aucun genre trouvé</p>
                  )}
                </div>
              </div>
            )}
          </div>

          <Button onClick={() => setStep(2)} disabled={!step1Valid} className="w-full mt-4">
            Suivant <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <button onClick={() => setStep(1)} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-2">
            <ArrowLeft className="h-4 w-4" /> Retour
          </button>
          <h1 className="text-xl font-bold text-foreground mb-2">Fichiers</h1>
          <p className="text-sm text-muted-foreground mb-4">Ajoute le fichier audio et la couverture</p>

          <button onClick={() => audioRef.current?.click()} className="w-full flex items-center gap-3 p-4 rounded-lg bg-secondary border border-border hover:border-primary/50 transition-colors">
            <Music className="h-5 w-5 text-muted-foreground" />
            <span className="text-sm text-foreground truncate">
              {audioFile ? audioFile.name : 'Fichier audio (max 20 Mo)'}
            </span>
          </button>
          <input ref={audioRef} type="file" accept="audio/*" className="hidden" onChange={handleAudio} />

          <button onClick={() => imageRef.current?.click()} className="w-full flex items-center gap-3 p-4 rounded-lg bg-secondary border border-border hover:border-primary/50 transition-colors">
            {imagePreview ? (
              <img src={imagePreview} alt="Cover" className="h-12 w-12 rounded object-cover" />
            ) : (
              <Image className="h-5 w-5 text-muted-foreground" />
            )}
            <span className="text-sm text-foreground truncate">
              {imageFile ? imageFile.name : 'Image de couverture (max 50 Mo)'}
            </span>
          </button>
          <input ref={imageRef} type="file" accept="image/*" className="hidden" onChange={handleImage} />

          {error && (
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4" /> {error}
            </div>
          )}

          {uploading && (
            <div className="space-y-2">
              <div className="h-2 rounded-full bg-secondary overflow-hidden">
                <div className="h-full bg-primary transition-all duration-300 rounded-full" style={{ width: `${progress}%` }} />
              </div>
              <p className="text-xs text-muted-foreground text-center">Upload en cours ({progress}%) — Ne rechargez pas la page</p>
            </div>
          )}

          <Button onClick={handleUpload} disabled={!canUpload || uploading} className="w-full">
            <UploadIcon className="h-4 w-4 mr-2" />
            {uploading ? 'Upload en cours...' : 'Publier'}
          </Button>
        </div>
      )}
    </div>
  );
}
