import { useState, useRef } from 'react';
import { pb } from '@/lib/pocketbase';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Music, Image, Upload as UploadIcon, AlertCircle } from 'lucide-react';

export default function Upload() {
  const { user } = useAuth();
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState('');
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const audioRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLInputElement>(null);

  const handleAudio = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 20 * 1024 * 1024) {
        setError('Le fichier audio ne doit pas dépasser 20 Mo');
        return;
      }
      setAudioFile(file);
      setError('');
    }
  };

  const handleImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 50 * 1024 * 1024) {
        setError("L'image ne doit pas dépasser 50 Mo");
        return;
      }
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
      setError('');
    }
  };

  const canUpload = audioFile && imageFile && title.trim() && author.trim();

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
      fd.append('audioFile', audioFile);
      fd.append('coverImage', imageFile);
      fd.append('uploadedBy', user.id);

      // Simulate progress since PocketBase SDK doesn't have native progress
      const interval = setInterval(() => {
        setProgress(p => Math.min(p + 5, 90));
      }, 200);

      await pb.collection('songs').create(fd);

      clearInterval(interval);
      setProgress(100);
      setSuccess(true);
      setTitle('');
      setAuthor('');
      setAudioFile(null);
      setImageFile(null);
      setImagePreview('');
    } catch (err: any) {
      setError(err?.message || "Erreur lors de l'upload");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="px-4 py-6 pb-28">
      <h1 className="text-xl font-bold text-foreground mb-6">Publier une musique</h1>

      <div className="space-y-4">
        {/* Audio file */}
        <button
          onClick={() => audioRef.current?.click()}
          className="w-full flex items-center gap-3 p-4 rounded-lg bg-secondary border border-border hover:border-primary/50 transition-colors"
        >
          <Music className="h-5 w-5 text-muted-foreground" />
          <span className="text-sm text-foreground truncate">
            {audioFile ? audioFile.name : 'Sélectionner le fichier audio (max 20 Mo)'}
          </span>
        </button>
        <input ref={audioRef} type="file" accept="audio/*" className="hidden" onChange={handleAudio} />

        {/* Cover image */}
        <button
          onClick={() => imageRef.current?.click()}
          className="w-full flex items-center gap-3 p-4 rounded-lg bg-secondary border border-border hover:border-primary/50 transition-colors"
        >
          {imagePreview ? (
            <img src={imagePreview} alt="Cover" className="h-12 w-12 rounded object-cover" />
          ) : (
            <Image className="h-5 w-5 text-muted-foreground" />
          )}
          <span className="text-sm text-foreground truncate">
            {imageFile ? imageFile.name : "Sélectionner l'image de couverture (max 50 Mo)"}
          </span>
        </button>
        <input ref={imageRef} type="file" accept="image/*" className="hidden" onChange={handleImage} />

        <Input
          placeholder="Titre de la musique"
          value={title}
          onChange={e => setTitle(e.target.value)}
          className="bg-secondary border-border text-foreground placeholder:text-muted-foreground"
        />
        <Input
          placeholder="Auteur / Artiste"
          value={author}
          onChange={e => setAuthor(e.target.value)}
          className="bg-secondary border-border text-foreground placeholder:text-muted-foreground"
        />

        {error && (
          <div className="flex items-center gap-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        )}

        {uploading && (
          <div className="space-y-2">
            <div className="h-2 rounded-full bg-secondary overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-300 rounded-full"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground text-center">
              Upload en cours ({progress}%) — Ne rechargez pas la page
            </p>
          </div>
        )}

        {success && (
          <p className="text-sm text-primary text-center">✓ Musique publiée avec succès !</p>
        )}

        <Button
          onClick={handleUpload}
          disabled={!canUpload || uploading}
          className="w-full"
        >
          <UploadIcon className="h-4 w-4 mr-2" />
          {uploading ? 'Upload en cours...' : 'Publier'}
        </Button>
      </div>
    </div>
  );
}
