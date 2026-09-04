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

// Verrou en mémoire : évite que deux appels concurrents à loadProfile (ex : le
// listener onChange de l'auth store + l'appel explicite après signUp) créent
// chacun un profil pour le même utilisateur → doublons dans `profiles`.
const profileLoadLocks = new Map<string, Promise<RecordModel>>();

/**
 * Récupère le profil d'un utilisateur, ou le crée s'il n'existe pas encore.
 * Sûr en cas d'appels concurrents (verrou par userId) et auto-répare les
 * doublons déjà présents en base en gardant le plus complet et supprimant les autres.
 */
async function fetchOrCreateProfile(userId: string): Promise<RecordModel> {
  const inFlight = profileLoadLocks.get(userId);
  if (inFlight) return inFlight;

  const task = (async () => {
    const records = await pb.collection('profiles').getList(1, 10, {
      filter: `user_id = "${userId}"`,
      sort: '-updated',
    });

    if (records.items.length > 1) {
      // Doublon existant (ancien bug de race condition) : on garde le profil le
      // plus complet/récent et on supprime les autres pour éviter que les mises
      // à jour futures (pseudo, avatar…) atterrissent sur le mauvais record.
      const [keep, ...duplicates] = [...records.items].sort((a: any, b: any) => {
        const score = (r: any) => (r.profile_completed ? 2 : 0) + (r.avatar ? 1 : 0);
        const diff = score(b) - score(a);
        return diff !== 0 ? diff : String(b.updated).localeCompare(String(a.updated));
      });
      for (const dup of duplicates) {
        pb.collection('profiles').delete(dup.id).catch(() => {});
      }
      return keep;
    }

    if (records.items.length === 1) return records.items[0];

    // Aucun profil : on le crée.
    try {
      return await pb.collection('profiles').create({
        user_id: userId,
        pseudo: pb.authStore.model?.email?.split('@')[0] || 'user',
        profile_completed: false,
      });
    } catch {
      // Un appel concurrent (hors de ce verrou, ex. ancien onglet) l'a créé entre-temps.
      const retry = await pb.collection('profiles').getList(1, 1, { filter: `user_id = "${userId}"` });
      if (retry.items.length > 0) return retry.items[0];
      throw new Error('Impossible de créer le profil');
    }
  })();

  profileLoadLocks.set(userId, task);
  try {
    return await task;
  } finally {
    profileLoadLocks.delete(userId);
  }
}

function recordToProfile(r: any): Profile {
  return {
    id: r.id,
    user_id: r.user_id || r.id,
    pseudo: r.pseudo || null,
    first_name: r.first_name || null,
    last_name: r.last_name || null,
    avatar_url: r.avatar ? pb.files.getUrl(r, r.avatar) : null,
    bio: r.bio || null,
    badge: r.badge || null,
    ban_status: r.ban_status ?? false,
    profile_completed: r.profile_completed ?? false,
    banner_video_url: r.banner_video_url || null,
    created_at: r.created,
    updated_at: r.updated,
  };
}


// Cache du profil pour l'auto-connexion hors ligne : le token PocketBase est
// déjà persisté par le SDK, mais sans backend le fetch du profil échoue et
// l'app croyait l'utilisateur déconnecté. On garde donc la dernière copie
// connue du profil en localStorage et on retombe dessus si le réseau manque.
const PROFILE_CACHE_KEY = 'jux_cached_profile';

function cacheProfile(p: Profile) {
  try { localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(p)); } catch {}
}

function readCachedProfile(userId: string): Profile | null {
  try {
    const raw = localStorage.getItem(PROFILE_CACHE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Profile;
    return p && p.user_id === userId ? p : null;
  } catch {
    return null;
  }
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
      const record = await fetchOrCreateProfile(userId);
      const p = recordToProfile(record);
      cacheProfile(p);
      setProfile(p);
      setUser(profileToPBUser(p));
    } catch (e) {
      // Backend injoignable (mode hors ligne) : auto-connexion depuis le cache
      // pour que l'app reste utilisable avec le compte de l'utilisateur.
      const cached = readCachedProfile(userId);
      if (cached) {
        setProfile(cached);
        setUser(profileToPBUser(cached));
        return;
      }
      console.error('loadProfile', e);
    }
  }, []);

  const refreshUser = useCallback(async () => {
    if (!pb.authStore.isValid || !pb.authStore.model?.id) return;
    try {
      const record = await fetchOrCreateProfile(pb.authStore.model.id);
      const p = recordToProfile(record);
      setProfile(p);
      setUser(profileToPBUser(p));
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
    
    // Authentifier (déclenche aussi le listener onChange qui appelle loadProfile —
    // fetchOrCreateProfile est sûr en cas d'appels concurrents, donc pas de doublon)
    await pb.collection('users').authWithPassword(email, password);

    if (newUser.id) {
      await loadProfile(newUser.id);
    }
  };

  const logout = async () => {
    try { localStorage.removeItem(PROFILE_CACHE_KEY); } catch {}
    pb.authStore.clear();
    setProfile(null);
    setUser(null);
    window.location.href = '/';
  };

  const updateProfile = async (data: Partial<Profile>, avatarFile?: File) => {
    if (!pb.authStore.isValid || !pb.authStore.model?.id) throw new Error('Non connecté');

    // Passe par fetchOrCreateProfile (et non un getList brut) pour cibler le bon
    // record même s'il restait un doublon historique — et pour ne pas planter si
    // le profil n'a pas encore été créé.
    const record = await fetchOrCreateProfile(pb.authStore.model.id);

    // Utiliser FormData pour pouvoir envoyer un fichier binaire
    const formData = new FormData();
    if (data.pseudo !== undefined) formData.append('pseudo', data.pseudo ?? '');
    if (data.first_name !== undefined) formData.append('first_name', data.first_name ?? '');
    if (data.last_name !== undefined) formData.append('last_name', data.last_name ?? '');
    if (data.bio !== undefined) formData.append('bio', data.bio ?? '');
    if (data.profile_completed !== undefined) formData.append('profile_completed', String(data.profile_completed));
    if (data.banner_video_url !== undefined) formData.append('banner_video_url', data.banner_video_url ?? '');
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