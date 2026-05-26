import { X, Youtube, Smartphone, Monitor, Music, Users, Upload, Car, Search, Heart, Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface TutorialModalProps {
  open: boolean;
  onClose: () => void;
}

export default function TutorialModal({ open, onClose }: TutorialModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Modal */}
      <div
        className="relative z-10 w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-background p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        style={{ animation: 'fadeSlideUp 0.3s cubic-bezier(0.16,1,0.3,1) both' }}
      >
        {/* Close */}
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-3 top-3"
          onClick={onClose}
          aria-label="Fermer"
        >
          <X className="h-5 w-5" />
        </Button>

        {/* Title */}
        <div className="mb-6 text-center">
          <h2 className="text-2xl font-bold text-foreground">🎵 Bienvenue sur Jux !</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Tout ce que tu dois savoir pour profiter de l'app
          </p>
        </div>

        {/* Sections */}
        <div className="space-y-6">
          {/* ── Qu'est-ce que Jux ? ── */}
          <section>
            <h3 className="mb-2 flex items-center gap-2 text-lg font-semibold text-foreground">
              <Music className="h-5 w-5 text-primary" />
              Qu'est-ce que Jux ?
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Jux est une plateforme musicale sociale où tu peux écouter, découvrir et partager
              de la musique avec tes amis. Tu peux uploader tes propres musiques, créer des
              playlists, suivre d'autres utilisateurs, et même écouter en synchronisation avec
              tes amis en temps réel !
            </p>
          </section>

          {/* ── Comment utiliser l'app ? ── */}
          <section>
            <h3 className="mb-2 flex items-center gap-2 text-lg font-semibold text-foreground">
              <Monitor className="h-5 w-5 text-primary" />
              Comment utiliser l'app
            </h3>
            <div className="space-y-3 text-sm text-muted-foreground">
              <div className="flex items-start gap-3 rounded-xl bg-secondary/50 p-3">
                <HomeIcon className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
                <div>
                  <p className="font-medium text-foreground">Accueil</p>
                  <p className="leading-relaxed">
                    Découvre les tendances, ton Daily Mix personnalisé, les collabs et les
                    dernières musiques ajoutées.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-xl bg-secondary/50 p-3">
                <Search className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
                <div>
                  <p className="font-medium text-foreground">Recherche</p>
                  <p className="leading-relaxed">
                    Cherche des musiques, des artistes ou des utilisateurs.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-xl bg-secondary/50 p-3">
                <Heart className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
                <div>
                  <p className="font-medium text-foreground">Favoris</p>
                  <p className="leading-relaxed">
                    Retrouve toutes tes musiques likées au même endroit.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-xl bg-secondary/50 p-3">
                <Bell className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
                <div>
                  <p className="font-medium text-foreground">Notifications</p>
                  <p className="leading-relaxed">
                    Reçois les alertes quand quelqu'un interagit avec toi.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-xl bg-secondary/50 p-3">
                <Car className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
                <div>
                  <p className="font-medium text-foreground">Mode Voiture</p>
                  <p className="leading-relaxed">
                    Une interface simplifiée et optimisée pour la conduite.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* ── Ajouter des amis ── */}
          <section>
            <h3 className="mb-2 flex items-center gap-2 text-lg font-semibold text-foreground">
              <Users className="h-5 w-5 text-primary" />
              Ajouter des amis
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Va dans l'onglet <strong>Social</strong> (l'icône en bas de l'écran). Tu peux
              rechercher des utilisateurs, envoyer des demandes d'amis et voir les profils
              des autres membres. Une fois amis, vous pouvez vous envoyer des messages et
              écouter de la musique ensemble !
            </p>
          </section>

          {/* ── Uploader une musique ── */}
          <section>
            <h3 className="mb-2 flex items-center gap-2 text-lg font-semibold text-foreground">
              <Upload className="h-5 w-5 text-primary" />
              Uploader une musique
            </h3>
            <p className="mb-3 text-sm text-muted-foreground leading-relaxed">
              Va sur ton profil (icône en bas à droite) puis appuie sur le bouton
              <strong> Upload</strong>. Choisis un fichier audio (MP3, WAV, etc.), ajoute
              un titre, un artiste, une cover et c'est prêt !
            </p>

            <div className="rounded-xl border border-border bg-card p-4">
              <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
                <Youtube className="h-4 w-4 text-red-500" />
                Télécharger depuis YouTube
              </h4>

              {/* PC */}
              <div className="mb-3">
                <div className="mb-1 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-foreground">
                  <Monitor className="h-3.5 w-3.5" />
                  Sur PC
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Le plus simple est d'installer cette extension Chrome :{' '}
                  <a
                    href="https://chromewebstore.google.com/detail/youtube-to-mp3/ogoimgmekoacpndfanncfplddpjnecjm"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-primary underline hover:text-primary/80"
                  >
                    Youtube to MP3
                  </a>
                  . Une fois installée, va sur YouTube, choisis la musique que tu veux et
                  télécharge-la avec l'extension. Le reste (cover, infos…) n'a pas besoin
                  d'être détaillé, tu peux le laisser vide ou le modifier après.
                </p>
              </div>

              {/* Mobile */}
              <div>
                <div className="mb-1 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-foreground">
                  <Smartphone className="h-3.5 w-3.5" />
                  Sur Mobile
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Copie le lien de la vidéo YouTube, va sur{' '}
                  <a
                    href="https://notube.lol/fr/youtube-app-348"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-primary underline hover:text-primary/80"
                  >
                    notube.lol
                  </a>
                  , colle le lien et télécharge la musique.
                </p>
              </div>
            </div>
          </section>

          {/* ── Remarque ── */}
          <p className="text-center text-xs text-muted-foreground">
            Jux est en constante évolution — amuse-toi bien ! 🚀
          </p>
        </div>

        {/* Bottom close */}
        <div className="mt-6 text-center">
          <Button
            variant="default"
            className="w-full rounded-xl"
            onClick={onClose}
          >
            C'est compris !
          </Button>
        </div>
      </div>
    </div>
  );
}

/* Small Home icon (not exported from lucide) */
function HomeIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}