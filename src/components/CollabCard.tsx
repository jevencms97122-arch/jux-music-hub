import type { Collaboration } from '@/types/music';
import { useNavigate } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface CollabCardProps {
  collab: Collaboration;
}

export default function CollabCard({ collab }: CollabCardProps) {
  const navigate = useNavigate();

  return (
    <button
      onClick={() => navigate(`/collab/${collab.pseudo}`)}
      className="group flex flex-col items-center gap-2 rounded-xl bg-card/60 p-3 transition-all hover:bg-card hover:shadow-elegant active:scale-[0.97]"
    >
      <Avatar className="h-16 w-16 ring-2 ring-primary/20 transition-transform group-hover:ring-primary/50">
        <AvatarImage src={collab.avatar_url ?? undefined} />
        <AvatarFallback>{collab.pseudo[0]?.toUpperCase() ?? '?'}</AvatarFallback>
      </Avatar>
      <div className="text-center">
        <p className="text-sm font-bold leading-tight">{collab.display_name ?? collab.pseudo}</p>
        <p className="text-xs text-muted-foreground">@{collab.pseudo}</p>
      </div>
    </button>
  );
}