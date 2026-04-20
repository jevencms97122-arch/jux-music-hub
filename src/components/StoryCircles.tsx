import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { avatarUrl } from '@/lib/storage';
import StoryViewer from './StoryViewer';
import type { Story, Profile, Song } from '@/types/music';

interface FullStory extends Story { profile?: Profile; song?: Song }

export default function StoryCircles() {
  const [stories, setStories] = useState<FullStory[]>([]);
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('stories').select('*').gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false }).limit(30);
      const list = (data ?? []) as Story[];
      const userIds = [...new Set(list.map((s) => s.user_id))];
      const songIds = [...new Set(list.map((s) => s.song_id))];
      const [{ data: profiles }, { data: songs }] = await Promise.all([
        userIds.length ? supabase.from('profiles').select('*').in('user_id', userIds) : Promise.resolve({ data: [] }),
        songIds.length ? supabase.from('songs').select('*').in('id', songIds) : Promise.resolve({ data: [] }),
      ]);
      setStories(list.map((s) => ({
        ...s,
        profile: (profiles ?? []).find((p: any) => p.user_id === s.user_id) as Profile | undefined,
        song: (songs ?? []).find((x: any) => x.id === s.song_id) as Song | undefined,
      })));
    })();
  }, []);

  if (stories.length === 0) return null;

  return (
    <>
      <div className="flex gap-3 overflow-x-auto px-4 py-2">
        {stories.map((s, i) => (
          <button key={s.id} onClick={() => setOpenIdx(i)} className="flex flex-col items-center gap-1">
            <div className="rounded-full bg-gradient-to-tr from-primary to-accent p-[2px]">
              <Avatar className="h-14 w-14 border-2 border-background">
                <AvatarImage src={s.profile ? avatarUrl(s.profile) : ''} />
                <AvatarFallback>{s.profile?.pseudo?.[0]?.toUpperCase() ?? '?'}</AvatarFallback>
              </Avatar>
            </div>
            <span className="max-w-[60px] truncate text-[10px] text-muted-foreground">{s.profile?.pseudo}</span>
          </button>
        ))}
      </div>
      {openIdx !== null && (
        <StoryViewer
          stories={stories}
          startIndex={openIdx}
          onClose={() => setOpenIdx(null)}
        />
      )}
    </>
  );
}
