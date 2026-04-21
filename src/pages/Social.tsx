import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { avatarUrl } from '@/lib/storage';
import { toast } from 'sonner';
import type { Profile, Follow } from '@/types/music';

export default function Social() {
  const { authUser } = useAuth();
  const navigate = useNavigate();
  const [following, setFollowing] = useState<Profile[]>([]);
  const [followers, setFollowers] = useState<Profile[]>([]);
  const [requests, setRequests] = useState<(Follow & { profile?: Profile })[]>([]);

  const load = async () => {
    if (!authUser) return;
    const { data: outF } = await supabase
      .from('follows').select('*').eq('follower_id', authUser.id).eq('status', 'accepted');
    const { data: inF } = await supabase
      .from('follows').select('*').eq('following_id', authUser.id).eq('status', 'accepted');
    const { data: req } = await supabase
      .from('follows').select('*').eq('following_id', authUser.id).eq('status', 'pending');

    const fetchProfiles = async (ids: string[]) => {
      if (!ids.length) return [] as Profile[];
      const { data } = await supabase.from('profiles').select('*').in('user_id', ids);
      return (data ?? []) as Profile[];
    };

    setFollowing(await fetchProfiles((outF ?? []).map((f) => f.following_id)));
    setFollowers(await fetchProfiles((inF ?? []).map((f) => f.follower_id)));
    const reqProfiles = await fetchProfiles((req ?? []).map((r) => r.follower_id));
    setRequests((req ?? []).map((r) => ({
      ...(r as Follow),
      profile: reqProfiles.find((p) => p.user_id === r.follower_id),
    })));
  };

  useEffect(() => { load(); }, [authUser]);

  const accept = async (id: string) => {
    await supabase.from('follows').update({ status: 'accepted' }).eq('id', id);
    toast.success('Demande acceptée');
    load();
  };
  const reject = async (id: string) => {
    await supabase.from('follows').delete().eq('id', id);
    load();
  };

  const Row = ({ p, action }: { p: Profile; action?: React.ReactNode }) => (
    <div className="flex items-center gap-3 rounded-lg p-2 hover:bg-secondary">
      <button onClick={() => navigate(`/u/${p.user_id}`)} className="flex flex-1 items-center gap-3">
        <Avatar className="h-10 w-10">
          <AvatarImage src={avatarUrl(p)} />
          <AvatarFallback>{p.pseudo?.[0]?.toUpperCase() ?? '?'}</AvatarFallback>
        </Avatar>
        <p className="text-left text-sm font-medium">{p.pseudo}</p>
      </button>
      {action}
    </div>
  );

  return (
    <div className="min-h-screen px-4 py-6 pb-40">
      <h1 className="mb-4 text-xl font-bold">Social</h1>
      <Tabs defaultValue="following">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="following">Abonnements</TabsTrigger>
          <TabsTrigger value="followers">Abonnés</TabsTrigger>
          <TabsTrigger value="requests">Demandes {requests.length > 0 && `(${requests.length})`}</TabsTrigger>
        </TabsList>
        <TabsContent value="following" className="mt-4 space-y-1">
          {following.length === 0 ? <p className="text-sm text-muted-foreground">Aucun abonnement.</p> :
            following.map((p) => <Row key={p.id} p={p} />)}
        </TabsContent>
        <TabsContent value="followers" className="mt-4 space-y-1">
          {followers.length === 0 ? <p className="text-sm text-muted-foreground">Aucun abonné.</p> :
            followers.map((p) => <Row key={p.id} p={p} />)}
        </TabsContent>
        <TabsContent value="requests" className="mt-4 space-y-1">
          {requests.length === 0 ? <p className="text-sm text-muted-foreground">Aucune demande.</p> :
            requests.map((r) => r.profile && (
              <Row key={r.id} p={r.profile} action={
                <div className="flex gap-1">
                  <Button size="sm" onClick={() => accept(r.id)}>Accepter</Button>
                  <Button size="sm" variant="ghost" onClick={() => reject(r.id)}>Refuser</Button>
                </div>
              } />
            ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
