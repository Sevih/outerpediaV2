// Loads and caches the editable JSON rule files used by the classifier.
// These rules are side-input to the pipeline: behavior is controlled from
// data files under `rules/` rather than hardcoded in the classifier.

import fs from 'fs'
import path from 'path'

// Rule files live alongside this source module. We resolve from `process.cwd()`
// (project root) rather than `__dirname` because Next.js bundles server code
// and `__dirname` does not point to the original source directory at runtime.
const RULES_DIR = path.join(
  process.cwd(),
  'src',
  'app',
  'api',
  'admin',
  'extractor-v3',
  '_shared',
  'effects',
  'rules'
)

export type ForcedOverride = {
  buff?: string[]
  debuff?: string[]
  removeBuff?: string[]
  removeDebuff?: string[]
}

export type ForcedOverrides = Record<string, Record<string, ForcedOverride>>

type TooltipBlacklistFile = {
  ranges?: [number, number][]
  ids?: string[]
}

type CachedRules = {
  labelBlacklist: Set<string>
  tooltipBlacklist: Set<string>
  forcedOverrides: ForcedOverrides
  /** Synonym → canonical label mapping (applied after label derivation). */
  aliases: Map<string, string>
  /**
   * Labels whose buff/debuff side is forced regardless of BuffTemplet's
   * own BuffDebuffType/TargetType classification.
   */
  forceSide: Map<string, 'buff' | 'debuff'>
}

let cache: CachedRules | null = null

function readJson<T>(file: string): T {
  return JSON.parse(fs.readFileSync(path.join(RULES_DIR, file), 'utf-8'))
}

function expandTooltipBlacklist(raw: TooltipBlacklistFile): Set<string> {
  const set = new Set<string>()
  for (const [from, to] of raw.ranges ?? []) {
    for (let i = from; i <= to; i++) set.add(String(i))
  }
  for (const id of raw.ids ?? []) set.add(id)
  return set
}

export function loadEffectRules(): CachedRules {
  if (cache) return cache
  const blacklist = readJson<string[]>('blacklist.json')
  const tooltipBl = readJson<TooltipBlacklistFile>('tooltip-blacklist.json')
  const forced = readJson<ForcedOverrides>('forced-overrides.json')
  const aliases = readJson<Record<string, string>>('aliases.json')
  const forceSideRaw = readJson<{ buff?: string[]; debuff?: string[] }>('force-side.json')
  // Strip comment keys (JSON files use `_comment` for documentation)
  delete (forced as Record<string, unknown>)._comment
  delete (aliases as Record<string, unknown>)._comment
  delete (forceSideRaw as Record<string, unknown>)._comment
  const forceSide = new Map<string, 'buff' | 'debuff'>()
  for (const l of forceSideRaw.buff ?? []) forceSide.set(l, 'buff')
  for (const l of forceSideRaw.debuff ?? []) forceSide.set(l, 'debuff')
  cache = {
    labelBlacklist: new Set(blacklist),
    tooltipBlacklist: expandTooltipBlacklist(tooltipBl),
    forcedOverrides: forced,
    aliases: new Map(Object.entries(aliases)),
    forceSide,
  }
  return cache
}

/** Force a reload on next call — useful for admin reload endpoints. */
export function clearEffectRulesCache(): void {
  cache = null
}

// Bundle reload marker: touch this comment to invalidate the in-memory
// rules cache via a Next.js fast-refresh. (bump 7)

