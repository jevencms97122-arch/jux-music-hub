import { useState, useEffect } from 'react';
import { pb, getUserAvatarUrl } from '@/lib/pocketbase';
import type { PBUser } from '@/types/music';
import { User } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface FriendsLikedBadgeProps {
  songId: string;
  userId: string;
}

export default function FriendsLikedBadge({ songId, userId }: FriendsLikedBadgeProps) {
  const [friendsWhoLiked, setFriendsWhoLiked] = useState<PBUser[]>([]);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    loadFriendsWhoLiked();
  }, [songId, userId]);

  const loadFriendsWhoLiked = async () => {
    try {
      // Get my friends (mutual accepted follows)
      const myFollowing = await pb.collection('follows').getFullList({
        filter: `follower="${userId}" && status="accepted"`,
      });
      const friendIds = new Set(myFollowing.map((f: any) => f.following));

      if (friendIds.size === 0) return;

      // Get likes for this song
      const likes = await pb.collection('song_likes').getFullList({
        filter: `song="${songId}"`,
        expand: 'user',
      });

      const friends: PBUser[] = [];
      for (const like of likes) {
        const likeUserId = (like as any).user;
        if (friendIds.has(likeUserId)) {
          const expanded = (like as any).expand?.user;
          if (expanded) friends.push(expanded as PBUser);
        }
      }
      setFriendsWhoLiked(friends);
    } catch (e) {
      // silently fail
    }
  };

  if (friendsWhoLiked.length === 0) return null;

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="flex items-center gap-2 mt-2 px-3 py-1.5 rounded-full bg-card/50 backdrop-blur-sm"
      >
        <div className="flex -space-x-2">
          {friendsWhoLiked.slice(0, 3).map(f => (
            <div key={f.id} className="h-5 w-5 rounded-full overflow-hidden border border-background">
              {f.avatar ? (
                <img src={getUserAvatarUrl(f as any)} alt={f.pseudo} className="h-full w-full object-cover" />
              ) : (
                <div className="h-full w-full bg-secondary flex items-center justify-center">
                  <User className="h-2.5 w-2.5 text-muted-foreground" />
                </div>
              )}
            </div>
          ))}
        </div>
        <span className="text-xs text-muted-foreground">
          {friendsWhoLiked.length === 1
            ? `${friendsWhoLiked[0].pseudo} a aimé cette musique`
            : `${friendsWhoLiked.length} de vos amis ont aimé cette musique`}
        </span>
      </button>

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">Amis qui ont aimé</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {friendsWhoLiked.map(f => (
              <div key={f.id} className="flex items-center gap-3 p-2">
                <div className="h-10 w-10 rounded-full overflow-hidden shrink-0">
                  {f.avatar ? (
                    <img src={getUserAvatarUrl(f as any)} alt={f.pseudo} className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full bg-secondary flex items-center justify-center">
                      <User className="h-5 w-5 text-muted-foreground" />
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{f.pseudo}</p>
                  <p className="text-xs text-muted-foreground">{f.firstName} {f.lastName}</p>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
