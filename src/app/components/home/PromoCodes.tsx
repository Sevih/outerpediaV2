'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import Link from 'next/link';
import type { Lang } from '@/lib/i18n/config';
import ItemInline from '@/app/components/inline/ItemInline';
import { localePath } from '@/lib/navigation';
import {
  useRedeem,
  redeemCode,
  isRedeemedKey,
  REDEEM_SERVERS,
  type RedeemServer,
  type RedeemResultKey,
  type UseRedeem,
} from '@/lib/redeem';

type PromoCode = {
  code: string;
  description: Record<string, string>;
  start: string;
  end: string;
};

type Status = 'active' | 'expired' | 'upcoming';

/** Translation accessor for `coupons.redeem.*` keys (short key in, full string out). */
type Rt = (key: string) => string;

type Props = {
  codes: PromoCode[];
  lang?: Lang;
  limit?: number;
  showAll?: boolean;
  /** Enables the one-click redeem panel + per-code redeem buttons. */
  enableRedeem?: boolean;
  /** Flat map of `coupons.redeem.*` i18n strings (required when enableRedeem). */
  redeemT?: Record<string, string>;
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

/* ------------------------------------------------------------------ */
/* Redeem setup panel — UID + server, stored in localStorage.         */
/* ------------------------------------------------------------------ */

function RedeemSetup({ redeem, rt }: { redeem: UseRedeem; rt: Rt }) {
  const [uid, setUid] = useState('');
  const [server, setServer] = useState<RedeemServer | ''>('');
  const [justSaved, setJustSaved] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(null);

  // Hydrate the inputs once localStorage has been read.
  useEffect(() => {
    if (redeem.loaded) {
      setUid(redeem.uid);
      setServer(redeem.server);
    }
  }, [redeem.loaded, redeem.uid, redeem.server]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const uidValid = /^[0-9]{4,20}$/.test(uid.trim());
  const canSave = uidValid && server !== '';

  const handleSave = () => {
    if (!canSave) return;
    redeem.saveAccount(uid, server);
    setJustSaved(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setJustSaved(false), 1500);
  };

  return (
    <div className="mb-6 rounded-lg border border-zinc-700 bg-zinc-800/50 p-4">
      <h2 className="text-sm font-semibold text-zinc-200">{rt('title')}</h2>
      <p className="mt-1 text-xs text-zinc-400">{rt('desc')}</p>

      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="flex flex-1 flex-col gap-1">
          <span className="text-xs font-medium text-zinc-300">{rt('uid_label')}</span>
          <input
            type="text"
            inputMode="numeric"
            value={uid}
            onChange={(e) => setUid(e.target.value.replace(/[^0-9]/g, ''))}
            placeholder={rt('uid_placeholder')}
            className="rounded bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none ring-1 ring-zinc-700 focus:ring-cyan-500"
          />
        </label>

        <label className="flex flex-col gap-1 sm:w-40">
          <span className="text-xs font-medium text-zinc-300">{rt('server_label')}</span>
          <select
            value={server}
            onChange={(e) => setServer(e.target.value as RedeemServer | '')}
            className="rounded bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none ring-1 ring-zinc-700 focus:ring-cyan-500"
          >
            <option value="">—</option>
            {REDEEM_SERVERS.map((s) => (
              <option key={s} value={s}>
                {rt(`server_${s}`)}
              </option>
            ))}
          </select>
        </label>

        <button
          onClick={handleSave}
          disabled={!canSave}
          className="rounded bg-cyan-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {justSaved ? rt('saved') : rt('save')}
        </button>
      </div>

      <p className="mt-2 text-xs text-zinc-500">{rt('hint')}</p>
      <p className="mt-1 text-xs text-zinc-600">{rt('disclaimer')}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Per-code redeem button — isolated state per coupon.                */
/* ------------------------------------------------------------------ */

function RedeemButton({
  code,
  redeem,
  rt,
}: {
  code: string;
  redeem: UseRedeem;
  rt: Rt;
}) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<RedeemResultKey | null>(null);

  const alreadyRedeemed = code in redeem.redeemed;

  const handleRedeem = async () => {
    if (busy || !redeem.isConfigured || redeem.server === '') return;
    setBusy(true);
    setResult(null);
    const key = await redeemCode({
      uid: redeem.uid,
      server: redeem.server,
      code,
    });
    if (isRedeemedKey(key)) redeem.markRedeemed(code);
    setResult(key);
    setBusy(false);
  };

  const success = result !== null && isRedeemedKey(result);

  return (
    <div className="flex flex-col gap-1">
      {alreadyRedeemed ? (
        <span className="inline-flex w-fit items-center gap-1 rounded bg-green-600/20 px-3 py-1.5 text-xs font-medium text-green-300">
          ✓ {rt('redeemed')}
        </span>
      ) : (
        <button
          onClick={handleRedeem}
          disabled={busy || !redeem.isConfigured}
          title={!redeem.isConfigured ? rt('need_setup') : undefined}
          className="w-fit rounded bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? rt('busy') : rt('button')}
        </button>
      )}
      {result && (
        <span
          className={`text-xs ${success ? 'text-green-400' : 'text-red-400'}`}
        >
          {rt(`result.${result}`)}
        </span>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

export default function PromoCodes({
  codes,
  lang,
  limit,
  showAll,
  enableRedeem,
  redeemT,
  t,
}: Props) {
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(null);

  const redeem = useRedeem();
  const rt: Rt = (key) => redeemT?.[`coupons.redeem.${key}`] ?? key;

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

      {showAll && enableRedeem && redeemT && (
        <RedeemSetup redeem={redeem} rt={rt} />
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

                  {/* One-click redeem (active codes only) */}
                  {showAll && enableRedeem && redeemT && status === 'active' && (
                    <RedeemButton code={promo.code} redeem={redeem} rt={rt} />
                  )}

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
                href={localePath(lang, '/coupons')}
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
