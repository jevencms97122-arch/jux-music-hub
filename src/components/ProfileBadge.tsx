import { Crown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProfileBadgeProps {
  label: string;
  size?: 'sm' | 'md';
  className?: string;
}

/** Pastille de badge spécial (ex: "PDG de Jux Music"), affichée sur les profils. */
export default function ProfileBadge({ label, size = 'sm', className }: ProfileBadgeProps) {
  return (
    <span
      title={label}
      className={cn(
        'inline-flex items-center gap-1 rounded-full border border-amber-400/50 bg-amber-400/10 font-semibold text-amber-400',
        size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-3 py-1 text-xs',
        className
      )}
    >
      <Crown className={size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
      <span>{label}</span>
    </span>
  );
}
