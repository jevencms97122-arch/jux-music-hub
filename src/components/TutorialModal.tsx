import { useEffect, useRef, useState } from 'react';
import {
  X, Music2, Sparkles, Upload, Users, ListMusic, Flame,
  TrendingUp, Tag, Pin, Repeat2, Headphones, UserPlus, Lock,
  Heart, Award, QrCode, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
const juxLogo = '/jux-icon-512.png';

interface TutorialModalProps {
  open: boolean;
  onClose: () => void;
}

interface SlideItem {
  icon: typeof Music2;
  label: string;
  text: string;
}

interface Slide {
  icon: typeof Music2;
  emoji: string;
  title: string;
  description: string;
  items: SlideItem[];
}

const SLIDES: Slide[] = [
  {
    icon: Music2,
    emoji: '🎵',
    title: 'Bienvenue sur Nexora-Music !',
    description: 'Ta plateforme musicale sociale. Écoute, publie et découvre de la musique avec tes amis.',
    items: [
      { icon: Headphones, label: 'Écoute libre', text: 'Tous les sons de la communauté, gratuitement.' },
      { icon: Users, label: 'Social', text: 'Suis tes amis et vois ce qu\'ils écoutent en direct.' },
      { icon: Sparkles, label: 'Personnalisé', text: 'Des recommandations basées sur tes écoutes.' },
    ],
  },
  {
    icon: Sparkles,
    emoji: '✨',
    title: 'Découvre chaque jour',
    description: 'L\'accueil se renouvelle en continu avec du contenu fait pour toi.',
    items: [
      { icon: Sparkles, label: 'Daily Mix', text: 'Une sélection générée chaque jour selon tes 3 derniers jours d\'écoute.' },
      { icon: TrendingUp, label: 'Tendances', text: 'Les sons qui montent dans la communauté.' },
      { icon: Tag, label: 'Par genre', text: 'Filtre l\'accueil par genre en un tap sur une pastille.' },
    ],
  },
  {
    icon: Upload,
    emoji: '🎤',
    title: 'Publie ta musique',
    description: 'Partage tes sons avec la communauté depuis le bouton Upload.',
    items: [
      { icon: Upload, label: 'Upload', text: 'Un fichier audio, un titre, une cover — et c\'est en ligne.' },
      { icon: Repeat2, label: 'Republie', text: 'Reposte les sons que tu aimes sur ton profil.' },
      { icon: Pin, label: 'Titre épinglé', text: 'Mets un son en avant sur ton profil, avec extrait choisi.' },
    ],
  },
  {
    icon: Users,
    emoji: '👥',
    title: 'Retrouve tes amis',
    description: 'L\'onglet Social, c\'est ta communauté en temps réel.',
    items: [
      { icon: UserPlus, label: 'Abonnements', text: 'Envoie des demandes et accepte celles qu\'on t\'envoie.' },
      { icon: Headphones, label: 'En ce moment', text: 'Vois en direct ce que tes amis écoutent.' },
      { icon: QrCode, label: 'QR code', text: 'Partage ton profil en un scan depuis la page Profil.' },
    ],
  },
  {
    icon: ListMusic,
    emoji: '📚',
    title: 'Crée tes playlists',
    description: 'Organise ta musique et construis des playlists à plusieurs.',
    items: [
      { icon: Lock, label: 'Privées ou publiques', text: 'Tu choisis qui peut voir chaque playlist.' },
      { icon: Users, label: 'Collaboratives', text: 'Invite des amis (qui te suivent en retour) à ajouter des sons.' },
      { icon: Heart, label: 'Titres likés', text: 'Tous tes sons likés réunis automatiquement dans Favoris.' },
    ],
  },
  {
    icon: Flame,
    emoji: '🔥',
    title: 'Ton univers',
    description: 'Plus tu écoutes, plus ton profil prend vie.',
    items: [
      { icon: Flame, label: 'Série d\'écoute', text: 'Écoute chaque jour pour faire grimper ta flamme.' },
      { icon: Award, label: 'Rang', text: 'Accomplis des quêtes pour monter de palier, d\'Amateur I au Divin de Nexora.' },
      { icon: Sparkles, label: 'Wrapped', text: 'Tes stats d\'écoute résumées, accessibles depuis ton profil.' },
    ],
  },
];

export default function TutorialModal({ open, onClose }: TutorialModalProps) {
  const [index, setIndex] = useState(0);
  const touchStartX = useRef<number | null>(null);

  // Repart de la première slide à chaque ouverture
  useEffect(() => {
    if (open) setIndex(0);
  }, [open]);

  if (!open) return null;

  const isLast = index === SLIDES.length - 1;
  const slide = SLIDES[index];

  const next = () => (isLast ? onClose() : setIndex((i) => i + 1));
  const prev = () => setIndex((i) => Math.max(0, i - 1));

  const onTouchStart = (e: React.TouchEvent) => { touchStartX.current = e.touches[0].clientX; };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const delta = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(delta) < 50) return;
    if (delta < 0 && !isLast) setIndex((i) => i + 1);
    if (delta > 0) prev();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div
        className="relative z-10 flex w-full max-w-md flex-col overflow-hidden rounded-t-3xl bg-background shadow-2xl sm:rounded-3xl"
        style={{ animation: 'fadeSlideUp 0.3s cubic-bezier(0.16,1,0.3,1) both' }}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {/* Halo décoratif */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-gradient-hero" />

        {/* Header : logo + passer */}
        <div className="relative flex items-center justify-between px-5 pt-5">
          <img src={juxLogo} alt="Nexora-Music" className="h-6 w-auto" />
          <button
            onClick={onClose}
            aria-label="Passer le tutoriel"
            className="flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            Passer
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Contenu de la slide */}
        <div key={index} className="relative px-6 pt-6 animate-fade-slide-up">
          {/* Icône héro */}
          <div className="mb-5 flex justify-center">
            <div className="relative">
              <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-primary shadow-elegant">
                <slide.icon className="h-9 w-9 text-primary-foreground" />
              </div>
              <span className="absolute -bottom-2 -right-2 flex h-8 w-8 items-center justify-center rounded-full border border-border/60 bg-background text-base shadow-soft">
                {slide.emoji}
              </span>
            </div>
          </div>

          <h2 className="text-center text-xl font-extrabold tracking-tight">{slide.title}</h2>
          <p className="mx-auto mt-1.5 max-w-xs text-center text-sm leading-relaxed text-muted-foreground">
            {slide.description}
          </p>

          {/* Points clés */}
          <div className="mt-5 space-y-2.5">
            {slide.items.map((item) => (
              <div key={item.label} className="flex items-start gap-3 rounded-2xl border border-border/40 bg-card/50 p-3">
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-primary/10">
                  <item.icon className="h-4 w-4 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{item.label}</p>
                  <p className="text-xs leading-relaxed text-muted-foreground">{item.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer : dots + navigation */}
        <div className="relative px-6 pb-6 pt-5 safe-bottom">
          {/* Dots */}
          <div className="mb-4 flex items-center justify-center gap-1.5">
            {SLIDES.map((_, i) => (
              <button
                key={i}
                onClick={() => setIndex(i)}
                aria-label={`Slide ${i + 1}`}
                className={cn(
                  'h-1.5 rounded-full transition-[width,background-color] duration-300',
                  i === index ? 'w-6 bg-gradient-primary' : 'w-1.5 bg-secondary hover:bg-muted'
                )}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            {index > 0 && (
              <Button
                variant="outline"
                size="icon"
                aria-label="Précédent"
                className="h-11 w-11 flex-shrink-0 rounded-xl"
                onClick={prev}
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
            )}
            <Button
              className="h-11 flex-1 rounded-xl bg-gradient-primary text-sm font-bold shadow-elegant-sm"
              onClick={next}
            >
              {isLast ? 'C\'est parti ! 🚀' : 'Suivant'}
              {!isLast && <ChevronRight className="ml-1 h-4 w-4" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
