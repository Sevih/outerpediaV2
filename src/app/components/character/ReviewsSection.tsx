'use client';

import type { Review } from '@/types/review';
import { useState } from 'react';
import { useI18n } from '@/lib/contexts/I18nContext';

const PAGE_SIZE = 10;

type Props = {
  reviews: Review[];
};

function getDiscordAvatarUrl(userId: string, avatar: string | null): string {
  if (avatar) {
    return `https://cdn.discordapp.com/avatars/${userId}/${avatar}.webp?size=64`;
  }
  // Default Discord avatar (based on user ID)
  const index = Number(BigInt(userId) >> BigInt(22)) % 6;
  return `https://cdn.discordapp.com/embed/avatars/${index}.png`;
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/** Parse Discord custom emojis <:name:id> and <a:name:id> into img elements */
function renderTextWithEmojis(text: string) {
  const parts = text.split(/(<a?:\w+:\d+>)/g);
  return parts.map((part, i) => {
    const match = part.match(/^<(a?):(\w+):(\d+)>$/);
    if (match) {
      const [, animated, name, id] = match;
      const ext = animated ? 'gif' : 'webp';
      // eslint-disable-next-line @next/next/no-img-element
      return <img
        key={i}
        src={`https://cdn.discordapp.com/emojis/${id}.${ext}?size=20`}
        alt={`:${name}:`}
        title={`:${name}:`}
        width={20}
        height={20}
        className="inline-block align-text-bottom"
        loading="lazy"
      />;
    }
    return part;
  });
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => {
        if (star <= Math.floor(rating)) {
          return <span key={star} className="text-amber-400">★</span>;
        }
        if (star === Math.ceil(rating) && rating % 1 >= 0.5) {
          return (
            <span key={star} className="relative text-zinc-600">
              ★
              <span className="absolute inset-0 overflow-hidden" style={{ width: '50%' }}>
                <span className="text-amber-400">★</span>
              </span>
            </span>
          );
        }
        return <span key={star} className="text-zinc-600">★</span>;
      })}
    </div>
  );
}

export default function ReviewsSection({ reviews }: Props) {
  const { t } = useI18n();
  const [page, setPage] = useState(1);

  const average =
    reviews.length > 0
      ? Math.round((reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length) * 10) / 10
      : 0;

  const totalPages = Math.ceil(reviews.length / PAGE_SIZE);
  const visibleReviews = reviews.slice(0, page * PAGE_SIZE);
  const hasMore = page < totalPages;

  return (
    <section id="reviews">
      <h2 className="mb-4 text-2xl font-bold">{t('page.character.toc.reviews')}</h2>

      {/* CTA */}
      <p className="mb-6 text-sm text-zinc-400">
        {t('page.character.reviews.cta')}{' '}
        <a
          href="https://discord.gg/PNMd5mkAV8"
          target="_blank"
          rel="noopener noreferrer"
          className="text-indigo-400 hover:underline"
        >
          EvaMains Discord
        </a>
      </p>

      {reviews.length === 0 ? (
        <p className="text-sm italic text-zinc-500">{t('page.character.reviews.no_reviews')}</p>
      ) : (
        <>
          {/* Summary */}
          <div className="mb-6 flex items-center gap-4">
            <div className="text-4xl font-bold text-amber-400">{average}</div>
            <div>
              <StarRating rating={Math.round(average)} />
              <p className="mt-1 text-sm text-zinc-400">
                {t('page.character.reviews.count', { count: String(reviews.length) })}
              </p>
            </div>
          </div>

          {/* Reviews list */}
          <div className="space-y-4">
            {visibleReviews.map((review) => (
              <div
                key={review.id}
                className="rounded-xl border border-zinc-700/50 bg-zinc-800/50 p-4"
              >
                <div className="flex items-start gap-3">
                  {/* Vote score */}
                  <div className="flex shrink-0 flex-col items-center gap-0.5 pt-1">
                    <span className="text-xs text-zinc-500">👍</span>
                    <span className={`text-sm font-semibold ${review.score > 0 ? 'text-emerald-400' : review.score < 0 ? 'text-red-400' : 'text-zinc-500'}`}>
                      {review.score || 0}
                    </span>
                    <span className="text-xs text-zinc-500">👎</span>
                  </div>

                  {/* Avatar */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={getDiscordAvatarUrl(review.userId, review.avatar)}
                    alt={review.displayName}
                    width={40}
                    height={40}
                    className="shrink-0 rounded-full"
                    loading="lazy"
                  />

                  <div className="min-w-0 flex-1">
                    {/* Header: name + rating + date */}
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-zinc-200">{review.displayName}</span>
                      <StarRating rating={review.rating} />
                      <span className="text-xs text-zinc-500">{formatDate(review.timestamp)}</span>
                    </div>

                    {/* Review text */}
                    <p className="mt-2 text-sm leading-relaxed text-zinc-300 whitespace-pre-line">
                      {renderTextWithEmojis(review.text)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Load more */}
          {hasMore && (
            <button
              onClick={() => setPage(p => p + 1)}
              className="mt-4 w-full rounded-lg border border-zinc-700 bg-zinc-800/50 py-2 text-sm text-zinc-400 transition hover:bg-zinc-700/50 hover:text-zinc-200"
            >
              {t('page.character.reviews.load_more')}
            </button>
          )}

          {/* Discord attribution */}
          <p className="mt-4 text-xs text-zinc-500">
            {t('page.character.reviews.via_discord')}
          </p>
        </>
      )}
    </section>
  );
}
