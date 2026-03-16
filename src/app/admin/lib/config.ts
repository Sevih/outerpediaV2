/**
 * Admin-specific configuration
 *
 * Centralizes mappings and helpers used by the admin extractor / tools.
 */

import { LANGS, DEFAULT_LANG, SUFFIX_LANGS, type Lang } from '@/lib/i18n/config';

// ── Text column mapping ──────────────────────────────────────────────

/** Maps our Lang keys to the column names found in Text*.json templet files */
export const LANG_TO_COLUMN: Record<Lang, string> = {
  en: 'English',
  jp: 'Japanese',
  kr: 'Korean',
  zh: 'China_Simplified',
};

// ── LangTexts helpers ────────────────────────────────────────────────

export type LangTexts = Record<Lang, string>;

/** Build a lookup map from a Text*.json data array: IDSymbol → LangTexts */
export function buildTextMap(data: Record<string, string>[]): Record<string, LangTexts> {
  const map: Record<string, LangTexts> = {};
  for (const row of data) {
    const key = row.IDSymbol;
    if (!key) continue;
    const texts = {} as LangTexts;
    for (const lang of LANGS) {
      texts[lang] = row[LANG_TO_COLUMN[lang]] ?? '';
    }
    map[key] = texts;
  }
  return map;
}

/**
 * Expand a LangTexts into suffixed output fields.
 *
 * expandLang('Fullname', { en: 'K', jp: 'ケイ', kr: '케이', zh: '凯伊' })
 * → { Fullname: 'K', Fullname_jp: 'ケイ', Fullname_kr: '케이', Fullname_zh: '凯伊' }
 */
export function expandLang(fieldName: string, texts: LangTexts | undefined, fallback = ''): Record<string, string> {
  const result: Record<string, string> = {};
  result[fieldName] = texts?.[DEFAULT_LANG] ?? fallback;
  for (const lang of SUFFIX_LANGS) {
    result[`${fieldName}_${lang}`] = texts?.[lang] ?? fallback;
  }
  return result;
}

// ── Enum resolution ──────────────────────────────────────────────────

/**
 * Resolve a game enum to its display name via TextSystem.
 *
 *   resolveEnum(textSys, 'CET_FIRE', 'CET_', 'SYS_ELEMENT_') → 'Fire'
 *   resolveEnum(textSys, 'CCT_PRIEST', 'CCT_', 'SYS_CLASS_')  → 'Healer'
 */
export function resolveEnum(textSys: Record<string, LangTexts>, raw: string, prefix: string, sysPrefix: string): string {
  const stripped = raw.startsWith(prefix) ? raw.slice(prefix.length) : raw;
  if (!stripped || stripped === 'NONE') return '';
  return textSys[`${sysPrefix}${stripped}`]?.[DEFAULT_LANG] ?? stripped;
}

export function resolveElement(textSys: Record<string, LangTexts>, raw: string): string {
  return resolveEnum(textSys, raw, 'CET_', 'SYS_ELEMENT_');
}

export function resolveClass(textSys: Record<string, LangTexts>, raw: string): string {
  return resolveEnum(textSys, raw, 'CCT_', 'SYS_CLASS_');
}

export function resolveSubClass(textSys: Record<string, LangTexts>, raw: string): string {
  return resolveEnum(textSys, raw, '', 'SYS_CLASS_NAME_');
}

// ── Buff placeholder resolution ──────────────────────────────────────

type BuffRow = Record<string, string>;

/**
 * Index BuffTemplet data by BuffID → level → row.
 * Levels in the game data are sparse (typically 1, 3, 5).
 */
export function buildBuffIndex(data: BuffRow[]): Map<string, Map<number, BuffRow>> {
  const index = new Map<string, Map<number, BuffRow>>();
  for (const row of data) {
    const buffId = row.BuffID;
    if (!buffId) continue;
    const level = parseInt(row.Level) || 1;
    let levels = index.get(buffId);
    if (!levels) {
      levels = new Map();
      index.set(buffId, levels);
    }
    // Keep the first entry per level (some buffs have multiple entries per level)
    if (!levels.has(level)) {
      levels.set(level, row);
    }
  }
  return index;
}

/**
 * Get buff value at a given skill level, falling back to the closest lower level.
 * Game data typically has levels 1, 3, 5 — levels 2/4 inherit from 1/3.
 */
function getBuffAtLevel(levels: Map<number, BuffRow> | undefined, skillLevel: number): BuffRow | undefined {
  if (!levels) return undefined;
  // Try exact match, then walk down
  for (let lv = skillLevel; lv >= 1; lv--) {
    const row = levels.get(lv);
    if (row) return row;
  }
  return undefined;
}

/**
 * Format a buff field value for display.
 * - CreateRate: always /10 with % (300 → "30%")
 * - Value: depends on ApplyingType — OAT_RATE means /10 with %, otherwise abs value
 * - TurnDuration: as-is
 */
function formatBuffValue(type: string, raw: string | undefined, applyingType?: string): string {
  if (!raw) return '';
  const num = parseInt(raw);
  if (isNaN(num)) return raw;
  switch (type) {
    case 'c': // CreateRate: stored as 300 → display "30%"
      return `${num / 10}%`;
    case 'v': // Value: OAT_RATE → percentage (/10 + %), otherwise absolute
      if (applyingType === 'OAT_RATE') return `${Math.abs(num) / 10}%`;
      return String(Math.abs(num));
    case 't': // TurnDuration: as-is if numeric
      return String(num);
    default:
      return raw;
  }
}

// Matches [Buff_C_someId], [Buff_V_someId], [Buff_T_someId] (case insensitive)
const BUFF_PLACEHOLDER_RE = /\[(?:buff|Buff)_(c|v|t)_([^\]]+)\]/gi;

/**
 * Resolve all buff placeholders in a skill description for a given skill level.
 *
 * "[Buff_C_2000001_1_1]" at level 3 → "40%" (from BuffTemplet CreateRate)
 * "[Buff_V_2000003_1_2]" with OAT_RATE → "10%" (from BuffTemplet Value / 10)
 */
export function resolveBuffPlaceholders(
  text: string,
  skillLevel: number,
  buffIndex: Map<string, Map<number, BuffRow>>,
): string {
  return text.replace(BUFF_PLACEHOLDER_RE, (_match, type: string, buffId: string) => {
    const levels = buffIndex.get(buffId);
    const row = getBuffAtLevel(levels, skillLevel);
    if (!row) return _match; // keep placeholder if not found

    const t = type.toLowerCase();
    switch (t) {
      case 'c': return formatBuffValue('c', row.CreateRate);
      case 'v': return formatBuffValue('v', row.Value, row.ApplyingType);
      case 't': return formatBuffValue('t', row.TurnDuration);
      default: return _match;
    }
  });
}

// ── Buff/Debuff extraction ────────────────────────────────────────────

// Buff types to rename (game name → display name)
const BUFF_TYPE_RENAME: Record<string, string> = {
};

// Force classification override: types the game marks wrong (e.g. NEUTRAL that should be DEBUFF)
const BUFF_TYPE_FORCE: Record<string, 'buff' | 'debuff'> = {
  'BT_WG_REVERSE_HEAL': 'debuff',
};

// Buff types to exclude from extraction
const BUFF_TYPE_BLACKLIST = new Set([
  'BT_DMG',
  'BT_DMG_TO_BOSS',
  'BT_DMG_ENEMY_TEAM_DECREASE',
  'BT_RESOURCE_USE_SKILL',
  'BT_RESOURCE_CHARGE',
  'BT_SKILL_RANGE_ALL',
  'BT_STAT_PREMIUM',
]);

/**
 * Extract buff and debuff tags from BuffTemplet entries for given buff group IDs.
 *
 * Format: "Type|StatType" for BT_STAT types, else just "Type"
 * Classification: BUFF → buff array, DEBUFF* → debuff array, NEUTRAL* → ignored
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

      if (!type || BUFF_TYPE_BLACKLIST.has(type)
        || type.startsWith('BT_DMG_OWNER_STAT')
        || type.startsWith('BT_DMG_TARGET_STAT')
      ) continue;

      // BT_HEAL_BASED_TARGET: TurnDuration > 1 → BT_CONTINU_HEAL, otherwise skip
      if (type === 'BT_HEAL_BASED_TARGET') {
        const turn = parseInt(row.TurnDuration);
        if (!isNaN(turn) && turn > 1) {
          buffs.add('BT_CONTINU_HEAL');
        }
        break;
      }

      // BT_STAT with TurnDuration -1 = permanent stacking mechanic, not a real buff
      if (type === 'BT_STAT' && row.TurnDuration === '-1') break;

      // Only include StatType for BT_STAT (where it identifies the buffed stat)
      // For other types, StatType is a scaling parameter
      const rawTag = type === 'BT_STAT' && statType && statType !== 'ST_NONE'
        ? `${type}|${statType}`
        : type;
      const tag = BUFF_TYPE_RENAME[rawTag] ?? rawTag;

      // Check forced classification first, then game data
      const forced = BUFF_TYPE_FORCE[type];
      if (forced === 'buff' || (!forced && bdType === 'BUFF')) {
        buffs.add(tag);
      } else if (forced === 'debuff' || (!forced && bdType.startsWith('DEBUFF'))) {
        debuffs.add(tag);
      }
      // NEUTRAL/NEUTRAL2 without force override are ignored

      break; // Only need one entry per BuffID to get the Type
    }
  }

  return { buff: [...buffs], debuff: [...debuffs] };
}

/**
 * Collect all buff group IDs referenced by skill level entries.
 * Accepts a single row or an array of rows (all levels).
 * Searches all fields due to bytes parser column shifts.
 */
export function collectBuffGroupIds(skillLevelRows: BuffRow | BuffRow[]): string[] {
  const rows = Array.isArray(skillLevelRows) ? skillLevelRows : [skillLevelRows];
  const ids = new Set<string>();
  for (const row of rows) {
    for (const [, val] of Object.entries(row)) {
      if (!val || typeof val !== 'string') continue;
      for (const part of val.split(',')) {
        const trimmed = part.trim();
        // Buff group IDs look like "2000001_1_1" — charId_skillNum_buffNum
        if (/^\d{7}_/.test(trimmed)) {
          ids.add(trimmed);
        }
      }
    }
  }
  return [...ids];
}

/**
 * Collect buff group IDs from BuffTemplet by naming convention.
 * Used for chain passive ({charId}_chain_*) and backup ({charId}_backup_*).
 */
export function collectBuffGroupIdsByPattern(charId: string, pattern: string, buffData: BuffRow[]): string[] {
  const prefix = `${charId}_${pattern}_`;
  const ids = new Set<string>();
  for (const row of buffData) {
    const bid = row.BuffID ?? '';
    if (bid.startsWith(prefix) && !bid.endsWith('_old')) {
      ids.add(bid);
    }
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

export function resolveTarget(rangeType: string): string | null {
  const parts = rangeType.split(',').map(p => p.trim()).filter(Boolean);
  if (parts.length === 0) return null;
  const mapped = parts.map(p => p in TARGET_MAP ? TARGET_MAP[p] : p).filter((v): v is string => v != null);
  if (mapped.length === 0) return null;
  // Deduplicate (e.g. "SINGLE,SINGLE" → "mono")
  const unique = [...new Set(mapped)];
  return unique.join(',');
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

/**
 * Determine chain type from the chain passive skill description and icon.
 *
 * Priority:
 * 1. Description contains "Chain Starter Effect" → Start
 * 2. Description contains "Chain Companion Effect" → Join
 * 3. Description contains "Chain Finish Effect" → Finish
 * 4. IconName ends with _Start/_Join/_Finish → use that
 * 5. Fallback → Join
 */
export function resolveChainType(chainDesc: string, chainIconName: string): string {
  if (chainDesc.includes('Chain Starter Effect')) return 'Start';
  if (chainDesc.includes('Chain Companion Effect')) return 'Join';
  if (chainDesc.includes('Chain Finish Effect')) return 'Finish';
  const parts = chainIconName.split('_');
  const last = parts[parts.length - 1];
  if (last === 'Start' || last === 'Join' || last === 'Finish') return last;
  return 'Join';
}

// ── Data fixes ───────────────────────────────────────────────────────

/** Workaround: game data has BasicStar stored in wrong column for some characters */
export const BASIC_STAR_OVERRIDE: Record<string, number> = {
  '2000020': 3,
};

/**
 * Skills flagged ENEMY in game data but actually non-offensive (debuff/purge/passive).
 * Key: "charId:skillSlot" (e.g. "2000013:Skill_2")
 */
export const NON_OFFENSIVE_OVERRIDE = new Set([
  '2000013:Skill_2', // Dolly S2 — AoE debuff, no damage
  '2000038:Skill_2', // Shu S2 — buff removal, no damage
  '2000050:Skill_2', // Flamberge S2 — passive effect
  '2000090:Skill_2', // Gnosis Dahlia S2 — passive/triggered
]);

// Re-export for convenience
export { LANGS, DEFAULT_LANG, SUFFIX_LANGS, type Lang };
