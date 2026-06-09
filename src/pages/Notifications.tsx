import { useEffect, useState } from 'react';
import { pb } from '@/lib/pocketbase';
import { useAuth } from '@/contexts/AuthContext';
import { getUserStats } from '@/lib/streaks';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Bell, CheckCheck, Trash2 } from 'lucide-react';
import type { AppNotification } from '@/types/music';

export default function Notifications() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<any[]>([]);

  const load = async () => {
    if (!user) return;
    const res = await pb.collection('notifications').getList(1, 50, { filter: `recipient_id = "${user.id}"`, sort: '-created', requestKey: null });
    setNotifications(res.items);
  };

  useEffect(() => { load(); }, [user]);

  const markAllRead = async () => {
    for (const n of notifications) {
      if (!n.is_read) await pb.collection('notifications').update(n.id, { is_read: true });
    }
    load();
  };

  const del = async (id: string) => {
    await pb.collection('notifications').delete(id);
    setNotifications((ns) => ns.filter((n) => n.id !== id));
  };

  return (
    <div className="relative min-h-screen pb-40 p-4">
      <header className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}><ArrowLeft className="h-5 w-5" /></Button>
          <h1 className="text-xl font-bold">Notifications</h1>
        </div>
        <Button variant="ghost" size="sm" onClick={markAllRead}><CheckCheck className="h-4 w-4 mr-1" /> Tout lire</Button>
      </header>
      {notifications.length === 0 ? (
        <div className="flex flex-col items-center mt-20 text-muted-foreground"><Bell className="h-12 w-12 mb-4" /><p>Aucune notification</p></div>
      ) : (
        <div className="space-y-2">
          {notifications.map((n: any) => (
            <div key={n.id} className={`flex items-start gap-3 rounded-xl p-3 ${n.is_read ? 'bg-card/30' : 'bg-card'}`}>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">{n.title}</p>
                {n.body && <p className="text-xs text-muted-foreground">{n.body}</p>}
                <p className="text-[10px] text-muted-foreground mt-1">{new Date(n.created || n.created).toLocaleDateString()}</p>
              </div>
              <Button variant="ghost" size="icon" className="shrink-0" onClick={() => del(n.id)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}