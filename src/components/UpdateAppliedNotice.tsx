import { useEffect, useState } from 'react';
import { isTauri } from '@tauri-apps/api/core';
import { getVersion } from '@tauri-apps/api/app';
import { updatePb } from '@/lib/updatePocketbase';
import { UPDATE_TRANSITION_KEY, type UpdateTransition } from '@/lib/updateTransition';
import { Sparkles, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

/** Affiche une fois, au premier lancement après une mise à jour, "1.0.x -> 1.0.y" + les notes. */
export default function UpdateAppliedNotice() {
  const [transition, setTransition] = useState<UpdateTransition | null>(null);
  const [notes, setNotes] = useState<string | null>(null);

  useEffect(() => {
    if (!isTauri()) return;
    const raw = localStorage.getItem(UPDATE_TRANSITION_KEY);
    if (!raw) return;
    localStorage.removeItem(UPDATE_TRANSITION_KEY); // ne s'affiche qu'une fois, peu importe l'issue

    (async () => {
      let parsed: UpdateTransition;
      try {
        parsed = JSON.parse(raw);
      } catch {
        return;
      }
      let current: string;
      try {
        current = await getVersion();
      } catch {
        return;
      }
      // La version tournante correspond bien à la cible : la mise à jour a réussi.
      if (current !== parsed.to) return;

      setTransition(parsed);
      try {
        const record = await updatePb.collection('app_updates').getFirstListItem(
          `plateforme = "win" && version = "${parsed.to}"`,
          { requestKey: null }
        );
        setNotes((record as any)?.notedemiseajour || null);
      } catch { /* noop */ }
    })();
  }, []);

  if (!transition) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="relative w-full max-w-md rounded-2xl bg-background p-6 shadow-2xl mx-4">
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-3 top-3"
          onClick={() => setTransition(null)}
          aria-label="Fermer"
        >
          <X className="h-5 w-5" />
        </Button>

        <div className="mb-4 flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/15">
            <Sparkles className="h-7 w-7 text-primary" />
          </div>
        </div>

        <div className="mb-4 text-center">
          <h2 className="text-xl font-bold text-foreground">Mise à jour appliquée</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Nexora Music est passé de <span className="font-semibold text-foreground">{transition.from}</span> à{' '}
            <span className="font-semibold text-foreground">{transition.to}</span>
          </p>
        </div>

        {notes && (
          <div className="mb-2 rounded-xl bg-secondary/50 p-4 max-h-52 overflow-y-auto">
            <p className="text-sm leading-relaxed text-foreground whitespace-pre-line">{notes}</p>
          </div>
        )}

        <Button size="default" className="w-full mt-2" onClick={() => setTransition(null)}>
          OK
        </Button>
      </div>
    </div>
  );
}
