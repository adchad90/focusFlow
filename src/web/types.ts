export interface Profile {
  id: string;
  userId: string;
  platform: string;
  handle: string;
  url: string;
}

export interface Source {
  id: string;
  userId: string;
  type: string;
  value: string;
}

export interface Feedback {
  id: string;
  curationId: string;
  userId: string;
  rating: number;
}

export interface Curation {
  id: string;
  userId: string;
  title: string;
  url: string;
  source: string;
  summary: string;
  createdAt: string;
  feedback: Feedback | null;
}

export interface User {
  id: string;
  discordId: string;
  discordUsername: string;
  interests: string | null;
  noise: string | null;
  frequency: string | null;
  profiles: Profile[];
  sources: Source[];
}
