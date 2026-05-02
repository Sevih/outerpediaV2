import { existsSync } from 'fs'
import { INPUTS } from './shared'
import { buildChars } from './build-chars'
import { buildBuffs } from './build-buffs'
import { buildMonsters } from './build-monsters'
import { buildMechanics } from './build-mechanics'
import { buildTranscend } from './build-transcend'

/**
 * Damage calculator data bake — runs after `characters-index` + `character-stats`
 * (depends on their generated outputs) and writes runtime artifacts to
 * `public/damage-calc/`.
 *
 * The outputs are **committed** to the repo (not gitignored) because
 * `data/admin/json2/` ships only on dev/CI machines — prod can't regenerate
 * them. Builders must therefore stay diff-stable: no timestamps or other
 * non-deterministic content unless gated to a build flag.
 *
 * Same skip-on-missing-input pattern as `bytes-cache` and other dev-only
 * steps: when `data/admin/json2/` is absent (typical prod deploy), the
 * step returns a `skipped` message and the committed `public/damage-calc/`
 * artifacts continue to serve the runtime calculator.
 *
 * Sub-builders are independent and parallelizable. Add a new builder by
 * importing it here and pushing its promise into the `Promise.all` — the
 * orchestrator stays trivial. Each builder owns its own output paths under
 * `public/damage-calc/<area>/`.
 */
export async function run(): Promise<string> {
  if (!existsSync(INPUTS.json2)) {
    return 'skipped (no json2 datamine)'
  }

  const [chars, buffs, monsters, mechanics, transcend] = await Promise.all([
    buildChars(),
    buildBuffs(),
    buildMonsters(),
    buildMechanics(),
    buildTranscend(),
    // future: buildGearPassives()…
  ])
  return `${chars.chars} chars, ${buffs.charFiles} buff files, ${monsters.stages} stages, ${mechanics.withMechanics}/${mechanics.total} with mechanics, ${transcend.chars} transcend (${transcend.tiers} tiers)`
}
