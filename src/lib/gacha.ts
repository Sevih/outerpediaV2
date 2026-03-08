import type { RarityType } from '@/types/enums';

// ── Banner type definitions ──────────────────────────────────────────────────

export type BannerType = 'custom' | 'rateup' | 'premium' | 'limited';

export type BannerConfig = {
  type: BannerType;
  /** Rate for the featured 3★ (sum if multiple focus units) */
  focus3Rate: number;
  /** Rate for non-focus 3★ */
  offFocus3Rate: number;
  /** 2★ rate */
  rate2: number;
  /** 1★ rate */
  rate1: number;
  /** Mileage required for guaranteed unit */
  mileageCap: number;
  /** Ether cost per single pull */
  etherCost: number;
  /** Whether 10-pull guarantees at least one 2★+ */
  tenPullGuarantee: boolean;
  /** Whether a free daily pull is available */
  freePull: boolean;
};

export const BANNER_CONFIGS: Record<BannerType, BannerConfig> = {
  custom: {
    type: 'custom',
    focus3Rate: 0,
    offFocus3Rate: 2.5,
    rate2: 19,
    rate1: 78.5,
    mileageCap: 200,
    etherCost: 150,
    tenPullGuarantee: true,
    freePull: true,
  },
  rateup: {
    type: 'rateup',
    focus3Rate: 1.25,
    offFocus3Rate: 1.25,
    rate2: 19,
    rate1: 78.5,
    mileageCap: 200,
    etherCost: 150,
    tenPullGuarantee: true,
    freePull: false,
  },
  premium: {
    type: 'premium',
    focus3Rate: 1.25,
    offFocus3Rate: 2.5,
    rate2: 19,
    rate1: 77.25,
    mileageCap: 200,
    etherCost: 225,
    tenPullGuarantee: false,
    freePull: true,
  },
  limited: {
    type: 'limited',
    focus3Rate: 1.25,
    offFocus3Rate: 1.25,
    rate2: 19,
    rate1: 78.5,
    mileageCap: 150,
    etherCost: 150,
    tenPullGuarantee: true,
    freePull: false,
  },
};

// ── Pull result ──────────────────────────────────────────────────────────────

export type PullResult = {
  rarity: RarityType;
  isFocus: boolean;
};

// ── Session state ────────────────────────────────────────────────────────────

export type GachaSession = {
  bannerType: BannerType;
  totalPulls: number;
  mileage: number;
  pullsToFirst3Star: number | null;
  pullsToFocus: number | null;
  totalEther: number;
  history: PullResult[][];
  counts: { star1: number; star2: number; star3: number; star3Focus: number };
};

export function createSession(bannerType: BannerType): GachaSession {
  return {
    bannerType,
    totalPulls: 0,
    mileage: 0,
    pullsToFirst3Star: null,
    pullsToFocus: null,
    totalEther: 0,
    history: [],
    counts: { star1: 0, star2: 0, star3: 0, star3Focus: 0 },
  };
}

// ── Core pull logic ──────────────────────────────────────────────────────────

function rollSingle(config: BannerConfig): PullResult {
  const roll = Math.random() * 100;

  if (roll < config.focus3Rate) {
    return { rarity: 3, isFocus: true };
  }
  if (roll < config.focus3Rate + config.offFocus3Rate) {
    return { rarity: 3, isFocus: false };
  }
  if (roll < config.focus3Rate + config.offFocus3Rate + config.rate2) {
    return { rarity: 2, isFocus: false };
  }
  return { rarity: 1, isFocus: false };
}

function pullMulti(config: BannerConfig, count: number): PullResult[] {
  const results: PullResult[] = [];
  for (let i = 0; i < count; i++) {
    results.push(rollSingle(config));
  }

  // 10-pull guarantee: if no 2★+, upgrade last 1★ to 2★
  if (count === 10 && config.tenPullGuarantee) {
    const hasHighRarity = results.some((r) => r.rarity >= 2);
    if (!hasHighRarity) {
      const lastOneStarIdx = results.findLastIndex((r) => r.rarity === 1);
      if (lastOneStarIdx !== -1) {
        results[lastOneStarIdx] = { rarity: 2, isFocus: false };
      }
    }
  }

  return results;
}

// ── Public API ───────────────────────────────────────────────────────────────

export function performPulls(session: GachaSession, count: 1 | 10): { results: PullResult[]; session: GachaSession } {
  const config = BANNER_CONFIGS[session.bannerType];
  const results = pullMulti(config, count);

  const next: GachaSession = {
    ...session,
    totalPulls: session.totalPulls + count,
    mileage: session.mileage + count,
    totalEther: session.totalEther + count * config.etherCost,
    history: [...session.history, results],
    counts: { ...session.counts },
  };

  for (const r of results) {
    if (r.rarity === 1) next.counts.star1++;
    else if (r.rarity === 2) next.counts.star2++;
    else {
      next.counts.star3++;
      if (r.isFocus) next.counts.star3Focus++;
    }
  }

  // Track first 3★ and first focus
  if (next.pullsToFirst3Star === null && next.counts.star3 > 0) {
    // Find the exact pull number
    let pullNum = session.totalPulls;
    for (const batch of next.history) {
      for (const r of batch) {
        pullNum++;
        if (r.rarity === 3 && next.pullsToFirst3Star === null) {
          next.pullsToFirst3Star = pullNum;
        }
      }
    }
  }

  if (next.pullsToFocus === null && next.counts.star3Focus > 0) {
    let pullNum = 0;
    for (const batch of next.history) {
      for (const r of batch) {
        pullNum++;
        if (r.isFocus && next.pullsToFocus === null) {
          next.pullsToFocus = pullNum;
        }
      }
    }
  }

  return { results, session: next };
}

export function redeemMileage(session: GachaSession): GachaSession | null {
  const config = BANNER_CONFIGS[session.bannerType];
  if (session.mileage < config.mileageCap) return null;

  return {
    ...session,
    mileage: session.mileage - config.mileageCap,
    counts: {
      ...session.counts,
      star3: session.counts.star3 + 1,
      star3Focus: session.counts.star3Focus + 1,
    },
  };
}

export function canUseMileage(session: GachaSession): boolean {
  const config = BANNER_CONFIGS[session.bannerType];
  return session.mileage >= config.mileageCap;
}
