import { useEffect, useRef, useState } from 'react';
import { pb } from '@/lib/pocketbase';
import { useAuth } from '@/contexts/AuthContext';
import { songCoverUrl, songAudioUrl } from '@/lib/storage';
import { X } from 'lucide-react';

interface Props {
  stories: any[];
  initialIndex?: number;
  onClose: () => void;
}

export default function StoryViewer({ stories, initialIndex = 0, onClose }: Props) {
  const { user } = useAuth();
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [progress, setProgress] = useState(0);
  const progressRef = useRef(0);
  const intervalRef = useRef<number | null>(null);

  const story = stories[currentIndex];

  useEffect(() => {
    if (!story) return;
    // Record view
    if (user) {
      pb.collection('story_views').create({ story_id: story.id, viewer_id: user.id }).catch(() => {});
    }
    // Start progress
    progressRef.current = 0;
    setProgress(0);
    const duration = 5000; // 5s per story
    const step = 100;
    intervalRef.current = window.setInterval(() => {
      progressRef.current += step;
      setProgress(progressRef.current);
      if (progressRef.current >= duration) {
        if (intervalRef.current) clearInterval(intervalRef.current);
        if (currentIndex < stories.length - 1) setCurrentIndex((i) => i + 1);
        else onClose();
      }
    }, step);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [story?.id, currentIndex, user]);

  const handleClick = (e: React.MouseEvent) => {
    const x = e.clientX / window.innerWidth;
    if (x < 0.3 && currentIndex > 0) setCurrentIndex((i) => i - 1);
    else if (x > 0.7 && currentIndex < stories.length - 1) setCurrentIndex((i) => i + 1);
    else onClose();
  };

  if (!story) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black" onClick={handleClick}>
      <button onClick={(e) => { e.stopPropagation(); onClose(); }} className="absolute right-4 top-4 z-10 text-white"><X className="h-6 w-6" /></button>
      <div className="absolute left-0 right-0 top-2 z-10 flex gap-1 px-2">
        {stories.map((_, i) => (
          <div key={i} className="h-1 flex-1 rounded-full bg-white/30 overflow-hidden">
            <div className="h-full rounded-full bg-white transition-all" style={{ width: i === currentIndex ? `${(progress / 5000) * 100}%` : i < currentIndex ? '100%' : '0%' }} />
          </div>
        ))}
      </div>
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <p className="text-lg font-bold text-white">{story.get('comment') || ''}</p>
          <p className="text-sm text-white/70 mt-2">Story musicale</p>
        </div>
      </div>
    </div>
  );
}