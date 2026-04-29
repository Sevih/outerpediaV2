/**
 * Regression diff: v1 vs v2 monster stat computation.
 *
 * Run with: npx tsx scripts/test_v2_stats_regression.ts
 *
 * For each test case (monster, level, dungeon advantage):
 *   - v1 path: re-implements inline the exact chain from
 *     `src/app/api/admin/monsters/[id]/stats/route.ts` and
 *     `src/app/api/admin/damage-lab/stages/route.ts` (the two v1 routes that
 *     compute monster stats — they each have their own inline `interpolate` /
 *     `applyRate` and may diverge subtly).
 *   - v2 path: calls `resolveBaseStats` + `applyDungeonAdvantage` from
 *     `src/lib/damage/v2/stats.ts`.
 *
 * Reports any field-level shifts. The expected outcome is "no shifts" — both
 * v1 routes ultimately do `Math.floor(Math.fround(rate × int))` which equals
 * v2's `Math.floor` inside `applyAdvantageRate`. Any reported shift would be
 * a true behavioral divergence and should be investigated before PR 4 ships.
 *
 * The script also covers the lv 100 / lv 120 boundary cases — v1 stages route
 * has an `if (level >= 100) return max` upper cap; v1 monsters route does not.
 * v2 drops the cap (matches v1 monsters). This means at lv 100 the v2 result
 * MAY differ from v1 stages by ±1 unit due to f32 rounding (we report this as
 * an expected divergence, not a regression).
 */

import path from 'path'
import fs from 'fs'
import {
  resolveBaseStats,
  applyDungeonAdvantage,
  type AdvantageRates,
  type MonsterRow,
} from '../src/lib/damage/v2/stats'

// ── v1 logic re-implemented inline (verbatim from v1 routes) ─────────────

function v1_num(v: string | undefined): number {
  if (!v) return 0
  const p = parseInt(v, 10)
  return Number.isFinite(p) ? p : 0
}

// v1 monsters/[id]/stats route version — no upper cap.
function v1_monsters_interpolate(min: number, max: number, level: number): number {
  if (level <= 1) return min
  const diff = Math.fround(max - min)
  const div = Math.fround(diff / Math.fround(99))
  const mul = Math.fround(div * Math.fround(level - 1))
  const sum = Math.fround(mul + Math.fround(min))
  return Math.floor(sum)
}

// v1 stages route version — UPPER CAP at lv 100.
function v1_stages_interpolate(min: number, max: number, level: number): number {
  if (level <= 1) return min
  if (level >= 100) return max
  const diff = Math.fround(max - min)
  const div = Math.fround(diff / Math.fround(99))
  const mul = Math.fround(div * Math.fround(level - 1))
  const sum = Math.fround(mul + Math.fround(min))
  return Math.floor(sum)
}

// v1 monsters/[id]/stats route — does NOT floor inside applyRate; floors later.
function v1_monsters_applyRate(v: number, srPermille: number): number {
  if (srPermille === 0) return v
  const rate = Math.fround(Math.fround(1) + Math.fround(srPermille) * Math.fround(0.001))
  return Math.fround(rate * v)
}

// v1 stages route — floors inside applyAdvantageRate.
function v1_stages_applyAdvantageRate(baseStat: number, ratePermille: number): number {
  if (ratePermille === 0) return baseStat
  const rate = Math.fround(Math.fround(1) + Math.fround(ratePermille) * Math.fround(0.001))
  return Math.floor(Math.fround(rate * baseStat))
}

interface SimpleStats {
  atk: number
  def: number
  hp: number
}

// v1 monsters route — final stats for HP/ATK/DEF only (skip percent stats).
function v1_monsters_compute(row: MonsterRow, level: number, adv: AdvantageRates): SimpleStats {
  const atk = v1_monsters_interpolate(v1_num(row.Atk_Min), v1_num(row.Atk_Max), level)
  const def = v1_monsters_interpolate(v1_num(row.Def_Min), v1_num(row.Def_Max), level)
  const hp  = v1_monsters_interpolate(v1_num(row.HP_Min),  v1_num(row.HP_Max),  level)
  return {
    atk: Math.floor(v1_monsters_applyRate(atk, adv.atk)),
    def: Math.floor(v1_monsters_applyRate(def, adv.def)),
    hp:  Math.floor(v1_monsters_applyRate(hp,  adv.hp)),
  }
}

// v1 stages route — only ATK/DEF/HP surfaced, identical chain otherwise.
function v1_stages_compute(row: MonsterRow, level: number, adv: AdvantageRates): SimpleStats {
  const atk = v1_stages_interpolate(v1_num(row.Atk_Min), v1_num(row.Atk_Max), level)
  const def = v1_stages_interpolate(v1_num(row.Def_Min), v1_num(row.Def_Max), level)
  const hp  = v1_stages_interpolate(v1_num(row.HP_Min),  v1_num(row.HP_Max),  level)
  return {
    atk: v1_stages_applyAdvantageRate(atk, adv.atk),
    def: v1_stages_applyAdvantageRate(def, adv.def),
    hp:  v1_stages_applyAdvantageRate(hp,  adv.hp),
  }
}

// v2 path
function v2_compute(row: MonsterRow, level: number, adv: AdvantageRates): SimpleStats {
  const base = resolveBaseStats(row, level)
  const final = applyDungeonAdvantage(base, adv)
  return { atk: final.atk, def: final.def, hp: final.hp }
}

// ── Test cases ───────────────────────────────────────────────────────────

interface TestCase {
  label: string
  monsterId: string
  level: number
  advantage: AdvantageRates
  // When true, this case exercises lv ≥ 100 — v1 stages caps to Max, v1
  // monsters / v2 extrapolate. The v1-stages divergence is documented but not
  // a regression.
  highLevelExpectedDivergence?: boolean
}

const TESTS: TestCase[] = [
  // 1. Amadeus boss family — heavy negative HP advantage
  { label: 'Amadeus 4076009 lv 30, no dungeon',
    monsterId: '4076009', level: 30, advantage: { atk: 0, def: 0, hp: 0, spd: 0 } },
  { label: 'Amadeus 4076009 lv 30, dungeon 100201 (sr_atk=-885, sr_hp=-723)',
    monsterId: '4076009', level: 30, advantage: { atk: -885, def: 0, hp: -723, spd: 0 } },

  // 2. Amadeus stage 9-12 dungeon advantage
  { label: 'Amadeus 4076009 lv 35, dungeon 100912 (sr_atk=-704, sr_hp=-473)',
    monsterId: '4076009', level: 35, advantage: { atk: -704, def: 0, hp: -473, spd: 0 } },

  // 3. Boundary: lv 100 (v1 stages early-returns max, v1 monsters / v2 compute)
  { label: 'Amadeus 4076009 lv 100, no dungeon (boundary)',
    monsterId: '4076009', level: 100, advantage: { atk: 0, def: 0, hp: 0, spd: 0 },
    highLevelExpectedDivergence: true },

  // 4. Extrapolation past lv 100 (Joint Challenge content)
  { label: 'Amadeus 4076009 lv 120, no dungeon (extrapolation)',
    monsterId: '4076009', level: 120, advantage: { atk: 0, def: 0, hp: 0, spd: 0 },
    highLevelExpectedDivergence: true },

  // 5. Tower mode — different dungeon advantage profile
  { label: 'Tower 401100190 lv 20, dungeon 40101001 (sr_atk=-767, sr_hp=-693)',
    monsterId: '401100190', level: 20, advantage: { atk: -767, def: 0, hp: -693, spd: 0 } },

  // 6. Boss alt: 4013072 (Irregular Chase boss)
  { label: 'Boss 4013072 lv 50, no dungeon',
    monsterId: '4013072', level: 50, advantage: { atk: 0, def: 0, hp: 0, spd: 0 } },

  // 7. Low level (lv 1)
  { label: 'Amadeus 4076009 lv 1 (early return min)',
    monsterId: '4076009', level: 1, advantage: { atk: 0, def: 0, hp: 0, spd: 0 } },

  // 8. With positive advantage (rare but exists)
  { label: 'Tower 401101390 lv 25, dungeon 40101006 (sr_def=+4)',
    monsterId: '401101390', level: 25, advantage: { atk: -737, def: 4, hp: -616, spd: 0 } },

  // 9. Mid level, mid advantage
  { label: 'Amadeus 4076009 lv 50, dungeon 100912',
    monsterId: '4076009', level: 50, advantage: { atk: -704, def: 0, hp: -473, spd: 0 } },

  // 10. Random boss for breadth
  { label: 'Boss 407600950 lv 60, mid dungeon',
    monsterId: '407600950', level: 60, advantage: { atk: -500, def: 0, hp: -500, spd: 0 } },
]

// ── Run ──────────────────────────────────────────────────────────────────

const monsterPath = path.join(process.cwd(), 'data', 'admin', 'json2', 'MonsterTemplet.json')
const monsters: MonsterRow[] = JSON.parse(fs.readFileSync(monsterPath, 'utf-8'))

function findRow(id: string): MonsterRow | null {
  return monsters.find(r => r.ID === id) ?? null
}

interface Diff {
  field: 'atk' | 'def' | 'hp'
  v1: number
  v2: number
  delta: number
}

function diff(a: SimpleStats, b: SimpleStats): Diff[] {
  const fields: ('atk' | 'def' | 'hp')[] = ['atk', 'def', 'hp']
  const out: Diff[] = []
  for (const f of fields) {
    if (a[f] !== b[f]) out.push({ field: f, v1: a[f], v2: b[f], delta: b[f] - a[f] })
  }
  return out
}

function fmtDiffs(diffs: Diff[]): string {
  return diffs.map(d => `${d.field}: v1=${d.v1} v2=${d.v2} (Δ ${d.delta > 0 ? '+' : ''}${d.delta})`).join(', ')
}

let v1MonstersMatched = 0
let v1MonstersDiffered = 0
let v1StagesMatched = 0
let v1StagesDiffered = 0
const expectedDivergences: { case: string; vsMonsters: Diff[]; vsStages: Diff[] }[] = []
const realRegressions: { case: string; vsMonsters: Diff[]; vsStages: Diff[] }[] = []

console.log('Regression diff: v1 vs v2 monster stats')
console.log('='.repeat(110))

for (const tc of TESTS) {
  const row = findRow(tc.monsterId)
  if (!row) {
    console.log(`✗ ${tc.label} — MONSTER NOT FOUND: ${tc.monsterId}`)
    continue
  }

  const v1m = v1_monsters_compute(row, tc.level, tc.advantage)
  const v1s = v1_stages_compute(row, tc.level, tc.advantage)
  const v2  = v2_compute(row, tc.level, tc.advantage)

  const diffsM = diff(v1m, v2)
  const diffsS = diff(v1s, v2)

  if (diffsM.length === 0) v1MonstersMatched++
  else                     v1MonstersDiffered++
  if (diffsS.length === 0) v1StagesMatched++
  else                     v1StagesDiffered++

  const status =
    diffsM.length === 0 && diffsS.length === 0 ? '✓'
    : tc.highLevelExpectedDivergence ? '~'
    : '✗'

  console.log(`${status} ${tc.label}`)
  console.log(`    v2:        atk=${v2.atk} def=${v2.def} hp=${v2.hp}`)
  if (diffsM.length > 0) {
    console.log(`    v1mon Δ:   ${fmtDiffs(diffsM)}`)
  }
  if (diffsS.length > 0) {
    console.log(`    v1stages Δ: ${fmtDiffs(diffsS)}`)
  }

  if (diffsM.length > 0 || diffsS.length > 0) {
    const entry = { case: tc.label, vsMonsters: diffsM, vsStages: diffsS }
    if (tc.highLevelExpectedDivergence) expectedDivergences.push(entry)
    else realRegressions.push(entry)
  }
}

// ── Summary ──────────────────────────────────────────────────────────────

console.log('\n' + '='.repeat(110))
console.log(`Compared ${TESTS.length} cases against both v1 routes.`)
console.log(`  v2 vs v1 monsters: ${v1MonstersMatched} match, ${v1MonstersDiffered} differ`)
console.log(`  v2 vs v1 stages:   ${v1StagesMatched} match, ${v1StagesDiffered} differ`)

if (expectedDivergences.length > 0) {
  console.log(`\nExpected divergences (lv ≥ 100, v1 stages caps to Max):`)
  for (const e of expectedDivergences) {
    console.log(`  ~ ${e.case}`)
    if (e.vsStages.length > 0) console.log(`      vs stages: ${fmtDiffs(e.vsStages)}`)
    if (e.vsMonsters.length > 0) console.log(`      vs monsters: ${fmtDiffs(e.vsMonsters)}`)
  }
}

if (realRegressions.length > 0) {
  console.log(`\n⚠ REAL REGRESSIONS (unexpected v2 vs v1 divergence):`)
  for (const r of realRegressions) {
    console.log(`  ✗ ${r.case}`)
    if (r.vsMonsters.length > 0) console.log(`      vs monsters: ${fmtDiffs(r.vsMonsters)}`)
    if (r.vsStages.length > 0)   console.log(`      vs stages: ${fmtDiffs(r.vsStages)}`)
  }
  process.exit(1)
}

console.log('\nNo unexpected regressions.')
process.exit(0)
