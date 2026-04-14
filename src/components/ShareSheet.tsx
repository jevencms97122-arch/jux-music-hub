import { motion, AnimatePresence } from 'framer-motion';
import { Share2, Copy, Check, X } from 'lucide-react';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { getSongCoverUrl } from '@/lib/pocketbase';

interface ShareSheetProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'song' | 'playlist';
  data: {
    id: string;
    title: string;
    author?: string;
    cover?: string;
    songsCount?: number;
  };
}

export default function ShareSheet({ isOpen, onClose, type, data }: ShareSheetProps) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const shareUrl = type === 'song' 
    ? `${window.location.origin}/listen/${data.id}`
    : `${window.location.origin}/playlist/${data.id}`;

  const formattedText = type === 'song'
    ? `Écoute ${data.title} de ${data.author} sur Jux Music : ${shareUrl}`
    : `Écoute la playlist ${data.title} sur Jux Music : ${shareUrl}`;

  const handleCopy = () => {
    setCopied(true);

    // Copie directe et immédiate sans await
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(shareUrl);
    }

    setTimeout(() => {
      setCopied(false);
      onClose();
      toast({
        title: '✅ Lien copié !',
        description: 'Le lien est dans votre presse papier'
      });
    }, 500);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] bg-black/60 flex items-end justify-center"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            className="bg-card rounded-t-3xl w-full max-w-md p-6 pb-8 safe-bottom"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold">Prêt à partager ?</h3>
              <button 
                onClick={onClose}
                className="p-2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Preview Card */}
            <div className="flex gap-4 mb-6 p-4 bg-secondary/30 rounded-2xl">
              <div className="w-20 h-20 rounded-xl overflow-hidden flex-shrink-0 shadow-lg">
                {data.cover ? (
                  <img 
                    src={data.cover} 
                    alt={data.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-secondary flex items-center justify-center">
                    <Share2 className="h-8 w-8 text-muted-foreground" />
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <p className="font-bold text-foreground truncate">{data.title}</p>
                <p className="text-sm text-muted-foreground truncate">
                  {type === 'song' 
                    ? data.author 
                    : `${data.songsCount} titres`
                  }
                </p>
                <p className="text-xs text-muted-foreground/70 mt-1 truncate">{shareUrl}</p>
              </div>
            </div>

            {/* Action Button */}
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={handleCopy}
              className={`w-full py-4 rounded-2xl font-semibold flex items-center justify-center gap-2 transition-all ${
                copied 
                  ? 'bg-green-500 text-white' 
                  : 'bg-primary text-primary-foreground hover:bg-primary/90'
              }`}
            >
              {copied ? (
                <>
                  <Check className="h-5 w-5" />
                  Copié !
                </>
              ) : (
                <>
                  <Copy className="h-5 w-5" />
                  Copier le lien
                </>
              )}
            </motion.button>

          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}