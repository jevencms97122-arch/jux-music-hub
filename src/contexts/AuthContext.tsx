import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Session, User } from '@supabase/supabase-js';
import type { Profile, PBUser } from '@/types/music';
import { avatarUrl } from '@/lib/storage';

interface AuthContextType {
  user: PBUser | null;
  session: Session | null;
  authUser: User | null;
  profile: Profile | null;
  loading: boolean;
  /** Magic link via email — Supabase envoie un lien de connexion à l'email donné. */
  sendMagicLink: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (data: Partial<Profile>) => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

function profileToPBUser(p: Profile, email: string): PBUser {
  return {
    id: p.user_id,
    email,
    pseudo: p.pseudo ?? '',
    firstName: p.first_name ?? '',
    lastName: p.last_name ?? '',
    avatar: p.avatar_url ? avatarUrl(p) : '',
    profileCompleted: p.profile_completed,
    profilCompleted: p.profile_completed,
    collectionId: 'profiles',
    collectionName: 'profiles',
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [user, setUser] = useState<PBUser | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (uid: string, email: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', uid)
      .maybeSingle();
    if (error) {
      console.error('loadProfile', error);
      return;
    }
    if (data) {
      setProfile(data as Profile);
      setUser(profileToPBUser(data as Profile, email));
    }
  }, []);

  const refreshUser = useCallback(async () => {
    if (!authUser) return;
    await loadProfile(authUser.id, authUser.email ?? '');
  }, [authUser, loadProfile]);

  useEffect(() => {
    // 1) Listener d'abord (recommandation Supabase)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_evt, sess) => {
      setSession(sess);
      setAuthUser(sess?.user ?? null);
      if (sess?.user) {
        // Defer pour éviter deadlock
        setTimeout(() => loadProfile(sess.user.id, sess.user.email ?? ''), 0);
      } else {
        setProfile(null);
        setUser(null);
      }
    });

    // 2) Puis check session existante
    supabase.auth.getSession().then(({ data: { session: sess } }) => {
      setSession(sess);
      setAuthUser(sess?.user ?? null);
      if (sess?.user) {
        loadProfile(sess.user.id, sess.user.email ?? '').finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [loadProfile]);

  const sendMagicLink = async (email: string) => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/jux` },
    });
    if (error) throw error;
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setUser(null);
    setAuthUser(null);
    setSession(null);
    window.location.href = '/';
  };

  const updateProfile = async (data: Partial<Profile>) => {
    if (!authUser) throw new Error('Non connecté');
    const { error } = await supabase
      .from('profiles')
      .update(data)
      .eq('user_id', authUser.id);
    if (error) throw error;
    await refreshUser();
  };

  return (
    <AuthContext.Provider value={{ user, session, authUser, profile, loading, sendMagicLink, logout, updateProfile, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}
