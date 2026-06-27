import { useRef, useState, useEffect } from 'react';
import { Flame, ChevronLeft, ChevronRight, User } from 'lucide-react';
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
          const result = await pb.collection('profiles').getList(1, 1, {
            filter: `user_id = "${uid}"`,
            requestKey: null,
          });
          if (result.items[0]) {
            const r = result.items[0];
            map[uid] = {
              id: r.id,
              collectionName: r.collectionName,
              user_id: r.user_id,
              pseudo: r.pseudo,
              first_name: r.first_name,
              last_name: r.last_name,
              avatar_url: r.avatar || null,
              bio: r.bio,
              profile_completed: r.profile_completed,
              created_at: r.created || r.created,
              updated_at: r.updated || r.updated,
            } as Profile;
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
    el.scrollBy({ left: direction === 'left' ? -el.clientWidth * 0.66 : el.clientWidth * 0.66, behavior: 'smooth' });
  };

  return (
    <section className="relative mb-8 px-4 animate-fade-slide-up" style={{ animationDelay: '0.15s' }}>
      {/* Header */}
      <div className="mb-4 flex items-center gap-2.5">
        <Flame className="h-4 w-4 text-primary" strokeWidth={2} />
        <h2 className="text-base font-bold tracking-tight text-foreground">Tendances</h2>
      </div>

      <div className="group relative">
        {canScrollLeft && (
          <button
            onClick={() => scroll('left')}
            className="absolute -left-2 top-1/3 z-10 hidden -translate-y-1/2 rounded-full bg-background/90 p-1.5 shadow-elegant backdrop-blur-md group-hover:flex md:flex"
            aria-label="Précédent"
          >
            <ChevronLeft className="h-4 w-4 text-foreground" />
          </button>
        )}
        {canScrollRight && (
          <button
            onClick={() => scroll('right')}
            className="absolute -right-2 top-1/3 z-10 hidden -translate-y-1/2 rounded-full bg-background/90 p-1.5 shadow-elegant backdrop-blur-md group-hover:flex md:flex"
            aria-label="Suivant"
          >
            <ChevronRight className="h-4 w-4 text-foreground" />
          </button>
        )}

        <div
          ref={scrollRef}
          className="-mx-4 flex gap-3 overflow-x-auto scrollbar-hide px-4 pb-2"
        >
          {trending.map((s, i) => (
            <button
              key={s.id}
              onClick={() => playSongFromList(s, trending)}
              className="group/card relative flex w-44 flex-shrink-0 flex-col gap-2.5 text-left"
            >
              <div className="relative aspect-square w-full overflow-hidden rounded-xl shadow-card transition-transform duration-300 group-hover/card:scale-[1.03]">
                <CachedImage
                  src={songCoverUrl(s)}
                  alt={s.title}
                  className="h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

                {/* Rank badge */}
                <div className="absolute bottom-2 left-2 flex h-7 w-7 items-center justify-center rounded-lg bg-black/50 backdrop-blur-md ring-1 ring-white/10">
                  <span className="text-xs font-bold text-foreground">
                    {i + 1}
                  </span>
                </div>

                {i === 0 && (
                  <div className="absolute right-2 top-2 rounded-md bg-primary/90 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-primary-foreground backdrop-blur-sm">
                    #1
                  </div>
                )}

                <div className="absolute inset-0 rounded-xl ring-1 ring-inset ring-white/[0.08]" />
              </div>

              <div>
                <p className="truncate text-[13px] font-semibold text-foreground">{s.title}</p>
                <p className="truncate text-[11px] text-muted-foreground">{s.author}</p>
                {profilesMap[s.uploaded_by] && (
                  <div className="mt-1.5 flex items-center gap-1.5">
                    <div className="h-4 w-4 flex-shrink-0 overflow-hidden rounded-full bg-muted ring-1 ring-white/10">
                      {avatarUrl(profilesMap[s.uploaded_by]) ? (
                        <CachedImage
                          src={avatarUrl(profilesMap[s.uploaded_by])}
                          alt=""
                          className="h-full w-full object-cover"
                          exempt
                        />
                      ) : (
                        <User className="h-2.5 w-2.5 p-0.5 text-muted-foreground" />
                      )}
                    </div>
                    <span className="truncate text-[10px] text-muted-foreground">
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
