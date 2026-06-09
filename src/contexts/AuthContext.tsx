import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { pb } from '@/lib/pocketbase';
import type { Profile, PBUser } from '@/types/music';
import type { RecordModel } from 'pocketbase';

interface AuthContextType {
  user: PBUser | null;
  authUser: PBUser | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (data: Partial<Profile>, avatarFile?: File) => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

function recordToProfile(r: any): Profile {
  return {
    id: r.id,
    user_id: r.user_id || r.id,
    pseudo: r.pseudo || null,
    first_name: r.first_name || null,
    last_name: r.last_name || null,
    avatar_url: r.avatar ? pb.files.getUrl(r, r.avatar) : null,
    bio: r.bio || null,
    profile_completed: r.profile_completed ?? false,
    created_at: r.created,
    updated_at: r.updated,
  };
}


function profileToPBUser(p: Profile): PBUser {
  return {
    id: p.user_id,
    email: pb.authStore.model?.email || '',
    pseudo: p.pseudo ?? '',
    firstName: p.first_name ?? '',
    lastName: p.last_name ?? '',
    avatar: p.avatar_url ?? '',
    profileCompleted: p.profile_completed,
    profilCompleted: p.profile_completed,
    collectionId: 'profiles',
    collectionName: 'profiles',
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [user, setUser] = useState<PBUser | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (userId: string) => {
    try {
      const records = await pb.collection('profiles').getList(1, 1, {
        filter: `user_id = "${userId}"`,
      });
      
      if (records.items.length > 0) {
        const p = recordToProfile(records.items[0]);
        setProfile(p);
        setUser(profileToPBUser(p));
      } else {
        // Créer un profil par défaut
        const newProfile = await pb.collection('profiles').create({
          user_id: userId,
          pseudo: pb.authStore.model?.email?.split('@')[0] || 'user',
          profile_completed: false,
        });
        const p = recordToProfile(newProfile);
        setProfile(p);
        setUser(profileToPBUser(p));
      }
    } catch (e) {
      console.error('loadProfile', e);
    }
  }, []);

  const refreshUser = useCallback(async () => {
    if (!pb.authStore.isValid || !pb.authStore.model?.id) return;
    try {
      const records = await pb.collection('profiles').getList(1, 1, {
        filter: `user_id = "${pb.authStore.model.id}"`,
      });
      if (records.items.length > 0) {
        const p = recordToProfile(records.items[0]);
        setProfile(p);
        setUser(profileToPBUser(p));
      }
    } catch (e) {
      console.error('refreshUser', e);
    }
  }, []);

  useEffect(() => {
    // Check existing auth
    if (pb.authStore.isValid && pb.authStore.model?.id) {
      loadProfile(pb.authStore.model.id).finally(() => setLoading(false));
    } else {
      setLoading(false);
    }

    // Listen for auth changes
    const unsub = pb.authStore.onChange((token, model) => {
      if (model?.id) {
        loadProfile(model.id);
      } else {
        setProfile(null);
        setUser(null);
      }
    });

    return () => {
      unsub();
    };
  }, [loadProfile]);

  const signIn = async (email: string, password: string) => {
    const authData = await pb.collection('users').authWithPassword(email, password);
    if (authData.record?.id) {
      await loadProfile(authData.record.id);
    }
  };

  const signUp = async (email: string, password: string) => {
    // Créer d'abord l'utilisateur dans PocketBase
    const newUser = await pb.collection('users').create({
      email,
      password,
      passwordConfirm: password,
    });
    
    // Authentifier
    await pb.collection('users').authWithPassword(email, password);
    
    // Créer le profil automatiquement
    if (newUser.id) {
      await pb.collection('profiles').create({
        user_id: newUser.id,
        pseudo: email.split('@')[0],
        profile_completed: false,
      });
      await loadProfile(newUser.id);
    }
  };

  const logout = async () => {
    pb.authStore.clear();
    setProfile(null);
    setUser(null);
    window.location.href = '/';
  };

  const updateProfile = async (data: Partial<Profile>, avatarFile?: File) => {
    if (!pb.authStore.isValid || !pb.authStore.model?.id) throw new Error('Non connecté');

    const records = await pb.collection('profiles').getList(1, 1, {
      filter: `user_id = "${pb.authStore.model.id}"`,
    });

    if (records.items.length === 0) throw new Error('Profil non trouvé');

    const record = records.items[0];

    // Utiliser FormData pour pouvoir envoyer un fichier binaire
    const formData = new FormData();
    if (data.pseudo !== undefined) formData.append('pseudo', data.pseudo ?? '');
    if (data.first_name !== undefined) formData.append('first_name', data.first_name ?? '');
    if (data.last_name !== undefined) formData.append('last_name', data.last_name ?? '');
    if (data.bio !== undefined) formData.append('bio', data.bio ?? '');
    if (data.profile_completed !== undefined) formData.append('profile_completed', String(data.profile_completed));
    if (avatarFile) formData.append('avatar', avatarFile);

    const updated = await pb.collection('profiles').update(record.id, formData);

    // Mettre à jour l'état local immédiatement avec les données fraîches
    const p = recordToProfile(updated);
    setProfile(p);
    setUser(profileToPBUser(p));
  };

  return (
    <AuthContext.Provider value={{ user, authUser: user, profile, loading, signIn, signUp, logout, updateProfile, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}