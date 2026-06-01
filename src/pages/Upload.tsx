import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { uploadFile, extractYoutubeId } from '@/lib/storage';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MUSIC_GENRES } from '@/types/music';
import YouTubeUploadSection from '@/components/youtube/YouTubeUploadSection';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Upload as UploadIcon, Youtube, Music2 } from 'lucide-react';

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
  const [uploadMode, setUploadMode] = useState<'manual' | 'youtube'>('manual');

  // YouTube detection state
  const [detectedVideo, setDetectedVideo] = useState<{ videoId: string; title: string; author: string } | null>(null);
  const [youtubeUploading, setYoutubeUploading] = useState(false);

  const handleManualSubmit = async (e: React.FormEvent) => {
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
      const audioPath = await uploadFile('songs', authUser.id, audio);
      const coverPath = cover ? await uploadFile('covers', authUser.id, cover) : null;

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

  const handleYouTubeUpload = async () => {
    if (!authUser || !detectedVideo) return;

    setYoutubeUploading(true);
    try {
      const coverPath = cover ? await uploadFile('covers', authUser.id, cover) : null;

      // Store the YouTube video URL - the player will play it directly with sound
      const videoEmbedUrl = `https://www.youtube.com/embed/${detectedVideo.videoId}?enablejsapi=1&autoplay=0&controls=0&modestbranding=1&rel=0&showinfo=0&iv_load_policy=3`;

      const { error } = await supabase.from('songs').insert({
        title: title || detectedVideo.title,
        author: author || detectedVideo.author || 'Inconnu',
        audio_url: '',
        cover_url: coverPath,
        video_url: videoEmbedUrl,
        genre: genre || null,
        uploaded_by: authUser.id,
      } as any);
      if (error) throw error;

      toast({ title: 'Morceau YouTube publié 🎵' });
      navigate('/jux');
    } catch (err: any) {
      console.error(err);
      toast({ title: 'Erreur', description: err.message, variant: 'destructive' });
    } finally {
      setYoutubeUploading(false);
    }
  };

  const handleVideoDetected = (videoId: string, title: string, author: string) => {
    setDetectedVideo({ videoId, title, author });
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

      {/* Tab Selector */}
      <Tabs 
        defaultValue="manual" 
        value={uploadMode}
        onValueChange={(v) => setUploadMode(v as 'manual' | 'youtube')}
        className="mb-6"
        style={{ animation: 'fadeSlideUp 0.6s cubic-bezier(0.16,1,0.3,1) both', animationDelay: '0.16s' }}
      >
        <TabsList className="w-full grid grid-cols-2">
          <TabsTrigger value="manual" className="flex items-center gap-2">
            <Music2 className="h-4 w-4" />
            Manuel
          </TabsTrigger>
          <TabsTrigger value="youtube" className="flex items-center gap-2">
            <Youtube className="h-4 w-4 text-red-500" />
            YouTube
          </TabsTrigger>
        </TabsList>

        {/* Manual Upload Tab */}
        <TabsContent value="manual">
          <form onSubmit={handleManualSubmit} className="space-y-4">
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
        </TabsContent>

        {/* YouTube Upload Tab */}
        <TabsContent value="youtube">
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Collez un lien YouTube et la musique sera détectée automatiquement. 
              La vidéo sera lue avec le son original en arrière-plan.
            </p>

            <YouTubeUploadSection
              onVideoDetected={handleVideoDetected}
              detectedVideo={detectedVideo}
              onUpload={handleYouTubeUpload}
              submitting={youtubeUploading}
            />

            {/* Optional metadata fields for YouTube upload */}
            {detectedVideo && (
              <div className="space-y-4 pt-2 border-t border-border">
                <h3 className="text-sm font-medium">Personnaliser (optionnel)</h3>
                <div>
                  <Label htmlFor="yt-title">Titre (laissez vide pour utiliser le titre YouTube)</Label>
                  <Input 
                    id="yt-title" 
                    value={title} 
                    onChange={(e) => setTitle(e.target.value)} 
                    placeholder={detectedVideo.title}
                  />
                </div>
                <div>
                  <Label htmlFor="yt-author">Artiste (laissez vide pour utiliser l'artiste YouTube)</Label>
                  <Input 
                    id="yt-author" 
                    value={author} 
                    onChange={(e) => setAuthor(e.target.value)} 
                    placeholder={detectedVideo.author}
                  />
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
                  <Label htmlFor="yt-cover">Pochette (optionnel - la miniature YouTube sera utilisée par défaut)</Label>
                  <Input id="yt-cover" type="file" accept="image/*" onChange={(e) => setCover(e.target.files?.[0] ?? null)} />
                </div>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}