import { useState, useEffect } from 'react';
import { pb, getUserAvatarUrl } from '@/lib/pocketbase';
import { useAuth } from '@/contexts/AuthContext';
import { User } from 'lucide-react';
import StoryViewer from './StoryViewer';
import type { Story, PBUser } from '@/types/music';

interface GroupedStory {
  user: PBUser;
  stories: Story[];
}

export default function StoryCircles() {
  const { user } = useAuth();
  const [groups, setGroups] = useState<GroupedStory[]>([]);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerStories, setViewerStories] = useState<Story[]>([]);
  const [viewerIndex, setViewerIndex] = useState(0);

  useEffect(() => {
    if (!user) return;
    loadStories();
  }, [user]);

  const loadStories = async () => {
    if (!user) return;
    try {
      // Get friends
      const myFollowing = await pb.collection('follows').getFullList({
        filter: `follower="${user.id}" && status="accepted"`,
      });
      const friendIds = [...myFollowing.map((f: any) => f.following), user.id];

      if (friendIds.length === 0) return;

      const now = new Date().toISOString();
      const friendFilter = friendIds.map(id => `user="${id}"`).join('||');

      const stories = await pb.collection('stories').getFullList({
        filter: `(${friendFilter}) && expiresAt>"${now}"`,
        expand: 'user,song',
        sort: '-created',
      }) as unknown as Story[];

      // Group by user
      const grouped = new Map<string, GroupedStory>();
      for (const story of stories) {
        const storyUser = story.expand?.user;
        if (!storyUser) continue;
        if (!grouped.has(storyUser.id)) {
          grouped.set(storyUser.id, { user: storyUser, stories: [] });
        }
        grouped.get(storyUser.id)!.stories.push(story);
      }

      setGroups(Array.from(grouped.values()));
    } catch (error) {
      console.error('Error loading stories:', error);
    }
  };

  const openStories = (group: GroupedStory) => {
    setViewerStories(group.stories);
    setViewerIndex(0);
    setViewerOpen(true);
  };

  if (groups.length === 0) return null;

  return (
    <>
      <div className="flex gap-3 px-4 py-3 overflow-x-auto scrollbar-hide">
        {groups.map(group => (
          <button
            key={group.user.id}
            onClick={() => openStories(group)}
            className="flex flex-col items-center gap-1 flex-shrink-0"
          >
            <div className="h-16 w-16 rounded-full p-0.5 bg-gradient-to-br from-primary to-orange-400">
              <div className="h-full w-full rounded-full overflow-hidden border-2 border-background">
                {group.user.avatar ? (
                  <img src={getUserAvatarUrl(group.user as any)} className="h-full w-full object-cover" />
                ) : (
                  <div className="h-full w-full bg-secondary flex items-center justify-center">
                    <User className="h-6 w-6 text-muted-foreground" />
                  </div>
                )}
              </div>
            </div>
            <span className="text-[10px] text-foreground truncate w-16 text-center">{group.user.pseudo}</span>
          </button>
        ))}
      </div>

      <StoryViewer
        stories={viewerStories}
        initialIndex={viewerIndex}
        isOpen={viewerOpen}
        onClose={() => setViewerOpen(false)}
      />
    </>
  );
}
