import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { songAudioUrl, songCoverUrl } from '@/lib/storage';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import type { Story, Profile, Song } from '@/types/music';

interface FullStory extends Story { profile?: Profile; song?: Song }

interface Props {
  stories: FullStory[];
  startIndex: number;
  onClose: () => void;
}

export default function StoryViewer({ stories, startIndex, onClose }: Props) {
  const { authUser } = useAuth();
  const [idx, setIdx] = useState(startIndex);
  const [progress, setProgress] = useState(0);
  const [closing, setClosing] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const story = stories[idx];

  useEffect(() => {
    if (!story?.song) return;
    const audio = new Audio(songAudioUrl(story.song));
    audio.currentTime = story.start_time;
    audio.play().catch(() => {});
    audioRef.current = audio;

    const dur = story.end_time - story.start_time;
    const onTime = () => {
      const p = ((audio.currentTime - story.start_time) / dur) * 100;
      setProgress(p);
      if (audio.currentTime >= story.end_time) next();
    };
    audio.addEventListener('timeupdate', onTime);

    if (authUser) {
      supabase.from('story_views').insert({ story_id: story.id, viewer_id: authUser.id }).then(() => {});
    }

    return () => { audio.pause(); audio.removeEventListener('timeupdate', onTime); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx]);

  const handleClose = () => {
    setClosing(true);
    setTimeout(onClose, 250); // attend la fin de l'animation
  };

  const next = () => idx < stories.length - 1 ? setIdx(idx + 1) : handleClose();
  const prev = () => idx > 0 && setIdx(idx - 1);

  if (!story) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex flex-col bg-black"
      style={{
        animation: closing
          ? 'fadeOut 0.25s ease-in both'
          : 'fadeIn 0.3s ease-out both',
      }}
    >
      <div className="flex gap-1 p-2">
        {stories.map((_, i) => (
          <div key={i} className="h-1 flex-1 overflow-hidden rounded-full bg-white/30">
            <div className="h-full bg-white" style={{ width: i < idx ? '100%' : i === idx ? `${progress}%` : '0%' }} />
          </div>
        ))}
      </div>
      <div
        className="flex items-center gap-2 px-4 py-2 text-white"
        style={{
          animation: 'fadeSlideUp 0.4s cubic-bezier(0.16,1,0.3,1) both',
          animationDelay: '0.1s',
        }}
      >
        <p className="flex-1 text-sm font-medium">@{story.profile?.pseudo}</p>
        <button onClick={handleClose}><X className="h-5 w-5" /></button>
      </div>
      <div
        className="relative flex min-h-0 flex-1 items-center justify-center"
        style={{
          animation: 'scaleIn 0.4s cubic-bezier(0.16,1,0.3,1) both',
          animationDelay: '0.05s',
        }}
      >
        {story.song && (
          <div className="flex h-full w-full items-center justify-center">
            <img
              src={songCoverUrl(story.song)}
              alt=""
              className="h-full w-full object-contain"
              style={{ maxHeight: 'calc(100dvh - 120px)' }}
            />
          </div>
        )}
        <button onClick={prev} className="absolute left-0 top-0 h-full w-1/3"><ChevronLeft className="absolute left-2 top-1/2 -translate-y-1/2 text-white/50" /></button>
        <button onClick={next} className="absolute right-0 top-0 h-full w-1/3"><ChevronRight className="absolute right-2 top-1/2 -translate-y-1/2 text-white/50" /></button>
        {story.comment && (
          <div className="absolute bottom-20 left-0 right-0 px-6 text-center text-white">
            <p className="rounded-lg bg-black/50 p-3 text-sm">{story.comment}</p>
          </div>
        )}
        {story.song && (
          <div className="absolute bottom-4 left-0 right-0 text-center text-white">
            <p className="text-sm font-bold">{story.song.title}</p>
            <p className="text-xs opacity-80">{story.song.author}</p>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
