import { useState, useEffect } from 'react';
import { pb, getUserAvatarUrl } from '@/lib/pocketbase';
import { useAuth } from '@/contexts/AuthContext';
import { Send, User, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';
import type { SongComment } from '@/types/music';

interface SongCommentsProps {
  songId: string;
  currentTime: number;
  duration: number;
}

export default function SongComments({ songId, currentTime, duration }: SongCommentsProps) {
  const { user } = useAuth();
  const [comments, setComments] = useState<SongComment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [posting, setPosting] = useState(false);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    loadComments();
  }, [songId]);

  const loadComments = async () => {
    try {
      const res = await pb.collection('song_comments').getFullList({
        filter: `song="${songId}"`,
        expand: 'user',
        sort: 'timestamp',
      });
      setComments(res as unknown as SongComment[]);
    } catch (error) {
      console.error('Error loading comments:', error);
    }
  };

  const handlePost = async () => {
    if (!user || !newComment.trim()) return;
    setPosting(true);
    try {
      await pb.collection('song_comments').create({
        user: user.id,
        song: songId,
        comment: newComment.trim(),
        timestamp: Math.floor(currentTime),
      });
      setNewComment('');
      await loadComments();
      toast.success('Commentaire ajouté !');
    } catch (error) {
      console.error('Error posting comment:', error);
      toast.error('Erreur');
    } finally {
      setPosting(false);
    }
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  // Comments near current time (within 5 seconds)
  const nearbyComments = comments.filter(c => Math.abs(c.timestamp - currentTime) < 5);
  const displayComments = showAll ? comments : nearbyComments.slice(0, 3);

  return (
    <div className="w-full mt-4">
      {/* Comment markers on timeline */}
      {duration > 0 && (
        <div className="relative h-2 mb-3">
          {comments.map(c => (
            <div
              key={c.id}
              className="absolute top-0 w-1.5 h-1.5 rounded-full bg-primary/60"
              style={{ left: `${(c.timestamp / duration) * 100}%` }}
              title={`${formatTime(c.timestamp)} - ${c.comment}`}
            />
          ))}
        </div>
      )}

      {/* Input */}
      {user && (
        <div className="flex items-center gap-2 mb-3">
          <input
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder={`Commenter à ${formatTime(currentTime)}...`}
            className="flex-1 bg-card border border-border rounded-full px-4 py-2 text-sm text-foreground placeholder:text-muted-foreground"
            onKeyDown={(e) => e.key === 'Enter' && handlePost()}
            maxLength={200}
          />
          <button
            onClick={handlePost}
            disabled={posting || !newComment.trim()}
            className="p-2 text-primary disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Comments list */}
      {displayComments.length > 0 && (
        <div className="space-y-2 max-h-32 overflow-y-auto scrollbar-hide">
          {displayComments.map(c => {
            const commentUser = c.expand?.user;
            return (
              <div key={c.id} className="flex items-start gap-2">
                <div className="h-6 w-6 rounded-full overflow-hidden flex-shrink-0 mt-0.5">
                  {commentUser?.avatar ? (
                    <img src={getUserAvatarUrl(commentUser as any)} className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full bg-secondary flex items-center justify-center">
                      <User className="h-3 w-3 text-muted-foreground" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs">
                    <span className="font-semibold text-foreground">{commentUser?.pseudo}</span>
                    <span className="text-primary ml-1.5 text-[10px]">{formatTime(c.timestamp)}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">{c.comment}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {comments.length > 3 && (
        <button onClick={() => setShowAll(!showAll)} className="text-xs text-primary mt-2 flex items-center gap-1">
          <MessageCircle className="h-3 w-3" />
          {showAll ? 'Réduire' : `Voir les ${comments.length} commentaires`}
        </button>
      )}
    </div>
  );
}
