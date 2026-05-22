import { useRef, useState, useEffect } from 'react';
import { Flame, ChevronLeft, ChevronRight, Video } from 'lucide-react';
import { usePlayer } from '@/contexts/PlayerContext';
import { songCoverUrl } from '@/lib/storage';
import type { Song } from '@/types/music';

interface Props {
  trending: Song[];
}

export default function TrendingSection({ trending }: Props) {
  const { playSongFromList } = usePlayer();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const updateScrollButtons = () => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener('scroll', updateScrollButtons);
    updateScrollButtons();
    return () => el.removeEventListener('scroll', updateScrollButtons);
  }, [trending]);

  const scroll = (direction: 'left' | 'right') => {
    const el = scrollRef.current;
    if (!el) return;
    const scrollAmount = el.clientWidth * 0.66;
    el.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    });
  };

  return (
    <section
      className="relative mb-8 px-4"
      style={{ animation: 'fadeSlideUp 0.6s cubic-bezier(0.16,1,0.3,1) both', animationDelay: '0.55s' }}
    >
      <div className="mb-4 flex items-center gap-2">
        <Flame className="h-6 w-6 text-primary" />
        <h2 className="text-xl font-bold text-foreground">Tendances</h2>
      </div>

      <div className="group relative">
        {/* Left arrow */}
        {canScrollLeft && (
          <button
            onClick={() => scroll('left')}
            className="absolute -left-2 top-1/2 z-10 hidden -translate-y-1/2 rounded-full bg-background/80 p-2 shadow-elegant backdrop-blur-md transition-all hover:bg-background group-hover:flex md:flex"
            aria-label="Voir les précédents"
          >
            <ChevronLeft className="h-5 w-5 text-foreground" />
          </button>
        )}

        {/* Right arrow */}
        {canScrollRight && (
          <button
            onClick={() => scroll('right')}
            className="absolute -right-2 top-1/2 z-10 hidden -translate-y-1/2 rounded-full bg-background/80 p-2 shadow-elegant backdrop-blur-md transition-all hover:bg-background group-hover:flex md:flex"
            aria-label="Voir les suivants"
          >
            <ChevronRight className="h-5 w-5 text-foreground" />
          </button>
        )}

        {/* Scrollable container */}
        <div
          ref={scrollRef}
          className="-mx-4 flex gap-4 overflow-x-auto scrollbar-hide px-4 pb-2"
        >
          {trending.map((s, i) => (
            <button
              key={s.id}
              onClick={() => playSongFromList(s, trending)}
              className="group relative flex w-48 flex-shrink-0 flex-col gap-3 text-left"
              style={{ animation: 'fadeSlideUp 0.5s cubic-bezier(0.16,1,0.3,1) both', animationDelay: `${0.60 + i * 0.08}s` }}
            >
              <div className="relative aspect-square w-full overflow-hidden rounded-xl shadow-card transition-transform group-hover:scale-105">
                <img src={songCoverUrl(s)} alt={s.title} loading="lazy"
                  className="h-full w-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                <div className="absolute bottom-3 left-3 right-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground shadow-elegant">
                    {i + 1}
                  </div>
                </div>
              </div>
              <div>
                <p className="truncate text-sm font-semibold text-foreground">{s.title}</p>
                <p className="truncate text-xs text-muted-foreground">{s.author}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}