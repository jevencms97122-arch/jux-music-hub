import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { uploadFile } from '@/lib/storage';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MUSIC_GENRES } from '@/types/music';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Upload as UploadIcon } from 'lucide-react';

export default function Upload() {
  const { authUser } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [genre, setGenre] = useState<string>('');
  const [audio, setAudio] = useState<File | null>(null);
  const [cover, setCover] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authUser || !audio) return;
    setSubmitting(true);
    try {
      const audioPath = await uploadFile('songs', authUser.id, audio);
      const coverPath = cover ? await uploadFile('covers', authUser.id, cover) : null;

      const { error } = await supabase.from('songs').insert({
        title,
        author: author || 'Inconnu',
        audio_url: audioPath,
        cover_url: coverPath,
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
      <button onClick={() => navigate(-1)} className="mb-4 flex items-center gap-2 text-muted-foreground">
        <ArrowLeft className="h-5 w-5" /> Retour
      </button>
      <h1 className="mb-6 text-2xl font-bold">Publier un morceau</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
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
          <Label htmlFor="cover">Pochette (image)</Label>
          <Input id="cover" type="file" accept="image/*" onChange={(e) => setCover(e.target.files?.[0] ?? null)} />
        </div>
        <Button type="submit" className="w-full" disabled={submitting || !title || !audio}>
          <UploadIcon className="mr-2 h-4 w-4" />
          {submitting ? 'Publication...' : 'Publier'}
        </Button>
      </form>
    </div>
  );
}
