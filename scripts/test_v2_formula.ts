/**
 * Unit tests for `src/lib/damage/v2/{f32,formula}.ts`.
 *
 * Run with: npx tsx scripts/test_v2_formula.ts
 *
 * Validates:
 *   - .rodata constants match `Math.fround` of the documented f32 values
 *   - `interpolate` matches binary `CFormula.CalcStat` truncation behavior
 *   - `applyAdvantageRate` matches the binary `get_MaxHP` chain (Amadeus St2 spec)
 *   - `computeDamage` produces the expected integer damage on a curated set of
 *     simple cases (no buffs, single-modifier flips, rate cap, max(1) clamp).
 *
 * The fixtures here are unit-level — full pipeline obs validation (Noa S1/S2,
 * Stella, Maxwell etc.) lands in PR 6 once `recompute.ts` v2 wires the buffs
 * reducer.
 */

import assert from 'node:assert/strict'
import {
  RODATA, f, interpolate, applyAdvantageRate,
} from '../src/lib/damage/v2/f32'
import {
  computeDamage, type DamageInputs,
} from '../src/lib/damage/v2/formula'

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

// ── .rodata constants ────────────────────────────────────────────────────

test('PER_MILLE_POS = Math.fround(0.001)', () => {
  assert.strictEqual(RODATA.PER_MILLE_POS, Math.fround(0.001))
  assert.strictEqual(RODATA.PER_MILLE_POS, 0.0010000000474974513)
})

test('PER_MILLE_NEG = -Math.fround(0.001)', () => {
  assert.strictEqual(RODATA.PER_MILLE_NEG, -Math.fround(0.001))
})

test('MARKING = Math.fround(1.15)', () => {
  assert.strictEqual(RODATA.MARKING, Math.fround(1.15))
})

test('RATE_MIN = Math.fround(0.30)', () => {
  assert.strictEqual(RODATA.RATE_MIN, Math.fround(0.30))
})

test('ADV = Math.fround(1.20)', () => {
  assert.strictEqual(RODATA.ADV, Math.fround(1.20))
})

test('DISADV = Math.fround(0.80)', () => {
  assert.strictEqual(RODATA.DISADV, Math.fround(0.80))
})

test('f is alias for Math.fround', () => {
  assert.strictEqual(f, Math.fround)
})

// ── interpolate ──────────────────────────────────────────────────────────

test('interpolate(0, 100, 1) = 0 (early return min)', () => {
  assert.strictEqual(interpolate(0, 100, 1), 0)
})

test('interpolate(0, 100, 30) = 29 (binary int truncation)', () => {
  // From v1 stages route validation: drMax=100, lv 30 → game uses int 29
  // (= 2.9%), not float 29.29... — closes Δ=−1 → 0 on Noa S1/S3 obs.
  assert.strictEqual(interpolate(0, 100, 30), 29)
})

test('interpolate(0, 100, 50) = 49 (mid-scale truncation)', () => {
  assert.strictEqual(interpolate(0, 100, 50), 49)
})

test('interpolate(0, 100, 100) ≈ 100 (no upper cap, f32 rounding)', () => {
  // (max-min)/99 × 99 + 0 should round to 100 in f32; tolerate ±1 just in case.
  const r = interpolate(0, 100, 100)
  assert.ok(r === 99 || r === 100, `expected 99 or 100, got ${r}`)
})

test('interpolate(0, 100, 120) extrapolates past lv 100 (Joint Challenge)', () => {
  // 100/99 × 119 + 0 ≈ 120.20 → floor = 120. Validates the no-upper-cap policy.
  const r = interpolate(0, 100, 120)
  assert.ok(r === 119 || r === 120, `expected 119 or 120, got ${r}`)
})

test('interpolate(min=0, max=0, level=50) = 0 (constant stat)', () => {
  assert.strictEqual(interpolate(0, 0, 50), 0)
})

// ── applyAdvantageRate ───────────────────────────────────────────────────

test('applyAdvantageRate(stat, 0) = stat (no-op)', () => {
  assert.strictEqual(applyAdvantageRate(1000, 0), 1000)
})

test('applyAdvantageRate(52707, -574) = 22453 (Amadeus St2 spec §1)', () => {
  // Validated: floor(0.426 × 52707) = 22453, matches BT_DMG_TARGET_STAT read.
  assert.strictEqual(applyAdvantageRate(52707, -574), 22453)
})

test('applyAdvantageRate is monotonic in rate', () => {
  // Sanity: larger negative rate → smaller stat.
  const r0 = applyAdvantageRate(10000, 0)
  const rNeg = applyAdvantageRate(10000, -500)
  assert.ok(rNeg < r0, `expected ${rNeg} < ${r0}`)
})

// ── computeDamage: baseline (no buffs, no crit, no DR/PEN/DEF) ──────────

const baseline: DamageInputs = {
  atk: 1000,
  damageFactor: 1000,
  chdPct: 100,
  penPct: 0,
  dmgIncPct: 0,
  crit: false,
  def: 0,
  cdmgRedPct: 0,
  dmgRedPct: 0,
  isBoss: false,
  elem: 'none',
}

test('baseline: ATK=1000, DF=1000, no buffs → calc = 1000', () => {
  const r = computeDamage(baseline)
  assert.strictEqual(r.calculated, 1000)
  assert.strictEqual(r.mainCalc, 1000)
  assert.strictEqual(r.additionalCalc, 0)
  assert.strictEqual(r.rate, 1)
  assert.strictEqual(r.rateRaw, 1)
})

// ── computeDamage: single-modifier flips ─────────────────────────────────

test('crit chd=200 → rate=2.0, calc = 2000', () => {
  const r = computeDamage({ ...baseline, crit: true, chdPct: 200 })
  assert.strictEqual(r.rate, 2.0)
  assert.strictEqual(r.calculated, 2000)
})

test('elem=adv → ×1.20 (f32) → calc = 1200', () => {
  const r = computeDamage({ ...baseline, elem: 'adv' })
  assert.strictEqual(r.elemMult, RODATA.ADV)
  assert.strictEqual(r.calculated, 1200)
})

test('elem=disadv → ×0.80 → calc = 800', () => {
  const r = computeDamage({ ...baseline, elem: 'disadv' })
  assert.strictEqual(r.calculated, 800)
})

test('PEN/DEF mitigation: pen=50, def=2000 → mit=0.5, calc = 500', () => {
  const r = computeDamage({ ...baseline, penPct: 50, def: 2000 })
  assert.strictEqual(r.mitigation, 0.5)
  assert.strictEqual(r.calculated, 500)
})

test('marking ×1.15 (f32) → calc = 1150', () => {
  const r = computeDamage({ ...baseline, markingActive: true })
  assert.strictEqual(r.calculated, 1150)
})

test('finalReducePct=50 → ×0.5 → calc = 500', () => {
  const r = computeDamage({ ...baseline, finalReducePct: 50 })
  assert.strictEqual(r.calculated, 500)
})

test('skillFactor=500 (permille) → ×0.5 → calc = 500', () => {
  const r = computeDamage({ ...baseline, skillFactor: 500 })
  assert.strictEqual(r.calculated, 500)
})

test('dmgIncPct=30 → +30% pool → calc = 1300', () => {
  const r = computeDamage({ ...baseline, dmgIncPct: 30 })
  assert.strictEqual(r.calculated, 1300)
})

// ── computeDamage: pool aggregation ──────────────────────────────────────

test('targetStatPermille=300 → +30% pool → calc = 1300', () => {
  const r = computeDamage({ ...baseline, targetStatPermille: 300 })
  assert.strictEqual(r.calculated, 1300)
})

test('targetStatPermille capped at 1000', () => {
  // permille=5000 → capped to 1000 → contrib = 1.0 → rate = 2.0 → calc = 2000.
  const r = computeDamage({ ...baseline, targetStatPermille: 5000 })
  assert.strictEqual(r.calculated, 2000)
})

test('targetStatPermille truncates fractional value', () => {
  // permille=300.7 → trunc=300 → matches the 300 case.
  const r = computeDamage({ ...baseline, targetStatPermille: 300.7 })
  assert.strictEqual(r.calculated, 1300)
})

// ── computeDamage: rate cap (RATE_MIN) ───────────────────────────────────

test('rate cap fires at 0.30 when DR pushes rate below', () => {
  // chd 100 (no crit), DR=80% → rateRaw ≈ 0.20 < 0.30 → cap to RATE_MIN.
  const r = computeDamage({ ...baseline, dmgRedPct: 80 })
  assert.ok(r.rateRaw < RODATA.RATE_MIN, `expected rateRaw < 0.30, got ${r.rateRaw}`)
  assert.strictEqual(r.rate, RODATA.RATE_MIN)
  assert.strictEqual(r.calculated, 300)
})

test('rate cap NOT fired when rate >= 0.30', () => {
  // DR=50% → rateRaw = 0.50 ≥ 0.30 → no cap.
  const r = computeDamage({ ...baseline, dmgRedPct: 50 })
  assert.strictEqual(r.rate, r.rateRaw)
  assert.strictEqual(r.calculated, 500)
})

// ── computeDamage: max(1, ...) clamp ─────────────────────────────────────

test('max(1, floor(mc)) clamp on tiny damage', () => {
  // ATK=1, DF=1, DR=80% → mc tiny → floor=0 → clamp to 1.
  const r = computeDamage({ ...baseline, atk: 1, damageFactor: 1, dmgRedPct: 80 })
  assert.strictEqual(r.calculated, 1)
  assert.strictEqual(r.mainCalc, 1)
})

// ── computeDamage: additional attack ─────────────────────────────────────

test('additionalAttackDF=500 fires separate hit, full pool re-applied', () => {
  const r = computeDamage({ ...baseline, additionalAttackDF: 500 })
  assert.strictEqual(r.mainCalc, 1000)
  assert.strictEqual(r.additionalCalc, 500)
  assert.strictEqual(r.calculated, 1500)
})

test('additionalAttackDF inherits crit/elem/marking from main', () => {
  // crit chd=200 doubles the rate → main = 2000, additional = 1000 (DF×0.5).
  const r = computeDamage({ ...baseline, crit: true, chdPct: 200, additionalAttackDF: 500 })
  assert.strictEqual(r.mainCalc, 2000)
  assert.strictEqual(r.additionalCalc, 1000)
  assert.strictEqual(r.calculated, 3000)
})

// ── computeDamage: debug + quirks ────────────────────────────────────────

test('debugSteps always populated', () => {
  const r = computeDamage(baseline)
  assert.ok(r.debugSteps.length > 0, `expected non-empty debugSteps, got ${r.debugSteps.length}`)
  // Last step should be the final calculated trace.
  const last = r.debugSteps[r.debugSteps.length - 1]
  assert.strictEqual(last.value, r.calculated)
})

test('quirks lists crit / adv / DR when active', () => {
  const r = computeDamage({ ...baseline, elem: 'adv', crit: true, chdPct: 200, dmgRedPct: 30 })
  const names = r.quirks.map(q => q.name)
  assert.ok(names.includes('Crit base'),  `missing Crit base in [${names.join(', ')}]`)
  assert.ok(names.includes('Adv'),        `missing Adv in [${names.join(', ')}]`)
  assert.ok(names.includes('Target DR'),  `missing Target DR in [${names.join(', ')}]`)
})

test('quirks lists Rate cap when fired', () => {
  const r = computeDamage({ ...baseline, dmgRedPct: 80 })
  const names = r.quirks.map(q => q.name)
  assert.ok(names.includes('Rate cap'), `missing Rate cap in [${names.join(', ')}]`)
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
