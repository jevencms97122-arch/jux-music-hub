// Types alignés sur le schéma Supabase

export interface Profile {
  id: string;
  user_id: string;
  pseudo: string | null;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  profile_completed: boolean;
  created_at: string;
  updated_at: string;
}

// Alias rétro-compat pour le code existant
export interface PBUser {
  id: string;          // = profile.user_id (auth user id)
  email: string;
  pseudo: string;
  firstName: string;
  lastName: string;
  avatar: string;      // = avatar_url
  profileCompleted?: boolean;
  profilCompleted?: boolean;
  collectionId: string;
  collectionName: string;
}

export interface Song {
  id: string;
  title: string;
  author: string;
  audio_url: string;
  /** For YouTube-only songs (no uploaded audio file), this is set to '' */
  source_type?: 'upload' | 'youtube';
  cover_url: string | null;
  video_url: string | null;
  genre: string | null;
  uploaded_by: string;
  play_count: number;
  weekly_play_count?: number;
  likes_count: number;
  created_at: string;
  updated_at: string;
  // legacy aliases
  audioFile?: string;
  coverImage?: string;
  uploadedBy?: string;
  playCount?: number;
  likesCount?: number;
  created?: string;
  collectionId?: string;
  collectionName?: string;
  expand?: {
    uploadedBy?: PBUser;
  };
}

export interface ListenHistory {
  id: string;
  user_id: string;
  song_id: string;
  listened_at: string;
  expand?: { song?: Song };
}

export interface SongLike {
  id: string;
  user_id: string;
  song_id: string;
  created_at: string;
}

export interface Follow {
  id: string;
  follower_id: string;
  following_id: string;
  status: 'pending' | 'accepted';
  created_at: string;
  expand?: {
    follower?: PBUser;
    following?: PBUser;
  };
}

export interface Playlist {
  id: string;
  title: string;
  description: string | null;
  is_public: boolean;
  owner_id: string;
  view_count: number;
  play_count: number;
  likes_count: number;
  thumbnail_mode: 'grid' | 'single';
  created_at: string;
  updated_at: string;
  // legacy
  songs?: string[];
  expand?: {
    owner?: PBUser;
    songs?: Song[];
  };
}

export interface PlaylistLike {
  id: string;
  user_id: string;
  playlist_id: string;
  created_at: string;
  expand?: { playlist?: Playlist };
}

export interface Story {
  id: string;
  user_id: string;
  song_id: string;
  start_time: number;
  end_time: number;
  comment: string | null;
  expires_at: string;
  created_at: string;
  expand?: {
    user?: PBUser;
    song?: Song;
  };
}

export interface StoryView {
  id: string;
  story_id: string;
  viewer_id: string;
  created_at: string;
}

export interface UserStats {
  id: string;
  user_id: string;
  current_streak: number;
  longest_streak: number;
  total_listens: number;
  last_listen_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface ListenSession {
  id: string;
  host_id: string;
  song_id: string | null;
  current_time_seconds: number;
  is_playing: boolean;
  participants: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
  expand?: {
    host?: PBUser;
    song?: Song;
  };
}

export interface AppNotification {
  id: string;
  recipient_id: string;
  type: 'new_song' | 'milestone' | 'friend_request' | 'like' | 'comment' | 'story_view' | 'session_invite';
  title: string;
  body: string | null;
  data: Record<string, any>;
  is_read: boolean;
  created_at: string;
}

export interface Collaboration {
  id: string;
  pseudo: string;
  display_name: string | null;
  avatar_url: string | null;
  banner_url: string | null;
  bio: string | null;
  twitch_url: string | null;
  youtube_url: string | null;
  discord_url: string | null;
  instagram_url: string | null;
  twitter_url: string | null;
  tiktok_url: string | null;
  user_id: string | null;
  active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export const MUSIC_GENRES = [
  "Afrobeat", "Alternative", "Ambient", "Blues", "Bossa Nova",
  "Classique", "Country", "Dance", "Disco", "Drill",
  "Drum & Bass", "Dub", "Dubstep", "EDM", "Electro",
  "Folk", "Funk", "Garage", "Gospel", "Grime",
  "Grunge", "Hard Rock", "Hip-Hop", "House", "Indie",
  "Jazz", "Jungle", "K-Pop", "Latin", "Lo-fi",
  "Métal", "Musique du monde", "Neo Soul", "New Wave", "Pop",
  "Punk", "R&B", "Raï", "Rap", "Reggae",
  "Reggaeton", "Rock", "Salsa", "Ska", "Soul",
  "Techno", "Trap", "Trip-Hop", "Variété française", "Zouk"
] as const;
