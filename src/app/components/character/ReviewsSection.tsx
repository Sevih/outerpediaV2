'use client';

import type { Review } from '@/types/review';
import type { ElementType } from '@/types/enums';
import { useState } from 'react';
import { useI18n } from '@/lib/contexts/I18nContext';
import { elementAccent } from './characterDetailTheme';

const PAGE_SIZE = 10;

type Props = {
  reviews: Review[];
  element: ElementType;
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

export default function ReviewsSection({ reviews, element }: Props) {
  const { t } = useI18n();
  const { hex } = elementAccent(element);
  const [page, setPage] = useState(1);

  const average =
    reviews.length > 0
      ? Math.round((reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length) * 10) / 10
      : 0;

  // Distribution per integer star bucket (1..5)
  const distribution = [0, 0, 0, 0, 0];
  for (const r of reviews) {
    const bucket = Math.min(5, Math.max(1, Math.round(r.rating)));
    distribution[bucket - 1]++;
  }

  const totalPages = Math.ceil(reviews.length / PAGE_SIZE);
  const visibleReviews = reviews.slice(0, page * PAGE_SIZE);
  const hasMore = page < totalPages;

  return (
    <div className="flex flex-col gap-4">
      {/* CTA */}
      <p className="text-sm text-zinc-400">
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
          {/* Summary: average + distribution */}
          <div className="grid grid-cols-[auto_1fr] items-center gap-7 border-b border-white/6 pb-5">
            <div className="flex min-w-32 flex-col items-center gap-1.5">
              <div className="font-game text-5xl leading-none font-bold" style={{ color: hex, textShadow: `0 0 24px ${hex}55` }}>
                {average}
              </div>
              <StarRating rating={average} />
              <span className="font-mono text-[10px] tracking-wider text-zinc-500 uppercase">
                {t('page.character.reviews.count', { count: String(reviews.length) })}
              </span>
            </div>
            <div className="flex flex-col gap-1">
              {[5, 4, 3, 2, 1].map((star) => {
                const count = distribution[star - 1];
                const pct = reviews.length ? (count / reviews.length) * 100 : 0;
                return (
                  <div key={star} className="grid grid-cols-[28px_1fr_36px] items-center gap-2.5">
                    <span className="font-mono text-[11px] text-zinc-400">{star}★</span>
                    <span className="h-1.5 overflow-hidden rounded-full bg-white/5">
                      <span className="block h-full" style={{ width: `${pct}%`, background: hex, opacity: 0.7 }} />
                    </span>
                    <span className="text-right font-mono text-[10.5px] text-zinc-500">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Reviews list */}
          <div className="flex flex-col gap-3">
            {visibleReviews.map((review) => (
              <div key={review.id} className="card flex items-start gap-3 rounded-xl p-4">
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
            ))}
          </div>

          {/* Load more */}
          {hasMore && (
            <button
              onClick={() => setPage(p => p + 1)}
              className="w-full rounded-lg border border-white/10 bg-white/5 py-2 text-sm text-zinc-400 transition hover:bg-white/10 hover:text-zinc-200"
            >
              {t('page.character.reviews.load_more')}
            </button>
          )}

          {/* Discord attribution */}
          <p className="text-xs text-zinc-500">
            {t('page.character.reviews.via_discord')}
          </p>
        </>
      )}
    </div>
  );
}
