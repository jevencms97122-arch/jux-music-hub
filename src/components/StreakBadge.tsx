import { useState, useEffect } from 'react';
import { Flame } from 'lucide-react';
import { getUserStats } from '@/lib/streaks';

interface StreakBadgeProps {
  userId: string;
  size?: 'sm' | 'md';
}

export default function StreakBadge({ userId, size = 'md' }: StreakBadgeProps) {
  const [streak, setStreak] = useState(0);

  useEffect(() => {
    getUserStats(userId).then(stats => {
      if (stats) setStreak(stats.currentStreak || 0);
    });
  }, [userId]);

  if (streak === 0) return null;

  const sizeClasses = size === 'sm' ? 'text-xs gap-0.5' : 'text-sm gap-1';
  const iconSize = size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4';

  return (
    <div className={`inline-flex items-center ${sizeClasses} px-2 py-1 rounded-full bg-orange-500/10 text-orange-500`}>
      <Flame className={iconSize} />
      <span className="font-bold">{streak}</span>
    </div>
  );
}
