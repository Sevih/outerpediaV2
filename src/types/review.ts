export type Review = {
  id: string;
  userId: string;
  username: string;
  displayName: string;
  avatar: string | null;
  rating: number;
  text: string;
  score: number;
  source: string;
  timestamp: string;
};
