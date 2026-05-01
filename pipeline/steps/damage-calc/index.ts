import { buildChars } from './build-chars'

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
 * Sub-builders are independent and parallelizable. Add a new builder by
 * importing it here and pushing its promise into `tasks` — the orchestrator
 * stays trivial. Each builder owns its own output paths under
 * `public/damage-calc/<area>/`.
 */
export async function run(): Promise<string> {
  const tasks = [
    buildChars(),
    // future: buildBuffs(), buildMonsters(), buildTranscend()…
  ] as const

  const results = await Promise.all(tasks)
  const [chars] = results
  return `${chars.chars} chars (+${chars.details} details)`
}
