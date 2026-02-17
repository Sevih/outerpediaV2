'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import Link from 'next/link';
import type { Lang } from '@/lib/i18n/config';
import ItemInline from '@/app/components/inline/ItemInline';

type PromoCode = {
  code: string;
  description: Record<string, string>;
  start: string;
  end: string;
};

type Status = 'active' | 'expired' | 'upcoming';

type Props = {
  codes: PromoCode[];
  lang?: Lang;
  limit?: number;
  showAll?: boolean;
  t: {
    title: string;
    copy: string;
    copied: string;
    empty: string;
    viewAll?: string;
    active?: string;
    expired?: string;
    upcoming?: string;
    validity?: string;
    redeemAndroid?: string;
    redeemIos?: string;
  };
};

function getStatus(code: PromoCode, now: string): Status {
  if (code.start > now) return 'upcoming';
  if (code.end < now) return 'expired';
  return 'active';
}

const STATUS_STYLES: Record<Status, { badge: string; code: string }> = {
  active: { badge: 'bg-green-600/20 text-green-400', code: 'text-cyan-400' },
  upcoming: { badge: 'bg-yellow-600/20 text-yellow-400', code: 'text-yellow-400' },
  expired: { badge: 'bg-zinc-700/50 text-zinc-500', code: 'text-zinc-500' },
};

export default function PromoCodes({ codes, lang, limit, showAll, t }: Props) {
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const now = new Date().toISOString().slice(0, 10);

  const { activeCodes, allSorted } = useMemo(() => {
    const active: PromoCode[] = [];
    const upcoming: PromoCode[] = [];
    const expired: PromoCode[] = [];

    for (const c of codes) {
      const s = getStatus(c, now);
      if (s === 'active') active.push(c);
      else if (s === 'upcoming') upcoming.push(c);
      else expired.push(c);
    }

    const byStartDesc = (a: PromoCode, b: PromoCode) => b.start.localeCompare(a.start);
    active.sort(byStartDesc);
    upcoming.sort(byStartDesc);
    expired.sort(byStartDesc);

    return {
      activeCodes: active,
      allSorted: [...active, ...upcoming, ...expired],
    };
  }, [codes, now]);

  const displayed = useMemo(() => {
    if (showAll) return allSorted;
    if (limit) return activeCodes.slice(0, limit);
    return activeCodes;
  }, [showAll, allSorted, activeCodes, limit]);

  const hasMore = limit && !showAll && activeCodes.length > limit;

  const handleCopy = async (code: string) => {
    await navigator.clipboard.writeText(code);
    setCopiedCode(code);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setCopiedCode(null), 1500);
  };

  const statusLabel = (s: Status) => {
    if (s === 'active') return t.active ?? 'Active';
    if (s === 'upcoming') return t.upcoming ?? 'Upcoming';
    return t.expired ?? 'Expired';
  };

  return (
    <section>
      {!showAll && <h2 className="mx-auto mb-6 text-2xl">{t.title}</h2>}

      {showAll && (t.redeemAndroid || t.redeemIos) && (
        <div className="mb-6 rounded-lg border border-zinc-700 bg-zinc-800/50 p-4 text-sm text-zinc-300">
          {t.redeemAndroid && <p>{t.redeemAndroid}</p>}
          {t.redeemIos && (
            <p className="mt-1" dangerouslySetInnerHTML={{ __html: t.redeemIos }} />
          )}
        </div>
      )}

      {displayed.length === 0 ? (
        <p className="text-center text-sm text-zinc-500">{t.empty}</p>
      ) : (
        <>
          <div className={limit && !showAll
            ? 'space-y-3'
            : 'grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3'
          }>
            {displayed.map((promo) => {
              const status = getStatus(promo, now);
              const styles = STATUS_STYLES[status];

              return (
                <div
                  key={promo.code}
                  className={`card flex flex-col gap-2 p-4 ${status === 'expired' ? 'opacity-60' : ''}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <p className={`truncate font-mono text-sm font-bold ${styles.code}`}>
                        {promo.code}
                      </p>
                      {showAll && (
                        <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${styles.badge}`}>
                          {statusLabel(status)}
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => handleCopy(promo.code)}
                      className="shrink-0 rounded bg-zinc-700 px-3 py-1.5 text-xs font-medium transition-colors hover:bg-zinc-600"
                    >
                      {copiedCode === promo.code ? t.copied : t.copy}
                    </button>
                  </div>

                  <div className="flex flex-col gap-1">
                    {Object.entries(promo.description).map(([item, qty]) => (
                      <span key={item} className="inline-flex items-center gap-1 text-xs text-zinc-400">
                        <ItemInline name={item} />
                        <span>x{qty}</span>
                      </span>
                    ))}
                  </div>

                  {showAll && (
                    <p className="text-[11px] text-zinc-500">
                      {(t.validity ?? '{start} — {end}')
                        .replace('{start}', promo.start)
                        .replace('{end}', promo.end)}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
          {hasMore && lang && t.viewAll && (
            <div className="mt-4 text-center">
              <Link
                href={`/${lang}/promo-codes`}
                className="text-sm text-cyan-400 hover:underline"
              >
                {t.viewAll.replace('{count}', String(activeCodes.length))}
              </Link>
            </div>
          )}
        </>
      )}
    </section>
  );
}
