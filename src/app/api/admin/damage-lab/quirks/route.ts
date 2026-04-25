import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

// ── Reference mappings (decoded empirically from node names + AwakeningApplyTypeValue) ──

// AAT_CLASS index → in-game class label (Outerplane calls CCT_ATTACKER "Striker" in UI)
const CLASS_BY_INDEX: Record<number, string> = {
  1: 'Defender', 2: 'Striker', 3: 'Ranger', 4: 'Mage', 5: 'Healer',
}

// AAT_SUBCLASS index → subclass name (uppercase, matches CharacterTemplet.SubClass)
const SUBCLASS_BY_INDEX: Record<number, string> = {
  1: 'ATTACKER', 2: 'BRUISER',         // Striker
  3: 'WIZARD',   4: 'ENCHANTER',       // Mage
  5: 'VANGUARD', 6: 'TACTICIAN',       // Ranger
  7: 'SWEEPER',  8: 'PHALANX',         // Defender
  9: 'RELIEVER', 10: 'SAGE',           // Healer
}

// AAT_ELEMENTAL index → element name
const ELEMENT_BY_INDEX: Record<number, string> = {
  0: 'Earth', 1: 'Water', 2: 'Fire', 3: 'Light', 4: 'Dark',
}

// ── Types ─────────────────────────────────────────────────────────────

type Row = Record<string, string>
interface ResolvedQuirk {
  nodeId: string                         // CharacterAwakeningNodeTemplet.ID
  group: 'ELEMENTAL' | 'JOB' | 'UTILITY' | 'PVE' | 'ADVENTURE_LICENSE'
  name: string                           // localized English label (NodeNameID)
  desc: string                           // English with {0} substituted by the actual value
  maxLevel: number
  enabledByDefault: boolean              // false for ADVENTURE_LICENSE (player doesn't get these automatically)
  // Targeting — which characters can unlock this node
  appliesTo: {
    kind: 'element' | 'class' | 'subclass' | 'none'
    value: string | null                 // e.g. 'Earth', 'Mage', 'WIZARD' or null for 'none'
  }
  // Resolved bonus at max level. Two row shapes in CharacterAwakeningLevelTemplet:
  //  - IOT_BUFF: BuffID points to BuffTemplet (StatType/Value there)
  //  - IOT_STAT: StatType/ApplyingType/OptionValue stored directly on the level row; no BuffID.
  // We normalize both into a single shape here.
  source: {
    buffId: string                       // empty for IOT_STAT rows
    buffType: string                     // 'BT_STAT' synthesized for IOT_STAT rows
    statType: string                     // ST_ATK, ST_CRITICAL_DMG_RATE, ST_NONE, ...
    applyingType: string                 // OAT_RATE, OAT_ADD
    value: number                        // raw (per-mille for RATE, flat for ADD)
    condition: string                    // BuffConditionType (NONE, ATTACKER_ELEMENT_WIN, ...)
    optionType: string                   // IOT_BUFF / IOT_STAT
  }
  // Computed offensive effect on damage-lab formula inputs.
  // null when the effect doesn't affect attacker-side damage (DMG_REDUCE, ST_SPEED, etc.).
  effect: QuirkEffect | null
}

export interface QuirkEffect {
  // 'pool' / 'atk' / 'chd' / 'pen' / 'critRate' — caster-side bonuses (existing).
  // 'monsterEff' / 'monsterRes' — boss-side debuffs (negative `amount`) applied
  //                                to the target's EFF/RES when the target is a boss.
  target: 'pool' | 'atk' | 'chd' | 'pen' | 'critRate' | 'monsterEff' | 'monsterRes'
  unit: '%' | 'flat'
  amount: number                         // e.g. 12 for +12%, −4 for −4% on monsterRes
  requires?: 'adv' | 'disadv' | 'neutral' | 'crit' | 'boss' | null
}

// ── Helpers ───────────────────────────────────────────────────────────

const JSON2_DIR = path.join(process.cwd(), 'data', 'admin', 'json2')

function loadJson<T>(name: string): T {
  return JSON.parse(fs.readFileSync(path.join(JSON2_DIR, `${name}.json`), 'utf-8'))
}

function indexBy(rows: Row[], key = 'ID'): Map<string, Row> {
  const m = new Map<string, Row>()
  for (const r of rows) if (r[key]) m.set(r[key], r)
  return m
}

function groupBy(rows: Row[], key: string): Map<string, Row[]> {
  const m = new Map<string, Row[]>()
  for (const r of rows) {
    const k = r[key]
    if (!k) continue
    const arr = m.get(k) ?? []
    arr.push(r)
    m.set(k, arr)
  }
  return m
}

function num(v: string | undefined): number {
  if (!v) return 0
  const n = parseInt(v, 10)
  return Number.isFinite(n) ? n : 0
}

// Strip Unity-style <color=#RRGGBB>...</color> tags from localized strings.
function stripColorTags(s: string): string {
  return s.replace(/<color=#[0-9A-Fa-f]{6}>/g, '').replace(/<\/color>/g, '')
}

// Stats whose RAW Value in BuffTemplet/LevelTemplet is always per-mille (÷10 → %),
// additive percentage points regardless of OAT_RATE vs OAT_ADD. These are the stats the
// game displays as a percentage on the character sheet (CHD, Crit Rate, PEN %, DR %).
const PERCENT_STATS = new Set([
  'ST_CRITICAL_DMG_RATE', 'ST_CRITICAL_RATE',
  'ST_PIERCE_POWER_RATE', 'ST_DMG_REDUCE_RATE',
  'ST_DMG_BOOST', 'ST_BUFF_CHANCE', 'ST_BUFF_RESIST',
])

// Map a resolved source (either a Buff row or a direct IOT_STAT level row) to a
// QuirkEffect for the damage-lab formula. Returns null for buffs/stats that don't
// directly affect attacker-side damage (ST_HP, ST_SPEED, ST_DMG_REDUCE_RATE as attacker, ...).
//
// `buffId` is needed to spot the special "Awakening_Boss_*_Down_*" buffs that
// look like a self-debuff (BT_STAT_PREMIUM ST_BUFF_RESIST OAT_RATE −40 TargetType=ME)
// but are actually a boss-side debuff per the in-game node description
// ("Reduces Resilience of the Boss by X%"). The engine resolves them via the
// buff name pattern; we mirror that here.
function computeEffect(buffType: string, statType: string, applyingType: string, rawValue: number, condition: string, buffId: string): QuirkEffect | null {
  const isRate = applyingType === 'OAT_RATE'
  const isAdd = applyingType === 'OAT_ADD'
  if (!isRate && !isAdd) return null

  // Condition → requires tag. Only conditions that map to damage-lab toggles contribute.
  let requires: QuirkEffect['requires'] = null
  switch (condition) {
    case 'NONE':                   requires = null; break
    case 'ATTACKER_ELEMENT_WIN':   requires = 'adv'; break
    case 'ATTACKER_ELEMENT_LOSE':  requires = 'disadv'; break
    case 'ATTACKER_ELEMENT_EQUAL': requires = 'neutral'; break
    case 'CASTER_CRITICAL':        requires = 'crit'; break
    case 'TARGET_IS_BOSS':         requires = 'boss'; break
    default: return null
  }

  // BT_DMG without specific stat → adds to damage pool (per-mille additive %).
  // Skill-chain bonuses (Awakening_Chain_Dmg_*) declare BuffConditionType=NONE
  // but only fire during a Skill Chain — the engine resolves the context via
  // the buff name pattern, not via BuffConditionType. Same convention as the
  // Awakening_Boss_*_Down_* boss-debuff buffs handled below. Since the
  // damage-lab models individual skill hits (not chains), we drop these
  // entirely. Symptom that surfaced this: 4 chain nodes summed to +100% pool
  // and broke a 1.000 ratio → 0.57 on Caren obs.
  if (buffType === 'BT_DMG' && statType === 'ST_NONE') {
    if (/^Awakening_Chain_Dmg_/.test(buffId)) return null
    return { target: 'pool', unit: '%', amount: rawValue / 10, requires }
  }

  // Boss EFF / RES debuff — Awakening PVE nodes whose buff name follows
  // `Awakening_Boss_*_Down_*` and stores a negative ST_BUFF_RESIST / ST_BUFF_CHANCE
  // OAT_RATE. The engine treats these as percentage debuffs on the boss target,
  // not on the caster, despite TargetType=ME.
  if (buffType === 'BT_STAT_PREMIUM' && /^Awakening_Boss_.*_Down_/.test(buffId)) {
    if (statType === 'ST_BUFF_RESIST') {
      return { target: 'monsterRes', unit: '%', amount: rawValue / 10, requires: 'boss' }
    }
    if (statType === 'ST_BUFF_CHANCE') {
      return { target: 'monsterEff', unit: '%', amount: rawValue / 10, requires: 'boss' }
    }
  }

  // Percent stats: always per-mille (additive % points) regardless of OAT mode.
  if (PERCENT_STATS.has(statType)) {
    const amount = rawValue / 10
    let target: QuirkEffect['target'] | null = null
    if (statType === 'ST_CRITICAL_DMG_RATE')      target = 'chd'
    else if (statType === 'ST_CRITICAL_RATE')     target = 'critRate'
    else if (statType === 'ST_PIERCE_POWER_RATE') target = 'pen'
    else if (statType === 'ST_DMG_BOOST')         target = 'pool'
    if (!target) return null  // Buff chance / resist / DR aren't modeled for attacker-side damage
    return { target, unit: '%', amount, requires }
  }

  // Absolute stats: OAT_RATE → per-mille → % multiplier of base; OAT_ADD → raw flat.
  if (statType === 'ST_ATK') {
    return {
      target: 'atk',
      unit: isRate ? '%' : 'flat',
      amount: isRate ? rawValue / 10 : rawValue,
      requires,
    }
  }

  return null
}

// ── Applicability decoder ─────────────────────────────────────────────

function decodeApplies(node: Row): ResolvedQuirk['appliesTo'] {
  const apply = node.AwakeningApplyType
  const v = num(node.AwakeningApplyTypeValue)
  if (apply === 'AAT_ELEMENTAL') return { kind: 'element',  value: ELEMENT_BY_INDEX[v]  ?? null }
  if (apply === 'AAT_CLASS')     return { kind: 'class',    value: CLASS_BY_INDEX[v]    ?? null }
  if (apply === 'AAT_SUBCLASS')  return { kind: 'subclass', value: SUBCLASS_BY_INDEX[v] ?? null }
  return { kind: 'none', value: null }
}

// ── Handler ───────────────────────────────────────────────────────────

let cache: ResolvedQuirk[] | null = null

function build(): ResolvedQuirk[] {
  if (cache) return cache

  const nodes       = loadJson<Row[]>('CharacterAwakeningNodeTemplet')
  const levels      = loadJson<Row[]>('CharacterAwakeningLevelTemplet')
  const buffs       = loadJson<Row[]>('BuffTemplet')
  const textSystem  = indexBy(loadJson<Row[]>('TextSystem'))

  // For each AwakeningLevelGroupID, find the highest AwakeningLevel row.
  // That row either has IOT_BUFF (resolve via BuffTemplet) or IOT_STAT (inline stat).
  const levelsByGroup = groupBy(levels, 'AwakeningLevelGroupID')
  const maxLevelRowByGroup = new Map<string, { level: number; row: Row }>()
  for (const [gid, rows] of levelsByGroup) {
    let best: { level: number; row: Row } | null = null
    for (const r of rows) {
      const lvl = num(r.AwakeningLevel)
      if (!best || lvl > best.level) best = { level: lvl, row: r }
    }
    if (best) maxLevelRowByGroup.set(gid, best)
  }

  // Multiple BuffTemplet rows share the same BuffID with different Level values —
  // pick the max-level row (the one the user gets after fully unlocking).
  const buffRowsById = groupBy(buffs, 'BuffID')
  function findMaxBuff(buffId: string): Row | null {
    const rows = buffRowsById.get(buffId)
    if (!rows || rows.length === 0) return null
    return rows.reduce((best, r) => (num(r.Level) > num(best.Level) ? r : best))
  }

  const out: ResolvedQuirk[] = []
  for (const node of nodes) {
    const groupId = node.AwakeningLevelGroupID
    if (!groupId) continue
    const max = maxLevelRowByGroup.get(groupId)
    if (!max) continue

    // Resolve the stat/buff according to the level row's OptionType.
    const optionType = max.row.OptionType
    let buffId = ''
    let buffType = ''
    let statType = ''
    let applyingType = ''
    let rawValue = 0
    let condition = 'NONE'
    if (optionType === 'IOT_BUFF' || max.row.BuffID) {
      const buff = findMaxBuff(max.row.BuffID)
      if (!buff) continue
      buffId = buff.BuffID
      buffType = buff.Type
      statType = buff.StatType
      applyingType = buff.ApplyingType
      rawValue = num(buff.Value)
      condition = buff.BuffConditionType ?? 'NONE'
    } else if (optionType === 'IOT_STAT') {
      buffType = 'BT_STAT'                  // synthesized — not a real BuffTemplet type
      statType = max.row.StatType
      applyingType = max.row.ApplyingType
      rawValue = num(max.row.OptionValue)
      // IOT_STAT rows have no condition field — they're unconditional
      condition = 'NONE'
    } else {
      continue  // unknown option type, skip
    }

    const nameText = textSystem.get(node.NodeNameID ?? '')?.English ?? node.NodeNameID ?? ''
    const descRaw = textSystem.get(node.NodeDescID ?? '')?.English ?? ''
    const isRate = applyingType === 'OAT_RATE'
    const formattedValue = isRate ? `${(rawValue / 10).toFixed(1)}%` : String(rawValue)
    const desc = stripColorTags(descRaw.replace('{0}', formattedValue))
    const group = (node.AwakeningType as ResolvedQuirk['group']) ?? 'UTILITY'

    out.push({
      nodeId: node.ID,
      group,
      name: stripColorTags(nameText),
      desc,
      maxLevel: max.level,
      // ADVENTURE_LICENSE is paid/seasonal — don't auto-apply by default.
      enabledByDefault: group !== 'ADVENTURE_LICENSE',
      appliesTo: decodeApplies(node),
      source: {
        buffId, buffType, statType, applyingType, value: rawValue, condition, optionType,
      },
      effect: computeEffect(buffType, statType, applyingType, rawValue, condition, buffId),
    })
  }

  cache = out
  return out
}

export async function GET() {
  return NextResponse.json({ quirks: build() })
}
