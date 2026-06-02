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
  clearBuff?: boolean
  clearDebuff?: boolean
}

export type ForcedOverrides = Record<string, Record<string, ForcedOverride>>

export type DescriptionPattern = {
  regex: RegExp
  addBuff: string[]
  addDebuff: string[]
  removeBuff: string[]
  removeDebuff: string[]
}

export type DescriptionOverride = {
  addBuff: string[]
  addDebuff: string[]
  removeBuff: string[]
  removeDebuff: string[]
  clearBuff: boolean
  clearDebuff: boolean
}

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
  /** Description regexes that add buffs/debuffs when matched. */
  descriptionPatterns: DescriptionPattern[]
  /** Exact-match description → buff/debuff overrides. */
  descriptionOverrides: Map<string, DescriptionOverride>
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

type RawDescriptionPattern = {
  pattern: string
  flags?: string
  add_buff?: string[]
  add_debuff?: string[]
  remove_buff?: string[]
  remove_debuff?: string[]
  _comment?: string
}

type RawDescriptionOverride = {
  add_buff?: string[]
  add_debuff?: string[]
  remove_buff?: string[]
  remove_debuff?: string[]
  clear_buff?: boolean
  clear_debuff?: boolean
}

export function loadEffectRules(): CachedRules {
  if (cache) return cache
  const blacklist = readJson<string[]>('blacklist.json')
  const tooltipBl = readJson<TooltipBlacklistFile>('tooltip-blacklist.json')
  type RawForcedOverride = ForcedOverride & { clear_buff?: boolean; clear_debuff?: boolean }
  const forcedRaw = readJson<Record<string, Record<string, RawForcedOverride>>>('forced-overrides.json')
  const forced: ForcedOverrides = {}
  for (const [key, bySkill] of Object.entries(forcedRaw)) {
    if (key === '_comment') continue
    const out: Record<string, ForcedOverride> = {}
    for (const [skillKey, ov] of Object.entries(bySkill)) {
      out[skillKey] = {
        buff: ov.buff,
        debuff: ov.debuff,
        removeBuff: ov.removeBuff,
        removeDebuff: ov.removeDebuff,
        clearBuff: ov.clearBuff === true || ov.clear_buff === true,
        clearDebuff: ov.clearDebuff === true || ov.clear_debuff === true,
      }
    }
    forced[key] = out
  }
  const aliases = readJson<Record<string, string>>('aliases.json')
  const forceSideRaw = readJson<{ buff?: string[]; debuff?: string[] }>('force-side.json')
  const descPatternsRaw = readJson<RawDescriptionPattern[]>('description-patterns.json')
  const descOverridesRaw = readJson<Record<string, RawDescriptionOverride>>('description-overrides.json')
  // Strip comment keys (JSON files use `_comment` for documentation)
  delete (aliases as Record<string, unknown>)._comment
  delete (forceSideRaw as Record<string, unknown>)._comment
  const forceSide = new Map<string, 'buff' | 'debuff'>()
  for (const l of forceSideRaw.buff ?? []) forceSide.set(l, 'buff')
  for (const l of forceSideRaw.debuff ?? []) forceSide.set(l, 'debuff')
  const descriptionPatterns: DescriptionPattern[] = []
  for (const p of descPatternsRaw) {
    if (!p.pattern) continue
    try {
      descriptionPatterns.push({
        regex: new RegExp(p.pattern, p.flags ?? ''),
        addBuff: p.add_buff ?? [],
        addDebuff: p.add_debuff ?? [],
        removeBuff: p.remove_buff ?? [],
        removeDebuff: p.remove_debuff ?? [],
      })
    } catch {
      // Bad regex: skip rather than crashing the whole extractor.
    }
  }
  delete (descOverridesRaw as Record<string, unknown>)._comment
  // Normalize smart quotes in keys so authors can write straight ASCII
  // punctuation even though TextSkill.json uses `’` / `“` / `”`.
  const normalizeKey = (s: string) =>
    s.replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"').trimEnd()
  const descriptionOverrides = new Map<string, DescriptionOverride>()
  for (const [desc, ov] of Object.entries(descOverridesRaw)) {
    descriptionOverrides.set(normalizeKey(desc), {
      addBuff: ov.add_buff ?? [],
      addDebuff: ov.add_debuff ?? [],
      removeBuff: ov.remove_buff ?? [],
      removeDebuff: ov.remove_debuff ?? [],
      clearBuff: ov.clear_buff === true,
      clearDebuff: ov.clear_debuff === true,
    })
  }
  cache = {
    labelBlacklist: new Set(blacklist),
    tooltipBlacklist: expandTooltipBlacklist(tooltipBl),
    forcedOverrides: forced,
    aliases: new Map(Object.entries(aliases)),
    forceSide,
    descriptionPatterns,
    descriptionOverrides,
  }
  return cache
}

/** Force a reload on next call — useful for admin reload endpoints. */
export function clearEffectRulesCache(): void {
  cache = null
}

// Bundle reload marker: touch this comment to invalidate the in-memory
// rules cache via a Next.js fast-refresh. (bump 181)

