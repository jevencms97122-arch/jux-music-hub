import { useEffect, useState } from 'react';
import { pb } from '@/lib/pocketbase';
import { useAuth } from '@/contexts/AuthContext';
import { useSeo } from '@/lib/useSeo';
import { avatarUrl } from '@/lib/storage';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Bell, CheckCheck, Trash2, UserPlus } from 'lucide-react';

interface NotifItem {
  id: string;
  type: string;
  title: string;
  body: string | null;
  is_read: boolean;
  created: string;
  data: Record<string, any>;
  sender?: {
    user_id: string;
    pseudo: string;
    avatar_url: string;
  } | null;
}

export default function Notifications() {
  useSeo({ title: 'Notifications — Nexora Music', description: 'Tes notifications Nexora Music.', path: '/notifications' });
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notifs, setNotifs] = useState<NotifItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await pb.collection('notifications').getList(1, 50, {
        filter: `recipient_id = "${user.id}"`,
        sort: '-created',
        requestKey: null,
      });

      const items: NotifItem[] = res.items.map((n: any) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        body: n.body ?? null,
        is_read: n.is_read ?? false,
        created: n.created,
        data: n.data ?? {},
        sender: null,
      }));

      // Fetch sender profiles for notifications that have sender_id
      const senderIds = [...new Set(
        items.map((n) => n.data?.sender_id).filter(Boolean) as string[]
      )];
      if (senderIds.length > 0) {
        const filter = senderIds.map((id) => `user_id = "${id}"`).join(' || ');
        const profiles = await pb.collection('profiles').getList(1, 50, { filter, requestKey: null });
        const profileMap: Record<string, any> = {};
        for (const p of profiles.items) profileMap[p.user_id as string] = p;

        for (const item of items) {
          const sid = item.data?.sender_id;
          if (sid && profileMap[sid]) {
            const p = profileMap[sid];
            item.sender = {
              user_id: p.user_id,
              pseudo: p.pseudo || '?',
              avatar_url: avatarUrl(p),
            };
          }
        }
      }

      setNotifs(items);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  // Mark all as read when page opens
  useEffect(() => {
    if (!user || notifs.length === 0) return;
    const unread = notifs.filter((n) => !n.is_read);
    if (unread.length === 0) return;
    Promise.all(unread.map((n) => pb.collection('notifications').update(n.id, { is_read: true }).catch(() => {}))).then(() => {
      setNotifs((prev) => prev.map((n) => ({ ...n, is_read: true })));
    });
  }, [notifs.length]);

  const del = async (id: string) => {
    await pb.collection('notifications').delete(id).catch(() => {});
    setNotifs((prev) => prev.filter((n) => n.id !== id));
  };

  const typeIcon = (type: string) => {
    if (type === 'friend_request') return <UserPlus className="h-4 w-4 text-primary" />;
    return <Bell className="h-4 w-4 text-muted-foreground" />;
  };

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return "À l'instant";
    if (m < 60) return `Il y a ${m} min`;
    const h = Math.floor(m / 60);
    if (h < 24) return `Il y a ${h}h`;
    const d = Math.floor(h / 24);
    if (d < 7) return `Il y a ${d}j`;
    return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  };

  return (
    <div className="relative min-h-screen pb-40 p-4">
      <header className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}><ArrowLeft className="h-5 w-5" /></Button>
          <h1 className="text-xl font-bold">Notifications</h1>
        </div>
        {notifs.length > 0 && (
          <Button variant="ghost" size="sm" onClick={() => {
            Promise.all(notifs.map((n) => n.id && pb.collection('notifications').delete(n.id).catch(() => {})))
              .then(() => setNotifs([]));
          }}>
            <Trash2 className="h-4 w-4 mr-1" /> Tout effacer
          </Button>
        )}
      </header>

      {loading && (
        <p className="text-center text-sm text-muted-foreground mt-8">Chargement...</p>
      )}

      {!loading && notifs.length === 0 && (
        <div className="flex flex-col items-center mt-20 text-muted-foreground gap-3 animate-fade-in">
          <Bell className="h-12 w-12 opacity-30" />
          <p className="text-sm">Aucune notification</p>
        </div>
      )}

      {!loading && notifs.length > 0 && (
        <div className="space-y-2">
          {notifs.map((n, i) => (
            <div
              key={n.id}
              className={`flex items-center gap-3 rounded-2xl p-3 transition-colors animate-card-in ${
                n.is_read ? 'bg-card/40' : 'bg-card border border-primary/20'
              } ${(n.sender || n.data?.sender_id) ? 'cursor-pointer hover:bg-card' : ''}`}
              style={{ animationDelay: `${Math.min(i, 12) * 30}ms` }}
              onClick={() => {
                const uid = n.sender?.user_id || n.data?.sender_id;
                if (uid) navigate(`/u/${uid}`);
              }}
            >
              {/* Avatar or icon */}
              {(() => {
                const pseudo = n.sender?.pseudo || n.data?.sender_pseudo || null;
                const avatarSrc = n.sender?.avatar_url || n.data?.sender_avatar || null;
                if (pseudo) {
                  return (
                    <div className="relative shrink-0">
                      {avatarSrc ? (
                        <img src={avatarSrc} alt={pseudo} className="h-11 w-11 rounded-full object-cover" />
                      ) : (
                        <div className="h-11 w-11 rounded-full bg-muted flex items-center justify-center font-bold text-sm">
                          {pseudo[0].toUpperCase()}
                        </div>
                      )}
                      <div className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-background border border-border">
                        {typeIcon(n.type)}
                      </div>
                    </div>
                  );
                }
                return (
                  <div className="h-11 w-11 rounded-full bg-muted flex items-center justify-center shrink-0">
                    {typeIcon(n.type)}
                  </div>
                );
              })()}

              {/* Content */}
              <div className="flex-1 min-w-0">
                {n.type === 'friend_request' ? (
                  <p className="text-sm leading-snug">
                    {(n.sender?.pseudo || n.data?.sender_pseudo) ? (
                      <><span className="font-semibold">{n.sender?.pseudo || n.data?.sender_pseudo}</span>{' '}a commencé à vous suivre</>
                    ) : (
                      'Quelqu\'un a commencé à vous suivre'
                    )}
                  </p>
                ) : (
                  <>
                    <p className="text-sm font-semibold">{n.title}</p>
                    {n.body && <p className="text-xs text-muted-foreground mt-0.5">{n.body}</p>}
                  </>
                )}
                <p className="text-[10px] text-muted-foreground mt-1">{timeAgo(n.created)}</p>
              </div>

              {/* Unread dot + delete */}
              <div className="flex items-center gap-2 shrink-0">
                {!n.is_read && <div className="h-2 w-2 rounded-full bg-primary" />}
                <button
                  onClick={(e) => { e.stopPropagation(); del(n.id); }}
                  className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-white/[0.06] transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
