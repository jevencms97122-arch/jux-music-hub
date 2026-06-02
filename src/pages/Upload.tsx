import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { uploadFileSmart, extractYoutubeId } from '@/lib/storage';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MUSIC_GENRES } from '@/types/music';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Upload as UploadIcon, Youtube } from 'lucide-react';

export default function Upload() {
  const { authUser } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [genre, setGenre] = useState<string>('');
  const [audio, setAudio] = useState<File | null>(null);
  const [cover, setCover] = useState<File | null>(null);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [youtubeError, setYoutubeError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authUser || !audio) return;

    // Validate YouTube URL if provided
    let videoUrl: string | null = null;
    if (youtubeUrl.trim()) {
      const videoId = extractYoutubeId(youtubeUrl.trim());
      if (!videoId) {
        setYoutubeError('Lien YouTube invalide. Utilisez un lien youtube.com/watch?v=... ou youtu.be/...');
        return;
      }
      videoUrl = `https://www.youtube.com/embed/${videoId}?enablejsapi=1&autoplay=0&controls=0&modestbranding=1&rel=0&showinfo=0&iv_load_policy=3`;
    }

    setSubmitting(true);
    setYoutubeError('');
    try {
      const audioPath = await uploadFileSmart('songs', authUser.id, audio);
      const coverPath = cover ? await uploadFileSmart('covers', authUser.id, cover) : null;

      const { error } = await supabase.from('songs').insert({
        title,
        author: author || 'Inconnu',
        audio_url: audioPath,
        cover_url: coverPath,
        video_url: videoUrl,
        genre: genre || null,
        uploaded_by: authUser.id,
      });
      if (error) throw error;

      toast({ title: 'Morceau publié 🎵' });
      navigate('/jux');
    } catch (err: any) {
      console.error(err);
      toast({ title: 'Erreur', description: err.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen px-6 pb-32 pt-4">
      <button
        onClick={() => navigate(-1)}
        className="mb-4 flex items-center gap-2 text-muted-foreground"
        style={{ animation: 'fadeSlideUp 0.6s cubic-bezier(0.16,1,0.3,1) both' }}
      >
        <ArrowLeft className="h-5 w-5" /> Retour
      </button>
      <h1 className="mb-6 text-2xl font-bold" style={{ animation: 'fadeSlideUp 0.6s cubic-bezier(0.16,1,0.3,1) both', animationDelay: '0.08s' }}>
        Publier un morceau
      </h1>

      <form onSubmit={handleSubmit} className="space-y-4" style={{ animation: 'fadeSlideUp 0.6s cubic-bezier(0.16,1,0.3,1) both', animationDelay: '0.16s' }}>
        <div>
          <Label htmlFor="title">Titre</Label>
          <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} required />
        </div>
        <div>
          <Label htmlFor="author">Artiste</Label>
          <Input id="author" value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="Nom de l'artiste" />
        </div>
        <div>
          <Label>Genre</Label>
          <Select value={genre} onValueChange={setGenre}>
            <SelectTrigger><SelectValue placeholder="Choisir un genre" /></SelectTrigger>
            <SelectContent>
              {MUSIC_GENRES.map((g) => (
                <SelectItem key={g} value={g}>{g}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="audio">Fichier audio (mp3, wav...)</Label>
          <Input id="audio" type="file" accept="audio/*" onChange={(e) => setAudio(e.target.files?.[0] ?? null)} required />
        </div>
        <div>
          <Label htmlFor="cover">Pochette (image) *Requis</Label>
          <Input id="cover" type="file" accept="image/*" onChange={(e) => setCover(e.target.files?.[0] ?? null)} />
          <p className="mt-1 text-xs text-muted-foreground">Une image sera affichée comme couverture du morceau</p>
        </div>
        <div>
          <Label htmlFor="youtube" className="flex items-center gap-2">
            <Youtube className="h-4 w-4 text-red-500" />
            Vidéo YouTube (optionnel)
          </Label>
          <Input
            id="youtube"
            type="url"
            value={youtubeUrl}
            onChange={(e) => { setYoutubeUrl(e.target.value); setYoutubeError(''); }}
            placeholder="https://www.youtube.com/watch?v=..."
          />
          {youtubeError && (
            <p className="mt-1 text-xs text-destructive">{youtubeError}</p>
          )}
          <p className="mt-1 text-xs text-muted-foreground">
            La vidéo YouTube sera lue en synchronisation avec la musique (son désactivé)
          </p>
        </div>
        <Button type="submit" className="w-full" disabled={submitting || !title || !audio}>
          <UploadIcon className="mr-2 h-4 w-4" />
          {submitting ? 'Publication...' : 'Publier'}
        </Button>
      </form>
    </div>
  );
}