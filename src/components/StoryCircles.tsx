import { useEffect, useState } from 'react';
import { pb } from '@/lib/pocketbase';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import StoryViewer from './StoryViewer';
import CreateStoryModal from './CreateStoryModal';
import { Plus } from 'lucide-react';

export default function StoryCircles() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stories, setStories] = useState<any[]>([]);
  const [profileMap, setProfileMap] = useState<Record<string, any>>({});
  const [viewingIndex, setViewingIndex] = useState(-1);
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    (async () => {
      const res = await pb.collection('stories').getList(1, 50, { filter: 'expires_at > "' + new Date().toISOString() + '"', sort: '-created', requestKey: null });
      setStories(res.items);
      const userIds = [...new Set(res.items.map((r: any) => r.get('user_id')))].filter(Boolean);
      const map: Record<string, any> = {};
      for (const uid of userIds) {
        try {
          const prof = await pb.collection('profiles').getList(1, 1, { filter: `user_id = "${uid}"`, requestKey: null });
          if (prof.items[0]) map[uid] = prof.items[0];
        } catch {}
      }
      setProfileMap(map);
    })();
  }, []);

  const grouped = stories.reduce((acc: any, s: any) => {
    const uid = s.get('user_id');
    if (!acc[uid]) acc[uid] = [];
    acc[uid].push(s);
    return acc;
  }, {} as Record<string, any[]>);

  return (
    <>
      <div className="flex gap-3 overflow-x-auto px-4 pb-4 scrollbar-hide">
        {user && (
          <button onClick={() => setCreateOpen(true)} className="flex flex-col items-center gap-1 flex-shrink-0">
            <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-dashed border-muted-foreground/40">
              <Plus className="h-6 w-6 text-muted-foreground" />
            </div>
            <span className="text-[10px] text-muted-foreground">Ajouter</span>
          </button>
        )}
        {Object.entries(grouped).map(([userId, userStories]: [string, any[]]) => {
          const profile = profileMap[userId];
          return (
            <button key={userId} onClick={() => {
              const startIndex = stories.findIndex((s: any) => s.get('user_id') === userId);
              if (startIndex >= 0) setViewingIndex(startIndex);
            }} className="flex flex-col items-center gap-1 flex-shrink-0">
              <div className="h-16 w-16 rounded-full bg-gradient-primary p-0.5">
                <div className="h-full w-full rounded-full bg-background p-0.5">
                  <Avatar className="h-full w-full">
                    <AvatarImage src={profile?.get('avatar') ? '' : undefined} />
                    <AvatarFallback>{profile?.get('pseudo')?.[0] || '?'}</AvatarFallback>
                  </Avatar>
                </div>
              </div>
              <span className="text-[10px] text-muted-foreground truncate max-w-[64px]">{profile?.get('pseudo') || 'Anonyme'}</span>
            </button>
          );
        })}
      </div>
      {viewingIndex >= 0 && (
        <StoryViewer stories={stories} initialIndex={viewingIndex} onClose={() => setViewingIndex(-1)} />
      )}
      <CreateStoryModal open={createOpen} onOpenChange={setCreateOpen} />
    </>
  );
}