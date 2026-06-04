import { useState } from 'react';
import { pb } from '@/lib/pocketbase';
import { useAuth } from '@/contexts/AuthContext';
import { extractYoutubeId } from '@/lib/storage';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Upload as UploadIcon, Music2, Youtube } from 'lucide-react';
import { toast } from 'sonner';
import { MUSIC_GENRES } from '@/types/music';

export default function Upload() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [genre, setGenre] = useState('');
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [uploading, setUploading] = useState(false);

  const submit = async () => {
    if (!user) { toast.error('Connecte-toi d\'abord'); return; }
    if (!title.trim() || !author.trim()) { toast.error('Titre et auteur requis'); return; }
    if (!audioFile && !youtubeUrl.trim()) { toast.error('Ajoute un fichier audio ou une URL YouTube'); return; }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('title', title.trim());
      formData.append('author', author.trim());
      formData.append('uploaded_by', user.id);
      if (genre) formData.append('genre', genre);
      if (youtubeUrl.trim()) {
        const id = extractYoutubeId(youtubeUrl.trim());
        if (id) { formData.append('youtube_id', id); formData.append('audio_url', `https://www.youtube.com/watch?v=${id}`); }
        else formData.append('video_url', youtubeUrl.trim());
      }
      if (audioFile) formData.append('audio', audioFile);
      if (coverFile) formData.append('cover', coverFile);
      // Envoi unique : PocketBase gère les fichiers attachés aux champs file
      await pb.collection('songs').create(formData);
      toast.success('Musique uploadée !');
      navigate('/jux');
    } catch (e: any) { toast.error(e.message || 'Erreur upload'); }
    setUploading(false);
  };

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
          <label className="text-sm font-medium">Auteur *</label>
          <Input value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="Nom de l'artiste" />
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