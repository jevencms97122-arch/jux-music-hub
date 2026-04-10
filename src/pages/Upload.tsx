import { useState, useRef, useMemo, useEffect } from 'react';
import { pb } from '@/lib/pocketbase';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Music, Image, Upload as UploadIcon, AlertCircle, ArrowRight, ArrowLeft, Search, Check, X } from 'lucide-react';
import { MUSIC_GENRES } from '@/types/music';

// Simple ID3 parser for basic metadata extraction
function parseID3Tags(file: File): Promise<{ title?: string; artist?: string }> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const buffer = reader.result as ArrayBuffer;
      const view = new DataView(buffer);
      
      // Check for ID3 header (first 3 bytes should be "ID3")
      if (buffer.byteLength >= 10 && 
          view.getUint8(0) === 0x49 && // 'I'
          view.getUint8(1) === 0x44 && // 'D'
          view.getUint8(2) === 0x33) { // '3'
        
        try {
          // Skip ID3 header (10 bytes)
          let offset = 10;
          
          // Read ID3 size (synchsafe integer)
          const size = (view.getUint8(6) << 21) | (view.getUint8(7) << 14) | (view.getUint8(8) << 7) | view.getUint8(9);
          
          // Parse frames
          let title: string | undefined;
          let artist: string | undefined;
          
          while (offset < buffer.byteLength && offset < 10 + size) {
            const frameId = String.fromCharCode(view.getUint8(offset), view.getUint8(offset + 1), view.getUint8(offset + 2), view.getUint8(offset + 3));
            
            if (frameId === 'TIT2' || frameId === 'TT2') {
              // Title frame
              const frameSize = view.getUint32(offset + 4);
              const flags = view.getUint16(offset + 8);
              const dataOffset = offset + 10;
              
              if (dataOffset + frameSize <= buffer.byteLength) {
                const dataView = new Uint8Array(buffer, dataOffset, frameSize);
                // Skip encoding byte (usually 0x00 or 0x01)
                let textOffset = 1;
                if (dataView[0] === 0x01) textOffset = 4; // UTF-16 with BOM
                
                // Extract text
                let text = '';
                for (let i = textOffset; i < frameSize; i++) {
                  if (dataView[i] === 0) break;
                  text += String.fromCharCode(dataView[i]);
                }
                if (text.trim()) title = text.trim();
              }
            }
            
            if (frameId === 'TPE1' || frameId === 'TP1') {
              // Artist frame
              const frameSize = view.getUint32(offset + 4);
              const flags = view.getUint16(offset + 8);
              const dataOffset = offset + 10;
              
              if (dataOffset + frameSize <= buffer.byteLength) {
                const dataView = new Uint8Array(buffer, dataOffset, frameSize);
                // Skip encoding byte
                let textOffset = 1;
                if (dataView[0] === 0x01) textOffset = 4; // UTF-16 with BOM
                
                // Extract text
                let text = '';
                for (let i = textOffset; i < frameSize; i++) {
                  if (dataView[i] === 0) break;
                  text += String.fromCharCode(dataView[i]);
                }
                if (text.trim()) artist = text.trim();
              }
            }
            
            // Move to next frame
            const frameSize = view.getUint32(offset + 4);
            offset += 10 + frameSize;
          }
          
          resolve({ title, artist });
        } catch (e) {
          console.warn('Failed to parse ID3 tags:', e);
          resolve({});
        }
      } else {
        resolve({});
      }
    };
    reader.onerror = () => resolve({});
    reader.readAsArrayBuffer(file);
  });
}

// Alternative method using MediaMetadata API if available
async function extractMetadataFromAudio(file: File): Promise<{ title?: string; artist?: string }> {
  return new Promise((resolve) => {
    // Try using MediaMetadata API for better compatibility
    if ('MediaMetadata' in window) {
      const audio = new Audio();
      const url = URL.createObjectURL(file);
      
      audio.onloadedmetadata = () => {
        try {
          // Try to get metadata from the audio element
          const title = audio.title || file.name || undefined;
          const artist = undefined; // HTMLAudioElement doesn't have artist property
          
          if (title || artist) {
            resolve({ title, artist });
            URL.revokeObjectURL(url);
            return;
          }
        } catch (e) {
          // Fallback to ID3 parser
        }
        
        // Fallback to ID3 parser
        parseID3Tags(file).then(resolve);
        URL.revokeObjectURL(url);
      };
      
      audio.onerror = () => {
        // Fallback to ID3 parser
        parseID3Tags(file).then(resolve);
        URL.revokeObjectURL(url);
      };
      
      audio.src = url;
    } else {
      // Fallback to ID3 parser
      parseID3Tags(file).then(resolve);
    }
  });
}

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
  const [parsingMetadata, setParsingMetadata] = useState(false);
  const audioRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLInputElement>(null);
  
  // Nouveaux états pour la recherche de cover
  const [searchingCover, setSearchingCover] = useState(false);
  const [coverResults, setCoverResults] = useState<string[]>([]);
  const [showCoverSelector, setShowCoverSelector] = useState(false);
  const [selectedCoverUrl, setSelectedCoverUrl] = useState('');
  const [showCoverChoiceModal, setShowCoverChoiceModal] = useState(false);

  // Fonction de recherche de cover sur internet (DuckDuckGo Images)
  const searchCover = async (searchTitle: string, searchAuthor: string) => {
    if (!searchTitle.trim()) return;
    
    setSearchingCover(true);
    setCoverResults([]);
    
    try {
      const query = encodeURIComponent(`${searchTitle} ${searchAuthor} album cover official`.trim());
      
      // Utilisation directe de DuckDuckGo Image Search avec proxy pour CORS
      const response = await fetch(`https://corsproxy.io/?https://duckduckgo.com/i.js?q=${query}&o=json&p=1&s=0&u=bing&f=,,,&l=fr-fr`);
      
      if (!response.ok) throw new Error('Erreur recherche');
      
      const data = await response.json();
      
      const images: string[] = [];
      
      if (data.results && data.results.length > 0) {
        // Filtrer uniquement les images qui sont bien des covers (format carré)
        for (const item of data.results) {
          if (item.width && item.height && Math.abs(item.width - item.height) < 150) {
            // Utiliser l'image en taille moyenne optimisée
            images.push(item.thumbnail || item.image);
          }
          if (images.length >= 12) break;
        }
      }
      
      // Si aucun résultat on utilise le fallback Bing
      if (images.length === 0) {
        for (let i = 0; i < 6; i++) {
          images.push(`https://tse${i%4}.mm.bing.net/th?q=${query}&w=300&h=300&c=7&rs=1&p=${i}`);
        }
      }
      
      setCoverResults(images);
      
      // Sélectionner automatiquement la première image si aucune n'est sélectionnée
      if (images.length > 0 && !imageFile && !selectedCoverUrl) {
        setSelectedCoverUrl(images[0]);
        setImagePreview(images[0]);
      }
      
    } catch (err) {
      console.warn('Erreur lors de la recherche de cover:', err);
      // Fallback minimal en cas d'erreur
      const query = encodeURIComponent(`${searchTitle} ${searchAuthor} album cover`.trim());
      const fallbackImages = [];
      for (let i = 0; i < 6; i++) {
        fallbackImages.push(`https://tse${i%4}.mm.bing.net/th?q=${query}&w=300&h=300&c=7&p=${i}`);
      }
      setCoverResults(fallbackImages);
      
      if (!imageFile && !selectedCoverUrl) {
        setSelectedCoverUrl(fallbackImages[0]);
        setImagePreview(fallbackImages[0]);
      }
    } finally {
      setSearchingCover(false);
    }
  };
  
  // Recherche automatique quand le titre ou l'auteur change
  useEffect(() => {
    if (step === 2 && title.trim()) {
      const debounce = setTimeout(() => {
        searchCover(title, author);
      }, 800);
      return () => clearTimeout(debounce);
    }
  }, [title, author, step]);

  const filteredGenres = useMemo(() => {
    if (!genreSearch) return [...MUSIC_GENRES];
    return MUSIC_GENRES.filter(g => g.toLowerCase().includes(genreSearch.toLowerCase()));
  }, [genreSearch]);

  const handleAudio = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 20 * 1024 * 1024) { setError('Le fichier audio ne doit pas dépasser 20 Mo'); return; }
      
      setParsingMetadata(true);
      setError('');
      
      try {
        const metadata = await extractMetadataFromAudio(file);
        
        // Set metadata if found, otherwise keep existing values
        if (metadata.title) {
          setTitle(metadata.title);
        }
        if (metadata.artist) {
          setAuthor(metadata.artist);
        }
        
        setAudioFile(file);
        // Automatically go to step 2 after selecting audio
        setStep(2);
      } catch (err) {
        console.warn('Failed to parse metadata:', err);
        setAudioFile(file);
        setStep(2);
      } finally {
        setParsingMetadata(false);
      }
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

  // Gérer le choix de la source de l'image
  const handleCoverButtonClick = () => {
    setShowCoverChoiceModal(true);
  };
  
  const selectCoverFromDevice = () => {
    setShowCoverChoiceModal(false);
    imageRef.current?.click();
  };
  
  const selectCoverFromInternet = () => {
    setShowCoverChoiceModal(false);
    setShowCoverSelector(true);
  };
  
  const selectCoverResult = (url: string) => {
    setSelectedCoverUrl(url);
    setImagePreview(url);
    setImageFile(null); // On efface le fichier si on sélectionne une url
    setShowCoverSelector(false);
  };

  const step1Valid = title.trim() && author.trim() && genre;
  const canUpload = step1Valid && audioFile && (imageFile || selectedCoverUrl);

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
      if (imageFile) {
        fd.append('coverImage', imageFile);
      }
      if (selectedCoverUrl) {
        fd.append('url_coverSong', selectedCoverUrl);
      }
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
          <h1 className="text-xl font-bold text-foreground mb-2">Sélection du fichier audio</h1>
          <p className="text-sm text-muted-foreground mb-4">Choisis ton fichier audio, les informations seront extraites automatiquement</p>

          <button onClick={() => audioRef.current?.click()} className="w-full flex items-center gap-3 p-4 rounded-lg bg-secondary border border-border hover:border-primary/50 transition-colors">
            <Music className="h-5 w-5 text-muted-foreground" />
            <span className="text-sm text-foreground truncate">
              {audioFile ? audioFile.name : 'Fichier audio (max 20 Mo)'}
            </span>
          </button>
          <input ref={audioRef} type="file" accept="audio/*" className="hidden" onChange={handleAudio} />

          {parsingMetadata && (
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <div className="h-4 w-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              <span>Extraction des métadonnées en cours...</span>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4" /> {error}
            </div>
          )}
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <button onClick={() => setStep(1)} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-2">
            <ArrowLeft className="h-4 w-4" /> Retour
          </button>
          <h1 className="text-xl font-bold text-foreground mb-2">Informations et image</h1>
          <p className="text-sm text-muted-foreground mb-4">Vérifie et modifie les informations extraites, puis ajoute l'image</p>

          <div className="space-y-3">
            <div className="relative">
              <Input 
                placeholder="Titre de la musique" 
                value={title} 
                onChange={e => setTitle(e.target.value)} 
                className="bg-secondary border-border text-foreground placeholder:text-muted-foreground"
              />
            </div>
            <div className="relative">
              <Input 
                placeholder="Auteur / Artiste" 
                value={author} 
                onChange={e => setAuthor(e.target.value)} 
                className="bg-secondary border-border text-foreground placeholder:text-muted-foreground"
              />
            </div>

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
          </div>

          {/* Modal de choix de source de cover */}
          {showCoverChoiceModal && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center" onClick={() => setShowCoverChoiceModal(false)}>
              <div className="bg-background w-full max-w-md rounded-t-2xl p-6 animate-slide-up" onClick={e => e.stopPropagation()}>
                <h3 className="text-lg font-bold mb-4 text-center">Choisir la source de l'image</h3>
                <div className="space-y-3">
                  <Button onClick={selectCoverFromDevice} className="w-full justify-start">
                    <Image className="h-5 w-5 mr-3" />
                    Depuis mon appareil
                  </Button>
                  <Button onClick={selectCoverFromInternet} variant="secondary" className="w-full justify-start">
                    <Search className="h-5 w-5 mr-3" />
                    Rechercher sur internet
                  </Button>
                  <Button onClick={() => setShowCoverChoiceModal(false)} variant="ghost" className="w-full mt-2">
                    Annuler
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Modal de sélection de cover depuis internet */}
          {showCoverSelector && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center" onClick={() => setShowCoverSelector(false)}>
              <div className="bg-background w-full max-w-md rounded-t-2xl p-6 max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <h3 className="text-lg font-bold mb-4 text-center">Sélectionner une cover</h3>
                {searchingCover ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="h-8 w-8 rounded-full border-3 border-primary border-t-transparent animate-spin" />
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-3 gap-2 overflow-y-auto max-h-60">
                      {coverResults.map((url, idx) => (
                        <button 
                          key={idx} 
                          onClick={() => selectCoverResult(url)}
                          className={`aspect-square rounded-lg overflow-hidden border-2 transition-colors ${selectedCoverUrl === url ? 'border-primary' : 'border-transparent'}`}
                        >
                          <img src={url} alt={`Cover ${idx+1}`} className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                    <Button onClick={() => setShowCoverSelector(false)} variant="ghost" className="w-full mt-4">
                      Fermer
                    </Button>
                  </>
                )}
              </div>
            </div>
          )}

          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-foreground">Image de couverture</h2>
            <button onClick={handleCoverButtonClick} className="w-full flex items-center gap-3 p-4 rounded-lg bg-secondary border border-border hover:border-primary/50 transition-colors">
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
          </div>

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
