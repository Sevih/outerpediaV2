import type { BossMechanicState } from '@/lib/damage/v2/boss-overrides'
import {
  INITIAL_CONDITIONAL,
  INITIAL_LOADOUT,
  INITIAL_MANUAL,
  INITIAL_SETTINGS,
  INITIAL_STATS,
  INITIAL_TEAM_MEMBER,
  TALISMAN_MAIN_STATS,
  TEAM_SIZE,
  cloneInitialBuffs,
  type AttackerState,
  type CalcState,
  type SettingsState,
  type StatScaling,
  type TalismanMainStat,
  type TargetState,
  type TeamState,
} from '../_state/types'

/**
 * Export / import helpers for the calculator state. Drives the share-panel
 * "Copy to clipboard" + "Paste & apply" flows so a user can hand off their
 * full setup (attacker + target + buffs + team + settings) for someone else
 * to reproduce — useful for divergence reports.
 *
 * The on-wire shape is a versioned envelope so we can evolve the schema
 * without silently breaking older payloads. Any unknown / missing slice on
 * import falls back to its `INITIAL_*` default — old shares survive new
 * fields, new shares missing nothing.
 *
 * Runtime fields are stripped on export and re-zeroed on import:
 *   - `attacker.detail`   → null (re-fetched by AttackerPanel's effect)
 *   - `attacker.loading`  → false
 *   - `statsDirty`        → false (the shared stats grid is the user's edit)
 */

/** Bump when the on-wire schema changes (slice rename, field removal, …). */
export const SHARE_SCHEMA_VERSION = 1

/**
 * Bug-report payload — the whole point of the share. Lets a user pin down
 * what THEY computed + what THEY actually saw in-game so the dev can
 * import the state, see the same calc on his side, and reason about the
 * delta vs `observed`.
 */
export interface ShareReport {
  /** Damage value the sender's calc returned — auto-embedded at export. */
  calculated: number
  /** What the sender saw in-game on the same setup (optional). */
  observed?: number
  /** Free-text note for context (optional). */
  note?: string
}

interface SharedEnvelope {
  v: number
  /** App version of the calc that produced the share — informational. */
  app?: string
  /** ISO timestamp at export — informational, no validation. */
  ts?: string
  state: SerializedCalcState
  /** Bug-report bundle — the dev's reason to care about the share. */
  report?: ShareReport
}

type SerializedCalcState = Omit<CalcState, 'attacker' | 'statsDirty' | 'bossOverride'> & {
  attacker: Omit<AttackerState, 'detail' | 'loading'>
  statsDirty?: boolean
}

/** Serialize the live state into a JSON-safe envelope. The `report` field
 *  is the actionable part for bug reports — the sender's computed value is
 *  always embedded; observed + note are operator-supplied inputs from the
 *  share panel UI. */
export function exportCalcState(
  state: CalcState,
  opts?: { appVersion?: string; report?: ShareReport },
): string {
  const envelope: SharedEnvelope = {
    v: SHARE_SCHEMA_VERSION,
    app: opts?.appVersion,
    ts: new Date().toISOString(),
    state: {
      attacker: {
        charId:     state.attacker.charId,
        stats:      state.attacker.stats,
        skillSlot:  state.attacker.skillSlot,
        skillLevel: state.attacker.skillLevel,
        burstLevel: state.attacker.burstLevel,
        crit:       state.attacker.crit,
        transStar:  state.attacker.transStar,
        equipment:  state.attacker.equipment,
        conditional: state.attacker.conditional,
        atkScaling: state.attacker.atkScaling,
      },
      target:   state.target,
      settings: state.settings,
      buffs:    state.buffs,
      team:     state.team,
      // Toggle states only — `bossOverride` is fetched fresh on import via
      // the CalculatorClient mechanics effect (the receiver's catalogue might
      // have evolved since export). Toggles for unknown ids get dropped at
      // override-merge time in the reducer.
      bossMechanics: state.bossMechanics,
    },
    report: opts?.report,
  }
  return JSON.stringify(envelope, null, 2)
}

export type ParseResult =
  | { ok: true; state: CalcState; warnings: string[]; report: ShareReport | null }
  | { ok: false; error: string }

/**
 * Parse a shared envelope into a fresh `CalcState`. Defensive: any field that
 * mismatches the expected shape falls back to the `INITIAL_*` default and a
 * warning surfaces in the UI so the user knows what was dropped.
 */
export function parseSharedState(raw: string): ParseResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch (e) {
    return { ok: false, error: `Invalid JSON: ${(e as Error).message}` }
  }
  if (!isObject(parsed)) return { ok: false, error: 'Payload is not a JSON object' }
  if (typeof parsed.v !== 'number') return { ok: false, error: 'Missing schema version (`v`)' }
  if (parsed.v !== SHARE_SCHEMA_VERSION) {
    return { ok: false, error: `Unsupported schema version v${parsed.v} (expected v${SHARE_SCHEMA_VERSION})` }
  }
  if (!isObject(parsed.state)) return { ok: false, error: '`state` is missing or not an object' }

  const warnings: string[] = []
  const s = parsed.state as Record<string, unknown>

  const attacker = pickAttacker(s.attacker, warnings)
  const target   = pickTarget(s.target, warnings)
  const settings = pickSettings(s.settings, warnings)
  const buffs    = pickBuffs(s.buffs, warnings)
  const team     = pickTeam(s.team, warnings)
  const bossMechanics = pickBossMechanics(s.bossMechanics)
  const report   = pickReport((parsed as Record<string, unknown>).report)

  return {
    ok: true,
    warnings,
    report,
    state: {
      attacker, target, settings, buffs, team,
      bossMechanics,
      // Override is fetched fresh on import — the CalculatorClient effect on
      // monsterId rehydrates it. Until then the panel stays hidden.
      bossOverride: null,
      statsDirty: false,
    },
  }
}

/** Resolve the optional bug-report bundle. Returns null when missing or
 *  malformed (no warnings — the report is purely informational). */
function pickReport(raw: unknown): ShareReport | null {
  if (!isObject(raw)) return null
  const calc = raw.calculated
  if (typeof calc !== 'number' || !Number.isFinite(calc)) return null
  const observed = typeof raw.observed === 'number' && Number.isFinite(raw.observed) ? raw.observed : undefined
  const note = typeof raw.note === 'string' && raw.note.length > 0 ? raw.note : undefined
  return { calculated: calc, observed, note }
}

// ── Slice resolvers ────────────────────────────────────────────────────────
// Each `pickX` returns the live-shape slice with `INITIAL_X` fallbacks for
// missing / mistyped fields. Warnings are appended (not thrown) so a
// partial paste still produces a usable state.

function pickAttacker(raw: unknown, warnings: string[]): AttackerState {
  const a = isObject(raw) ? raw : (warnings.push('attacker: missing — using defaults'), {})
  return {
    charId: typeof a.charId === 'string' ? a.charId : null,
    detail: null,
    loading: false,
    stats: pickRecord(a.stats, INITIAL_STATS),
    skillSlot: pickEnum(a.skillSlot, ['S1', 'S2', 'S3'] as const, 'S1'),
    skillLevel: pickInt(a.skillLevel, 1, 5, 5) as 1 | 2 | 3 | 4 | 5,
    burstLevel: pickInt(a.burstLevel, 0, 3, 0) as 0 | 1 | 2 | 3,
    crit: typeof a.crit === 'boolean' ? a.crit : false,
    transStar: pickNum(a.transStar, 0),
    equipment: pickEquipment(a.equipment),
    conditional: pickRecord(a.conditional, INITIAL_CONDITIONAL),
    atkScaling: pickAtkScaling(a.atkScaling),
  }
}

/** Recover the StatScaling block. Null when missing or any field is invalid —
 *  the formula then falls back to linear external-buff stacking. */
function pickAtkScaling(raw: unknown): StatScaling | null {
  if (!isObject(raw)) return null
  const baseMax      = raw.baseMax
  const flat         = raw.flat
  const pctBonus     = raw.pctBonus
  const codexPct     = raw.codexPct
  const transcendPct = raw.transcendPct
  if (typeof baseMax      !== 'number' || !Number.isFinite(baseMax))      return null
  if (typeof flat         !== 'number' || !Number.isFinite(flat))         return null
  if (typeof pctBonus     !== 'number' || !Number.isFinite(pctBonus))     return null
  if (typeof codexPct     !== 'number' || !Number.isFinite(codexPct))     return null
  if (typeof transcendPct !== 'number' || !Number.isFinite(transcendPct)) return null
  return { baseMax, flat, pctBonus, codexPct, transcendPct }
}

/** Recover boss-mechanic toggle states. Unknown shape → empty record so the
 *  panel stays hidden until the override re-fetches and merges. */
function pickBossMechanics(raw: unknown): Record<string, BossMechanicState> {
  if (!isObject(raw)) return {}
  const out: Record<string, BossMechanicState> = {}
  for (const [id, val] of Object.entries(raw)) {
    if (!isObject(val)) continue
    out[id] = { active: typeof val.active === 'boolean' ? val.active : false }
  }
  return out
}

function pickEquipment(raw: unknown): AttackerState['equipment'] {
  const e = isObject(raw) ? raw : {}
  const ee = isObject(e.ee) ? e.ee : {}
  return {
    weaponSlug:    typeof e.weaponSlug    === 'string' ? e.weaponSlug    : null,
    accessorySlug: typeof e.accessorySlug === 'string' ? e.accessorySlug : null,
    setSlots: [
      Array.isArray(e.setSlots) && typeof e.setSlots[0] === 'string' ? e.setSlots[0] : null,
      Array.isArray(e.setSlots) && typeof e.setSlots[1] === 'string' ? e.setSlots[1] : null,
    ],
    talismanSlug:  typeof e.talismanSlug  === 'string' ? e.talismanSlug  : null,
    ee: {
      enabled: typeof ee.enabled === 'boolean' ? ee.enabled : INITIAL_LOADOUT.ee.enabled,
      slug:    typeof ee.slug === 'string' ? ee.slug : null,
      level:   pickInt(ee.level, 0, 10, INITIAL_LOADOUT.ee.level),
      variant: pickEnum(ee.variant, ['self', 'base'] as const, INITIAL_LOADOUT.ee.variant),
    },
  }
}

function pickTarget(raw: unknown, warnings: string[]): TargetState {
  const t = isObject(raw) ? raw : (warnings.push('target: missing — using defaults'), {})
  const manualRaw = isObject(t.manual) ? t.manual : {}
  return {
    mode: pickEnum(t.mode, ['cascade', 'manual'] as const, 'cascade'),
    stageId:   typeof t.stageId   === 'string' ? t.stageId   : null,
    monsterId: typeof t.monsterId === 'string' ? t.monsterId : null,
    manual: {
      isBoss:  typeof manualRaw.isBoss === 'boolean' ? manualRaw.isBoss : INITIAL_MANUAL.isBoss,
      element: typeof manualRaw.element === 'string' ? manualRaw.element : INITIAL_MANUAL.element,
      stats:   pickRecord(manualRaw.stats, INITIAL_MANUAL.stats),
    },
  }
}

function pickSettings(raw: unknown, warnings: string[]): SettingsState {
  const s = isObject(raw) ? raw : (warnings.push('settings: missing — using defaults'), {})
  const q = isObject(s.quirks) ? s.quirks : {}
  return {
    codexLevel: pickInt(s.codexLevel, 0, 11, INITIAL_SETTINGS.codexLevel),
    quirks: {
      element:          typeof q.element          === 'boolean' ? q.element          : INITIAL_SETTINGS.quirks.element,
      job:              typeof q.job              === 'boolean' ? q.job              : INITIAL_SETTINGS.quirks.job,
      pve:              typeof q.pve              === 'boolean' ? q.pve              : INITIAL_SETTINGS.quirks.pve,
      adventureLicense: typeof q.adventureLicense === 'boolean' ? q.adventureLicense : INITIAL_SETTINGS.quirks.adventureLicense,
    },
  }
}

function pickBuffs(raw: unknown, warnings: string[]): CalcState['buffs'] {
  const b = isObject(raw) ? raw : (warnings.push('buffs: missing — using defaults'), {})
  const fresh = cloneInitialBuffs()
  // Toggles: keep the imported entries that match catalog ids; unknown ids
  // are dropped (they could be from a stale catalog after a buff rename).
  if (isObject(b.toggles)) {
    for (const [id, val] of Object.entries(b.toggles)) {
      if (!isObject(val)) continue
      if (id in fresh.toggles) {
        fresh.toggles[id] = {
          active: typeof val.active === 'boolean' ? val.active : false,
          value:  typeof val.value === 'number' && Number.isFinite(val.value) ? val.value : fresh.toggles[id].value,
        }
      }
    }
  }
  fresh.marked = typeof b.marked === 'boolean' ? b.marked : false
  return fresh
}

function pickTeam(raw: unknown, warnings: string[]): TeamState {
  const t = isObject(raw) ? raw : (warnings.push('team: missing — using defaults'), {})
  const inputMembers = Array.isArray(t.members) ? t.members : []
  const members = Array.from({ length: TEAM_SIZE }, (_, i) => pickTeamMember(inputMembers[i]))
  return { members }
}

function pickTeamMember(raw: unknown): TeamState['members'][number] {
  const m = isObject(raw) ? raw : {}
  const tal = isObject(m.talisman) ? m.talisman : {}
  const ed  = isObject(m.exquisiteDeath) ? m.exquisiteDeath : {}
  const am  = isObject(m.absoluteMusic) ? m.absoluteMusic : {}
  return {
    charId: typeof m.charId === 'string' ? m.charId : null,
    transStar: pickNum(m.transStar, 0),
    talisman: {
      rarity: pickEnum(tal.rarity, [4, 5, 6] as const, 6),
      // Validate against the current `TALISMAN_MAIN_STATS` enum so legacy
      // shares carrying retired flat stats (`'ATK'`, `'DEF'`, etc.) drop
      // back to "no talisman" instead of leaking an out-of-catalog value.
      stat:   typeof tal.stat === 'string' && (TALISMAN_MAIN_STATS as readonly string[]).includes(tal.stat)
              ? tal.stat as TalismanMainStat
              : '',
      level:  pickInt(tal.level, 0, 10, 10),
    },
    exquisiteDeath: {
      enabled: typeof ed.enabled === 'boolean' ? ed.enabled : INITIAL_TEAM_MEMBER.exquisiteDeath.enabled,
      tier:    pickInt(ed.tier, 0, 4, INITIAL_TEAM_MEMBER.exquisiteDeath.tier),
    },
    defenderDef: pickNum(m.defenderDef, 0),
    absoluteMusic: {
      enabled: typeof am.enabled === 'boolean' ? am.enabled : INITIAL_TEAM_MEMBER.absoluteMusic.enabled,
      tier:    pickInt(am.tier, 0, 4, INITIAL_TEAM_MEMBER.absoluteMusic.tier),
    },
  }
}

// ── Tiny narrow helpers ────────────────────────────────────────────────────

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/**
 * Copy a numeric record (stat block, conditional modifiers, …) from raw
 * input, keeping only the keys present in `fallback` and falling back to
 * the default value for missing / non-numeric entries. Structural type is
 * preserved through the cast — call sites pass strict shapes like
 * `INITIAL_STATS` and get the same shape back.
 */
function pickRecord<T extends object>(raw: unknown, fallback: T): T {
  const def = fallback as unknown as Record<string, number>
  const src = isObject(raw) ? raw : {}
  const out: Record<string, number> = {}
  for (const [k, defV] of Object.entries(def)) {
    const v = src[k]
    out[k] = typeof v === 'number' && Number.isFinite(v) ? v : defV
  }
  return out as unknown as T
}

function pickEnum<T extends readonly (string | number)[]>(raw: unknown, allowed: T, fallback: T[number]): T[number] {
  return (allowed as readonly unknown[]).includes(raw) ? (raw as T[number]) : fallback
}

function pickInt(raw: unknown, min: number, max: number, fallback: number): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return fallback
  const n = Math.floor(raw)
  return Math.max(min, Math.min(max, n))
}

function pickNum(raw: unknown, fallback: number): number {
  return typeof raw === 'number' && Number.isFinite(raw) ? raw : fallback
}
