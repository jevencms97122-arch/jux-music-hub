import { useRef, useState, useEffect } from 'react';
import { Flame, ChevronLeft, ChevronRight, Video, User } from 'lucide-react';
import { usePlayer } from '@/contexts/PlayerContext';
import { songCoverUrl, avatarUrl } from '@/lib/storage';
import { pb } from '@/lib/pocketbase';
import CachedImage from '@/components/CachedImage';
import type { Song, Profile } from '@/types/music';

interface Props {
  trending: Song[];
}

export default function TrendingSection({ trending }: Props) {
  const { playSongFromList } = usePlayer();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const [profilesMap, setProfilesMap] = useState<Record<string, Profile>>({});

  useEffect(() => {
    if (trending.length === 0) return;
    const userIds = [...new Set(trending.map((s) => s.uploaded_by))];
    (async () => {
      const map: Record<string, Profile> = {};
      for (const uid of userIds) {
        try {
          const result = await pb.collection('profiles').getList(1, 1, { filter: `user_id = "${uid}"`, requestKey: null });
          if (result.items[0]) {
            const r = result.items[0];
            map[uid] = { id: r.id, user_id: r.get('user_id'), pseudo: r.get('pseudo'), first_name: r.get('first_name'), last_name: r.get('last_name'), avatar_url: r.get('avatar') ? '' : null, bio: r.get('bio'), profile_completed: r.get('profile_completed'), created_at: r.get('created') || r.created, updated_at: r.get('updated') || r.updated } as Profile;
          }
        } catch {}
      }
      setProfilesMap(map);
    })();
  }, [trending]);

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
                <CachedImage src={songCoverUrl(s)} alt={s.title}
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
                {profilesMap[s.uploaded_by] && (
                  <div className="mt-1.5 flex items-center gap-1.5">
                    <div className="h-5 w-5 flex-shrink-0 overflow-hidden rounded-full bg-muted">
                      {avatarUrl(profilesMap[s.uploaded_by]) ? (
                        <CachedImage
                          src={avatarUrl(profilesMap[s.uploaded_by])}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <User className="h-3 w-3 p-0.5 text-muted-foreground" />
                      )}
                    </div>
                    <span className="truncate text-[11px] text-muted-foreground">
                      {profilesMap[s.uploaded_by].pseudo ?? 'Anonyme'}
                    </span>
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}