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

  const refreshUser = useCallback(async () => {
    if (pb.authStore.isValid && pb.authStore.record) {
      try {
        const u = await pb.collection('users').getOne(pb.authStore.record.id);
        setUser(u as unknown as PBUser);
      } catch {
        pb.authStore.clear();
        setUser(null);
      }
    }
  }, []);

  useEffect(() => {
    if (pb.authStore.isValid && pb.authStore.record) {
      refreshUser().finally(() => setLoading(false));
    } else {
      setLoading(false);
    }

    const unsub = pb.authStore.onChange(() => {
      if (pb.authStore.isValid && pb.authStore.record) {
        refreshUser();
      } else {
        setUser(null);
      }
    });

    return () => unsub();
  }, [refreshUser]);

  const login = async (email: string, password: string) => {
    await pb.collection('users').authWithPassword(email, password);
    await refreshUser();
  };

  const signup = async (email: string, password: string) => {
    await pb.collection('users').create({
      email,
      password,
      passwordConfirm: password,
      profileCompleted: false,
    });
    await pb.collection('users').authWithPassword(email, password);
    await refreshUser();
  };

  const logout = () => {
    pb.authStore.clear();
    setUser(null);
  };

  const updateProfile = async (data: FormData) => {
    if (!user) return;
    data.append('profileCompleted', 'true');
    await pb.collection('users').update(user.id, data);
    await refreshUser();
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
