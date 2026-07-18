import { cn } from '@/lib/utils';
import type { NebulaColors } from '@/lib/ultraNebulaPalette';

const BASE_DRIFT_DURATION = 70;
const BASE_PULSE_DURATION = 8;

export default function AuroraNebula({
  colors,
  speed,
  paused,
}: {
  colors: NebulaColors | null;
  speed: number;
  paused: boolean;
}) {
  const style: Record<string, string> = {
    '--ultra-speed-drift': `${(BASE_DRIFT_DURATION / speed).toFixed(1)}s`,
    '--ultra-speed-pulse': `${(BASE_PULSE_DURATION / speed).toFixed(1)}s`,
  };
  if (colors) {
    style['--ultra-c1'] = colors[0];
    style['--ultra-c2'] = colors[1];
    style['--ultra-c3'] = colors[2];
  }
  return <div aria-hidden className={cn('ultra-nebula', paused && 'paused')} style={style} />;
}
