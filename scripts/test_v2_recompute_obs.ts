/**
 * Run the v2 `recompute` pipeline on every saved observation in
 * `data/admin/damage-lab-observations.jsonl` and report the calc/obs ratio.
 *
 * Run with: npx tsx scripts/test_v2_recompute_obs.ts
 *
 * Each obs is fed back into the pipeline with the same RecomputeContext fields
 * the v1 lab persisted (charId, slot, ATK/CHD/PEN, target stats, charFlags, etc.).
 * The expected outcome:
 *   - Most obs: ratio in [0.95, 1.05] (within the documented residual envelope)
 *   - Sakura+crit+non-adv: ~0.94 (known limitation, spec §4)
 *   - Cases needing un-tracked context (e.g. enemy_team_decrease for Maxwell):
 *     ratio drops by the missing contribution but is still bounded
 *
 * The test FAILS only on real regressions (ratio outside [0.85, 1.15]) — the
 * tolerance is wide enough to admit the known residuals while catching pipeline
 * bugs (forgotten field, wrong sign, wrong scaling, etc.).
 */

import fs from 'node:fs'
import path from 'node:path'
import { recompute, type RecomputeContext } from '../src/lib/damage/v2/recompute'
import {
  extractAwakeningBuffs, extractCharSkillBuffs,
} from '../src/lib/damage/v2/extract-buffs'
import type { ApplicableBuff, CallerSlot } from '../src/lib/damage/v2/buffs'

// ── Load buffs from the datamine (same path as the v2 API route) ─────────

const JSON2_DIR = path.join(process.cwd(), 'data', 'admin', 'json2')

type Row = Record<string, string | undefined>

function loadJson<T>(file: string): T {
  return JSON.parse(fs.readFileSync(path.join(JSON2_DIR, file), 'utf-8'))
}

function buildAllBuffs(): ApplicableBuff[] {
  const nodes      = loadJson<Row[]>('CharacterAwakeningNodeTemplet.json')
  const levels     = loadJson<Row[]>('CharacterAwakeningLevelTemplet.json')
  const buffs      = loadJson<Row[]>('BuffTemplet.json')
  const charRows   = loadJson<Row[]>('CharacterTemplet.json')
  const skillLvls  = loadJson<Row[]>('CharacterSkillLevelTemplet.json')
  const textRows   = loadJson<Row[]>('TextSystem.json')

  const textSystem = new Map<string, { English: string }>()
  for (const t of textRows) {
    if (t.ID) textSystem.set(t.ID, { English: t.English ?? '' })
  }

  const awakening = extractAwakeningBuffs({ nodes, levels, buffs, textSystem })
  const charSkill = extractCharSkillBuffs({
    characters: charRows.filter(r => r.ID).map(r => r as { ID: string } & Row),
    skillLevels: skillLvls.filter(r => r.SkillID).map(r => ({
      SkillID: r.SkillID!,
      SkillLevel: r.SkillLevel ?? '0',
      BuffID: r.BuffID,
    })),
    buffs: buffs.map(b => ({
      ID: b.ID, BuffID: b.BuffID, Level: b.Level, Type: b.Type,
      StatType: b.StatType, ApplyingType: b.ApplyingType, Value: b.Value,
      BuffConditionType: b.BuffConditionType, BuffConditionValue: b.BuffConditionValue,
      TargetType: b.TargetType, TargetSkillType: b.TargetSkillType,
      CallerSkillType: b.CallerSkillType, BuffCreateType: b.BuffCreateType,
    })),
  })
  return [...awakening, ...charSkill]
}

// ── Obs schema (from /api/admin/damage-lab/observations) ──────────────────

interface SavedObservation {
  id: string
  ts: string
  charId: string
  charName: string
  charElement: string
  charClass: string
  charSubclass: string
  slot: CallerSlot
  skillLevel: number
  df: number
  atk: number
  chd: number
  pen: number
  dmgInc: number
  applyQuirks: boolean
  targetDef: number
  targetDmgRed: number
  targetCdmgRed: number
  isBoss: boolean
  elem: 'none' | 'adv' | 'disadv'
  crit: boolean
  obs: number
  extraStats?: Record<string, number>
  charFlags?: { umeActive?: boolean; sakuraActive?: boolean }
  targetHp?: number
  mode?: string
  monsterId?: string
  additionalAttack?: boolean
  additionalAttackRatio?: number
}

function buildContext(o: SavedObservation): RecomputeContext {
  return {
    charId:        o.charId,
    charElement:   o.charElement,
    charClass:     o.charClass,
    charSubclass:  o.charSubclass,
    slot:          o.slot,
    damageFactor:  o.df,
    additionalAttackRatio: o.additionalAttack ? o.additionalAttackRatio : undefined,
    atk:           o.atk,
    chd:           o.chd,
    pen:           o.pen,
    dmgInc:        o.dmgInc,
    applyQuirks:   o.applyQuirks,
    extraStats:    o.extraStats,
    targetDef:     o.targetDef,
    targetDmgRed:  o.targetDmgRed,
    targetCdmgRed: o.targetCdmgRed,
    targetHp:      o.targetHp,
    isBoss:        o.isBoss,
    elem:          o.elem,
    crit:          o.crit,
    mode:          o.mode,
    monsterId:     o.monsterId,
    charFlags:     o.charFlags,
  }
}

// ── Run ──────────────────────────────────────────────────────────────────

const allBuffs = buildAllBuffs()
console.log(`Loaded ${allBuffs.length} ApplicableBuff entries from the datamine.\n`)

const lines = fs.readFileSync(
  path.join(process.cwd(), 'data', 'admin', 'damage-lab-observations.jsonl'),
  'utf-8',
).split('\n').filter(Boolean)
const observations: SavedObservation[] = lines.map(l => JSON.parse(l))

console.log(`Replaying ${observations.length} obs through the v2 pipeline.\n`)
console.log(`${'#'.padStart(2)}  ${'caster'.padEnd(20)}  ${'slot'.padEnd(4)}  ${'crit'.padEnd(4)}  ${'monster'.padEnd(10)}  ${'obs'.padStart(7)}  ${'calc'.padStart(7)}  ${'ratio'.padStart(6)}  status`)
console.log('-'.repeat(95))

let pass = 0
let fail = 0
const regressions: { idx: number; label: string; ratio: number }[] = []

observations.forEach((o, idx) => {
  const ctx = buildContext(o)
  const result = recompute(ctx, allBuffs)
  const calc = result.calculated
  const ratio = calc / o.obs
  const inEnvelope = ratio >= 0.85 && ratio <= 1.15
  const inTight    = ratio >= 0.95 && ratio <= 1.05
  const status = inTight ? 'tight' : inEnvelope ? 'wide' : 'FAIL'

  if (inEnvelope) pass++
  else {
    fail++
    regressions.push({ idx, label: `${o.charName} ${o.slot}`, ratio })
  }

  const monsterShort = o.monsterId?.startsWith('40760') ? 'Amadeus'
    : o.monsterId?.startsWith('40130') ? 'Ars Nova'
    : o.monsterId ?? '—'

  console.log(
    `${String(idx + 1).padStart(2)}  ${o.charName.padEnd(20)}  ${o.slot.padEnd(4)}  ${String(o.crit).padEnd(4)}  ${monsterShort.padEnd(10)}  ${String(o.obs).padStart(7)}  ${String(calc).padStart(7)}  ${ratio.toFixed(3).padStart(6)}  ${status}`,
  )
})

console.log('\n' + '='.repeat(95))
console.log(`${observations.length} obs replayed — ${pass} within ±15%, ${fail} outside.`)

if (regressions.length > 0) {
  console.log('\n⚠ REGRESSIONS (ratio outside [0.85, 1.15]):')
  for (const r of regressions) {
    console.log(`  ✗ obs #${r.idx + 1} ${r.label}: ratio ${r.ratio.toFixed(3)}`)
  }
  process.exit(1)
}

console.log('\nNo regressions detected.')
