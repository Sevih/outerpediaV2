import type { Review } from '@/types/review';

const BOT_API_URL = process.env.BOT_API_URL || 'http://localhost:3001';
const REVALIDATE = process.env.NODE_ENV === 'development' ? 10 : 60;

/** Fetch reviews for a character from the bot API */
export async function getReviewsForCharacter(slug: string): Promise<Review[]> {
  const url = `${BOT_API_URL}/reviews/${encodeURIComponent(slug)}`;
  try {
    const res = await fetch(url, {
      next: { revalidate: REVALIDATE },
    });
    if (!res.ok) return [];
    return (await res.json()) as Review[];
  } catch {
    return [];
  }
}
