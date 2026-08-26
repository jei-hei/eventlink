export interface StudentEvent {
  id: string;
  title: string;
  emoji: string;
  /** Poster's organization name (from creator profile). */
  organization: string;
  /** Poster's full display name. */
  posterName: string;
  /** Poster's college name (empty if none on profile). */
  posterCollege: string;
  /** Public avatar URL; null → letter fallback. */
  posterAvatarUrl?: string | null;
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
