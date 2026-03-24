import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { pb } from '@/lib/pocketbase';
import type { PBUser } from '@/types/music';

interface AuthContextType {
  user: PBUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string) => Promise<void>;
  logout: () => void;
  updateProfile: (data: FormData) => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<PBUser | null>(null);
  const [loading, setLoading] = useState(true);

  const saveAuth = (extra: { email?: string; password?: string } = {}) => {
    const auth = pb.authStore.exportToObject();
    if (!auth.token || !auth.record) return;
    localStorage.setItem('jux_auth', JSON.stringify({
      token: auth.token,
      record: auth.record,
      ...extra,
    }));
  };

  const clearAuth = () => {
    pb.authStore.clear();
    setUser(null);
    localStorage.removeItem('jux_auth');
  };

  const refreshUser = useCallback(async () => {
    if (!pb.authStore.isValid) {
      console.debug('[Auth] pb.authStore non valide');
      return;
    }

    const userId = pb.authStore.record?.id;
    if (!userId) {
      console.warn('[Auth] userId introuvable lors du refreshUser');
      return;
    }

    try {
      const u = await pb.collection('users').getOne(userId);
      setUser(u as unknown as PBUser);
      console.debug('[Auth] user rafraîchi', u.id);
    } catch (error) {
      console.error('Erreur lors du rafraîchissement de l\'utilisateur:', error);
      clearAuth();
    }
  }, []);

  useEffect(() => {
    const initAuth = async () => {
      try {
        // Use the build-in pb.authStore persistence source first.
        if (pb.authStore.isValid && pb.authStore.record) {
          setUser(pb.authStore.record as PBUser);
          try {
            await refreshUser();
          } catch (error) {
            console.error('[Auth] refreshUser failed, clearing auth', error);
            clearAuth();
          }
          setLoading(false);
          return;
        }

        // Fallback for jux_auth legacy format (token + record)
        const savedAuth = localStorage.getItem('jux_auth');
        if (savedAuth) {
          const authData = JSON.parse(savedAuth);
          if (authData.token && authData.record) {
            pb.authStore.save(authData.token, authData.record);
            if (pb.authStore.isValid && pb.authStore.record) {
              setUser(pb.authStore.record as PBUser);
              try {
                await refreshUser();
              } catch (error) {
                console.error('[Auth] refreshUser failed, clearing auth', error);
                clearAuth();
              }
              setLoading(false);
              return;
            }
          }
        }

        // Nothing valid
        clearAuth();
      } catch (error) {
        console.error('Erreur lors de la restauration de l\'authentification:', error);
        clearAuth();
      } finally {
        setLoading(false);
      }
    };

    initAuth();

    const unsub = pb.authStore.onChange(() => {
      if (pb.authStore.isValid && pb.authStore.record) {
        refreshUser();
        saveAuth();
      } else {
        clearAuth();
      }
    });

    return () => unsub();
  }, [refreshUser]);

  const login = async (email: string, password: string) => {
    await pb.collection('users').authWithPassword(email, password);
    await refreshUser();
    if (pb.authStore.isValid && pb.authStore.record) {
      saveAuth({ email, password });
    }
  };

  const signup = async (email: string, password: string) => {
    await pb.collection('users').create({
      email,
      password,
      passwordConfirm: password,
      profileCompleted: false,
      profilCompleted: false,
    });
    await pb.collection('users').authWithPassword(email, password);
    await refreshUser();
    if (pb.authStore.isValid && pb.authStore.record) {
      saveAuth({ email, password });
    }
  };

  const logout = () => {
    clearAuth();
  };

  const updateProfile = async (data: FormData) => {
    if (!user) return;
    data.append('profileCompleted', 'true');
    data.append('profilCompleted', 'true');
    try {
      await pb.collection('users').update(user.id, data);
      await refreshUser();
    } catch (error) {
      console.error('Erreur lors de la mise à jour du profil:', error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout, updateProfile, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}