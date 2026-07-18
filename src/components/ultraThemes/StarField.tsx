import '@/styles/ultraGalaxy.css';
import { cn } from '@/lib/utils';

export default function StarField({ paused }: { paused: boolean }) {
  return (
    <div aria-hidden className={cn('ultra-galaxy', paused && 'paused')}>
      <div className="stars1" />
      <div className="stars2" />
      <div className="stars3" />
    </div>
  );
}
