/**
 * Unit tests for `src/lib/damage/v2/{buffs,extract-buffs}.ts`.
 *
 * Run with: npx tsx scripts/test_v2_extract_buffs.ts
 *
 * Validates:
 *   - Each BT_DMG_* buff type maps to the correct `EffectTarget` / `PoolCondition`
 *     per PR 4bis disas findings.
 *   - Type 94 (BT_DMG_ENEMY_TEAM_DECREASE) is properly isolated from type 103
 *     (BT_DMG_MY_TEAM_DECREASE) — different multiplier sources.
 *   - The reducer's `applyBuffs` dispatches each `PoolCondition` to the right
 *     BuffContext field.
 *   - Awakening BT_DMG / BT_DMG_TO_BOSS / Boss_*_Down extractions.
 */

import assert from 'node:assert/strict'
import {
  extractAwakeningBuffs, extractCharSkillBuffs,
} from '../src/lib/damage/v2/extract-buffs'
import {
  applyBuffs, type ApplicableBuff, type BuffContext,
} from '../src/lib/damage/v2/buffs'

let passed = 0
let failed = 0
const failures: { name: string; err: string }[] = []

function test(name: string, fn: () => void): void {
  try {
    fn()
    passed++
  } catch (e) {
    failed++
    failures.push({ name, err: e instanceof Error ? e.message : String(e) })
  }
}

// ── Fixture builders ─────────────────────────────────────────────────────

type Row = Record<string, string | undefined>

interface BuffSpec {
  id: string
  type: string
  stat?: string
  value: number
  cond?: string
  callerSkillType?: string
  createType?: string
  targetType?: string
}

function buffRow(spec: BuffSpec): Row {
  return {
    ID: spec.id,
    BuffID: spec.id,
    Level: '5',
    Type: spec.type,
    StatType: spec.stat ?? 'ST_NONE',
    ApplyingType: 'OAT_RATE',
    Value: String(spec.value),
    BuffConditionType: spec.cond ?? 'NONE',
    TargetType: spec.targetType ?? 'ME',
    CallerSkillType: spec.callerSkillType ?? 'SKT_ALL',
    BuffCreateType: spec.createType ?? 'PASSIVE',
  }
}

// Synthetic char with one skill on Skill_2 referencing one buff.
function charSkillFixture(charId: string, slotIdx: number, buffSpec: BuffSpec): {
  characters: ({ ID: string } & Row)[]
  skillLevels: { SkillID: string; SkillLevel: string; BuffID?: string }[]
  buffs: Row[]
} {
  const skillId = `${charId}_${slotIdx}`
  return {
    characters: [{
      ID: charId,
      [`Skill_${slotIdx}`]: skillId,
    } as { ID: string } & Row],
    skillLevels: [{
      SkillID: skillId,
      SkillLevel: '5',
      BuffID: buffSpec.id,
    }],
    buffs: [buffRow(buffSpec)],
  }
}

function extractOne(charId: string, slotIdx: number, buffSpec: BuffSpec): ApplicableBuff[] {
  const fx = charSkillFixture(charId, slotIdx, buffSpec)
  return extractCharSkillBuffs(fx)
}

// ── Char-skill extraction: direct pool types ────────────────────────────

test('BT_DMG ST_NONE → effect.target=pool', () => {
  const out = extractOne('test1', 2, { id: 'b1', type: 'BT_DMG', stat: 'ST_NONE', value: 300 })
  assert.strictEqual(out.length, 1)
  assert.strictEqual(out[0].effect.target, 'pool')
  assert.strictEqual(out[0].effect.amount, 30)  // 300 / 10 = 30%
})

test('BT_DMG_TO_BOSS ST_NONE → effect.target=pool, trigger.requires=boss', () => {
  const out = extractOne('test2', 2, { id: 'b2', type: 'BT_DMG_TO_BOSS', stat: 'ST_NONE', value: 200 })
  assert.strictEqual(out.length, 1)
  assert.strictEqual(out[0].effect.target, 'pool')
  assert.strictEqual(out[0].effect.amount, 20)
  assert.strictEqual(out[0].trigger.requires, 'boss')
})

// ── Char-skill extraction: scaling types ────────────────────────────────

test('BT_SWAP_STAT_ATTACK → scaling_swap with permille', () => {
  const out = extractOne('test3', 2, { id: 'b3', type: 'BT_SWAP_STAT_ATTACK', stat: 'ST_DEF', value: 1300 })
  assert.strictEqual(out[0].effect.target, 'scaling_swap')
  assert.strictEqual(out[0].effect.unit, 'permille')
  assert.strictEqual(out[0].effect.amount, 1300)
  assert.strictEqual(out[0].effect.statRef, 'ST_DEF')
})

test('BT_DMG_OWNER_STAT on flat stat (ST_HP) → scaling_add_flat', () => {
  const out = extractOne('test4', 2, { id: 'b4', type: 'BT_DMG_OWNER_STAT', stat: 'ST_HP', value: 30 })
  assert.strictEqual(out[0].effect.target, 'scaling_add_flat')
  assert.strictEqual(out[0].effect.statRef, 'ST_HP')
})

test('BT_DMG_OWNER_STAT on percent stat (ST_CRITICAL_RATE) → scaling_add_pct', () => {
  const out = extractOne('test5', 2, { id: 'b5', type: 'BT_DMG_OWNER_STAT', stat: 'ST_CRITICAL_RATE', value: 500 })
  assert.strictEqual(out[0].effect.target, 'scaling_add_pct')
  assert.strictEqual(out[0].effect.statRef, 'ST_CRITICAL_RATE')
})

test('BT_DMG_TARGET_STAT → scaling_target_stat (Noa S2 case)', () => {
  const out = extractOne('test6', 2, { id: 'b6', type: 'BT_DMG_TARGET_STAT', stat: 'ST_HP', value: 30 })
  assert.strictEqual(out[0].effect.target, 'scaling_target_stat')
  assert.strictEqual(out[0].effect.statRef, 'ST_HP')
  assert.strictEqual(out[0].effect.amount, 30)
})

// ── Char-skill extraction: pool_cond types (PR 4bis mapping) ────────────

const POOL_COND_CASES: { type: string; expectedCond: string }[] = [
  { type: 'BT_DMG_OWNER_LOST_HP_RATE',   expectedCond: 'owner_lost_hp' },
  { type: 'BT_DMG_TARGET_LOST_HP_RATE',  expectedCond: 'target_lost_hp' },
  { type: 'BT_DMG_OWNER_BUFF',           expectedCond: 'owner_buff' },
  { type: 'BT_DMG_TARGET_BUFF',          expectedCond: 'target_buff' },
  { type: 'BT_DMG_OWNER_DEBUFF',         expectedCond: 'owner_debuff' },
  { type: 'BT_DMG_TARGET_DEBUFF',        expectedCond: 'target_debuff' },
  { type: 'BT_DMG_TARGET_BREAK',         expectedCond: 'target_break' },
  { type: 'BT_DMG_KILL_COUNT_STACK',     expectedCond: 'kill_count_stack' },
  { type: 'BT_DMG_NOT_CRITICAL',         expectedCond: 'not_critical' },
  { type: 'BT_DMG_PVP_CONTENT',          expectedCond: 'pvp_content' },
  { type: 'BT_DMG_CASTER_LOST_HP_RATE',  expectedCond: 'caster_lost_hp' },
  { type: 'BT_DMG_OWNER_TEAM_BUFF',      expectedCond: 'team_buff' },
  { type: 'BT_DMG_MY_TEAM_DECREASE',     expectedCond: 'team_decrease' },
  { type: 'BT_DMG_ENEMY_TEAM_DECREASE',  expectedCond: 'enemy_team_decrease' },  // ← PR 4bis fix
  { type: 'BT_DMG_MONADGATE_CONTENT',    expectedCond: 'monadgate_content' },
  { type: 'BT_DMG_TOWER_CONTENT',        expectedCond: 'tower_content' },
]

for (const { type, expectedCond } of POOL_COND_CASES) {
  test(`${type} → poolCond=${expectedCond}`, () => {
    const out = extractOne(`testc-${type}`, 2, { id: `b-${type}`, type, stat: 'ST_NONE', value: 100 })
    assert.strictEqual(out.length, 1, `expected 1 buff for ${type}`)
    assert.strictEqual(out[0].effect.target, 'pool_cond')
    assert.strictEqual(out[0].effect.poolCond, expectedCond)
    assert.strictEqual(out[0].effect.amount, 10)  // 100 / 10
  })
}

// ── KEY SEPARATION: type 94 vs type 103 ──────────────────────────────────

test('Type 94 (ENEMY) and type 103 (MY) map to DIFFERENT poolConds', () => {
  // PR 4bis disasm of FindBuffEnemyTeamDecreaseDamageRate (VA 0x2639194) confirmed
  // that type 94 has a different multiplier source than type 103. v1 collapsed
  // both onto `team_decrease` — this regression test guards against re-collapse.
  const myDec    = extractOne('testM', 2, { id: 'bM', type: 'BT_DMG_MY_TEAM_DECREASE',    stat: 'ST_NONE', value: 100 })
  const enemyDec = extractOne('testE', 2, { id: 'bE', type: 'BT_DMG_ENEMY_TEAM_DECREASE', stat: 'ST_NONE', value: 100 })
  assert.notStrictEqual(
    myDec[0].effect.poolCond,
    enemyDec[0].effect.poolCond,
    'type 94 and type 103 must map to different poolConds (PR 4bis isolation)',
  )
  assert.strictEqual(myDec[0].effect.poolCond,    'team_decrease')
  assert.strictEqual(enemyDec[0].effect.poolCond, 'enemy_team_decrease')
})

// ── BT_STAT mapping ─────────────────────────────────────────────────────

test('BT_STAT ST_PIERCE_POWER_RATE → pen', () => {
  const out = extractOne('testS1', 2, { id: 'bS1', type: 'BT_STAT', stat: 'ST_PIERCE_POWER_RATE', value: 100 })
  assert.strictEqual(out[0].effect.target, 'pen')
  assert.strictEqual(out[0].effect.amount, 10)
})

test('BT_STAT ST_DMG_BOOST → pool (additive damage % channel)', () => {
  const out = extractOne('testS2', 2, { id: 'bS2', type: 'BT_STAT', stat: 'ST_DMG_BOOST', value: 200 })
  assert.strictEqual(out[0].effect.target, 'pool')
  assert.strictEqual(out[0].effect.amount, 20)
})

// ── CallerSlot resolution ───────────────────────────────────────────────

test('CallerSkillType=SKT_FIRST → callerSlots=[S1] (passive on Skill_2)', () => {
  // Permanent buff on Skill_2 with CallerSkillType=SKT_FIRST → fires only on S1.
  const fx = charSkillFixture('test7', 2, {
    id: 'b7', type: 'BT_DMG', stat: 'ST_NONE', value: 100,
    callerSkillType: 'SKT_FIRST', createType: 'PASSIVE',
  })
  const out = extractCharSkillBuffs(fx)
  assert.deepStrictEqual(out[0].trigger.callerSlots, ['S1'])
})

test('Combat-triggered buff on Skill_3 with SKT_ALL → callerSlots=[S3]', () => {
  // SKILL_START (combat-triggered) intersects host (S3) × CallerSkillType (all) → S3.
  const fx = charSkillFixture('test8', 3, {
    id: 'b8', type: 'BT_DMG', stat: 'ST_NONE', value: 200,
    callerSkillType: 'SKT_ALL', createType: 'SKILL_START',
  })
  const out = extractCharSkillBuffs(fx)
  assert.deepStrictEqual(out[0].trigger.callerSlots, ['S3'])
})

// ── Reducer: pool_cond dispatch ──────────────────────────────────────────

const baseCtx: BuffContext = {
  charId: 'X', charElement: 'Fire', charClass: 'Mage', charSubclass: 'WIZARD',
  slot: 'S2',
  isBoss: true, crit: false, elem: 'none',
  applyQuirks: true, inAdventureLicense: false,
  baseAtk: 1000,
  statValues: {},
}

function buildPoolCondBuff(charId: string, cond: string, amountPct: number): ApplicableBuff {
  return {
    id: `t:${cond}`,
    source: { kind: 'char_skill', charId, skillSlot: 2, buffId: `b-${cond}` },
    appliesTo: { kind: 'char', value: charId },
    effect: { target: 'pool_cond', unit: '%', amount: amountPct, poolCond: cond as never },
    trigger: { requires: 'always', callerSlots: 'all' },
  }
}

test('reducer: enemy_team_decrease uses enemyTeamDecreaseCount', () => {
  const buff = buildPoolCondBuff('X', 'enemy_team_decrease', 10)
  const result = applyBuffs([buff], { ...baseCtx, enemyTeamDecreaseCount: 3 })
  // 10% × 3 = 30%
  assert.strictEqual(result.poolPct, 30)
})

test('reducer: enemy_team_decrease defaults to 0 when count missing', () => {
  const buff = buildPoolCondBuff('X', 'enemy_team_decrease', 10)
  const result = applyBuffs([buff], baseCtx)
  assert.strictEqual(result.poolPct, 0)
})

test('reducer: team_decrease and enemy_team_decrease are independent', () => {
  // Same value, two different counts → must produce two different contributions.
  const myBuff    = buildPoolCondBuff('X', 'team_decrease',       10)
  const enemyBuff = buildPoolCondBuff('X', 'enemy_team_decrease', 10)
  const result = applyBuffs([myBuff, enemyBuff], {
    ...baseCtx,
    teamDecreaseCount: 1,
    enemyTeamDecreaseCount: 3,
  })
  // 10 × 1 + 10 × 3 = 40
  assert.strictEqual(result.poolPct, 40)
})

test('reducer: owner_lost_hp uses (1 - ownerHpRate)', () => {
  const buff = buildPoolCondBuff('X', 'owner_lost_hp', 100)  // +100% × (1 - hpRate)
  const result = applyBuffs([buff], { ...baseCtx, ownerHpRate: 0.5 })
  // 100 × (1 - 0.5) = 50
  assert.strictEqual(result.poolPct, 50)
})

test('reducer: target_break uses targetBroken bool', () => {
  const buff = buildPoolCondBuff('X', 'target_break', 50)
  const r1 = applyBuffs([buff], { ...baseCtx, targetBroken: true })
  const r0 = applyBuffs([buff], { ...baseCtx, targetBroken: false })
  assert.strictEqual(r1.poolPct, 50)
  assert.strictEqual(r0.poolPct, 0)
})

test('reducer: not_critical fires only when crit=false', () => {
  const buff = buildPoolCondBuff('X', 'not_critical', 30)
  const rNoCrit = applyBuffs([buff], { ...baseCtx, crit: false })
  const rCrit   = applyBuffs([buff], { ...baseCtx, crit: true })
  assert.strictEqual(rNoCrit.poolPct, 30)
  assert.strictEqual(rCrit.poolPct, 0)
})

// ── Reducer: scaling ────────────────────────────────────────────────────

test('reducer: scaling_swap replaces mainAtk with stat × permille / 1000', () => {
  const buff: ApplicableBuff = {
    id: 'swap', source: { kind: 'char_skill', charId: 'X', skillSlot: 2, buffId: 'bs' },
    appliesTo: { kind: 'char', value: 'X' },
    effect: { target: 'scaling_swap', unit: 'permille', amount: 1300, statRef: 'ST_DEF' },
    trigger: { requires: 'always', callerSlots: 'all' },
  }
  const ctx: BuffContext = { ...baseCtx, statValues: { ST_DEF: 2000 } }
  const result = applyBuffs([buff], ctx)
  // 2000 × 1300 / 1000 = 2600
  assert.strictEqual(result.mainAtk, 2600)
})

test('reducer: scaling_target_stat populates targetStatPermille', () => {
  // Noa S2: ST_HP val=30 (3% of target HP) — produces an int permille.
  const buff: ApplicableBuff = {
    id: 'tgt-stat', source: { kind: 'char_skill', charId: 'X', skillSlot: 2, buffId: 'bts' },
    appliesTo: { kind: 'char', value: 'X' },
    effect: { target: 'scaling_target_stat', unit: 'permille', amount: 30, statRef: 'ST_HP' },
    trigger: { requires: 'always', callerSlots: 'all' },
  }
  const ctx: BuffContext = { ...baseCtx, targetStatValues: { ST_HP: 22453 } }  // Amadeus St2
  const result = applyBuffs([buff], ctx)
  // floor(22453 × 30 / 1000) ≈ 673 (per spec §4 Noa S2 obs)
  assert.ok(Math.abs(result.targetStatPermille - 673) <= 1, `expected ~673, got ${result.targetStatPermille}`)
})

// ── Awakening extraction ────────────────────────────────────────────────

test('Awakening BT_DMG_TO_BOSS → pool with requires=boss + applies-to PVE', () => {
  const nodes: Row[] = [{
    ID: 'node-boss-dmg',
    AwakeningType: 'PVE',
    AwakeningLevelGroupID: 'g-boss-dmg',
    AwakeningApplyType: 'AAT_PVE',
    AwakeningApplyTypeValue: '0',
    NodeNameID: 'name-boss',
    NodeDescID: 'desc-boss',
  }]
  const levels: Row[] = [{
    AwakeningLevelGroupID: 'g-boss-dmg',
    AwakeningLevel: '10',
    OptionType: 'IOT_BUFF',
    BuffID: 'Awakening_Boss_Dmg_10',
  }]
  const buffs: Row[] = [buffRow({
    id: 'Awakening_Boss_Dmg_10', type: 'BT_DMG_TO_BOSS', stat: 'ST_NONE', value: 300,
  })]
  const textSystem = new Map([
    ['name-boss', { English: 'Boss DMG' }],
    ['desc-boss', { English: 'Increases damage to bosses by {0}' }],
  ])
  const out = extractAwakeningBuffs({ nodes, levels, buffs, textSystem })
  assert.strictEqual(out.length, 1)
  assert.strictEqual(out[0].effect.target, 'pool')
  assert.strictEqual(out[0].effect.amount, 30)
  assert.strictEqual(out[0].trigger.requires, 'boss')
  assert.strictEqual(out[0].source.kind, 'awakening')
  if (out[0].source.kind === 'awakening') {
    assert.strictEqual(out[0].source.group, 'PVE')
  }
})

test('Awakening Boss_*_Down → monster_res when ST_BUFF_RESIST', () => {
  const nodes: Row[] = [{
    ID: 'node-res-down',
    AwakeningType: 'PVE',
    AwakeningLevelGroupID: 'g-res-down',
    AwakeningApplyType: 'AAT_PVE',
    AwakeningApplyTypeValue: '0',
  }]
  const levels: Row[] = [{
    AwakeningLevelGroupID: 'g-res-down',
    AwakeningLevel: '10',
    OptionType: 'IOT_BUFF',
    BuffID: 'Awakening_Boss_Buff_RESIST_Down_10',
  }]
  const buffs: Row[] = [buffRow({
    id: 'Awakening_Boss_Buff_RESIST_Down_10',
    type: 'BT_STAT_PREMIUM', stat: 'ST_BUFF_RESIST', value: -200,
  })]
  const out = extractAwakeningBuffs({ nodes, levels, buffs, textSystem: new Map() })
  assert.strictEqual(out.length, 1)
  assert.strictEqual(out[0].effect.target, 'monster_res')
  assert.strictEqual(out[0].effect.amount, -20)
  assert.strictEqual(out[0].trigger.requires, 'boss')
})

test('Awakening BT_DMG cond=ATTACKER_ELEMENT_WIN → trigger.requires=adv', () => {
  const nodes: Row[] = [{
    ID: 'node-elem',
    AwakeningType: 'ELEMENTAL',
    AwakeningLevelGroupID: 'g-elem',
    AwakeningApplyType: 'AAT_ELEMENTAL',
    AwakeningApplyTypeValue: '2',  // Fire
  }]
  const levels: Row[] = [{
    AwakeningLevelGroupID: 'g-elem',
    AwakeningLevel: '10',
    OptionType: 'IOT_BUFF',
    BuffID: 'Awakening_Element_Dmg_10',
  }]
  const buffs: Row[] = [buffRow({
    id: 'Awakening_Element_Dmg_10', type: 'BT_DMG', stat: 'ST_NONE', value: 500,
    cond: 'ATTACKER_ELEMENT_WIN',
  })]
  const out = extractAwakeningBuffs({ nodes, levels, buffs, textSystem: new Map() })
  assert.strictEqual(out.length, 1)
  assert.strictEqual(out[0].effect.target, 'pool')
  assert.strictEqual(out[0].effect.amount, 50)
  assert.strictEqual(out[0].trigger.requires, 'adv')
  assert.strictEqual(out[0].appliesTo.kind, 'element')
  assert.strictEqual(out[0].appliesTo.value, 'Fire')
})

// ── Report ───────────────────────────────────────────────────────────────

const total = passed + failed
console.log(`\n${total} tests — ${passed} passed${failed > 0 ? `, ${failed} failed` : ''}`)
if (failed > 0) {
  console.log('\nFailures:')
  for (const f of failures) {
    console.log(`  ✗ ${f.name}\n    ${f.err}`)
  }
  process.exit(1)
}
