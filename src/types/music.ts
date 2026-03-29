export interface Song {
  id: string;
  title: string;
  author: string;
  audioFile: string;
  coverImage: string;
  uploadedBy: string;
  genre: string;
  playCount: number;
  likesCount: number;
  created: string;
  collectionId: string;
  collectionName: string;
  expand?: {
    uploadedBy?: PBUser;
  };
}

export interface PBUser {
  id: string;
  email: string;
  pseudo: string;
  firstName: string;
  lastName: string;
  avatar: string;
  profileCompleted?: boolean;
  profilCompleted?: boolean;
  collectionId: string;
  collectionName: string;
}

export interface ListenHistory {
  id: string;
  user: string;
  song: string;
  listenedAt: string;
  expand?: {
    song?: Song;
  };
}

export interface SongLike {
  id: string;
  user: string;
  song: string;
  created: string;
}

export interface Follow {
  id: string;
  follower: string;
  following: string;
  status: 'pending' | 'accepted';
  created: string;
  expand?: {
    follower?: PBUser;
    following?: PBUser;
  };
}

export interface Playlist {
  id: string;
  title: string;
  description: string;
  public: boolean;
  owner: string;
  songs: string[];
  viewCount: number;
  playCount: number;
  likesCount: number;
  thumbnailMode: 'grid' | 'single';
  created: string;
  updated: string;
  collectionId: string;
  collectionName: string;
  expand?: {
    owner?: PBUser;
    songs?: Song[];
  };
}

export interface PlaylistLike {
  id: string;
  user: string;
  playlist: string;
  created: string;
  expand?: {
    playlist?: Playlist;
  };
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