/**
 * Server-side extractor for monster passive mechanics. Walks
 * `MonsterTemplet[id]` → its `Skill_*` slots → `MonsterSkillTemplet`
 * (filter `SkillSubType === 'PASSIVE'`) → `MonsterSkillLevelTemplet`
 * (max `SkillLevel`) → `BuffTemplet` (max `Level` per `BuffID`).
 *
 * Output is consumed by `/api/admin/damage-lab/v2/monsters/[id]/mechanics`
 * and surfaced in the lab `BossMechanicsPanel` as one toggle per passive.
 *
 * Damage-relevance filter: only buffs whose `Type` belongs to the damage
 * pipeline (BT_DMG*, BT_DMG_REDUCE*, BT_WG_DMG_REDUCE, BT_STAT* on
 * damage-related stats, BT_DMG_ELEMENT_*) are kept. Survival buffs
 * (BT_WG_INVINCIBLE, BT_WG_HEAL, BT_HEAL, BT_SHIELD) are dropped — they
 * don't affect a single damage calc.
 *
 * Pure function (no I/O). The route handler loads the JSON files and
 * passes them in.
 */

type Row = Record<string, string | undefined>

interface MonsterRow extends Row {
  ID?: string
  NameID?: string
  Element?: string
  Type?: string
}

interface SkillRow {
  ID?: string
  NameID?: string
  DescID?: string
  SkillSubType?: string
  SkillType?: string
}

interface SkillLevelRow {
  ID?: string
  SkillID?: string
  SkillLevel?: string
  BuffID?: string
}

interface BuffRow {
  ID?: string
  BuffID?: string
  Level?: string
  Type?: string
  StatType?: string
  ApplyingType?: string
  Value?: string
  BuffConditionType?: string
  BuffConditionValue?: string
  TurnDuration?: string
  CallerSkillType?: string
}

interface TextRow {
  ID?: string
  English?: string
}

// ── Output schema ────────────────────────────────────────────────────────

export interface MonsterPassiveBuff {
  buffId: string
  type: string
  /** Raw `Value` from BuffTemplet (typically per-mille for OAT_RATE buffs). */
  value: number
  applyingType: string
  statType?: string
  /** BuffConditionType from BuffTemplet (e.g. ATTACKER_ELEMENT_WIN). */
  condition: string
  /** Raw BuffConditionValue (kept as string — semantics depend on cond type). */
  conditionValue?: string
  turnDuration?: string
  callerSkillType?: string
  /** Human-readable summary line for the UI. */
  summary: string
}

/**
 * `passive` = `SkillSubType=PASSIVE` (always active when boss is alive).
 * `enrage`  = `SkillType=SKT_RAGE_ENTER\d` (fires once when boss crosses
 *             an HP threshold and applies persistent buffs that stay
 *             until the matching `SKT_RAGE_FINISH` runs). Surfaced as a
 *             toggle in the lab so the operator can model the enraged
 *             state when boss HP is low.
 */
export type MonsterPassiveKind = 'passive' | 'enrage'

export interface MonsterPassive {
  skillId: string
  kind: MonsterPassiveKind
  name: string
  description: string
  buffs: MonsterPassiveBuff[]
}

export interface MonsterMechanics {
  monsterId: string
  monsterName: string
  monsterElement: string
  isBoss: boolean
  passives: MonsterPassive[]
}

// ── Inputs ───────────────────────────────────────────────────────────────

export interface ExtractMonsterInput {
  monsterId: string
  monsters: MonsterRow[]
  skills: SkillRow[]
  skillLevels: SkillLevelRow[]
  buffs: BuffRow[]
  textSkill: TextRow[]
}

// ── Filters ──────────────────────────────────────────────────────────────

const BOSS_TYPES = new Set([
  'CT_BOSS_MONSTER',
  'CT_AREA_BOSS_MONSTER',
  'CT_SEASON_BOSS_MONSTER',
])

const ELEMENT_LABELS: Record<string, string> = {
  CET_EARTH: 'Earth', CET_WATER: 'Water', CET_FIRE: 'Fire',
  CET_LIGHT: 'Light', CET_DARK: 'Dark',
}

/**
 * Buff types relevant to OUR damage hitting the boss. Boss passives carry
 * `TargetType=ME` (buff is on the boss itself) — so:
 *
 *   `BT_DMG_*` family (BT_DMG, BT_DMG_OWNER_*, BT_DMG_TARGET_*, etc.)
 *     → fire in `FindBuffAdditionalDamage(caster)` which scans the
 *       *attacker*'s buffs. When the buff is on the boss, the boss is
 *       the "caster" for ITS OWN attacks → these only modify the boss's
 *       OUTGOING damage to us. Irrelevant to the lab (we model damage
 *       dealt TO the boss). DROP.
 *
 *   `BT_DMG_REDUCE` / `_FINAL` / `_WG_DMG_REDUCE`
 *     → fire in `FindBuffDamageReduce(target)` which scans the
 *       *defender*'s buffs. When the buff is on the boss, it reduces
 *       (or increases, with negative values) the damage the boss takes.
 *       KEEP.
 *
 *   `BT_DMG_ELEMENT_SUPERIORITY` / `_ENCHANT` (types 92/93, see spec §2)
 *     → element multiplier override. Affects damage dealt against this
 *       target. KEEP.
 */
const DAMAGE_RELEVANT_TYPES = new Set([
  // Damage reduction (defender side — applies to OUR damage to the boss).
  'BT_DMG_REDUCE', 'BT_DMG_REDUCE_FINAL',
  'BT_DMG_REDUCE_MY_TEAM_INCREASE',
  'BT_DMG_REDUCE_FINAL_MY_TEAM_INCREASE',
  'BT_DMG_REDUCE_FINAL_WITH_OUT_FIRST_SKILL',
  // Element damage rate override (cf §2 spec, types 92/93).
  'BT_DMG_ELEMENT_SUPERIORITY', 'BT_DMG_ELEMENT_ENCHANT',
  // BT_WG_* (weakness gauge) excluded — WG is a separate combat resource,
  // not part of the damage formula the lab models.
])

/**
 * Stats relevant to OUR damage going to the boss (`BT_STAT*` filter).
 * The lab models damage *dealt* to the target — boss-offensive stats
 * (its own CHC/CHD/EFF/DMG_BOOST when it attacks us) don't affect that
 * calc and are filtered out so passives like Amadeus's "+CHC for 5 turns
 * when enemy uses non-attack skill" don't pollute the panel.
 *
 *   ST_DEFENCE       — feeds mit calc (`C / (C + (1−PEN/1000)·DEF)`)
 *   ST_DMG_REDUCE_RATE — subtracted from rate (gear stat / Enrage rage buff)
 *   ST_BUFF_RESIST   — gates whether our awakening boss-debuffs land
 */
const DAMAGE_RELEVANT_STATS = new Set([
  'ST_DEFENCE',
  'ST_DMG_REDUCE_RATE',
  'ST_BUFF_RESIST',
])

/** BT_STAT-family types that we consider damage-relevant if the StatType matches. */
const STAT_BUFF_TYPES = new Set([
  'BT_STAT', 'BT_STAT_PREMIUM',
  'BT_STAT_BUFF_ENHANCE', 'BT_STAT_DEBUFF_ENHANCE',
])

function isDamageRelevant(b: BuffRow): boolean {
  const t = b.Type ?? ''
  // BT_NONE marker buffs (placeholders for game-code logic) carry no
  // numeric effect — they pollute the panel without informing the lab.
  if (t === 'BT_NONE' || t === '') return false
  if (DAMAGE_RELEVANT_TYPES.has(t)) return true
  if (STAT_BUFF_TYPES.has(t) && DAMAGE_RELEVANT_STATS.has(b.StatType ?? '')) return true
  return false
}

// ── Indexers ─────────────────────────────────────────────────────────────

function indexBuffsByIdMax(buffs: BuffRow[]): Map<string, BuffRow> {
  const out = new Map<string, BuffRow>()
  for (const b of buffs) {
    if (!b.BuffID) continue
    const cur = out.get(b.BuffID)
    const lvl = parseInt(b.Level ?? '0', 10) || 0
    const curLvl = cur ? (parseInt(cur.Level ?? '0', 10) || 0) : -1
    if (lvl > curLvl) out.set(b.BuffID, b)
  }
  return out
}

function indexSkillLevelMax(rows: SkillLevelRow[]): Map<string, SkillLevelRow> {
  const out = new Map<string, SkillLevelRow>()
  for (const r of rows) {
    if (!r.SkillID) continue
    const cur = out.get(r.SkillID)
    const lvl = parseInt(r.SkillLevel ?? '0', 10) || 0
    const curLvl = cur ? (parseInt(cur.SkillLevel ?? '0', 10) || 0) : -1
    if (lvl > curLvl) out.set(r.SkillID, r)
  }
  return out
}

function indexSkills(skills: SkillRow[]): Map<string, SkillRow> {
  const out = new Map<string, SkillRow>()
  for (const s of skills) {
    if (s.ID) out.set(s.ID, s)
  }
  return out
}

function indexText(rows: TextRow[]): Map<string, string> {
  const out = new Map<string, string>()
  for (const r of rows) {
    if (r.ID) out.set(r.ID, r.English ?? '')
  }
  return out
}

// ── Description / summary helpers ────────────────────────────────────────

/**
 * Strip in-game color tags `<color=#...>...</color>`, `\n` literals,
 * and leftover placeholder tokens like `[Buff_V_xxx]`. We keep the inner
 * text — operators read this, not rendering engines.
 */
function cleanDescription(s: string): string {
  return s
    .replace(/<color=[^>]*>/g, '')
    .replace(/<\/color>/g, '')
    .replace(/\\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Stats encoded per-mille internally — even with OAT_ADD, their `Value`
 * is a permille delta (e.g. `+400` on `ST_DMG_REDUCE_RATE` = +40% DR).
 * Mirrors `PERCENT_STATS` in `extract-buffs.ts`.
 */
const PERMILLE_STATS = new Set([
  'ST_DMG_REDUCE_RATE', 'ST_PIERCE_POWER_RATE',
  'ST_CRITICAL_RATE', 'ST_CRITICAL_DMG_RATE',
  'ST_DMG_BOOST', 'ST_BUFF_CHANCE', 'ST_BUFF_RESIST',
])

function summarizeBuff(b: BuffRow): string {
  const type = b.Type ?? ''
  const val = parseInt(b.Value ?? '0', 10) || 0
  const cond = b.BuffConditionType ?? 'NONE'
  const condVal = b.BuffConditionValue
  const stat = b.StatType ?? ''

  const sign = val < 0 ? '−' : '+'
  const absVal = Math.abs(val)
  // OAT_RATE always permille. OAT_ADD permille only when the stat itself
  // is encoded permille (DR / CHC / CHD / etc.); a flat ATK/DEF buff with
  // OAT_ADD stays literal.
  const apply = b.ApplyingType ?? ''
  const isPermille = apply === 'OAT_RATE' || (apply === 'OAT_ADD' && PERMILLE_STATS.has(stat))
  const formatted = isPermille ? `${(absVal / 10).toFixed(absVal % 10 === 0 ? 0 : 1)}%` : String(absVal)

  // Phrasings are written from the LAB OPERATOR's perspective ("our damage
  // to the boss"). BT_DMG_REDUCE on the boss with positive value reduces
  // what the boss takes — i.e. `−X% damage to boss`. Negative value
  // (encoded as `val < 0`) increases damage taken — `+X% damage to boss`.
  let effect = ''
  switch (type) {
    case 'BT_DMG_REDUCE':         effect = val >= 0 ? `−${formatted} damage to boss` : `+${formatted} damage to boss`; break
    case 'BT_DMG_REDUCE_FINAL':   effect = val >= 0 ? `−${formatted} final damage to boss` : `+${formatted} final damage to boss`; break
    case 'BT_STAT':
    case 'BT_STAT_PREMIUM':       effect = `${sign}${formatted} ${stat.replace(/^ST_/, '')}`; break
    case 'BT_STAT_BUFF_ENHANCE':  effect = `${sign}${formatted} buff effectiveness`; break
    case 'BT_STAT_DEBUFF_ENHANCE':effect = `${sign}${formatted} debuff effectiveness`; break
    case 'BT_DMG_ELEMENT_SUPERIORITY': effect = 'Element superiority marker'; break
    case 'BT_DMG_ELEMENT_ENCHANT':     effect = `${sign}${formatted} element rate`; break
    default:                      effect = `${type} ${sign}${formatted}`
  }

  let condText = ''
  switch (cond) {
    case 'NONE':                   condText = ''; break
    // ATTACKER_ELEMENT_EQUAL = neutral matchup (NEITHER win nor lose).
    // Covers same-element AND cross-cycle pairs (e.g. F vs Dark, E vs Dark).
    // The "EQUAL" name refers to the matchup balance, not literal element
    // identity. So Earth vs Dark fires this; Light vs Dark does NOT (Light
    // has L↔D mutual advantage).
    case 'ATTACKER_ELEMENT_WIN':   condText = ' if attacker has element advantage'; break
    case 'ATTACKER_ELEMENT_LOSE':  condText = ' if attacker has element disadvantage'; break
    case 'ATTACKER_ELEMENT_EQUAL': condText = ' if attacker has no element advantage/disadvantage'; break
    // TARGET_ELEMENT=N: gate on attacker's element. Empirically interpreted
    // as "if attacker is element N" — see Amadeus skill 132405 buff `10`
    // (BT_DMG_REDUCE -450 TARGET_ELEMENT=4) which only fires for Dark
    // attackers per the in-game description ("increases damage taken from
    // Light/Dark enemies"). The "TARGET" naming is a datamine convention
    // quirk, not a check on the buff owner's element.
    case 'TARGET_ELEMENT':         condText = ` if attacker is ${ELEMENT_BY_VALUE[condVal || '0']}`; break
    case 'OWNER_ELEMENT':          condText = ` if owner is ${ELEMENT_BY_VALUE[condVal || '0']}`; break
    case 'TARGET_IS_BOSS':         condText = ' if target is boss'; break
    case 'CASTER_CRITICAL':        condText = ' on critical hits'; break
    case 'OWNER_HPRATE_UNDER':     condText = ` if owner HP < ${condVal}%`; break
    case 'OWNER_HPRATE_OVER':      condText = ` if owner HP > ${condVal}%`; break
    case 'TARGET_HPRATE_UNDER':    condText = ` if target HP < ${condVal}%`; break
    case 'TARGET_HPRATE_OVER':     condText = ` if target HP > ${condVal}%`; break
    case 'CASTER_HAS_BUFF':        condText = ` if caster has buff ${condVal}`; break
    case 'OWNER_HAS_NOT_BUFF':     condText = ` if owner has no buff ${condVal}`; break
    default:                       condText = ` (${cond}${condVal ? `=${condVal}` : ''})`
  }

  return effect + condText
}

const ELEMENT_BY_VALUE: Record<string, string> = {
  '0': 'Earth', '1': 'Water', '2': 'Fire', '3': 'Light', '4': 'Dark',
}

// ── Main extractor ───────────────────────────────────────────────────────

export function extractMonsterPassives(input: ExtractMonsterInput): MonsterMechanics | null {
  const { monsterId, monsters, skills, skillLevels, buffs, textSkill } = input

  const monster = monsters.find(m => m.ID === monsterId)
  if (!monster) return null

  const skillsById = indexSkills(skills)
  const skillLevelMax = indexSkillLevelMax(skillLevels)
  const buffsById = indexBuffsByIdMax(buffs)
  const textById = indexText(textSkill)

  // Walk Skill_* slots.
  const skillIds: string[] = []
  for (const [k, v] of Object.entries(monster)) {
    if (!k.startsWith('Skill_')) continue
    if (!v || v === '0') continue
    if (skillIds.includes(v)) continue
    skillIds.push(v)
  }

  const passives: MonsterPassive[] = []

  for (const sid of skillIds) {
    const skill = skillsById.get(sid)
    if (!skill) continue

    // Emit two skill families:
    //   1. SkillSubType=PASSIVE — always-active boss passives
    //   2. SkillType=SKT_RAGE_ENTER\d — enrage triggers (apply persistent
    //      buffs when boss HP crosses a threshold). The matching
    //      SKT_RAGE_FINISH skill removes them, so we don't surface those.
    let kind: MonsterPassiveKind | null = null
    let ragePhase = 0
    if (skill.SkillSubType === 'PASSIVE') kind = 'passive'
    else {
      const rageMatch = /^SKT_RAGE_ENTER(\d+)$/.exec(skill.SkillType ?? '')
      if (rageMatch) {
        kind = 'enrage'
        ragePhase = parseInt(rageMatch[1], 10) || 0
      }
    }
    if (!kind) continue

    const levelRow = skillLevelMax.get(sid)
    const buffCsv = (levelRow?.BuffID ?? '').split(',').map(x => x.trim()).filter(Boolean)
    if (buffCsv.length === 0) continue

    const passiveBuffs: MonsterPassiveBuff[] = []
    for (const buffId of buffCsv) {
      const b = buffsById.get(buffId)
      if (!b) continue
      if (!isDamageRelevant(b)) continue

      passiveBuffs.push({
        buffId,
        type: b.Type ?? '',
        value: parseInt(b.Value ?? '0', 10) || 0,
        applyingType: b.ApplyingType ?? '',
        statType: b.StatType,
        condition: b.BuffConditionType ?? 'NONE',
        conditionValue: b.BuffConditionValue,
        turnDuration: b.TurnDuration,
        callerSkillType: b.CallerSkillType,
        summary: summarizeBuff(b),
      })
    }

    if (passiveBuffs.length === 0) continue

    const rawName = textById.get(skill.NameID ?? '') ?? skill.NameID ?? sid
    const desc = textById.get(skill.DescID ?? '') ?? ''

    passives.push({
      skillId: sid,
      kind,
      name: cleanDescription(rawName),
      description: cleanDescription(desc),
      buffs: passiveBuffs,
    })
    // Suppress unused-var lint while ragePhase remains useful context for
    // future debug logging.
    void ragePhase
  }

  // Collapse all enrage entries into a single "Enrage" entry with deduped
  // buffs. The trigger conditions (HP threshold, turn count) vary per boss
  // but the operator only cares about the resulting persistent effects.
  const collapsed = collapseEnrages(passives)

  return {
    monsterId,
    monsterName: monster.NameID ?? monsterId,
    monsterElement: ELEMENT_LABELS[monster.Element ?? ''] ?? '',
    isBoss: BOSS_TYPES.has(monster.Type ?? ''),
    passives: collapsed,
  }
}

/**
 * Multi-phase enrages (e.g. SKT_RAGE_ENTER1 + ENTER2) usually share the
 * same persistent buffs (`Common_Rage_Buff_1`, `Common_Rage_Buff_1_4`,
 * `Common_Rage_Buff_1_6` all encode +400 ST_DMG_REDUCE_RATE). The
 * operator only cares about the cumulative pertinent effect — not which
 * threshold triggers it — so we collapse all `kind='enrage'` entries
 * into one "Enrage" entry with deduped buffs.
 */
function collapseEnrages(passives: MonsterPassive[]): MonsterPassive[] {
  const out: MonsterPassive[] = []
  const enrageBuffs: MonsterPassiveBuff[] = []
  const seen = new Set<string>()

  for (const p of passives) {
    if (p.kind !== 'enrage') {
      out.push(p)
      continue
    }
    for (const b of p.buffs) {
      // Dedupe by effect signature — different `buffId` values that encode
      // the same numeric effect (e.g. `Common_Rage_Buff_1` vs `_1_4`)
      // collapse into a single line.
      const key = `${b.type}|${b.statType ?? ''}|${b.value}|${b.condition}|${b.conditionValue ?? ''}`
      if (seen.has(key)) continue
      seen.add(key)
      enrageBuffs.push(b)
    }
  }

  if (enrageBuffs.length > 0) {
    out.push({
      skillId: 'enrage',
      kind: 'enrage',
      name: 'Enrage',
      description: '',
      buffs: enrageBuffs,
    })
  }
  return out
}
