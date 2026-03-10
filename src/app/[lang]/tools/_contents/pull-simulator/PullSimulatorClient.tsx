'use client';

import { useCallback, useMemo, useState } from 'react';
import { useI18n } from '@/lib/contexts/I18nContext';
import type { TranslationKey } from '@/i18n';
import { SUFFIX_LANGS } from '@/lib/i18n/config';
import type { Lang } from '@/lib/i18n/config';
import type { BannerType, PullResult } from '@/lib/gacha';
import {
  BANNER_CONFIGS,
  createSession,
  performPulls,
  redeemMileage,
  canUseMileage,
} from '@/lib/gacha';
import CharacterPortrait from '@/app/components/character/CharacterPortrait';
import FitText from '@/app/components/ui/FitText';
import { splitCharacterName } from '@/lib/character-name';
import type { GachaCharacterEntry, GachaMinorEntry } from './index';

// ── Constants ────────────────────────────────────────────────────────────────

const BANNER_TYPES: BannerType[] = ['custom', 'rateup', 'premium', 'limited'];

/** Which character categories can be picked as focus */
const BANNER_FOCUS_CATEGORY: Record<BannerType, GachaCharacterEntry['category'] | null> = {
  custom: null,       // no focus
  rateup: 'normal',
  premium: 'premium',
  limited: 'limited',
};

/** Which character categories appear in the off-focus pull pool */
const BANNER_POOL: Record<BannerType, Set<GachaCharacterEntry['category']>> = {
  custom: new Set(['normal', 'premium', 'limited']),
  rateup: new Set(['normal']),
  premium: new Set(['normal', 'premium']),
  limited: new Set(['normal']),
};

/** How many focus characters each banner allows */
const BANNER_FOCUS_COUNT: Record<BannerType, number> = {
  custom: 0,
  rateup: 1,
  premium: 1,
  limited: 1,
};

const RARITY_COLORS: Record<1 | 2 | 3, string> = {
  1: 'border-zinc-700/40 bg-zinc-900/40',
  2: 'border-blue-500/50 bg-blue-900/20',
  3: 'border-violet-300/50 bg-violet-900/15',
};

const RARITY_GLOW: Record<1 | 2 | 3, string> = {
  1: '',
  2: 'shadow-[0_0_8px_rgba(59,130,246,0.25)]',
  3: 'shadow-[0_0_10px_rgba(167,139,250,0.3)]',
};

const FOCUS_STYLE = 'ring-2 ring-amber-400/60 border-amber-500/50 bg-amber-900/20 shadow-[0_0_12px_rgba(251,191,36,0.3)]';

/** Weight multiplier for off-focus selection per banner type */
const BANNER_CATEGORY_WEIGHT: Record<BannerType, Record<GachaCharacterEntry['category'], number>> = {
  custom: { normal: 1, premium: 1, limited: 1 },
  rateup: { normal: 1, premium: 1, limited: 1 },
  premium: { normal: 1, premium: 0.5, limited: 1 },
  limited: { normal: 1, premium: 1, limited: 1 },
};

function getCharName(char: GachaMinorEntry, lang: Lang): string {
  if (lang === 'en') return char.name;
  return char[`name_${lang}`];
}

/** Pick a random character from a pool using category-based weights */
function weightedPick(pool: GachaCharacterEntry[], weights: Record<GachaCharacterEntry['category'], number>): GachaCharacterEntry {
  const totalWeight = pool.reduce((sum, c) => sum + weights[c.category], 0);
  let roll = Math.random() * totalWeight;
  for (const c of pool) {
    roll -= weights[c.category];
    if (roll <= 0) return c;
  }
  return pool[pool.length - 1];
}

/** Pull result enriched with resolved character info (for 3★ display) */
type ResolvedPull = PullResult & { charSlug: string | null; charId: string | null };

// ── Component ────────────────────────────────────────────────────────────────

type Props = {
  characters: GachaCharacterEntry[];
  pool1: GachaMinorEntry[];
  pool2: GachaMinorEntry[];
};

export default function PullSimulatorClient({ characters, pool1, pool2 }: Props) {
  const { t, lang } = useI18n();
  const tk = (key: string) => t(key as TranslationKey);

  const [bannerType, setBannerType] = useState<BannerType>('rateup');
  const [session, setSession] = useState(() => createSession('rateup'));
  const [lastResults, setLastResults] = useState<ResolvedPull[] | null>(null);
  const [selectedSlugs, setSelectedSlugs] = useState<string[]>([]);
  const [focusSearch, setFocusSearch] = useState('');
  const [focusOpen, setFocusOpen] = useState(false);

  const config = BANNER_CONFIGS[bannerType];
  const maxFocus = BANNER_FOCUS_COUNT[bannerType];
  const focusCategory = BANNER_FOCUS_CATEGORY[bannerType];
  const poolCategories = BANNER_POOL[bannerType];

  // Characters available for focus selection
  const focusPool = useMemo(
    () => focusCategory === null ? [] : characters.filter((c) => c.category === focusCategory),
    [characters, focusCategory],
  );

  // Characters in the off-focus pull pool
  const pullPool = useMemo(
    () => characters.filter((c) => poolCategories.has(c.category)),
    [characters, poolCategories],
  );

  // Resolved selected characters (filter out invalid slugs after banner change)
  const focusChars = useMemo(
    () => selectedSlugs
      .map((slug) => focusPool.find((c) => c.slug === slug))
      .filter((c): c is GachaCharacterEntry => c !== undefined),
    [selectedSlugs, focusPool],
  );

  // Custom banner has no focus requirement — other banners need at least 1 focus
  const canPull = maxFocus === 0 || focusChars.length > 0;

  const handleBannerChange = useCallback((type: BannerType) => {
    setBannerType(type);
    setSession(createSession(type));
    setLastResults(null);
    setSelectedSlugs([]);
    setFocusSearch('');
  }, []);

  const toggleCharacter = useCallback((slug: string) => {
    setSelectedSlugs((prev) => {
      if (prev.includes(slug)) return prev.filter((s) => s !== slug);
      // Respect max focus count for banner
      const max = BANNER_FOCUS_COUNT[bannerType];
      if (prev.length >= max) return prev;
      return [...prev, slug];
    });
  }, [bannerType]);

  const weights = BANNER_CATEGORY_WEIGHT[bannerType];

  const resolveChar = useCallback((pull: PullResult): { charSlug: string | null; charId: string | null } => {
    if (pull.rarity === 1) {
      if (pool1.length === 0) return { charSlug: null, charId: null };
      const c = pool1[Math.floor(Math.random() * pool1.length)];
      return { charSlug: null, charId: c.id };
    }
    if (pull.rarity === 2) {
      if (pool2.length === 0) return { charSlug: null, charId: null };
      const c = pool2[Math.floor(Math.random() * pool2.length)];
      return { charSlug: null, charId: c.id };
    }
    if (pull.isFocus && focusChars.length > 0) {
      const c = focusChars[Math.floor(Math.random() * focusChars.length)];
      return { charSlug: c.slug, charId: c.id };
    }
    const offPool = pullPool.filter((c) => !selectedSlugs.includes(c.slug));
    if (offPool.length > 0) {
      const c = weightedPick(offPool, weights);
      return { charSlug: c.slug, charId: c.id };
    }
    return { charSlug: null, charId: null };
  }, [pool1, pool2, focusChars, pullPool, selectedSlugs, weights]);

  const handlePull = useCallback((count: 1 | 10) => {
    setSession((prev) => {
      const { results, session: next } = performPulls(prev, count);
      setLastResults(results.map((r) => ({ ...r, ...resolveChar(r) })));
      return next;
    });
  }, [resolveChar]);

  const handleMileage = useCallback(() => {
    setSession((prev) => {
      const next = redeemMileage(prev);
      if (!next) return prev;
      const focus = focusChars.length > 0
        ? focusChars[Math.floor(Math.random() * focusChars.length)]
        : null;
      setLastResults([{ rarity: 3, isFocus: true, charSlug: focus?.slug ?? null, charId: focus?.id ?? null }]);
      return next;
    });
  }, [focusChars]);

  const handleReset = useCallback(() => {
    setSession(createSession(bannerType));
    setLastResults(null);
  }, [bannerType]);

  const mileageReady = maxFocus > 0 && canUseMileage(session);
  const mileagePercent = Math.min((session.mileage / config.mileageCap) * 100, 100);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* ── Banner selector ── */}
      <div className="flex flex-wrap justify-center gap-2">
        {BANNER_TYPES.map((type) => (
          <button
            key={type}
            onClick={() => handleBannerChange(type)}
            className={[
              'rounded-lg px-4 py-2.5 text-sm font-medium transition-all',
              type === bannerType
                ? 'bg-linear-to-b from-amber-500/15 to-transparent text-amber-300 border-t-2 border-t-amber-400/60 border-x border-b border-amber-500/20 shadow-[0_2px_16px_rgba(251,191,36,0.1)]'
                : 'border border-zinc-700/40 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50',
            ].join(' ')}
          >
            {tk(`tools.pull-simulator.banner.${type}`)}
          </button>
        ))}
      </div>

      {/* ── Banner info ── */}
      <div className="space-y-2 rounded-lg border border-zinc-700/40 bg-zinc-800/30 p-3 text-xs text-zinc-400">
        {/* Probabilities */}
        <div className="flex flex-wrap justify-center gap-x-4 gap-y-1">
          {config.focus3Rate > 0 && (
            <span>3★ Focus: <strong className="text-yellow-400">{config.focus3Rate}%</strong></span>
          )}
          <span>3★: <strong className="text-yellow-400">{config.offFocus3Rate}%</strong></span>
          <span>2★: <strong className="text-purple-400">{config.rate2}%</strong></span>
          <span>1★: <strong className="text-zinc-200">{config.rate1}%</strong></span>
        </div>
        {/* Ether, guarantee */}
        <div className="flex flex-wrap justify-center gap-x-4 gap-y-1">
          <span>{tk('tools.pull-simulator.ether_cost')}: <strong className="text-zinc-200">{config.etherCost}</strong></span>
          <span>{tk('tools.pull-simulator.guarantee')}: <strong className="text-zinc-200">{config.tenPullGuarantee ? tk('tools.pull-simulator.yes') : tk('tools.pull-simulator.no')}</strong></span>
        </div>
      </div>

      {/* ── Character selection (hidden for custom banner which has no focus) ── */}
      {maxFocus > 0 && (
        <div>
          <h2 className="mb-2 text-sm font-semibold text-zinc-300">
            {tk('tools.pull-simulator.select_focus')}
          </h2>

          {/* Selected focus character(s) */}
          {focusChars.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2">
              {focusChars.map((char) => (
                <button
                  key={char.slug}
                  onClick={() => toggleCharacter(char.slug)}
                  className="group flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-2 py-1.5 transition hover:bg-red-500/10 hover:border-red-500/40"
                >
                  <CharacterPortrait id={char.id} size="xs" />
                  <span className="text-xs font-medium text-amber-300 group-hover:text-red-300">
                    {getCharName(char, lang)}
                  </span>
                  <span className="text-[10px] text-zinc-500 group-hover:text-red-400">✕</span>
                </button>
              ))}
            </div>
          )}

          {/* Search combobox */}
          {focusChars.length < maxFocus && (
            <div className="relative">
              <input
                type="text"
                value={focusSearch}
                onChange={(e) => { setFocusSearch(e.target.value); setFocusOpen(true); }}
                onFocus={() => setFocusOpen(true)}
                onBlur={() => setFocusOpen(false)}
                placeholder={tk('tools.pull-simulator.search_placeholder')}
                className="w-full rounded-lg border border-zinc-700/40 bg-zinc-800/50 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-amber-500/40 focus:outline-none"
              />
              {focusOpen && (
                <div className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-zinc-700/40 bg-zinc-900/95 shadow-xl backdrop-blur-sm">
                  {focusPool
                    .filter((c) => {
                      if (!focusSearch) return true;
                      const q = focusSearch.toLowerCase();
                      return SUFFIX_LANGS.some((l) => c[`name_${l}`].toLowerCase().includes(q))
                        || c.name.toLowerCase().includes(q);
                    })
                    .filter((c) => !selectedSlugs.includes(c.slug))
                    .map((char) => (
                      <button
                        key={char.slug}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => { toggleCharacter(char.slug); setFocusSearch(''); setFocusOpen(false); }}
                        className="flex w-full items-center gap-3 px-3 py-2 text-left transition hover:bg-zinc-800/80"
                      >
                        <CharacterPortrait id={char.id} size="xs" />
                        <span className="text-sm text-zinc-200">{getCharName(char, lang)}</span>
                      </button>
                    ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Pull buttons + Mileage bar ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-2">
          <button
            onClick={() => handlePull(1)}
            disabled={!canPull}
            className={[
              'rounded-lg px-6 py-2.5 text-sm font-semibold transition',
              canPull
                ? 'border border-zinc-600 bg-zinc-700/50 text-zinc-100 hover:bg-zinc-600/50 active:scale-95'
                : 'border border-zinc-700/30 bg-zinc-800/30 text-zinc-600 cursor-not-allowed',
            ].join(' ')}
          >
            {tk('tools.pull-simulator.pull1')}
          </button>
          <button
            onClick={() => handlePull(10)}
            disabled={!canPull}
            className={[
              'rounded-lg px-6 py-2.5 text-sm font-semibold transition',
              canPull
                ? 'border border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 active:scale-95'
                : 'border border-zinc-700/30 bg-zinc-800/30 text-zinc-600 cursor-not-allowed',
            ].join(' ')}
          >
            {tk('tools.pull-simulator.pull10')}
          </button>
          <button
            onClick={handleReset}
            className="rounded-lg border border-zinc-700/40 bg-zinc-800/30 px-4 py-2.5 text-sm text-zinc-500 transition hover:text-zinc-300 hover:bg-zinc-700/40"
          >
            {tk('tools.pull-simulator.reset')}
          </button>
        </div>

        {/* Mileage bar (hidden for All Heroes banner) */}
        {maxFocus > 0 && (
          <div className="flex min-w-0 flex-1 items-center gap-3 sm:max-w-xs">
            <div className="flex-1">
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="text-zinc-400">{tk('tools.pull-simulator.mileage')}</span>
                <span className={mileageReady ? 'font-semibold text-amber-300' : 'text-zinc-300'}>
                  {session.mileage} / {config.mileageCap}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-zinc-700">
                <div
                  className={[
                    'h-full rounded-full transition-all duration-300',
                    mileageReady ? 'bg-amber-400' : 'bg-amber-600/60',
                  ].join(' ')}
                  style={{ width: `${mileagePercent}%` }}
                />
              </div>
            </div>
            <button
              onClick={handleMileage}
              disabled={!mileageReady}
              className={[
                'whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition',
                mileageReady
                  ? 'border border-amber-500/40 bg-amber-500/15 text-amber-300 hover:bg-amber-500/25 active:scale-95'
                  : 'border border-zinc-700/30 bg-zinc-800/30 text-zinc-600 cursor-not-allowed',
              ].join(' ')}
            >
              {tk('tools.pull-simulator.use_mileage')}
            </button>
          </div>
        )}
      </div>

      {/* ── Last pull results ── */}
      {lastResults ? (
        <div>
          <h2 className="mb-3 text-sm font-semibold text-zinc-300">{tk('tools.pull-simulator.results')}</h2>
          <div className="grid grid-cols-5 gap-2">
            {lastResults.map((pull, i) => {
              const char: GachaMinorEntry | undefined = pull.charId
                ? (characters.find((c) => c.id === pull.charId)
                  ?? pool2.find((c) => c.id === pull.charId)
                  ?? pool1.find((c) => c.id === pull.charId))
                : undefined;
              const charName = char ? getCharName(char, lang) : null;
              const nameParts = charName && pull.charId ? splitCharacterName(pull.charId, charName, lang) : null;
              const textColor = pull.isFocus ? 'text-amber-300'
                : pull.rarity === 3 ? 'text-violet-200'
                : pull.rarity === 2 ? 'text-blue-300/80'
                : 'text-zinc-500';
              return (
                <div
                  key={i}
                  className={[
                    'flex min-w-0 flex-col items-center overflow-hidden rounded-lg border p-1.5 transition-all',
                    pull.isFocus ? FOCUS_STYLE : [RARITY_COLORS[pull.rarity], RARITY_GLOW[pull.rarity]].join(' '),
                  ].join(' ')}
                >
                  <CharacterPortrait id={pull.charId ?? ''} size={{ base: 'sm', md: 'md' }} />
                  <div className="mt-1 w-full text-center leading-tight">
                    {nameParts ? (
                      <>
                        {nameParts.prefix && (
                          <FitText max={9} min={5} center className={`w-full font-medium ${textColor} opacity-70`}>
                            {nameParts.prefix}
                          </FitText>
                        )}
                        <FitText max={11} min={5} center className={`w-full font-medium ${textColor}`}>
                          {nameParts.name}
                        </FitText>
                      </>
                    ) : charName ? (
                      <FitText max={11} min={5} center className={`w-full font-medium ${textColor}`}>
                        {charName}
                      </FitText>
                    ) : (
                      <span className="text-[10px] text-zinc-500">{pull.rarity}★</span>
                    )}
                  </div>
                  {pull.isFocus && (
                    <span className="text-[10px] font-bold text-amber-400">
                      {tk('tools.pull-simulator.focus')}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <p className="text-center text-sm text-zinc-500">{tk('tools.pull-simulator.no_pulls')}</p>
      )}

      {/* ── Statistics ── */}
      {session.totalPulls > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-semibold text-zinc-300">{tk('tools.pull-simulator.stats')}</h2>
          <div className={`grid gap-2 ${maxFocus > 0 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-2'}`}>
            <StatCard label={tk('tools.pull-simulator.total_pulls')} value={session.totalPulls} />
            {maxFocus > 0 && (
              <StatCard
                label={tk('tools.pull-simulator.total_ether')}
                value={session.totalEther.toLocaleString()}
              />
            )}
            <StatCard
              label={tk('tools.pull-simulator.first_3star')}
              value={session.pullsToFirst3Star ?? tk('tools.pull-simulator.never')}
              highlight={session.pullsToFirst3Star !== null}
            />
            {maxFocus > 0 && (
              <StatCard
                label={tk('tools.pull-simulator.first_focus')}
                value={session.pullsToFocus ?? tk('tools.pull-simulator.never')}
                highlight={session.pullsToFocus !== null}
              />
            )}
          </div>

          {/* Rarity breakdown */}
          <div className={`mt-3 grid gap-2 ${maxFocus > 0 ? 'grid-cols-4' : 'grid-cols-3'}`}>
            <RarityBar label="1★" count={session.counts.star1} total={session.totalPulls} color="bg-zinc-500" />
            <RarityBar label="2★" count={session.counts.star2} total={session.totalPulls} color="bg-blue-500" />
            <RarityBar label="3★" count={session.counts.star3} total={session.totalPulls} color="bg-violet-400" />
            {maxFocus > 0 && (
              <RarityBar
                label={`3★ ${tk('tools.pull-simulator.focus')}`}
                count={session.counts.star3Focus}
                total={session.totalPulls}
                color="bg-amber-400"
              />
            )}
          </div>
        </div>
      )}

      {/* ── Pull history ── */}
      {session.history.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-semibold text-zinc-300">{tk('tools.pull-simulator.history')}</h2>
          <div className="max-h-64 space-y-1.5 overflow-y-auto rounded-lg border border-zinc-700/40 bg-zinc-800/20 p-3">
            {[...session.history].reverse().map((batch, revIdx) => {
              const batchIdx = session.history.length - 1 - revIdx;
              return (
                <div key={batchIdx} className="flex items-center gap-2 text-xs">
                  <span className="w-14 shrink-0 text-zinc-500">
                    {tk('tools.pull-simulator.batch')} {batchIdx + 1}
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {batch.map((pull, j) => (
                      <span
                        key={j}
                        className={[
                          'inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium',
                          pull.rarity === 3
                            ? pull.isFocus
                              ? 'bg-amber-500/20 text-amber-300 ring-1 ring-amber-400/40'
                              : 'bg-violet-500/15 text-violet-300'
                            : pull.rarity === 2
                              ? 'bg-blue-500/15 text-blue-300'
                              : 'bg-zinc-700/40 text-zinc-500',
                        ].join(' ')}
                      >
                        {pull.rarity}★{pull.isFocus ? ' ✦' : ''}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ label, value, highlight }: { label: string; value: string | number; highlight?: boolean }) {
  return (
    <div className="rounded-lg border border-zinc-700/40 bg-zinc-800/30 p-3 text-center">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className={['mt-1 text-lg font-bold', highlight ? 'text-amber-300' : 'text-zinc-100'].join(' ')}>
        {value}
      </p>
    </div>
  );
}

function RarityBar({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div className="rounded-lg border border-zinc-700/40 bg-zinc-800/30 p-2 text-center">
      <p className="text-[10px] text-zinc-500">{label}</p>
      <p className="text-sm font-bold text-zinc-200">{count}</p>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-zinc-700">
        <div
          className={`h-full rounded-full transition-all duration-300 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-0.5 text-[10px] text-zinc-500">{pct.toFixed(1)}%</p>
    </div>
  );
}
