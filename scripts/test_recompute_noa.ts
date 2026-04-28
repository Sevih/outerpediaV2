/**
 * End-to-end recompute test for Noa S2 obs #10.
 * Loads the full buffs from the API and runs `recompute()` with f64 vs f32.
 */
import { recompute } from '../src/lib/damage/recompute'
import type { ApplicableBuff } from '../src/lib/damage/buffs'

async function main() {
  const res = await fetch('http://localhost:3000/api/admin/damage-lab/buffs')
  const data = await res.json() as { buffs: ApplicableBuff[] }
  const allBuffs = data.buffs

  const baseCtx = {
    charId: '2000022', charElement: 'Earth', charClass: 'Striker', charSubclass: 'Attacker',
    atk: 4585, chd: 208, pen: 0, dmgInc: 0,
    applyQuirks: true, extraStats: { ST_HP: 6886 },
    // GAME runtime values (int-truncated by CalcStat → fcvtms): DR = 29 per-mille = 2.9%
    targetDef: 688, targetDmgRed: 2.9, targetCdmgRed: 0,
    targetHp: 22453, isBoss: true, elem: 'none' as const, crit: true,
    mode: 'DM_RAID_2',
  }

  // Test 3 obs back-to-back: S1 (#9), S2 (#10), and S3 (#11) — all same Amadeus St2.
  const obsList = [
    { label: '#9 S1 crit',  slot: 'S1' as const, df: 1900, expectedObs: 12133 },
    { label: '#10 S2 crit', slot: 'S2' as const, df: 1340, expectedObs: 10995 },
    { label: '#11 S3 crit', slot: 'S3' as const, df: 1800, expectedObs: 11494 },
  ]

  for (const ob of obsList) {
    const ctx = { ...baseCtx, slot: ob.slot, damageFactor: ob.df }
    console.log(`\n${'='.repeat(70)}\n${ob.label}  (DF=${ob.df}, slot=${ob.slot})`)
  for (const f32 of [false, true]) {
    const r = recompute({ ...ctx, f32arithmetic: f32 }, allBuffs)
    const mode = f32 ? 'f32' : 'f64'
    console.log(`\n=== ${mode} ===`)
    console.log(`  poolPct (from reducer): ${r.reduced.poolPct}`)
    console.log(`  addAtkNoPool:           ${r.reduced.addAtkNoPool}`)
    console.log(`  addAtkNoPoolPermille:   ${r.reduced.addAtkNoPoolPermille}`)
    console.log(`  mod:                    ${r.breakdown.mod}`)
    console.log(`  mit:                    ${r.breakdown.mitigation}`)
    console.log(`  mainCalc:               ${r.breakdown.mainCalc}`)
    console.log(`  extraCalc:              ${r.breakdown.extraCalc}`)
    console.log(`  total:                  ${r.calculated}  (rounded: ${Math.floor(r.calculated)})`)
    console.log(`  obs:                    ${ob.expectedObs}`)
    console.log(`  Δ:                      ${(Math.floor(r.calculated) - ob.expectedObs)} (${((Math.floor(r.calculated) - ob.expectedObs) / ob.expectedObs * 100).toFixed(3)}%)`)
  }
  }
}

main().catch(e => { console.error(e); process.exit(1) })
