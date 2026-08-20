import { useEffect, useState } from 'react';
import { onAutoDownloadProgress, type DownloadNotification } from '@/lib/autoDownloadManager';
import { toast } from 'sonner';
import { Download, CheckCircle2, AlertCircle } from 'lucide-react';

export default function AutoDownloadNotifier() {
  const [downloads, setDownloads] = useState<Record<string, DownloadNotification>>({});

  useEffect(() => {
    const unsubscribe = onAutoDownloadProgress((notification: DownloadNotification) => {
      setDownloads((prev) => ({
        ...prev,
        [notification.songId]: notification,
      }));

      // Afficher une toast selon le status
      if (notification.status === 'downloading') {
        toast.loading(`Téléchargement en cours de ${notification.title}`, {
          id: `download-${notification.songId}`,
          description: `Vers les titres hors connexion`,
        });
      } else if (notification.status === 'done') {
        toast.success(`Téléchargement terminé`, {
          id: `download-${notification.songId}`,
          description: `${notification.title} • ${notification.author}`,
        });
      } else if (notification.status === 'error') {
        toast.error(`Erreur de téléchargement`, {
          id: `download-${notification.songId}`,
          description: notification.error || 'Impossible de télécharger le titre',
        });
      }

      // Nettoyer après quelques secondes
      if (notification.status === 'done' || notification.status === 'error') {
        setTimeout(() => {
          setDownloads((prev) => {
            const next = { ...prev };
            delete next[notification.songId];
            return next;
          });
        }, 5000);
      }
    });

    return unsubscribe;
  }, []);

  return null;
}
