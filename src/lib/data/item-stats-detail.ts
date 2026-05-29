import { join } from 'path';
import { readJson } from './_json';
import type { EquipmentLookup } from './equipment';
import type {
  ItemLiveBundle, LiveMeta, LiveConstants, ItemLiveDetail, LiveMainSlot, LiveSubOpt, LiveArmorPiece, LivePassive,
} from '@/lib/equipment-formula';
import type { LangMap } from '@/types/common';

const EQUIP_DIR = join(process.cwd(), 'data/equipment');

// ── raw JSON shape (item-stats-detail.json) ──
type RawMainSlot =
  | { type: 'fixed'; stat: { key: string; base: number } }
  | { type: 'choice'; options: { key: string; base: number; levels?: number[] }[] };
type RawSubPool = { maxSegmentsPerStat: number | null; pool: { key: string; step: number; max: number }[] };
type RawItem = {
  name: string; slot: string; rarity: string; star: number; canAscend: boolean;
  scalesVia?: string;
  mainStats: RawMainSlot[];
  subStatGroupId?: string;
  excludedSubStats?: string[];
  passive?: { name: LangMap; desc: LangMap; valuesByTier: Record<string, string>[] } | null;
  setId?: string; setName?: string;
};
type RawSetBlock = { base: LangMap; bt4: LangMap };
type RawSet = { name: LangMap; rarity: string; '2pc': RawSetBlock; '4pc': RawSetBlock };
type RawDetail = {
  constants: LiveConstants;
  formula: { percentStats: string[] };
  statMeta: Record<string, { percent: boolean }>;
  subStatPools: Record<string, RawSubPool>;
  sets: Record<string, RawSet>;
  items: {
    weapons: Record<string, RawItem>;
    accessories: Record<string, RawItem>;
    talismans: Record<string, RawItem>;
    armor: Record<string, RawItem>;
  };
};

let cache: RawDetail | null = null;
async function load(): Promise<RawDetail> {
  if (!cache) cache = await readJson(join(EQUIP_DIR, 'item-stats-detail.json')) as RawDetail;
  return cache;
}

function buildMeta(d: RawDetail): LiveMeta {
  const statPercent: Record<string, boolean> = {};
  for (const [k, v] of Object.entries(d.statMeta)) statPercent[k] = v.percent;
  return { constants: d.constants, percentStats: d.formula.percentStats, statPercent };
}

function mapMain(m: RawMainSlot): LiveMainSlot {
  return m.type === 'fixed'
    ? { type: 'fixed', key: m.stat.key, base: m.stat.base }
    : { type: 'choice', options: m.options };
}

function resolvePool(d: RawDetail, id?: string): LiveSubOpt[] {
  const p = id ? d.subStatPools[id] : undefined;
  if (!p || !p.pool || p.pool.length === 0) return [];
  const seg = p.maxSegmentsPerStat ?? 6;
  return p.pool.map((o) => ({ key: o.key, step: o.step, max: o.max, maxSegments: seg }));
}

const ARMOR_SLOTS = ['Helmet', 'Armor', 'Gloves', 'Shoes'] as const;

/**
 * Resolve the live progression detail for an equipment item (NOT EE — the
 * datamine source excludes Exclusive Equipment). Returns a serializable bundle
 * (meta + resolved item) safe to pass to a client component.
 */
export async function getItemLiveDetail(equipment: EquipmentLookup): Promise<ItemLiveBundle | null> {
  if (equipment.type === 'ee') return null;
  const d = await load();
  const meta = buildMeta(d);
  const id = (equipment.data as { id?: string }).id;

  if (equipment.type === 'weapon' || equipment.type === 'amulet') {
    const cat = equipment.type === 'weapon' ? 'weapons' : 'accessories';
    const raw = id ? d.items[cat][id] : undefined;
    if (!raw) return null;
    const item: ItemLiveDetail = {
      kind: equipment.type === 'weapon' ? 'weapon' : 'accessory',
      star: raw.star,
      canAscend: raw.canAscend,
      mainStats: raw.mainStats.map(mapMain),
      subPool: resolvePool(d, raw.subStatGroupId),
      excludedSubStats: raw.excludedSubStats ?? [],
      passive: (raw.passive ?? null) as LivePassive,
    };
    return { meta, item };
  }

  if (equipment.type === 'talisman') {
    const raw = id ? d.items.talismans[id] : undefined;
    if (!raw) return null;
    const item: ItemLiveDetail = {
      kind: 'talisman',
      star: raw.star,
      canAscend: false,
      scalesVia: 'enhanceLevels',
      mainStats: raw.mainStats.map(mapMain),
      subPool: [],
      excludedSubStats: [],
      passive: null,
    };
    return { meta, item };
  }

  // set → resolve its four armor pieces (legendary 6★ variant) via setId
  const setId = id;
  if (!setId) return null;
  const armorEntries = Object.values(d.items.armor).filter((a) => a.setId === setId);
  const pieces: LiveArmorPiece[] = [];
  for (const slot of ARMOR_SLOTS) {
    const entry = armorEntries.find((a) => a.slot === slot && a.rarity === 'legendary' && a.star === 6)
      ?? armorEntries.find((a) => a.slot === slot);
    if (!entry) continue;
    pieces.push({
      slot,
      mainStats: entry.mainStats.map(mapMain),
      subPool: resolvePool(d, entry.subStatGroupId),
      excludedSubStats: entry.excludedSubStats ?? [],
    });
  }
  const setRaw = d.sets[setId];
  const item: ItemLiveDetail = {
    kind: 'armor',
    star: 6,
    canAscend: armorEntries.some((a) => a.canAscend),
    pieces,
    setPassive: setRaw ? { twoPc: setRaw['2pc'], fourPc: setRaw['4pc'] } : null,
  };
  return { meta, item };
}
