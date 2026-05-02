import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Bell, Trash2, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { AppNotification } from '@/types/music';

export default function Notifications() {
  const { authUser } = useAuth();
  const [notifs, setNotifs] = useState<AppNotification[]>([]);

  const load = async () => {
    if (!authUser) return;
    const { data } = await supabase
      .from('notifications').select('*')
      .eq('recipient_id', authUser.id)
      .order('created_at', { ascending: false }).limit(100);
    setNotifs((data ?? []) as AppNotification[]);
    // marquer comme lues
    await supabase.from('notifications').update({ is_read: true })
      .eq('recipient_id', authUser.id).eq('is_read', false);
  };

  useEffect(() => { load(); }, [authUser]);

  // Realtime
  useEffect(() => {
    if (!authUser) return;
    const channel = supabase
      .channel('notif-' + authUser.id)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'notifications',
        filter: `recipient_id=eq.${authUser.id}`,
      }, (payload) => {
        setNotifs((n) => [payload.new as AppNotification, ...n]);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [authUser]);

  const remove = async (id: string) => {
    await supabase.from('notifications').delete().eq('id', id);
    setNotifs((n) => n.filter((x) => x.id !== id));
  };

  return (
    <div className="min-h-screen px-4 py-6 pb-40">
      <h1 className="mb-4 flex items-center gap-2 text-xl font-bold"><Bell className="h-5 w-5" /> Notifications</h1>
      {notifs.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucune notification.</p>
      ) : (
        <div className="space-y-2">
          {notifs.map((n) => (
            <div key={n.id} className="flex items-start gap-2 rounded-lg border border-border bg-card p-3">
              <div className="flex-1">
                <p className="text-sm font-medium">{n.title}</p>
                {n.body && <p className="text-xs text-muted-foreground">{n.body}</p>}
                <p className="mt-1 text-[10px] text-muted-foreground">{new Date(n.created_at).toLocaleString()}</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => remove(n.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
