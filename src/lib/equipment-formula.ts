// Client-safe progression math for the interactive equipment configurator.
// Mirrors the formulas documented in data/equipment/item-stats-detail.json.
// NO fs / JSON access here — the data layer (src/lib/data/item-stats-detail.ts)
// loads the file and hands a serializable bundle to the UI; this module is the
// pure compute the UI applies live.

import type { LangMap } from '@/types/common';
import type { Lang } from '@/lib/i18n/config';

export type LiveConstants = {
  enhanceFactor: number;   // +40% of base per enhancement level
  tierFactor: number;      // +5% per breakthrough tier
  maxEnhanceLevel: number; // standard enhancement cap (10)
  maxTier: number;         // breakthrough T0..T4
  singularity: { activation: number; steps: number[]; reforgeBonus: number };
  reforge: { maxSubStats: number };
};

export type LiveMeta = {
  constants: LiveConstants;
  percentStats: string[];                 // drives display rounding (floor to 0.1)
  statPercent: Record<string, boolean>;   // drives the "%" suffix (EFF/RES are true here)
};

export type LiveMainSlot =
  | { type: 'fixed'; key: string; base: number }
  | { type: 'choice'; options: { key: string; base: number; levels?: number[] }[] };

export type LiveSubOpt = { key: string; step: number; max: number; maxSegments: number };
// Passive: per-language template (`desc`) with native tokens + per-tier token→value tables.
export type LivePassive = { name: LangMap; desc: LangMap; valuesByTier: Record<string, string>[] } | null;
export type LiveArmorPiece = { slot: string; mainStats: LiveMainSlot[]; subPool: LiveSubOpt[]; excludedSubStats: string[] };
export type LiveSetEffectBlock = { base: LangMap; bt4: LangMap };
export type LiveSetPassive = { twoPc: LiveSetEffectBlock; fourPc: LiveSetEffectBlock } | null;

export type ItemLiveDetail = {
  kind: 'weapon' | 'accessory' | 'talisman' | 'armor';
  star: number;
  canAscend: boolean;
  scalesVia?: 'enhanceLevels';
  mainStats?: LiveMainSlot[];        // weapon / accessory / talisman
  subPool?: LiveSubOpt[];            // weapon / accessory (full pool, before exclusions)
  excludedSubStats?: string[];
  passive?: LivePassive;             // weapon / accessory
  pieces?: LiveArmorPiece[];         // armor (one entry per slot)
  setPassive?: LiveSetPassive;       // armor
};

export type ItemLiveBundle = { meta: LiveMeta; item: ItemLiveDetail };

/** Build a bound formula helper from the meta (constants + rounding tables). */
export function makeFormula(meta: LiveMeta) {
  const C = meta.constants;
  const pct = new Set(meta.percentStats);
  const floorDisplay = (v: number, key: string) =>
    pct.has(key) ? Math.floor(v * 10 + 1e-9) / 10 : Math.floor(v + 1e-9);

  // Main stat — standard enhancement (lv 0..10) × breakthrough (tier 0..4).
  const mainStat = (base: number, key: string, lv: number, tier: number) =>
    floorDisplay(base * (1 + C.enhanceFactor * lv) * (1 + C.tierFactor * tier), key);

  // Main stat — Singularity ascension (lv 11..15), only when canAscend.
  const mainStatAscended = (base: number, key: string, lv: number, tier: number) => {
    const s = C.singularity;
    const mult = 1 + C.enhanceFactor * C.maxEnhanceLevel + s.activation
      + s.steps.slice(0, lv - C.maxEnhanceLevel).reduce((a, b) => a + b, 0);
    return floorDisplay(base * mult * (1 + C.tierFactor * tier), key);
  };

  // Dispatch standard vs ascended by level. Ascension activates AT +10 (does not
  // consume a level): an ascended gear at +10 uses ascended[10] (5.15), not 5.00.
  const mainAt = (base: number, key: string, lv: number, tier: number, canAscend: boolean) =>
    canAscend && lv >= C.maxEnhanceLevel
      ? mainStatAscended(base, key, lv, tier)
      : mainStat(base, key, Math.min(lv, C.maxEnhanceLevel), tier);

  // Talisman — no breakthrough, direct lookup (lv 0..10).
  const talismanStat = (levels: number[], lv: number) => levels[Math.min(lv, levels.length - 1)] ?? levels[levels.length - 1];

  // Substat value at n segments (step is a single segment).
  const subValue = (step: number, segments: number, key: string) => floorDisplay(step * segments, key);

  const isPercent = (key: string) => meta.statPercent[key] ?? pct.has(key);

  return { C, floorDisplay, mainStat, mainStatAscended, mainAt, talismanStat, subValue, isPercent };
}

/** Resolve a passive: pick the language template, substitute per-tier token values. */
export function renderPassive(
  p: { desc: LangMap; valuesByTier: Record<string, string>[] },
  lang: Lang,
  tier: number,
  color = true,
): string {
  let text = p.desc[lang] ?? p.desc.en ?? '';
  const vals = p.valuesByTier[Math.min(Math.max(tier, 0), p.valuesByTier.length - 1)] ?? {};
  for (const [token, value] of Object.entries(vals)) {
    const v = color ? `<color=#28d9ed>${value}</color>` : value;
    text = text.split(token).join(v);
  }
  return text;
}

/** Resolve a set effect block: `base` for T0..T3, `bt4` from breakthrough 4. */
export function renderSetEffect(blk: LiveSetEffectBlock, lang: Lang, tier: number): string {
  const m = tier >= 4 ? blk.bt4 : blk.base;
  return m[lang] ?? m.en ?? '';
}

/** Round-robin segment fill: each reforge adds one segment to the next substat slot. */
export function segmentsForReforge(reforge: number, subCount: number, maxSegments: number): number[] {
  const segs = new Array(Math.max(0, subCount)).fill(0);
  if (subCount <= 0) return segs;
  let placed = 0;
  let guard = 0;
  while (placed < reforge && guard < reforge * subCount + subCount) {
    const i = guard % subCount;
    if (segs[i] < maxSegments) { segs[i]++; placed++; }
    guard++;
  }
  return segs;
}
