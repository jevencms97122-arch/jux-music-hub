export interface Song {
  id: string;
  title: string;
  author: string;
  audioFile: string;
  coverImage: string;
  uploadedBy: string;
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
