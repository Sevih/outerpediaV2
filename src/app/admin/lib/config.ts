/**
 * Admin-specific configuration — character extractor
 *
 * Character-specific mappings and helpers.
 * Generic text/enum/buff helpers are in ./text.ts
 */

// Re-export shared helpers so existing imports from config.ts keep working
export {
  LANGS, DEFAULT_LANG, SUFFIX_LANGS, type Lang,
  LANG_TO_COLUMN, type LangTexts,
  readTemplet,
  buildTextMap, expandLang,
  resolveEnum, resolveElement, resolveClass, resolveSubClass,
  buildBuffIndex, resolveBuffPlaceholders,
} from './text';

// ── Buff/Debuff extraction (character-specific) ─────────────────────

type BuffRow = Record<string, string>;

// Buff types to rename (game name → display name)
const BUFF_TYPE_RENAME: Record<string, string> = {
  'BT_STAT|ST_AVOID': 'SYS_BUFF_AVOID_UP',
  'IG_Buff_Stat_Atk_Interruption_D':'BT_STAT|ST_ATK_IR',
  'IG_Buff_Stat_CriDmgRate_Interruption_D':'BT_STAT|ST_CRITICAL_DMG_RATE_IR'
};

// Force classification override: types the game marks wrong (e.g. NEUTRAL that should be DEBUFF)
const BUFF_TYPE_FORCE: Record<string, 'buff' | 'debuff'> = {
  'BT_WG_REVERSE_HEAL': 'debuff',
  'BT_SEALED_RESURRECTION': 'debuff',
  'BT_STEAL_BUFF': 'debuff',
  'BT_KILL_UNDER_HP_RATE': 'debuff',
};

// Force add buff/debuff to specific skills (charId:skillType → { buff: [...], debuff: [...] })
export const SKILL_BUFF_FORCE: Record<string, { buff?: string[]; debuff?: string[]; dual_buff?: string[]; dual_debuff?: string[] }> = {
  '2000065:SKT_FIRST': { buff: ['BT_EXTRA_ATTACK_ON_TURN_END'] },
  '2000072:SKT_ULTIMATE': { debuff: ['BT_STEAL_BUFF'] },
  '2000084:SKT_FIRST': { buff: ['BT_CALL_BACKUP_2', 'BT_CALL_BACKUP'] },
  '2000093:SKT_SECOND': { buff: ['BT_RANDOM_STAT'] },
  '2000095:SKT_SECOND': { buff: ['GRACE_OF_THE_VIRGIN_GODDESS', 'BT_COOL3_CHARGE', 'BT_ACTION_GAUGE'] },
  '2000102:SKT_ULTIMATE': { buff: ['BT_EXTEND_DEBUFF'], debuff: ['BT_EXTEND_BUFF'] },
};

// Specific BuffIDs to exclude
const BUFF_ID_BLACKLIST = new Set([
  '2000052_backup_1_1', // Sigma dual: self-immunity during attack, not a real buff
  '2000057_2_2', // Sterope S2: internal heal reduction, not visible
  '2000057_2_3',
  '2000087_3_7', // Rey S3: false curse interruption buff
  '2000087_3_8',
  '2000095_2_2', // Bell S2: internal passive trigger, not a visible buff
  '2000096_2_4', // Ais S2: internal action gauge
  '2000102_2_3', // Nadja S2: internal BT_STAT with no stat type
  '2000102_2_4',
  '2000109_3_3', // Viella S3: internal DEF stat
]);

const BUFF_TYPE_BLACKLIST = new Set([
  'BT_DMG',
  'BT_DMG_TO_BOSS',
  'BT_DMG_ENEMY_TEAM_DECREASE',
  'BT_RESOURCE_USE_SKILL',
  'BT_RESOURCE_CHARGE',
  'BT_SKILL_RANGE_ALL',
  'BT_STAT_PREMIUM',
  'BT_DMG_OWNER_LOST_HP_RATE',
  'BT_SKILL_USING_CONDITION',
  'BT_NONE',
  'BT_STAT_OWNER_LOST_HP_RATE',
  'BT_DMG_TARGET_DEBUFF',
  'BT_DMG_TARGET_BUFF',
  'BT_SWAP_STAT_ATTACK',
  'BT_GROUP',
  'BT_LIMIT_DMG_TURN',
  'BT_SHARE_DMG',
  "BT_DMG_TARGET_LOST_HP_RATE",
  "BT_SECOND_TRIGGER",
  'BT_DMG_REDUCE_FINAL',
  'BT_DMG_MY_TEAM_DECREASE',
  'BT_RESOURCE_CHARGE_BUFF_CASTER',
  'BT_WG_HEAL',
  'BT_WG_DMG_REDUCE',
  'BT_WG_INVINCIBLE',
  'BT_DOT_CURSE_CAP',
  'BT_REVERSE_HEAL_CAP',
  'BT_REVIVAL_N_RUN_PASSIVE_SKILL',
  'BT_REMOVE_DEATH',
  'BT_DMG_KILL_COUNT_STACK'
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
  { expandInterruption = true }: { expandInterruption?: boolean } = {},
): { buff: string[]; debuff: string[] } {
  const buffs = new Set<string>();
  const debuffs = new Set<string>();

  // Expand buff group IDs to include siblings with _Interruption IconName.
  // This catches irremovable variants that aren't in the BuffID field directly.
  // Disabled for monsters where normal/hard variants share the same prefix.
  const expandedIds = new Set(buffGroupIds);
  if (expandInterruption) {
    for (const gid of buffGroupIds) {
      const parts = gid.split('_');
      if (parts.length >= 3 && /^\d{7}$/.test(parts[0])) {
        const prefix = `${parts[0]}_${parts[1]}_`;
        for (const row of buffData) {
          if (row.BuffID?.startsWith(prefix) && !row.BuffID.endsWith('_old') && row.IconName?.includes('_Interruption')) {
            expandedIds.add(row.BuffID);
          }
        }
      }
    }
  }

  for (const groupId of expandedIds) {
    for (const row of buffData) {
      if (row.BuffID !== groupId) continue;

      const type = row.Type ?? '';
      const statType = row.StatType ?? '';
      const bdType = row.BuffDebuffType ?? '';

      if (!type || BUFF_ID_BLACKLIST.has(groupId)) continue;

      // Interruption IconName = irremovable variant, use IconName as tag.
      // This distinguishes e.g. BT_DOT_BURN (removable) from IG_Buff_Dot_Burn_Interruption_D (irremovable).
      // Exception: generic buffs like BT_COOL_CHARGE with Interruption icon should keep their type
      // (the Interruption just means permanent, not a distinct visible effect).
      if (row.IconName?.includes('_Interruption')) {
        const icon = row.IconName;
        // Skip buffs where _Interruption is just "permanent" and not a distinct visual effect
        const isJustPermanent = /^IG_Buff_Cool_Charge/.test(icon)
          || /^IG_Buff_Enhance_/.test(icon)
          || /^IG_Buff_Effect_Heal_/.test(icon);
        if (!isJustPermanent) {
          const iconTag = BUFF_TYPE_RENAME[icon] ?? icon;
          if (bdType === 'BUFF') buffs.add(iconTag);
          else if (bdType.startsWith('DEBUFF')) debuffs.add(iconTag);
          else {
            if (iconTag.endsWith('_D')) debuffs.add(iconTag);
            else buffs.add(iconTag);
          }
          break;
        }
        // "Just permanent" buffs: fall through to standard type handling
      }

      if (BUFF_TYPE_BLACKLIST.has(type)
        || type.startsWith('BT_DMG_OWNER_STAT')
        || type.startsWith('BT_DMG_TARGET_STAT')
      ) continue;

      if (type.startsWith('BT_IMMEDIATELY')) {
        debuffs.add(type);
        break;
      }

      if (type === 'BT_HEAL_BASED_TARGET' || type === 'BT_HEAL_BASED_CASTER') {
        if (row.BuffRemoveType === 'ON_TURN_END') {
          buffs.add('BT_CONTINU_HEAL');
        }
        break;
      }

      if (type === 'BT_STAT' && (row.TurnDuration === '-1' || row.BuffRemoveType === 'ON_SKILL_FINISH')) break;

      if ((type.startsWith('BT_RUN_PASSIVE_') || type.startsWith('BT_RUN_ACTIVE_')) && row.RemoveEffect) {
        buffs.add(row.RemoveEffect);
        break;
      }

      if (type === 'BT_DMG_REDUCE') break;

      if (type === 'BT_REVERSE_HEAL_BASED_TARGET' || type === 'BT_REVERSE_HEAL_BASED_CASTER') {
        if (row.TargetType?.startsWith('ENEMY')) debuffs.add(type);
        break;
      }

      const resolvedType = (type === 'BT_DOT_POISON' && row.RemoveEffect === 'SYS_BUFF_POISON_2')
        ? 'BT_DOT_POISON2' : type;

      const rawTag = resolvedType === 'BT_STAT' && statType && statType !== 'ST_NONE'
        ? `${resolvedType}|${statType}`
        : resolvedType;
      const tag = BUFF_TYPE_RENAME[rawTag] ?? rawTag;

      const forced = BUFF_TYPE_FORCE[type];
      if (forced === 'buff' || (!forced && bdType === 'BUFF')) {
        buffs.add(tag);
      } else if (forced === 'debuff' || (!forced && bdType.startsWith('DEBUFF'))) {
        debuffs.add(tag);
      }

      break;
    }
  }

  return { buff: [...buffs], debuff: [...debuffs] };
}

/**
 * Collect all buff group IDs referenced by skill level entries.
 */
export function collectBuffGroupIds(skillLevelRows: BuffRow | BuffRow[]): string[] {
  const rows = Array.isArray(skillLevelRows) ? skillLevelRows : [skillLevelRows];
  const ids = new Set<string>();
  for (const row of rows) {
    for (const [, val] of Object.entries(row)) {
      if (!val || typeof val !== 'string') continue;
      for (const part of val.split(',')) {
        const trimmed = part.trim();
        if (/^\d{7}_/.test(trimmed)) {
          ids.add(trimmed);
        }
      }
    }
  }
  return [...ids];
}

/**
 * Collect buff IDs from fusion passive skill level entries.
 * Unlike normal skills, fusion passive uses global BuffIDs (core_passive_*, trancendent_*)
 * that don't match the {7-digit charId}_ pattern.
 */
export function collectFusionPassiveBuffIds(skillLevelRows: BuffRow[], buffData: BuffRow[]): string[] {
  const knownBuffIds = new Set(buffData.map(r => r.BuffID).filter(Boolean));
  const ids = new Set<string>();
  for (const row of skillLevelRows) {
    for (const [key, val] of Object.entries(row)) {
      if (!val || typeof val !== 'string') continue;
      if (key === 'ID' || key === 'SkillID' || key === 'Key') continue;
      for (const part of val.split(',')) {
        const trimmed = part.trim();
        if (trimmed && knownBuffIds.has(trimmed)) {
          ids.add(trimmed);
        }
      }
    }
  }
  return [...ids];
}

/**
 * Collect buff group IDs from BuffTemplet by naming convention.
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

// ── Data fixes ───────────────────────────────────────────────────────

export const BASIC_STAR_OVERRIDE: Record<string, number> = {
  '2000020': 3,
};

export const NON_OFFENSIVE_OVERRIDE = new Set([
  '2000013:Skill_2',
  '2000038:Skill_2',
  '2000050:Skill_2',
  '2000090:Skill_2',
]);

// ── Auto-detect tags ─────────────────────────────────────────────────

type RecruitRow = Record<string, string>;
type ExtraRow = Record<string, string>;

export function detectTags(
  charId: string,
  buffData: BuffRow[],
  recruitData: RecruitRow[],
  extraData: ExtraRow[],
): string[] {
  const tags: string[] = [];

  const banner = recruitData.find(r =>
    r.EndDateTime === charId &&
    ['PREMIUM', 'SEASONAL', 'OUTER_FES'].includes(r.ShowDate_fallback1 ?? ''),
  );

  if (banner) {
    const marker = banner.ShowDate_fallback1;
    if (marker === 'PREMIUM') {
      tags.push('premium');
    } else if (marker === 'OUTER_FES') {
      tags.push('limited');
    } else if (marker === 'SEASONAL') {
      if (banner.ShowDate_fallback2?.includes('Collabo')) {
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

  const hasIgnoreDefense = buffData.some(r =>
    (r.BuffID?.startsWith(`${charId}_`) && r.Type === 'BT_STAT' && r.StatType === 'ST_PIERCE_POWER_RATE' && r.BuffRemoveType === 'ON_SKILL_FINISH')
    || (r.BuffID?.startsWith(`BID_CEQUIP_${charId}`) && r.StatType === 'ST_PIERCE_POWER_RATE'),
  );
  if (hasIgnoreDefense) tags.push('ignore-defense');

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
