import { useState, useEffect } from 'react';
import { Bell } from 'lucide-react';
import { pb } from '@/lib/pocketbase';
import { useAuth } from '@/contexts/AuthContext';

interface NotificationBellProps {
  onClick: () => void;
}

export default function NotificationBell({ onClick }: NotificationBellProps) {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user) return;

    const loadUnread = async () => {
      try {
        const res = await pb.collection('notifications').getList(1, 1, {
          filter: `recipient="${user.id}" && read=false`,
        });
        setUnreadCount(res.totalItems);
      } catch {
        // Collection may not exist yet
      }
    };

    loadUnread();

    // Real-time SSE subscription
    let unsubscribe: (() => void) | null = null;
    pb.collection('notifications').subscribe('*', (e) => {
      if (e.record.recipient === user.id) {
        if (e.action === 'create') {
          setUnreadCount(prev => prev + 1);
          // Show toast for new notification
          import('sonner').then(({ toast }) => {
            toast(e.record.title, { description: e.record.body });
          });
        }
      }
    }).then(unsub => {
      unsubscribe = unsub;
    }).catch(console.error);

    return () => {
      if (unsubscribe) unsubscribe();
      pb.collection('notifications').unsubscribe('*').catch(() => {});
    };
  }, [user]);

  return (
    <button onClick={onClick} className="relative p-2 text-muted-foreground hover:text-foreground transition-colors">
      <Bell className="h-6 w-6" />
      {unreadCount > 0 && (
        <span className="absolute -top-0.5 -right-0.5 h-5 w-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </button>
  );
}
