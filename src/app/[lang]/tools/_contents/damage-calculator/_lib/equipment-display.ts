import type { DamageCalcBuffEntry, DamageCalcEffectGroup } from '@/lib/data/damage-calc'

/**
 * Display helpers for the equipment passive UI.
 *
 * All localization goes through `lRec()` from `@/lib/i18n/localize` — no
 * hand-rolled lang switches. The helpers below only do data shaping
 * (label derivation, value formatting) that has no localization concern.
 */

/**
 * Normalize a buff to the player-facing stat label and sign.
 *
 * The datamine encodes "Effectiveness" as `ST_BUFF_RESIST` applied to
 * `ENEMY_TEAM` with negative values (reducing enemy RES is mechanically
 * equivalent to raising your own EFF — they collapse to the same hit
 * chance roll). The in-game UI shows it as `EFF +N`, so we flip both
 * the stat label and the value sign for display.
 *
 * Audited across all 119 EE main stats: this is the only inversion;
 * `ME|ST_DMG_BOOST|POS`, `ME|ST_CRITICAL_RATE|POS`, and
 * `ME|ST_DMG_REDUCE_RATE|POS` already display correctly as-is.
 */
function normalizeForDisplay(buff: DamageCalcBuffEntry): { statType?: string; flipSign: boolean } {
  if (buff.targetType === 'ENEMY_TEAM' && buff.statType === 'ST_BUFF_RESIST') {
    return { statType: 'ST_BUFF_CHANCE', flipSign: true }
  }
  return { statType: buff.statType, flipSign: false }
}

/**
 * Format a buff's Value at a given enchant level. Most buffs use OAT_RATE
 * with per-mille values (÷10 → %); a handful use OAT_ADD with a flat int.
 */
export function formatBuffValue(buff: DamageCalcBuffEntry, level: number): string {
  const idx = Math.max(0, Math.min(buff.values.length - 1, level))
  const raw = buff.values[idx] ?? 0
  const v = normalizeForDisplay(buff).flipSign ? -raw : raw
  if (buff.applyingType === 'OAT_RATE') return `${(v / 10).toFixed(v % 10 === 0 ? 0 : 1)}%`
  return String(v)
}

/** Compact scaling label: lv 1 value → max enchant value (e.g. "10% → 20%"). */
export function formatBuffScaling(buff: DamageCalcBuffEntry): string {
  if (!buff.values.length) return '—'
  const first = formatBuffValue(buff, 0)
  const last = formatBuffValue(buff, buff.values.length - 1)
  return first === last ? first : `${first} → ${last}`
}

/**
 * Short stat tag for a buff: `ATK%`, `HP`, `DMG↑%`, etc. Falls back to
 * the buff Type for non-stat passives (`BT_DMG_TARGET_BREAK` etc.).
 */
export function formatBuffTag(buff: DamageCalcBuffEntry): string {
  const { statType } = normalizeForDisplay(buff)
  if (statType) {
    const stat = STAT_LABEL[statType] ?? statType.replace(/^ST_/, '')
    return buff.applyingType === 'OAT_RATE' ? `${stat}%` : stat
  }
  return TYPE_LABEL[buff.type] ?? buff.type.replace(/^BT_/, '')
}

const STAT_LABEL: Record<string, string> = {
  ST_ATK:               'ATK',
  ST_DEF:               'DEF',
  ST_HP:                'HP',
  ST_SPEED:             'SPD',
  ST_CRITICAL_RATE:     'CHC',
  ST_CRITICAL_DMG_RATE: 'CHD',
  ST_PIERCE_POWER_RATE: 'PEN',
  ST_DMG_BOOST:         'DMG↑',
  ST_DMG_REDUCE_RATE:   'DMG-',
  ST_BUFF_CHANCE:       'EFF',
  ST_BUFF_RESIST:       'RES',
  ST_LIFESTEAL_RATE:    'LS',
  ST_COUNTER_RATE:      'CTR',
}

const TYPE_LABEL: Record<string, string> = {
  BT_DMG:               'DMG',
  BT_DMG_TARGET_STAT:   'DMG (target stat)',
  BT_DMG_TARGET_BREAK:  'DMG (vs Break)',
  BT_DMG_TO_BOSS:       'DMG (vs Boss)',
  BT_REMOVE_BUFF:       'Remove buff',
  BT_HEAL:              'Heal',
}

/** In-game class display name. CCT_ATTACKER = "Striker" (subclass naming differs). */
const CLASS_LABEL: Record<string, string> = {
  CCT_DEFENDER: 'Defender',
  CCT_ATTACKER: 'Striker',
  CCT_RANGER:   'Ranger',
  CCT_MAGE:     'Mage',
  CCT_PRIEST:   'Priest',
}
export function formatClassLimit(s: string): string {
  return CLASS_LABEL[s] ?? s.replace(/^CCT_/, '')
}

/**
 * Synthesize a display name for an EE main-stat group. The bake omits the
 * `name` field for these (the EE item name would be misleading); we
 * reconstruct from `targetElement` + the buff's stat tag, matching the
 * in-game format ("vs Fire DMG↑%").
 */
export function eeMainStatLabel(group: DamageCalcEffectGroup): string {
  const tag = group.buffs[0] ? formatBuffTag(group.buffs[0]) : ''
  if (!group.targetElement) return tag
  return `vs ${group.targetElement} ${tag}`
}
