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
