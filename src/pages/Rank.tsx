import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useSeo } from '@/lib/useSeo';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Check, Crown, Lock, Trophy } from 'lucide-react';
import { getRankProgress, RANK_TIERS, type RankProgress } from '@/lib/ranks';
import { cn } from '@/lib/utils';

export default function Rank() {
  useSeo({ title: 'Classement — Nexora Music', description: 'Ton rang et ta progression sur Nexora Music.', path: '/rank' });
  const { user } = useAuth();
  const navigate = useNavigate();
  const [progress, setProgress] = useState<RankProgress | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    getRankProgress(user.id)
      .then(setProgress)
      .finally(() => setLoading(false));
  }, [user]);

  if (loading || !progress) {
    return (
      <div className="relative min-h-screen pb-32">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-gradient-hero" />
        <div className="relative flex flex-col items-center px-5 pt-6">
          <div className="mb-6 h-9 w-9 self-start animate-pulse rounded-full bg-secondary" />
          <div className="h-24 w-24 animate-pulse rounded-full bg-secondary" />
          <div className="mt-4 h-5 w-40 animate-pulse rounded bg-secondary" />
          <div className="mt-6 h-3 w-full animate-pulse rounded-full bg-secondary" />
          <div className="mt-6 h-40 w-full animate-pulse rounded-2xl bg-secondary" />
        </div>
      </div>
    );
  }

  const { tier, nextTier, quests, questsDone, totalQuests } = progress;
  const pendingQuests = quests.filter((q) => !q.done);
  const doneQuests = quests.filter((q) => q.done);

  return (
    <div className="relative min-h-screen pb-32">
      {/* Halo héro */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-gradient-hero" />

      {/* ── Header ── */}
      <header className="relative flex items-center justify-between px-5 pt-6 animate-fade-slide-up">
        <Button variant="ghost" size="icon" aria-label="Retour" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-base font-bold">Mon rang</h1>
        <div className="w-9" />
      </header>

      {/* ── Palier actuel ── */}
      <section className="relative flex flex-col items-center px-5 pt-4 text-center animate-fade-slide-up delay-1">
        <div
          className={cn('flex h-24 w-24 items-center justify-center rounded-full text-5xl shadow-elegant-sm', tier.ultimate && 'animate-pulse')}
          style={{ backgroundColor: `${tier.color}26`, border: `3px solid ${tier.color}` }}
        >
          {tier.emoji}
        </div>
        <h2 className="mt-4 text-2xl font-extrabold tracking-tight" style={{ color: tier.color }}>
          {tier.label}
        </h2>
        <p className="mt-1 text-xs font-medium text-muted-foreground">
          Palier {tier.index}/{RANK_TIERS.length} · {questsDone}/{totalQuests} quêtes accomplies
        </p>

        {/* Progression vers le prochain palier */}
        <div className="mt-5 w-full rounded-2xl border border-border/50 bg-card/60 p-4 text-left">
          {nextTier ? (
            <>
              <div className="mb-2 flex items-center justify-between text-xs">
                <span className="font-semibold text-muted-foreground">Prochain palier</span>
                <span className="font-bold" style={{ color: nextTier.color }}>
                  {nextTier.emoji} {nextTier.label}
                </span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${(questsDone / totalQuests) * 100}%`, backgroundColor: tier.color }}
                />
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">
                Accomplis {nextTier.questsRequired - questsDone} quête{nextTier.questsRequired - questsDone > 1 ? 's' : ''} de plus pour monter au palier {nextTier.index}.
              </p>
            </>
          ) : (
            <div className="flex items-center gap-2 text-sm font-bold" style={{ color: tier.color }}>
              <Crown className="h-5 w-5" />
              Tu as atteint le palier ultime. Respect éternel. 👑
            </div>
          )}
        </div>
      </section>

      {/* ── Les 30 paliers ── */}
      <section className="relative mt-6 animate-fade-slide-up delay-2">
        <h3 className="mb-3 flex items-center gap-2 px-5 text-base font-bold">
          <Trophy className="h-5 w-5 text-primary" />
          Paliers
        </h3>
        <div className="grid grid-cols-3 gap-2 px-5">
          {RANK_TIERS.map((t) => {
            const reached = t.index <= tier.index;
            const isCurrent = t.index === tier.index;
            return (
              <div
                key={t.index}
                className={cn(
                  'flex flex-col items-center gap-1 rounded-2xl border py-2.5 px-1',
                  reached ? 'border-border/50 bg-card/60' : 'border-border/30 bg-card/20 opacity-45'
                )}
                style={isCurrent ? { borderColor: t.color, boxShadow: `0 0 12px ${t.color}55` } : undefined}
              >
                <div
                  className="flex h-9 w-9 items-center justify-center rounded-full text-lg"
                  style={reached ? { backgroundColor: `${t.color}26`, border: `2px solid ${t.color}` } : undefined}
                >
                  {reached ? t.emoji : <Lock className="h-3.5 w-3.5 text-muted-foreground" />}
                </div>
                <span className={cn('w-full truncate text-center text-[10px] font-semibold', !reached && 'text-muted-foreground')}>
                  {t.label}
                </span>
                <span className="text-[9px] text-muted-foreground">Palier {t.index}</span>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Quêtes ── */}
      <section className="relative px-5 mt-7 animate-fade-slide-up delay-3">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-base font-bold">
            <Check className="h-5 w-5 text-primary" />
            Quêtes
          </h3>
          <span className="rounded-full bg-secondary px-2.5 py-0.5 text-[11px] font-semibold text-muted-foreground">
            {questsDone}/{totalQuests}
          </span>
        </div>
        <div className="space-y-2">
          {[...pendingQuests, ...doneQuests].map((q) => (
            <div
              key={q.id}
              className={cn(
                'flex items-center gap-3 rounded-2xl border p-3',
                q.done ? 'border-primary/40 bg-primary/5' : 'border-border/40 bg-card/50'
              )}
            >
              <div className={cn(
                'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg',
                q.done ? 'bg-gradient-primary shadow-elegant-sm' : 'bg-secondary'
              )}>
                {q.emoji}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{q.name}</p>
                <p className="truncate text-[11px] text-muted-foreground">{q.description}</p>
                {!q.done && q.target > 1 && (
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
                      <div className="h-full rounded-full bg-primary/70" style={{ width: `${(q.value / q.target) * 100}%` }} />
                    </div>
                    <span className="shrink-0 text-[10px] font-medium text-muted-foreground">
                      {q.value}/{q.target}
                    </span>
                  </div>
                )}
              </div>
              {q.done && (
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15">
                  <Check className="h-3.5 w-3.5 text-primary" />
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
