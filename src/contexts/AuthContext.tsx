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
    if (!pb.authStore.isValid) return;
    try {
      const u = await pb.collection('users').getOne(pb.authStore.record?.id as string);
      setUser(u as unknown as PBUser);
    } catch (error) {
      console.error('Erreur lors du rafraîchissement de l\'utilisateur:', error);
      pb.authStore.clear();
      setUser(null);
    }
  }, []);

  useEffect(() => {
    // Restaurer l'utilisateur si une session est valide
    if (pb.authStore.isValid && pb.authStore.record) {
      refreshUser();
    } else {
      setUser(null);
    }
    setLoading(false);
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
      profilCompleted: false,
    });
    await pb.collection('users').authWithPassword(email, password);
    await refreshUser();
  };

  const logout = () => {
    // Efface le token et le record, empêchant la reconnexion automatique par PocketBase
    pb.authStore.clear();
    setUser(null);
    window.location.href = '/';
  };

  const updateProfile = async (data: FormData) => {
    const userId = pb.authStore.record?.id;
    if (!userId) throw new Error('Utilisateur non trouvé');
    try {
      await pb.collection('users').update(userId, data);
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
