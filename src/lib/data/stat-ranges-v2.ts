import { join } from 'path';
import { readJson } from './_json';

const FILE = join(process.cwd(), 'data/equipment/stat-ranges-v2.json');

// ── Public types ──

/**
 * One base variant for a (slot, stat, rarity, star) tuple. Most tuples have a single
 * entry, but some have 2 (e.g. weapon U 5★ ATK has bases 140 and 150). Each entry
 * carries the itemIDs that share the same base.
 */
export type StatEntry = {
  base: number;
  itemIds: string[];
  /** "0".."maxEnhanceLevel" → [T0, T1, T2, T3, T4] */
  levels: Record<string, number[]>;
  /** Only present for items eligible to Singularity (+15). "10".."15" → [T0..T4] */
  ascended?: Record<string, number[]>;
};

export type StatRangesConstants = {
  enhanceFactor: number;
  tierFactor: number;
  maxEnhanceLevel: number;
  maxTier: number;
  singularity: {
    activation: number;
    steps: number[];
    minRarity: string;
    minStar: number;
    slots: string[];
  };
};

type StatRangesV2 = {
  constants: StatRangesConstants;
  ranges: Record<string, Record<string, Record<string, Record<string, StatEntry[]>>>>;
};

export type ArmorPiece = 'Helmet' | 'Armor' | 'Gloves' | 'Shoes';

// ── Cache + index ──

type Cache = {
  data: StatRangesV2;
  /** itemId → stat → entry (one item can carry multiple stats e.g. weapons have ATK + secondary) */
  byItemId: Map<string, Map<string, StatEntry>>;
};

let cache: Cache | null = null;

async function load(): Promise<Cache> {
  if (cache) return cache;
  const data = await readJson<StatRangesV2>(FILE);
  const byItemId = new Map<string, Map<string, StatEntry>>();
  for (const stats of Object.values(data.ranges)) {
    for (const [stat, byRarity] of Object.entries(stats)) {
      for (const byStar of Object.values(byRarity)) {
        for (const entries of Object.values(byStar)) {
          for (const entry of entries) {
            for (const itemId of entry.itemIds) {
              let inner = byItemId.get(itemId);
              if (!inner) {
                inner = new Map();
                byItemId.set(itemId, inner);
              }
              inner.set(stat, entry);
            }
          }
        }
      }
    }
  }
  cache = { data, byItemId };
  return cache;
}

// ── Public API ──

/**
 * Returns all stats carried by an item as `[base, +maxLv T_maxTier]` tuples.
 *
 * This is the migration shim that mirrors the legacy `getWeaponStatRanges` /
 * `getAccessoryStatRanges` shape, so existing UI components can keep their
 * `[number, number]` rendering path. New components should prefer
 * `getItemStatTable()` which returns the full progression.
 */
export async function getItemStatRanges(itemId: string): Promise<Record<string, [number, number]>> {
  const { data, byItemId } = await load();
  const stats = byItemId.get(itemId);
  if (!stats) return {};
  const maxLv = String(data.constants.maxEnhanceLevel);
  const maxT = data.constants.maxTier;
  const out: Record<string, [number, number]> = {};
  for (const [stat, entry] of stats) {
    out[stat] = [entry.base, entry.levels[maxLv][maxT]];
  }
  return out;
}

/**
 * Look up a single stat value at any (lv, tier) for an item.
 * Returns null when the item or stat is unknown, or the requested lv/tier is out of range.
 */
export async function getItemStat(
  itemId: string,
  stat: string,
  lv: number,
  tier: number,
  ascended = false,
): Promise<number | null> {
  const { byItemId } = await load();
  const entry = byItemId.get(itemId)?.get(stat);
  if (!entry) return null;
  const table = ascended ? entry.ascended : entry.levels;
  const row = table?.[String(lv)];
  return row?.[tier] ?? null;
}

/**
 * Returns the full progression table for an item's stat (every level × tier).
 * Use this for the +15 progression display and any analytical view.
 */
export async function getItemStatTable(itemId: string, stat: string): Promise<StatEntry | null> {
  const { byItemId } = await load();
  return byItemId.get(itemId)?.get(stat) ?? null;
}

/**
 * For armor sets — the only category without itemIDs in `sets.json`. Returns the
 * **canonical** legendary 6★ entry per stat (the one with the most itemIDs, which
 * is the widely-dropped item; the rare variants like Armor DEF base 90 are
 * skipped here since the site only displays the dominant range).
 */
export async function getArmorPieceStatRanges(piece: ArmorPiece): Promise<Record<string, [number, number]>> {
  const { data } = await load();
  const slot = data.ranges[piece];
  if (!slot) return {};
  const maxLv = String(data.constants.maxEnhanceLevel);
  const maxT = data.constants.maxTier;
  const out: Record<string, [number, number]> = {};
  for (const [stat, byRarity] of Object.entries(slot)) {
    const entries = byRarity['legendary']?.['6'];
    if (!entries || entries.length === 0) continue;
    // Pick the entry with the most itemIDs; ties broken by highest base.
    const canonical = entries.reduce((a, b) => {
      if (a.itemIds.length !== b.itemIds.length) return a.itemIds.length > b.itemIds.length ? a : b;
      return a.base >= b.base ? a : b;
    });
    out[stat] = [canonical.base, canonical.levels[maxLv][maxT]];
  }
  return out;
}

/** Same as `getArmorPieceStatRanges` but for all four pieces in one shot. */
export async function getArmorSetStatRanges(): Promise<Record<ArmorPiece, Record<string, [number, number]>>> {
  const pieces: ArmorPiece[] = ['Helmet', 'Armor', 'Gloves', 'Shoes'];
  const out = {} as Record<ArmorPiece, Record<string, [number, number]>>;
  await Promise.all(pieces.map(async p => { out[p] = await getArmorPieceStatRanges(p); }));
  return out;
}

/**
 * Returns `{ stat → +15 T_maxTier max }` for an item, or null if the item
 * cannot ascend (not a legendary 6★ in an eligible slot).
 *
 * Pairs with `getItemStatRanges` to render the standard +10T4 vs ascended +15T4
 * comparison on the equipment detail page.
 */
export async function getItemAscendedRanges(itemId: string): Promise<Record<string, number> | null> {
  const { data, byItemId } = await load();
  const stats = byItemId.get(itemId);
  if (!stats) return null;
  const maxT = data.constants.maxTier;
  const ascendedMaxLv = String(data.constants.maxEnhanceLevel + data.constants.singularity.steps.length);
  const out: Record<string, number> = {};
  for (const [stat, entry] of stats) {
    const ascended = entry.ascended?.[ascendedMaxLv]?.[maxT];
    if (ascended !== undefined) out[stat] = ascended;
  }
  return Object.keys(out).length > 0 ? out : null;
}

/**
 * Canonical ascended ranges per armor piece (legendary 6★, dominant base variant).
 * Mirrors `getArmorPieceStatRanges` for the +15 T_maxTier max.
 */
export async function getArmorPieceAscendedRanges(piece: ArmorPiece): Promise<Record<string, number>> {
  const { data } = await load();
  const slot = data.ranges[piece];
  if (!slot) return {};
  const maxT = data.constants.maxTier;
  const ascendedMaxLv = String(data.constants.maxEnhanceLevel + data.constants.singularity.steps.length);
  const out: Record<string, number> = {};
  for (const [stat, byRarity] of Object.entries(slot)) {
    const entries = byRarity['legendary']?.['6'];
    if (!entries || entries.length === 0) continue;
    const canonical = entries.reduce((a, b) => {
      if (a.itemIds.length !== b.itemIds.length) return a.itemIds.length > b.itemIds.length ? a : b;
      return a.base >= b.base ? a : b;
    });
    const ascended = canonical.ascended?.[ascendedMaxLv]?.[maxT];
    if (ascended !== undefined) out[stat] = ascended;
  }
  return out;
}

/** Ascended ranges for all four armor pieces in one shot. */
export async function getArmorSetAscendedRanges(): Promise<Record<ArmorPiece, Record<string, number>>> {
  const pieces: ArmorPiece[] = ['Helmet', 'Armor', 'Gloves', 'Shoes'];
  const out = {} as Record<ArmorPiece, Record<string, number>>;
  await Promise.all(pieces.map(async p => { out[p] = await getArmorPieceAscendedRanges(p); }));
  return out;
}

/** Expose the formula constants (for ad-hoc tooltips, sub-section B.4 captions, etc.). */
export async function getStatRangeConstants(): Promise<StatRangesConstants> {
  return (await load()).data.constants;
}
