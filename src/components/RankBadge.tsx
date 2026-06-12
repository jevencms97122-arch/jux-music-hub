import { cn } from '@/lib/utils';
import type { RankTier } from '@/lib/ranks';

interface RankBadgeProps {
  tier: RankTier;
  size?: 'sm' | 'md';
  className?: string;
}

/** Pastille du palier (emoji + nom du rang), affichée sur les profils. */
export default function RankBadge({ tier, size = 'sm', className }: RankBadgeProps) {
  return (
    <span
      title={`Palier ${tier.index}/30`}
      className={cn(
        'inline-flex items-center gap-1 rounded-full border font-semibold',
        size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-3 py-1 text-xs',
        tier.ultimate && 'animate-pulse',
        className
      )}
      style={{
        color: tier.color,
        borderColor: `${tier.color}66`,
        backgroundColor: `${tier.color}1a`,
      }}
    >
      <span>{tier.emoji}</span>
      <span>{tier.label}</span>
    </span>
  );
}
