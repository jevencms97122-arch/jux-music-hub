import { useEffect, useState } from 'react';
import { pb } from '@/lib/pocketbase';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Eye } from 'lucide-react';
import { avatarUrl } from '@/lib/storage';

interface ViewerInfo {
  user_id: string;
  pseudo: string;
  avatar_url: string;
}

/**
 * Liste des personnes ayant vu une story, réservée à son auteur — exactement
 * comme sur Instagram : seul le publieur peut consulter qui a regardé.
 */
export default function StoryViewersSheet({ storyId, open, onOpenChange }: {
  storyId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [viewers, setViewers] = useState<ViewerInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open || !storyId) return;
    setLoading(true);
    (async () => {
      try {
        const views = await pb.collection('story_views').getFullList({
          filter: `story_id = "${storyId}"`,
          sort: '-created',
          requestKey: null,
        });

        // Un même spectateur peut avoir plusieurs vues (re-visionnage) : on ne
        // garde que la plus récente par personne, comme le fait Instagram.
        const viewerIds: string[] = [];
        const seen = new Set<string>();
        for (const v of views as any[]) {
          if (!seen.has(v.viewer_id)) { seen.add(v.viewer_id); viewerIds.push(v.viewer_id); }
        }

        if (viewerIds.length === 0) { setViewers([]); setLoading(false); return; }

        const filter = viewerIds.map((id) => `user_id = "${id}"`).join(' || ');
        const profiles = await pb.collection('profiles').getFullList({ filter, requestKey: null });
        const byId = new Map(profiles.map((r: any) => [r.user_id, r]));
        const ordered = viewerIds
          .map((id) => byId.get(id))
          .filter(Boolean)
          .map((r: any) => ({ user_id: r.user_id, pseudo: r.pseudo, avatar_url: avatarUrl(r) }));
        setViewers(ordered);
      } catch {
        setViewers([]);
      }
      setLoading(false);
    })();
  }, [open, storyId]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl pb-safe max-h-[70vh] flex flex-col overflow-hidden">
        <SheetHeader className="mb-4 flex-shrink-0">
          <SheetTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5 text-primary" />
            Vu par {loading ? '…' : viewers.length}
          </SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
          {loading ? (
            <p className="text-center text-xs text-muted-foreground py-8">Chargement…</p>
          ) : viewers.length === 0 ? (
            <p className="text-center text-xs text-muted-foreground py-8">Personne n'a encore vu cette story</p>
          ) : (
            viewers.map((v) => (
              <div key={v.user_id} className="flex items-center gap-3 rounded-xl bg-card/60 border border-white/[0.06] px-3.5 py-2.5">
                <Avatar className="h-9 w-9 shrink-0">
                  <AvatarImage src={v.avatar_url || ''} />
                  <AvatarFallback>{v.pseudo?.[0]?.toUpperCase() || '?'}</AvatarFallback>
                </Avatar>
                <p className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">{v.pseudo}</p>
              </div>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
