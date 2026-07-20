export interface StudentEvent {
  id: string;
  title: string;
  emoji: string;
  organization: string;
  date: string;
  time: string;
  venue: string;
  /** Day of month for relative "posted" label */
  day: number;
  caption?: string;
  imageUrl?: string | null;
  imageUrls?: string[];
  postedAt?: string | null;
  requestId?: string | null;
  letterPath?: string | null;
}
