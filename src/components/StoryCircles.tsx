import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { avatarUrl } from '@/lib/storage';
import StoryViewer from './StoryViewer';
import type { Story, Profile, Song } from '@/types/music';

interface FullStory extends Story { profile?: Profile; song?: Song }

interface UserStories {
  userId: string;
  profile?: Profile;
  stories: FullStory[];
}

export default function StoryCircles() {
  const [userStoriesMap, setUserStoriesMap] = useState<UserStories[]>([]);
  const [openUserIdx, setOpenUserIdx] = useState<number | null>(null);
  const [openStoryIdx, setOpenStoryIdx] = useState<number>(0);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('stories').select('*').gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false }).limit(50);
      const list = (data ?? []) as Story[];
      const userIds = [...new Set(list.map((s) => s.user_id))];
      const songIds = [...new Set(list.map((s) => s.song_id))];
      const [{ data: profiles }, { data: songs }] = await Promise.all([
        userIds.length ? supabase.from('profiles').select('*').in('user_id', userIds) : Promise.resolve({ data: [] }),
        songIds.length ? supabase.from('songs').select('*').in('id', songIds) : Promise.resolve({ data: [] }),
      ]);
      
      // Group stories by user
      const storiesByUser = new Map<string, Story[]>();
      list.forEach((s) => {
        if (!storiesByUser.has(s.user_id)) storiesByUser.set(s.user_id, []);
        storiesByUser.get(s.user_id)!.push(s);
      });
      
      const userStories: UserStories[] = Array.from(storiesByUser).map(([userId, userStoryList]) => ({
        userId,
        profile: (profiles ?? []).find((p: any) => p.user_id === userId) as Profile | undefined,
        stories: userStoryList.map((s) => ({
          ...s,
          profile: (profiles ?? []).find((p: any) => p.user_id === s.user_id) as Profile | undefined,
          song: (songs ?? []).find((x: any) => x.id === s.song_id) as Song | undefined,
        })),
      }));
      
      setUserStoriesMap(userStories);
    })();
  }, []);

  if (userStoriesMap.length === 0) return null;

  return (
    <>
      <div className="flex gap-3 overflow-x-auto px-4 py-4 scrollbar-hide">
        {userStoriesMap.map((userStory, i) => (
          <button key={userStory.userId} onClick={() => { setOpenUserIdx(i); setOpenStoryIdx(0); }} className="flex flex-col items-center gap-1 flex-shrink-0">
            <div className="rounded-full bg-gradient-to-tr from-primary to-accent p-[2px]">
              <Avatar className="h-16 w-16 border-2 border-background">
                <AvatarImage src={userStory.profile ? avatarUrl(userStory.profile) : ''} />
                <AvatarFallback>{userStory.profile?.pseudo?.[0]?.toUpperCase() ?? '?'}</AvatarFallback>
              </Avatar>
            </div>
            <span className="max-w-[70px] truncate text-[10px] text-muted-foreground">{userStory.profile?.pseudo}</span>
          </button>
        ))}
      </div>
      {openUserIdx !== null && (
        <StoryViewer
          stories={userStoriesMap[openUserIdx].stories}
          startIndex={openStoryIdx}
          onClose={() => setOpenUserIdx(null)}
        />
      )}
    </>
  );
}
