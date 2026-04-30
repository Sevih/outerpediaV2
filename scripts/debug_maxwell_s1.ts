/**
 * Debug trace for Maxwell S1 on Amadeus St3 — isolates the +3 overshoot
 * (calc 2789 vs in-game 2786). Replays test #2 with the full f32 trace.
 */
import fs from 'node:fs'
import path from 'node:path'
import { recompute, type RecomputeContext } from '../src/lib/damage/v2/recompute'
import { extractAwakeningBuffs, extractCharSkillBuffs } from '../src/lib/damage/v2/extract-buffs'
import type { ApplicableBuff } from '../src/lib/damage/v2/buffs'

const J = path.join(process.cwd(), 'data', 'admin', 'json2')
const load = (f: string) => JSON.parse(fs.readFileSync(path.join(J, f), 'utf-8'))

type Row = Record<string, string | undefined>
const nodes = load('CharacterAwakeningNodeTemplet.json')
const lvls  = load('CharacterAwakeningLevelTemplet.json')
const buffs = load('BuffTemplet.json')
const chars = load('CharacterTemplet.json')
const skl   = load('CharacterSkillLevelTemplet.json')
const text  = load('TextSystem.json')
const ts = new Map<string, { English: string }>()
for (const t of text) if ((t as Row).ID) ts.set((t as Row).ID!, { English: (t as Row).English ?? '' })

const all: ApplicableBuff[] = [
  ...extractAwakeningBuffs({ nodes, levels: lvls, buffs, textSystem: ts }),
  ...extractCharSkillBuffs({
    characters: chars.filter((r: Row) => r.ID).map((r: Row) => r as { ID: string } & Row),
    skillLevels: skl.filter((r: Row) => r.SkillID).map((r: Row) => ({ SkillID: r.SkillID!, SkillLevel: r.SkillLevel ?? '0', BuffID: r.BuffID })),
    buffs: buffs.map((b: Row) => ({
      ID: b.ID, BuffID: b.BuffID, Level: b.Level, Type: b.Type, StatType: b.StatType,
      ApplyingType: b.ApplyingType, Value: b.Value, BuffConditionType: b.BuffConditionType,
      BuffConditionValue: b.BuffConditionValue, TargetType: b.TargetType,
      TargetSkillType: b.TargetSkillType, CallerSkillType: b.CallerSkillType,
      BuffCreateType: b.BuffCreateType,
    })),
  }),
]

// Test 2 — Maxwell S1 on Amadeus St3 lv35
const ctx: RecomputeContext = {
  charId: '2000028',
  charElement: 'Dark', charClass: 'Mage', charSubclass: 'Wizard',
  slot: 'S1', damageFactor: 1190,
  atk: 2095, chd: 180, pen: 0, dmgInc: 2,
  applyQuirks: true,
  extraStats: { ST_HP: 5926, ST_DEF: 1108, ST_CRITICAL_RATE: 21, ST_CRITICAL_DMG_RATE: 180, ST_PIERCE_POWER_RATE: 0, ST_BUFF_CHANCE: 120, ST_BUFF_RESIST: 100 },
  targetDef: 793, targetDmgRed: 3.4, targetCdmgRed: 0,
  targetHp: 26347,
  isBoss: true, elem: 'none', crit: false,
  mode: 'DM_RAID_2',
  monsterId: '407600952',
  ownerHpRate: 1, targetHpRate: 1, casterHpRate: 1,
  enemyTeamDecreaseCount: 3,
}

const r = recompute(ctx, all)
console.log('=== Maxwell S1 on Amadeus — test #2 ===')
console.log(`obs:  2786`)
console.log(`calc: ${r.calculated} (Δ +${r.calculated - 2786})`)
console.log()

console.log('--- Active buffs that contributed ---')
for (const b of r.reduced.active) {
  const tgt = b.effect.target === 'pool_cond' ? `pool[${b.effect.poolCond}]` : b.effect.target
  const u = b.effect.unit === 'permille' ? '‰' : b.effect.unit === '%' ? '%' : ''
  console.log(`  ${b.id.padEnd(40)} ${tgt.padEnd(20)} ${b.effect.amount}${u}`)
}
console.log()

console.log('--- Reduced totals ---')
console.log(`  poolPct           : ${r.reduced.poolPct}`)
console.log(`  atkBonusFlat/Pct  : ${r.reduced.atkBonusFlat} / ${r.reduced.atkBonusPct}`)
console.log(`  chdBonus / penBon : ${r.reduced.chdBonus} / ${r.reduced.penBonus}`)
console.log(`  monsterEff‰/Res‰ : ${r.reduced.monsterEffPermille} / ${r.reduced.monsterResPermille}`)
console.log(`  mainAtk           : ${r.reduced.mainAtk}`)
console.log()

console.log('--- Reducer trace ---')
for (const s of r.reduced.debugSteps) {
  const note = s.note ? ` — ${s.note}` : ''
  console.log(`  [reducer] ${s.label}: ${s.value}${note}`)
}
console.log()

console.log('--- Formula trace ---')
for (const s of r.breakdown.debugSteps) {
  const note = s.note ? ` — ${s.note}` : ''
  console.log(`  [formula] ${s.label}: ${s.value}${note}`)
}
console.log()

console.log('--- Breakdown ---')
console.log(`  rate (post-cap) : ${r.breakdown.rate}`)
console.log(`  rateRaw         : ${r.breakdown.rateRaw}`)
console.log(`  mitigation      : ${r.breakdown.mitigation}`)
console.log(`  elemMult        : ${r.breakdown.elemMult}`)
console.log(`  poolPct         : ${r.breakdown.poolPct}`)
console.log(`  mainCalc        : ${r.breakdown.mainCalc}`)
console.log(`  additionalCalc  : ${r.breakdown.additionalCalc}`)
