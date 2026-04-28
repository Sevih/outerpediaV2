/**
 * Compare f64 vs f32-emulator on Noa S2 obs to see if the ARM f32 emulation
 * closes the residual.
 *
 * Run with: npx tsx scripts/test_f32_noa_s2.ts
 */
import { computeDamage, type DamageInputs } from '../src/lib/damage/formula'

interface NoaS2Obs {
  id: string
  obs: number
  atk: number
  chd: number
  df: number
  targetDef: number
  targetDmgRed: number
  targetCdmgRed: number
  targetHp: number
  crit: boolean
  isBoss: boolean
  // Noa is on Earth element, fighting Dark boss → Dark.adv = Light, Earth ≠ Light → 'none'
  // (we already validated elem='none' on the saved obs)
  // Awakening pool quirks bundled into dmgIncPct (boss +30 etc.) — tuned to match prod calc.
}

// Two saved Noa S2 obs (#8 and #10 in the JSONL)
const obsList: NoaS2Obs[] = [
  // #8: Stage 3, S2 crit
  { id: '#8 Amadeus St3 S2 crit', obs: 10735,
    atk: 4585, chd: 208, df: 1340,
    targetDef: 793, targetDmgRed: 3.4343434343434347, targetCdmgRed: 0,
    targetHp: 26347,
    crit: true, isBoss: true,
  },
  // #10: Stage 2, S2 crit
  { id: '#10 Amadeus St2 S2 crit', obs: 10995,
    atk: 4585, chd: 208, df: 1340,
    targetDef: 688, targetDmgRed: 2.9292929292929295, targetCdmgRed: 0,
    targetHp: 22453,
    crit: true, isBoss: true,
  },
]

// BT_DMG_TARGET_STAT for Noa S2: ST_HP, val=30 (per-mille = 3%)
// addAtkNoPoolPermille = trunc(targetHp × 30 / 1000) per binary GetStatValuePermille
// addAtkNoPool       = mainAtk × targetHp × 30 / 1_000_000 (legacy f64 model)

// Boss awakening: +30% pool (Awakening_Boss_Dmg_10).
// Plus any subclass/class quirks. We tune dmgIncPct to match the user's
// reported live calc of ~11008 for #10 (= +30% boss bonus only).
const dmgIncPct = 30

function buildInputs(o: NoaS2Obs, opts: { f32: boolean; useTargetStatPool: boolean }): DamageInputs {
  const targetStatPermille = Math.trunc(o.targetHp * 30 / 1000)
  const targetStatF64      = o.atk * o.targetHp * 30 / 1_000_000
  return {
    atk: o.atk,
    addAtkNoPool:           opts.useTargetStatPool ? 0 : targetStatF64,
    addAtkNoPoolPermille:   opts.useTargetStatPool ? targetStatPermille : 0,
    damageFactor: o.df,
    chdPct: o.chd,
    penPct: 0,
    dmgIncPct,
    crit: o.crit,
    def: o.targetDef,
    cdmgRedPct: o.targetCdmgRed,
    dmgRedPct: o.targetDmgRed,
    isBoss: o.isBoss,
    elem: 'none',
    f32arithmetic: opts.f32,
  }
}

console.log('Mode comparison on Noa S2 obs:')
console.log('='.repeat(96))
console.log(`${'obs'.padEnd(30)} ${'mode'.padEnd(28)} ${'calc'.padStart(8)} ${'obs'.padStart(8)} ${'Δ'.padStart(7)} ${'ratio'.padStart(7)}`)
console.log('-'.repeat(96))

for (const o of obsList) {
  for (const opts of [
    { f32: false, useTargetStatPool: false, label: 'f64 + addAtkNoPool (legacy)' },
    { f32: false, useTargetStatPool: true,  label: 'f64 + targetStatPool'        },
    { f32: true,  useTargetStatPool: false, label: 'f32 + addAtkNoPool'          },
    { f32: true,  useTargetStatPool: true,  label: 'f32 + targetStatPool (BIN)' },
  ]) {
    const inp = buildInputs(o, opts)
    const r = computeDamage(inp)
    const calc = Math.round(r.calculated)
    const delta = calc - o.obs
    const ratio = o.obs / r.calculated
    console.log(`${o.id.padEnd(30)} ${opts.label.padEnd(28)} ${String(calc).padStart(8)} ${String(o.obs).padStart(8)} ${(delta >= 0 ? '+' : '') + delta} ${ratio.toFixed(4).padStart(7)}`)
  }
  console.log('')
}
