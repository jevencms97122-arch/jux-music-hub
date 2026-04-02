import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { pb } from '@/lib/pocketbase';
import { useAuth } from '@/contexts/AuthContext';
import { Bell, Music, Heart, UserPlus, TrendingUp, ChevronLeft, Check } from 'lucide-react';
import type { AppNotification } from '@/types/music';

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "à l'instant";
  if (mins < 60) return `il y a ${mins}min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `il y a ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `il y a ${days}j`;
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

const iconMap = {
  new_song: Music,
  milestone: TrendingUp,
  friend_request: UserPlus,
  like: Heart,
};

export default function Notifications() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    loadNotifications();

    // SSE real-time
    pb.collection('notifications').subscribe('*', (e) => {
      if (e.action === 'create' && e.record.recipient === user.id) {
        setNotifications(prev => [e.record as unknown as AppNotification, ...prev]);
      }
    }).catch(console.error);

    return () => {
      pb.collection('notifications').unsubscribe('*').catch(() => {});
    };
  }, [user]);

  const loadNotifications = async () => {
    if (!user) return;
    try {
      const res = await pb.collection('notifications').getList(1, 50, {
        filter: `recipient="${user.id}"`,
        sort: '-created',
      });
      setNotifications(res.items as unknown as AppNotification[]);
    } catch (error) {
      console.error('Error loading notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (notif: AppNotification) => {
    if (notif.read) return;
    try {
      await pb.collection('notifications').update(notif.id, { read: true });
      setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, read: true } : n));
    } catch { }
  };

  const markAllAsRead = async () => {
    const unread = notifications.filter(n => !n.read);
    try {
      await Promise.all(unread.map(n => pb.collection('notifications').update(n.id, { read: true })));
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    } catch { }
  };

  const handleClick = (notif: AppNotification) => {
    markAsRead(notif);
    try {
      const data = notif.data ? JSON.parse(notif.data) : {};
      if (data.songId) {
        // Could navigate to song or play it
      } else if (data.userId) {
        navigate(`/profile/${data.userId}`);
      }
    } catch { }
  };

  return (
    <div className="pb-28">
      <div className="flex items-center justify-between px-4 py-4">
        <div className="flex items-center gap-2">
          <button onClick={() => navigate(-1)} className="p-1">
            <ChevronLeft className="h-5 w-5 text-foreground" />
          </button>
          <h1 className="text-xl font-bold text-foreground">Notifications</h1>
        </div>
        {notifications.some(n => !n.read) && (
          <button
            onClick={markAllAsRead}
            className="text-xs text-primary flex items-center gap-1"
          >
            <Check className="h-3.5 w-3.5" />
            Tout lire
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <div className="h-6 w-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </div>
      ) : notifications.length === 0 ? (
        <div className="text-center py-12">
          <Bell className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Aucune notification</p>
        </div>
      ) : (
        <div className="px-4 space-y-1">
          {notifications.map(notif => {
            const Icon = iconMap[notif.type] || Bell;
            return (
              <button
                key={notif.id}
                onClick={() => handleClick(notif)}
                className={`w-full flex items-start gap-3 p-3 rounded-xl text-left transition-colors ${
                  notif.read ? 'bg-transparent' : 'bg-primary/5'
                }`}
              >
                <div className={`p-2 rounded-full flex-shrink-0 ${notif.read ? 'bg-secondary' : 'bg-primary/10'}`}>
                  <Icon className={`h-4 w-4 ${notif.read ? 'text-muted-foreground' : 'text-primary'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm ${notif.read ? 'text-foreground' : 'font-semibold text-foreground'}`}>
                    {notif.title}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">{notif.body}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">{timeAgo(notif.created)}</p>
                </div>
                {!notif.read && (
                  <div className="h-2 w-2 rounded-full bg-primary flex-shrink-0 mt-2" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
