import { useParams, useNavigate } from 'react-router-dom';
import { usePlayer } from '@/contexts/PlayerContext';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ArrowLeft, ExternalLink, Globe, Music } from 'lucide-react';
import type { Collaboration } from '@/types/music';
import { collaborations } from '@/data/collaborations';

const SOCIAL_ICONS: Record<string, { label: string; color: string }> = {
  twitch_url: { label: 'Twitch', color: '#9146FF' },
  youtube_url: { label: 'YouTube', color: '#FF0000' },
  discord_url: { label: 'Discord', color: '#5865F2' },
  instagram_url: { label: 'Instagram', color: '#E4405F' },
  twitter_url: { label: 'Twitter', color: '#1DA1F2' },
  tiktok_url: { label: 'TikTok', color: '#000000' },
};

export default function CollabDetail() {
  const { username } = useParams();
  const navigate = useNavigate();
  const { playSongFromList } = usePlayer();

  const collab = collaborations.find((c) => c.pseudo === username) ?? null;

  if (!collab) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6">
        <p className="text-muted-foreground">Collaboration introuvable</p>
        <Button variant="outline" onClick={() => navigate(-1)}>
          Retour
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-40">
      {/* ── Bannière ── */}
      <div className="relative h-48 w-full overflow-hidden bg-gradient-to-br from-primary/30 to-secondary/30">
        {collab.banner_url ? (
          <img src={collab.banner_url} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Music className="h-16 w-16 text-muted-foreground/30" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />

        <Button
          variant="ghost"
          size="icon"
          className="absolute left-3 top-3 z-10 bg-background/50 backdrop-blur-sm"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
      </div>

      {/* ── Avatar + Infos ── */}
      <div className="relative -mt-12 flex flex-col items-center px-6">
        <Avatar className="h-24 w-24 ring-4 ring-background">
          <AvatarImage src={collab.avatar_url ?? undefined} />
          <AvatarFallback className="text-2xl">
            {collab.pseudo[0]?.toUpperCase() ?? '?'}
          </AvatarFallback>
        </Avatar>

        <h1 className="mt-3 text-2xl font-bold">{collab.display_name ?? collab.pseudo}</h1>
        <p className="text-sm text-muted-foreground">@{collab.pseudo}</p>

        {collab.bio && (
          <p className="mt-2 max-w-md text-center text-sm text-muted-foreground">{collab.bio}</p>
        )}
      </div>

      {/* ── Réseaux sociaux ── */}
      <div className="mt-6 flex flex-wrap justify-center gap-3 px-6">
        {Object.entries(SOCIAL_ICONS).map(([key, config]) => {
          const url = collab[key as keyof Collaboration] as string | null;
          if (!url) return null;
          return (
            <a
              key={key}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-white transition-transform hover:scale-105 active:scale-95"
              style={{ backgroundColor: config.color }}
            >
              <ExternalLink className="h-4 w-4" />
              {config.label}
            </a>
          );
        })}
      </div>

      {/* ── Bouton profil Jux ── */}
      {collab.user_id && (
        <div className="mt-8 px-6">
          <Button
            className="w-full gap-2"
            size="lg"
            onClick={() => navigate(`/u/${collab.user_id}`)}
          >
            <Globe className="h-5 w-5" />
            Voir son profil Jux
          </Button>
        </div>
      )}
    </div>
  );
}