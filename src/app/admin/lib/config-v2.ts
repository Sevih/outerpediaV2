/**
 * Admin-specific configuration — character extractor v2
 *
 * Clean base: no hardcoded exceptions, no blacklists, no force overrides.
 * Adapted for json2 format (flat arrays, clean field names).
 */

export {
  LANGS, DEFAULT_LANG, SUFFIX_LANGS, type Lang,
  LANG_TO_COLUMN, type LangTexts,
  readTemplet,
  buildTextMap, expandLang,
  resolveEnum, resolveElement, resolveClass, resolveSubClass,
  buildBuffIndex, resolveBuffPlaceholders,
} from './text-v2';

// ── Buff/Debuff extraction ──────────────────────────────────────────

type BuffRow = Record<string, string>;

/**
 * Extract buff and debuff tags from BuffTemplet entries.
 * Clean classification based on BuffDebuffType field only.
 * Tag format: "Type|StatType" for BT_STAT, else just "Type".
 */
export function extractBuffDebuff(
  buffGroupIds: string[],
  buffData: BuffRow[],
): { buff: string[]; debuff: string[] } {
  const buffs = new Set<string>();
  const debuffs = new Set<string>();

  for (const groupId of buffGroupIds) {
    for (const row of buffData) {
      if (row.BuffID !== groupId) continue;

      const type = row.Type ?? '';
      const statType = row.StatType ?? '';
      const bdType = row.BuffDebuffType ?? '';

      if (!type) continue;

      const tag = type === 'BT_STAT' && statType && statType !== 'ST_NONE'
        ? `${type}|${statType}`
        : type;

      if (bdType === 'BUFF') {
        buffs.add(tag);
      } else if (bdType.startsWith('DEBUFF')) {
        debuffs.add(tag);
      }

      break;
    }
  }

  return { buff: [...buffs], debuff: [...debuffs] };
}

/** Collect buff group IDs from skill level rows (BuffID field) */
export function collectBuffGroupIds(skillLevelRows: BuffRow | BuffRow[]): string[] {
  const rows = Array.isArray(skillLevelRows) ? skillLevelRows : [skillLevelRows];
  const ids = new Set<string>();
  for (const row of rows) {
    const buffId = row.BuffID ?? '';
    if (!buffId) continue;
    for (const part of buffId.split(',')) {
      const trimmed = part.trim();
      if (trimmed) ids.add(trimmed);
    }
  }
  return [...ids];
}

/** Collect buff IDs from fusion passive skill level entries */
export function collectFusionPassiveBuffIds(skillLevelRows: BuffRow[], buffData: BuffRow[]): string[] {
  const knownBuffIds = new Set(buffData.map(r => r.BuffID).filter(Boolean));
  const ids = new Set<string>();
  for (const row of skillLevelRows) {
    const buffId = row.BuffID ?? '';
    if (!buffId) continue;
    for (const part of buffId.split(',')) {
      const trimmed = part.trim();
      if (trimmed && knownBuffIds.has(trimmed)) ids.add(trimmed);
    }
  }
  return [...ids];
}

/** Collect buff group IDs from BuffTemplet by naming convention */
export function collectBuffGroupIdsByPattern(charId: string, pattern: string, buffData: BuffRow[]): string[] {
  const prefix = `${charId}_${pattern}_`;
  const ids = new Set<string>();
  for (const row of buffData) {
    const bid = row.BuffID ?? '';
    if (bid.startsWith(prefix)) ids.add(bid);
  }
  return [...ids];
}

// ── Skill target mapping ─────────────────────────────────────────────

const TARGET_MAP: Record<string, string | null> = {
  SINGLE: 'mono',
  ALL: 'multi',
  DOUBLE: 'duo',
  DOUBLE_SPEED: 'duo',
  NONE: null,
};

export function resolveTarget(rangeType: string): string | string[] | null {
  const parts = rangeType.split(',').map(p => p.trim()).filter(Boolean);
  if (parts.length === 0) return null;
  const mapped = parts.map(p => p in TARGET_MAP ? TARGET_MAP[p] : p).filter((v): v is string => v != null);
  if (mapped.length === 0) return null;
  const unique = [...new Set(mapped)];
  return unique.length === 1 ? unique[0] : unique;
}

// ── Gift mapping ─────────────────────────────────────────────────────

export const GIFT_MAP: Record<string, string> = {
  ITS_PRESENT_01: 'Science',
  ITS_PRESENT_02: 'Luxury',
  ITS_PRESENT_03: 'Magic Tool',
  ITS_PRESENT_04: 'Craftwork',
  ITS_PRESENT_05: 'Natural Object',
};

// ── Chain type extraction ────────────────────────────────────────────

export function resolveChainType(chainDesc: string, chainIconName: string): string {
  if (chainDesc.includes('Chain Starter Effect')) return 'Start';
  if (chainDesc.includes('Chain Companion Effect')) return 'Join';
  if (chainDesc.includes('Chain Finish Effect')) return 'Finish';
  const parts = chainIconName.split('_');
  const last = parts[parts.length - 1];
  if (last === 'Start' || last === 'Join' || last === 'Finish') return last;
  return 'Join';
}

// ── Auto-detect tags (adapted for json2 RecruitGroupTemplet) ─────────

type RecruitRow = Record<string, string>;
type ExtraRow = Record<string, string>;

export function detectTags(
  charId: string,
  recruitData: RecruitRow[],
  extraData: ExtraRow[],
): string[] {
  const tags: string[] = [];

  const banner = recruitData.find(r => r.PickupID === charId);

  if (banner) {
    const type = banner.RecruitType ?? '';
    if (type === 'DEMIURGE') {
      tags.push('premium');
    } else if (type === 'OUTER_FES') {
      tags.push('limited');
    } else if (type === 'SEASONAL') {
      if (banner.BannerImageName?.includes('Collabo')) {
        tags.push('collab');
      } else {
        tags.push('seasonal');
      }
    }
  } else {
    const extra = extraData.find(r => r.CharacterID === charId);
    if (extra) {
      const thumb = extra.ThumbnailEffect ?? '';
      if (thumb === 'FX_UI_Character_List_Dungeon') {
        tags.push('collab');
      }
    }
  }

  if (charId.startsWith('2700')) tags.push('core-fusion');

  return tags;
}

const TAG_ORDER = ['premium', 'seasonal', 'limited', 'collab', 'ignore-defense', 'free', 'core-fusion'];
export function sortTags(tags: string[]): string[] {
  return [...tags].sort((a, b) => {
    const ia = TAG_ORDER.indexOf(a);
    const ib = TAG_ORDER.indexOf(b);
    return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
  });
}
