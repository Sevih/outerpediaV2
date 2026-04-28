/**
 * Final E2E test: run recompute() on every Noa obs and report Δ vs game.
 * Uses Math.floor (= binary's fcvtms) for the displayed calc.
 */
import fs from 'fs'
import { recompute } from '../src/lib/damage/recompute'
import type { ApplicableBuff } from '../src/lib/damage/buffs'

interface Obs {
  id: string; charId: string; charName: string; charElement: string; charClass: string; charSubclass: string
  slot: 'S1'|'S2'|'S3'; skillLevel: number; df: number; atk: number; chd: number; pen: number; dmgInc: number
  applyQuirks: boolean; extraStats?: Record<string, number>; charFlags?: { umeActive?: boolean; sakuraActive?: boolean }
  targetDef: number; targetDmgRed: number; targetCdmgRed: number; targetHp?: number
  isBoss: boolean; elem: 'none'|'adv'|'disadv'; crit: boolean
  obs: number; mode?: string; stageId?: string; stageName?: string; additionalAttack?: boolean; additionalAttackRatio?: number
}

async function main() {
  const res = await fetch('http://localhost:3000/api/admin/damage-lab/buffs')
  const data = await res.json() as { buffs: ApplicableBuff[] }
  const allBuffs = data.buffs

  const path = 'C:/Users/Sevih/Documents/Projet perso/outerpedia-v2/data/admin/damage-lab-observations.jsonl'
  const lines = fs.readFileSync(path, 'utf-8').split('\n').filter(l => l.trim())
  const obsList: Obs[] = lines.map(l => JSON.parse(l) as Obs)

  console.log('='.repeat(106))
  console.log(`${'id'.padEnd(28)} ${'stage'.padEnd(16)} ${'slot'.padEnd(4)} ${'crit'.padEnd(5)} ${'mode'.padEnd(4)} ${'obs'.padStart(7)} ${'calc'.padStart(7)} ${'Δ'.padStart(5)} ${'%'.padStart(7)}`)
  console.log('='.repeat(106))

  for (const o of obsList) {
    for (const f32 of [false, true]) {
      const ctx = {
        charId: o.charId, charElement: o.charElement, charClass: o.charClass, charSubclass: o.charSubclass,
        slot: o.slot, damageFactor: o.df,
        atk: o.atk, chd: o.chd, pen: o.pen, dmgInc: o.dmgInc, applyQuirks: o.applyQuirks,
        extraStats: o.extraStats, charFlags: o.charFlags,
        targetDef: o.targetDef, targetDmgRed: o.targetDmgRed, targetCdmgRed: o.targetCdmgRed, targetHp: o.targetHp,
        isBoss: o.isBoss, elem: o.elem, crit: o.crit,
        mode: o.mode, additionalAttackRatio: o.additionalAttackRatio,
        f32arithmetic: f32,
      }
      const r = recompute(ctx, allBuffs)
      const calc = Math.floor(r.calculated)
      const delta = calc - o.obs
      void (o.obs / r.calculated)
      const idShort = o.id.slice(-12)
      const stageShort = (o.stageName || '').slice(0, 16)
      console.log(`${idShort.padEnd(28)} ${stageShort.padEnd(16)} ${o.slot.padEnd(4)} ${String(o.crit).padEnd(5)} ${(f32?'f32':'f64').padEnd(4)} ${String(o.obs).padStart(7)} ${String(calc).padStart(7)} ${(delta>=0?'+':'')+delta} ${((delta/o.obs)*100).toFixed(3).padStart(7)}`)
    }
  }
}

main().catch(e => { console.error(e); process.exit(1) })
