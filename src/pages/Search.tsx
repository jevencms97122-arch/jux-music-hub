import { useState, useEffect, useCallback } from 'react';
import { pb } from '@/lib/pocketbase';
import { usePlayer } from '@/contexts/PlayerContext';
import { avatarUrl } from '@/lib/storage';
import SongCard from '@/components/SongCard';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Search as SearchIcon, Music2, Users, Flame, X, ChevronRight, History, LayoutGrid } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Song } from '@/types/music';
import { recordToSong } from '@/lib/pbUtils';

interface UserResult {
  id: string;
  user_id: string;
  pseudo: string;
  avatar_url: string;
  current_streak: number;
  longest_streak: number;
}

type Tab = 'all' | 'songs' | 'users';

const RECENT_KEY = 'search_recent';
const loadRecent = (): string[] => {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); } catch { return []; }
};

export default function Search() {
  const { playSongFromList } = usePlayer();
  const navigate = useNavigate();
  const [term, setTerm] = useState('');
  const [songs, setSongs] = useState<Song[]>([]);
  const [users, setUsers] = useState<UserResult[]>([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<Tab>('all');
  const [recent, setRecent] = useState<string[]>(loadRecent);

  const saveRecent = (t: string) => {
    setRecent((prev) => {
      const next = [t, ...prev.filter((r) => r.toLowerCase() !== t.toLowerCase())].slice(0, 8);
      try { localStorage.setItem(RECENT_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const clearRecent = () => {
    setRecent([]);
    try { localStorage.removeItem(RECENT_KEY); } catch {}
  };

  const doSearch = useCallback(async () => {
    if (!term.trim()) return;
    setLoading(true);
    const t = term.trim();
    try {
      const [songRes, userRes] = await Promise.all([
        pb.collection('songs').getList(1, 30, {
          filter: `title ~ "${t}" || author ~ "${t}" || genre ~ "${t}"`,
          requestKey: null,
        }),
        pb.collection('profiles').getList(1, 20, {
          filter: `pseudo ~ "${t}"`,
          requestKey: null,
        }),
      ]);

      setSongs(songRes.items.map(recordToSong));

      // Fetch streak stats for all found users in one query
      let statsMap: Record<string, any> = {};
      const userIds = userRes.items.map((r: any) => r.user_id).filter(Boolean) as string[];
      if (userIds.length > 0) {
        const statsFilter = userIds.map((id) => `user_id = "${id}"`).join(' || ');
        const statsRes = await pb.collection('user_stats').getList(1, 50, { filter: statsFilter, requestKey: null });
        for (const s of statsRes.items) statsMap[s.user_id as string] = s;
      }

      setUsers(userRes.items.map((r: any) => ({
        id: r.id,
        user_id: r.user_id,
        pseudo: r.pseudo,
        avatar_url: avatarUrl(r),
        current_streak: statsMap[r.user_id]?.current_streak ?? 0,
        longest_streak: statsMap[r.user_id]?.longest_streak ?? 0,
      })));

      if (songRes.items.length > 0 || userRes.items.length > 0) saveRecent(t);
    } catch { setSongs([]); setUsers([]); }
    setSearched(true);
    setLoading(false);
  }, [term]);

  useEffect(() => {
    if (!term.trim()) { setSongs([]); setUsers([]); setSearched(false); setLoading(false); setTab('all'); return; }
    const timer = setTimeout(() => { doSearch(); }, 400);
    return () => clearTimeout(timer);
  }, [term, doSearch]);

  const tabs: { id: Tab; label: string; icon: typeof Music2; count: number }[] = [
    { id: 'all', label: 'Tout', icon: LayoutGrid, count: songs.length + users.length },
    { id: 'songs', label: 'Musiques', icon: Music2, count: songs.length },
    { id: 'users', label: 'Profils', icon: Users, count: users.length },
  ];

  const showSongs = (tab === 'all' || tab === 'songs') && songs.length > 0;
  const showUsers = (tab === 'all' || tab === 'users') && users.length > 0;
  const noResults = searched && !loading && (
    tab === 'all' ? songs.length === 0 && users.length === 0
    : tab === 'songs' ? songs.length === 0
    : users.length === 0
  );

  return (
    <div className="relative min-h-screen pb-40">
      {/* Halo héro */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-gradient-hero" />

      {/* ── Header ── */}
      <header className="relative flex items-center gap-2 px-5 pt-6 animate-fade-slide-up">
        <Button variant="ghost" size="icon" aria-label="Retour" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-2xl font-extrabold tracking-tight">Recherche</h1>
      </header>

      {/* ── Barre de recherche ── */}
      <div className="relative px-5 mt-4 animate-fade-slide-up delay-1">
        <div className="relative">
          <SearchIcon className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Titre, artiste, genre, utilisateur..."
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            autoFocus
            className="h-12 rounded-2xl border-border/50 bg-card/60 pl-11 pr-10 text-sm"
          />
          {term && (
            <button
              onClick={() => setTerm('')}
              aria-label="Effacer"
              className="absolute right-3 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full bg-secondary text-muted-foreground transition-colors hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* ── État initial : recherches récentes ── */}
      {!searched && !loading && (
        <div className="relative px-5 mt-6 animate-fade-slide-up delay-2">
          {recent.length > 0 ? (
            <>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-base font-bold">
                  <History className="h-4 w-4 text-primary" />Recherches récentes
                </h2>
                <button onClick={clearRecent} className="text-xs text-muted-foreground hover:text-foreground">
                  Effacer
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {recent.map((r) => (
                  <button
                    key={r}
                    onClick={() => setTerm(r)}
                    className="flex items-center gap-1.5 rounded-full border border-border/50 bg-card/60 px-3.5 py-1.5 text-xs font-medium transition-colors hover:bg-card"
                  >
                    <SearchIcon className="h-3 w-3 text-muted-foreground" />
                    {r}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border/60 bg-card/30 px-6 py-12 text-center">
              <div className="mb-1 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
                <SearchIcon className="h-6 w-6 text-primary" />
              </div>
              <p className="text-sm font-bold">Explore Jux Music</p>
              <p className="text-xs text-muted-foreground">Cherche un titre, un artiste, un genre ou un utilisateur.</p>
            </div>
          )}
        </div>
      )}

      {/* ── Résultats ── */}
      {(searched || loading) && (
        <section className="relative px-5 mt-5 animate-fade-slide-up delay-2">
          {/* Onglets */}
          <div className="mb-4 flex rounded-2xl border border-border/50 bg-card/50 p-1">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  'flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold transition-colors',
                  tab === t.id ? 'bg-gradient-primary text-primary-foreground shadow-elegant-sm' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <t.icon className="h-3.5 w-3.5" />
                {t.label}
                {searched && t.count > 0 && (
                  <span className={cn('rounded-full px-1.5 text-[10px] font-bold', tab === t.id ? 'bg-white/20' : 'bg-secondary')}>
                    {t.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {loading && !searched ? (
            <div className="grid grid-cols-2 gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <div className="aspect-square w-full animate-pulse rounded-xl bg-secondary" />
                  <div className="h-3 w-3/4 animate-pulse rounded bg-secondary" />
                  <div className="h-2.5 w-1/2 animate-pulse rounded bg-secondary" />
                </div>
              ))}
            </div>
          ) : (
            <>
              {showSongs && (
                <div className="mb-6">
                  {tab === 'all' && (
                    <h2 className="mb-3 flex items-center gap-2 text-base font-bold">
                      <Music2 className="h-4 w-4 text-primary" />Musiques
                    </h2>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    {songs.map((s) => (<SongCard key={s.id} song={s} onPlay={() => playSongFromList(s, songs)} />))}
                  </div>
                </div>
              )}

              {showUsers && (
                <div className="mb-6">
                  {tab === 'all' && (
                    <h2 className="mb-3 flex items-center gap-2 text-base font-bold">
                      <Users className="h-4 w-4 text-primary" />Profils
                    </h2>
                  )}
                  <div className="space-y-2">
                    {users.map((u) => {
                      const displayStreak = u.current_streak >= 3 ? u.current_streak : u.longest_streak >= 3 ? u.longest_streak : 0;
                      const isActive = u.current_streak >= 3;
                      return (
                        <button
                          key={u.id}
                          onClick={() => navigate(`/u/${u.user_id || u.id}`)}
                          className="group flex w-full items-center gap-3 rounded-2xl border border-border/40 bg-card/50 p-3 text-left transition-colors hover:bg-card active:scale-[0.99]"
                        >
                          {u.avatar_url ? (
                            <img src={u.avatar_url} alt={u.pseudo} className="h-11 w-11 shrink-0 rounded-full object-cover" />
                          ) : (
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-bold text-muted-foreground">
                              {u.pseudo?.charAt(0)?.toUpperCase() ?? '?'}
                            </div>
                          )}
                          <span className="min-w-0 flex-1 truncate text-sm font-semibold">{u.pseudo}</span>
                          {displayStreak >= 3 && (
                            <span className={cn(
                              'flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs font-bold',
                              isActive ? 'text-orange-400' : 'text-muted-foreground'
                            )}>
                              <Flame className="h-3.5 w-3.5" />
                              {displayStreak}
                            </span>
                          )}
                          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {noResults && (
                <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border/60 bg-card/30 px-6 py-12 text-center">
                  <div className="mb-1 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
                    <SearchIcon className="h-6 w-6 text-primary" />
                  </div>
                  <p className="text-sm font-bold">Aucun résultat</p>
                  <p className="text-xs text-muted-foreground">Rien trouvé pour « {term.trim()} ». Essaie un autre mot-clé.</p>
                </div>
              )}
            </>
          )}
        </section>
      )}
    </div>
  );
}
