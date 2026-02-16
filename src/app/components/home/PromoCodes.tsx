'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import Link from 'next/link';
import type { Lang } from '@/lib/i18n/config';

type PromoCode = {
  code: string;
  description: Record<string, string>;
  start: string;
  end: string;
};

type Props = {
  codes: PromoCode[];
  lang?: Lang;
  limit?: number;
  t: {
    title: string;
    copy: string;
    copied: string;
    empty: string;
    viewAll?: string;
  };
};

export default function PromoCodes({ codes, lang, limit, t }: Props) {
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const now = new Date().toISOString().slice(0, 10);
  const activeCodes = useMemo(
    () => codes
      .filter((c) => c.start <= now && c.end >= now)
      .sort((a, b) => b.start.localeCompare(a.start)),
    [codes, now]
  );

  const displayed = useMemo(
    () => limit ? activeCodes.slice(0, limit) : activeCodes,
    [activeCodes, limit]
  );
  const hasMore = limit && activeCodes.length > limit;

  const handleCopy = async (code: string) => {
    await navigator.clipboard.writeText(code);
    setCopiedCode(code);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setCopiedCode(null), 1500);
  };

  return (
    <section>
      <h2 className="mx-auto mb-6 text-2xl">{t.title}</h2>
      {activeCodes.length === 0 ? (
        <p className="text-center text-sm text-zinc-500">{t.empty}</p>
      ) : (
        <>
          <div className={limit
            ? 'space-y-3'
            : 'grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3'
          }>
            {displayed.map((promo) => (
              <div key={promo.code} className="card flex items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="truncate font-mono text-sm font-bold text-cyan-400">
                    {promo.code}
                  </p>
                  <p className="mt-1 truncate text-xs text-zinc-400">
                    {Object.entries(promo.description)
                      .map(([item, qty]) => `${qty}x ${item}`)
                      .join(', ')}
                  </p>
                </div>
                <button
                  onClick={() => handleCopy(promo.code)}
                  className="shrink-0 rounded bg-zinc-700 px-3 py-1.5 text-xs font-medium transition-colors hover:bg-zinc-600"
                >
                  {copiedCode === promo.code ? t.copied : t.copy}
                </button>
              </div>
            ))}
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
