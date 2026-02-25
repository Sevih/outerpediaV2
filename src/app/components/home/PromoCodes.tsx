'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import Link from 'next/link';
import type { Lang } from '@/lib/i18n/config';
import ItemInline from '@/app/components/inline/ItemInline';
import { localePath } from '@/lib/navigation';

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

const STATUS_STYLES: Record<Status, { badge: string; code: string; icon: string }> = {
  active: { badge: 'text-green-400', code: 'bg-green-600/20 text-green-300', icon: '✓' },
  upcoming: { badge: 'text-yellow-400', code: 'bg-yellow-600/20 text-yellow-300', icon: '⏳' },
  expired: { badge: 'text-zinc-500', code: 'bg-zinc-700/50 text-zinc-500', icon: '✗' },
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
    if (s === 'active') return t.active ?? '';
    if (s === 'upcoming') return t.upcoming ?? '';
    return t.expired ?? '';
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
          <div className={showAll ? 'space-y-3' : 'divide-y divide-zinc-800'}>
            {displayed.map((promo) => {
              const status = getStatus(promo, now);
              const styles = STATUS_STYLES[status];

              return (
                <div
                  key={promo.code}
                  className={showAll
                    ? `card-interactive flex flex-col gap-2 p-4 ${status === 'expired' ? 'opacity-60' : ''}`
                    : `flex flex-col gap-1.5 py-3 ${status === 'expired' ? 'opacity-60' : ''}`
                  }
                >
                  {/* Top row: Code + Copy + Validity + Status */}
                  <div className="flex items-center gap-3">
                    <span className={`shrink-0 rounded px-2.5 py-1 font-mono text-sm font-bold ${styles.code}`}>
                      {promo.code}
                    </span>
                    <button
                      onClick={() => handleCopy(promo.code)}
                      className="shrink-0 rounded bg-zinc-700 px-3 py-1.5 text-xs font-medium transition-colors hover:bg-zinc-600"
                    >
                      {copiedCode === promo.code ? t.copied : t.copy}
                    </button>
                    <div className="flex-1" />
                    {showAll && (
                      <span className={`flex shrink-0 items-center gap-1.5 text-xs font-semibold ${styles.badge}`}>
                        <span>{styles.icon}</span>
                        {statusLabel(status)}
                      </span>
                    )}
                  </div>

                  {/* Rewards */}
                  <div className="flex flex-col gap-1">
                    {Object.entries(promo.description).map(([item, qty]) => (
                      <span key={item} className="inline-flex items-center gap-1 text-xs text-zinc-400">
                        <ItemInline name={item} />
                        <span>x{qty}</span>
                      </span>
                    ))}
                  </div>

                  {/* Validity */}
                  {showAll && (
                    <p className="text-xs text-zinc-500">
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
                href={localePath(lang, '/promo-codes')}
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
