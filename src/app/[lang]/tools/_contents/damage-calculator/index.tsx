import {
  getDamageCalcCharManifest,
  getDamageCalcAwakeningBuffs,
  getDamageCalcMonsters,
  getDamageCalcMechanicsIndex,
  getDamageCalcTranscend,
  getDamageCalcEquipment,
} from '@/lib/data/damage-calc'
import CalculatorClient from './CalculatorClient'
import { loadObservations } from './_lib/load-observations'
import type { ObservationV2 } from './_lib/observations'

/**
 * Server-side data loader for the public damage calculator. Reads only the
 * "page-boot" payloads (manifest, awakening catalog, mechanics index,
 * transcend) — per-char detail (`chars/{id}.json`) and per-char buffs
 * (`buffs/{id}.json`) are fetched lazily by the client when the user picks
 * an attacker. Monsters list is loaded eagerly here for the target picker;
 * it's the heaviest single payload (~1 MB raw / ~250 KB gzipped) but the
 * picker is essential to first interaction so we pre-include it.
 *
 * Dev-only: also pulls the admin's observation log so the Result panel can
 * render a divergence table (our recompute vs. recorded calc value) — gated
 * on `NODE_ENV === 'development'` so the prod build never touches the file.
 */
export default async function DamageCalculatorTool() {
  const [manifest, awakening, monsters, mechanicsIndex, transcend, equipment] = await Promise.all([
    getDamageCalcCharManifest(),
    getDamageCalcAwakeningBuffs(),
    getDamageCalcMonsters(),
    getDamageCalcMechanicsIndex(),
    getDamageCalcTranscend(),
    getDamageCalcEquipment(),
  ])

  let observations: ObservationV2[] | null = null
  if (process.env.NODE_ENV === 'development') {
    try {
      observations = await loadObservations()
    } catch (err) {
      console.warn('[damage-calc] failed to load admin observations:', err)
    }
  }

  return (
    <CalculatorClient
      manifest={manifest}
      awakening={awakening}
      monsters={monsters}
      mechanicsIndex={mechanicsIndex}
      transcend={transcend}
      equipment={equipment}
      observations={observations}
    />
  )
}
