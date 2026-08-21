import { Crown, Music2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { normalizeBadge, type BadgeRole } from '@/lib/badges';

interface ProfileBadgeProps {
  label: string;
  size?: 'sm' | 'md';
  className?: string;
}

const STYLES: Record<BadgeRole, { icon: typeof Crown; classes: string }> = {
  PDG: {
    icon: Crown,
    classes: 'border-amber-400/50 bg-amber-400/10 text-amber-400',
  },
  Publicateur: {
    icon: Music2,
    classes: 'border-slate-400/50 bg-slate-400/10 text-slate-400',
  },
};

/** Pastille de badge de rôle (PDG ou Publicateur), affichée sur les profils. */
export default function ProfileBadge({ label, size = 'sm', className }: ProfileBadgeProps) {
  const role = normalizeBadge(label);
  if (!role) return null;

  const { icon: Icon, classes } = STYLES[role];

  return (
    <span
      title={label}
      className={cn(
        'inline-flex items-center gap-1 rounded-full border font-semibold',
        classes,
        size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-3 py-1 text-xs',
        className
      )}
    >
      <Icon className={size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
      <span>{label}</span>
    </span>
  );
}
