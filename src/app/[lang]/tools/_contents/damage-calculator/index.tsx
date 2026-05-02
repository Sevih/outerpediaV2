import {
  getDamageCalcCharManifest,
  getDamageCalcAwakeningBuffs,
  getDamageCalcMonsters,
  getDamageCalcMechanicsIndex,
  getDamageCalcTranscend,
} from '@/lib/data/damage-calc'
import CalculatorClient from './CalculatorClient'

/**
 * Server-side data loader for the public damage calculator. Reads only the
 * "page-boot" payloads (manifest, awakening catalog, mechanics index,
 * transcend) — per-char detail (`chars/{id}.json`) and per-char buffs
 * (`buffs/{id}.json`) are fetched lazily by the client when the user picks
 * an attacker. Monsters list is loaded eagerly here for the target picker;
 * it's the heaviest single payload (~1 MB raw / ~250 KB gzipped) but the
 * picker is essential to first interaction so we pre-include it.
 */
export default async function DamageCalculatorTool() {
  const [manifest, awakening, monsters, mechanicsIndex, transcend] = await Promise.all([
    getDamageCalcCharManifest(),
    getDamageCalcAwakeningBuffs(),
    getDamageCalcMonsters(),
    getDamageCalcMechanicsIndex(),
    getDamageCalcTranscend(),
  ])

  return (
    <CalculatorClient
      manifest={manifest}
      awakening={awakening}
      monsters={monsters}
      mechanicsIndex={mechanicsIndex}
      transcend={transcend}
    />
  )
}
