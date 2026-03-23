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
      } catch (error) {
        console.error('Erreur lors du rafraîchissement de l\'utilisateur:', error);
        pb.authStore.clear();
        setUser(null);
        localStorage.removeItem('pb_auth');
      }
    }
  }, []);

  useEffect(() => {
    // Vérifier si l'utilisateur est déjà connecté via le localStorage
    const savedAuth = localStorage.getItem('pb_auth');
    if (savedAuth) {
      try {
        const authData = JSON.parse(savedAuth);
        // Restaurer l'état d'authentification de Pocketbase
        pb.authStore.save(authData.token, authData.model);
        
        // Vérifier si l'authentification est toujours valide
        if (pb.authStore.isValid) {
          refreshUser().finally(() => setLoading(false));
        } else {
          // Si l'authentification n'est plus valide, essayer de se reconnecter
          if (authData.email && authData.password) {
            pb.collection('users').authWithPassword(authData.email, authData.password)
              .then(() => refreshUser())
              .finally(() => setLoading(false))
              .catch(() => {
                localStorage.removeItem('pb_auth');
                setLoading(false);
              });
          } else {
            localStorage.removeItem('pb_auth');
            setLoading(false);
          }
        }
      } catch (error) {
        console.error('Erreur lors de la restauration de l\'authentification:', error);
        localStorage.removeItem('pb_auth');
        setLoading(false);
      }
    } else if (pb.authStore.isValid && pb.authStore.record) {
      refreshUser().finally(() => setLoading(false));
    } else {
      setLoading(false);
    }

    const unsub = pb.authStore.onChange(() => {
      if (pb.authStore.isValid && pb.authStore.record) {
        refreshUser();
        // Sauvegarder l'état d'authentification
        localStorage.setItem('pb_auth', JSON.stringify({
          token: pb.authStore.token,
          model: pb.authStore.record
        }));
      } else {
        setUser(null);
        localStorage.removeItem('pb_auth');
      }
    });

    return () => unsub();
  }, [refreshUser]);

  const login = async (email: string, password: string) => {
    await pb.collection('users').authWithPassword(email, password);
    await refreshUser();
    // Sauvegarder l'état d'authentification complet avec email et mot de passe
    if (pb.authStore.isValid && pb.authStore.record) {
      localStorage.setItem('pb_auth', JSON.stringify({
        token: pb.authStore.token,
        model: pb.authStore.record,
        email: email,
        password: password
      }));
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
    // Sauvegarder l'état d'authentification complet avec email et mot de passe
    if (pb.authStore.isValid && pb.authStore.record) {
      localStorage.setItem('pb_auth', JSON.stringify({
        token: pb.authStore.token,
        model: pb.authStore.record,
        email: email,
        password: password
      }));
    }
  };

  const logout = () => {
    pb.authStore.clear();
    setUser(null);
    localStorage.removeItem('pb_auth');
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