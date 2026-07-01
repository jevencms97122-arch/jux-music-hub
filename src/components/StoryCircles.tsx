import { useEffect, useState } from 'react';
import { pb } from '@/lib/pocketbase';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { avatarUrl } from '@/lib/storage';
import StoryViewer from './StoryViewer';

export default function StoryCircles() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stories, setStories] = useState<any[]>([]);
  const [profileMap, setProfileMap] = useState<Record<string, any>>({});
  const [viewingIndex, setViewingIndex] = useState(-1);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const followsRes = await pb.collection('follows').getList(1, 200, { filter: `follower_id = "${user.id}" && status = "accepted"`, requestKey: null });
      const followingIds = followsRes.items.map((f: any) => f.following_id);
      const visibleUserIds = [...new Set([...followingIds, user.id])];
      const userFilter = visibleUserIds.map((uid) => `user_id = "${uid}"`).join(' || ');
      if (!userFilter) { setStories([]); return; }
      const res = await pb.collection('stories').getList(1, 50, { filter: `expires_at > "${new Date().toISOString()}" && (${userFilter})`, sort: '-created', requestKey: null });
      setStories(res.items);
      const userIds = [...new Set(res.items.map((r: any) => r.user_id))].filter(Boolean);
      const map: Record<string, any> = {};
      for (const uid of userIds) {
        try {
          const prof = await pb.collection('profiles').getList(1, 1, { filter: `user_id = "${uid}"`, requestKey: null });
          if (prof.items[0]) map[uid] = prof.items[0];
        } catch {}
      }
      setProfileMap(map);
    })();
  }, [user]);

  const grouped = stories.reduce((acc: any, s: any) => {
    const uid = s.user_id;
    if (!acc[uid]) acc[uid] = [];
    acc[uid].push(s);
    return acc;
  }, {} as Record<string, any[]>);

  return (
    <>
      <div className="flex gap-3 overflow-x-auto px-4 pb-4 scrollbar-hide">
        {/* Cut A-only: suppression du bouton "Ajouter une story" */}
        {Object.entries(grouped).map(([userId, userStories]: [string, any[]]) => {
          const profile = profileMap[userId];
          return (
            <button key={userId} onClick={() => {
              const startIndex = stories.findIndex((s: any) => s.user_id === userId);
              if (startIndex >= 0) setViewingIndex(startIndex);
            }} className="flex flex-col items-center gap-1 flex-shrink-0">
              <div className="h-16 w-16 rounded-full bg-gradient-primary p-0.5">
                <div className="h-full w-full rounded-full bg-background p-0.5">
                  <Avatar className="h-full w-full">
                    <AvatarImage src={profile ? avatarUrl(profile) : undefined} />
                    <AvatarFallback>{profile?.pseudo?.[0] || '?'}</AvatarFallback>
                  </Avatar>
                </div>
              </div>
              <span className="text-[10px] text-muted-foreground truncate max-w-[64px]">{profile?.pseudo || 'Anonyme'}</span>
            </button>
          );
        })}
      </div>
      {viewingIndex >= 0 && (
        <StoryViewer stories={stories} initialIndex={viewingIndex} onClose={() => setViewingIndex(-1)} />
      )}
    </>
  );
}