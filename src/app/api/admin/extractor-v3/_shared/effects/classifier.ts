// Shared buff/debuff classifier used by character + monster extractors.
//
// Pipeline:
//   1. Expand buff IDs with implicit prefix scans against BuffTemplet
//   2. For each row, derive a label via `buffTypeLabel()` (tooltip, ActivateText,
//      BT_STAT|ST_<stat>, BT_CONTINU_HEAL, or plain Type)
//   3. Drop blacklisted labels + caller-supplied extra filters
//   4. Classify buff vs debuff (BUFF / DEBUFF* / NEUTRAL+ENEMY)
//   5. Apply forced overrides from rules/forced-overrides.json
//
// The only data inputs are the already-built `EffectTables` (buffsByID +
// tooltipMap) and the `EffectContext` from the caller. Table loading and
// tooltip-map construction are the caller's responsibility — this module
// is intentionally I/O-free.

import type { BuffRow, EffectContext, EffectResult, EffectTables } from './types'
import { loadEffectRules } from './rules'

// ── Label derivation ────────────────────────────────────────────────

/**
 * Derive the display label for a single BuffTemplet row.
 *
 * Priority order:
 *   1. Irremovable (icon "Interruption" + ToolTipID):
 *      - character-specific tooltip (not blacklisted) → tooltip name
 *      - otherwise → base label + "_IR" suffix
 *   2. `BT_RUN_*` passive with `ActivateText` starting with `SYS_BUFF_`
 *      → use ActivateText (e.g. SYS_BUFF_COUNTER, SYS_BUFF_REVENGE_HEAL)
 *   3. `BT_STAT` with non-NONE StatType → `BT_STAT|<StatType>`
 *   4. Sustained heal (`BT_HEAL_BASED_*` + turn duration + ON_TURN_END)
 *      → `BT_CONTINU_HEAL`
 *   5. Plain `Type`
 */
/** Apply the synonym → canonical alias table to a derived label. */
function applyAlias(label: string): string {
  const { aliases } = loadEffectRules()
  return aliases.get(label) ?? label
}

export function buffTypeLabel(buff: BuffRow, tables: EffectTables): string {
  const type = buff.Type ?? ''
  const { tooltipMap } = tables
  const { tooltipBlacklist } = loadEffectRules()

  let label: string

  // 1. Irremovable handling
  if (buff.IconName?.includes('Interruption') && buff.ToolTipID) {
    if (!tooltipBlacklist.has(buff.ToolTipID)) {
      const tt = tooltipMap.get(buff.ToolTipID)
      // Return the tooltip entry's name even if empty — downstream the
      // classifier drops empty labels. Any tooltip hit short-circuits
      // the `_IR` fallback.
      if (tt) return applyAlias(tt.name)
    }
    const base =
      type === 'BT_STAT' && buff.StatType && buff.StatType !== 'ST_NONE'
        ? `${type}|${buff.StatType}`
        : type
    label = `${base}_IR`
  }
  // 2. Triggered passive with explicit SYS_BUFF_* activate text
  else if (type.startsWith('BT_RUN_') && buff.ActivateText?.startsWith('SYS_BUFF_')) {
    label = buff.ActivateText
  }
  // 3. Stat buff → explicit stat
  else if (type === 'BT_STAT' && buff.StatType && buff.StatType !== 'ST_NONE') {
    label = `${type}|${buff.StatType}`
  }
  // 4. Sustained recovery (heal with duration, not instant)
  else if (
    (type === 'BT_HEAL_BASED_TARGET' || type === 'BT_HEAL_BASED_CASTER') &&
    parseInt(buff.TurnDuration ?? '', 10) > 0 &&
    buff.BuffRemoveType === 'ON_TURN_END'
  ) {
    label = 'BT_CONTINU_HEAL'
  }
  // 5. Plain type
  else {
    label = type
  }

  return applyAlias(label)
}

// ── Implicit BuffID expansion ───────────────────────────────────────
//
// Helper exposed for callers that want to grow a declared buff-ID set
// with every BuffTemplet row whose BuffID matches a known prefix
// pattern. `safetyFilter` lets the caller veto specific IDs (the
// character extractor uses this to only accept implicit IDs that are
// also referenced elsewhere in the owner's skill levels).

export function expandImplicitBuffIds(
  declared: Iterable<string>,
  prefixes: string[],
  buffsByID: Map<string, BuffRow[]>,
  safetyFilter?: (bid: string) => boolean
): string[] {
  const out = new Set(declared)
  if (prefixes.length === 0) return [...out]
  for (const bid of buffsByID.keys()) {
    for (const p of prefixes) {
      if (!bid.startsWith(p)) continue
      if (safetyFilter && !safetyFilter(bid)) break
      out.add(bid)
      break
    }
  }
  return [...out]
}

// ── Row picking for multi-level buffs ───────────────────────────────

/**
 * Some BuffIDs have multiple BuffTemplet rows (different levels / variants).
 * We classify based on level 1 — matching the previous character/monster
 * behavior — and fall back to the first row if level 1 is missing.
 */
function pickLevel1(rows: BuffRow[]): BuffRow | null {
  if (rows.length === 0) return null
  return rows.find((r) => r.Level === '1') ?? rows[0]
}

// ── Buff vs debuff classification ───────────────────────────────────
//
// Returns:
//   - 'buff'   → row.BuffDebuffType === 'BUFF'
//   - 'debuff' → bdt starts with 'DEBUFF', or NEUTRAL/NEUTRAL2 targeting enemies
//   - null     → NEUTRAL/NEUTRAL2 targeting self/ally → dropped entirely
//     (preserves character-extractor behavior where such rows were implicit
//     passive modifiers, not visible statuses)

function classifyRow(row: BuffRow): 'buff' | 'debuff' | null {
  const bdt = row.BuffDebuffType ?? ''
  if (bdt.startsWith('DEBUFF')) return 'debuff'
  if (bdt === 'BUFF') return 'buff'
  if (bdt.startsWith('NEUTRAL')) {
    return (row.TargetType ?? '').startsWith('ENEMY') ? 'debuff' : null
  }
  return null
}

// ── Generic row filters ─────────────────────────────────────────────
//
// These apply to characters AND monsters — they drop internal BT_STAT
// rows that are not user-visible statuses:
//   - ON_SKILL_FINISH + BT_STAT: temporary calc modifier scoped to one cast
//   - BT_STAT + TurnDuration=-1 + StackCount>1: permanent stacking growth
//     (used for progression mechanics, not a displayed buff)

function passesGenericFilters(row: BuffRow): boolean {
  if (row.Type === 'BT_STAT' && row.BuffRemoveType === 'ON_SKILL_FINISH') return false
  if (
    row.Type === 'BT_STAT' &&
    row.TurnDuration === '-1' &&
    (parseInt(row.StackCount ?? '', 10) || 0) > 1
  ) return false
  return true
}

// ── Tooltip-ID discovery ────────────────────────────────────────────
//
// Separate from the per-row tooltip detection in `buffTypeLabel`: here
// we walk a CSV of tooltip IDs (from `SkillLevelTemplet.BuffToolTip`) and
// add each non-blacklisted entry as a buff/debuff.

function addTooltipIds(
  ttIds: string[],
  ctx: EffectContext,
  buffs: string[],
  debuffs: string[],
  seenBuff: Set<string>,
  seenDebuff: Set<string>
): void {
  const rules = loadEffectRules()
  // A tooltip picks its side from `isDebuff` and is deduped against the
  // target list only — the same tooltip name can legitimately appear in
  // both buffs and debuffs when distinct tooltip rows (buff/debuff faces)
  // share the same NameID.
  for (const id of ttIds) {
    if (rules.tooltipBlacklist.has(id)) continue
    const tt = ctx.tables.tooltipMap.get(id)
    if (!tt || !tt.name) continue
    const name = applyAlias(tt.name)
    if (tt.isDebuff) {
      if (seenDebuff.has(name)) continue
      seenDebuff.add(name)
      debuffs.push(name)
    } else {
      if (seenBuff.has(name)) continue
      seenBuff.add(name)
      buffs.push(name)
    }
  }
}

// ── Main entrypoint ─────────────────────────────────────────────────

export function classifyEffects(
  buffIds: string[],
  ctx: EffectContext
): EffectResult {
  const rules = loadEffectRules()

  const buffs: string[] = []
  const debuffs: string[] = []
  // Per-list dedup: the same label can appear in both buffs AND debuffs
  // when the effect has a mirror face (e.g. BANES_DOMAIN which buffs
  // allies and debuffs enemies, or BT_STAT|ST_* skills that symmetrically
  // raise one side and lower the other). Within a single list, dedup
  // still applies.
  const seenBuff = new Set<string>()
  const seenDebuff = new Set<string>()

  for (const bid of buffIds) {
    const rows = ctx.tables.buffsByID.get(bid)
    if (!rows?.length) continue
    const row = pickLevel1(rows)
    if (!row) continue
    if (!passesGenericFilters(row)) continue
    if (ctx.rowFilter && !ctx.rowFilter(row)) continue

    const rawKind = classifyRow(row)
    if (rawKind === null) continue
    const label = buffTypeLabel(row, ctx.tables)
    if (!label || rules.labelBlacklist.has(label)) continue
    // `force-side.json` lets us override the game's tagging for labels
    // whose intent reads the wrong way in the wiki UI.
    const kind = rules.forceSide.get(label) ?? rawKind

    if (kind === 'debuff') {
      if (seenDebuff.has(label)) continue
      seenDebuff.add(label)
      debuffs.push(label)
    } else {
      if (seenBuff.has(label)) continue
      seenBuff.add(label)
      buffs.push(label)
    }
  }

  // Caller-supplied extras (e.g. desc-derived effects).
  for (const b of ctx.extraBuffs ?? []) {
    if (!seenBuff.has(b)) { seenBuff.add(b); buffs.push(b) }
  }
  for (const d of ctx.extraDebuffs ?? []) {
    if (!seenDebuff.has(d)) { seenDebuff.add(d); debuffs.push(d) }
  }

  // Forced overrides (additive + removal). Additions use per-list `includes`
  // rather than the cross-list `seen` so a label classified as buff can be
  // re-added to debuff and then stripped from buff via `removeBuff`.
  const mode = ctx.forcedOverridesMode ?? 'full'
  const forced = mode === 'none' ? undefined : rules.forcedOverrides[ctx.ownerId]?.[ctx.skillType]
  const removeBuff: string[] = [...(forced?.removeBuff ?? [])]
  const removeDebuff: string[] = [...(forced?.removeDebuff ?? [])]
  if (forced) {
    if (mode === 'full') {
      for (const f of forced.buff ?? []) {
        if (!seenBuff.has(f)) { seenBuff.add(f); buffs.push(f) }
      }
      for (const f of forced.debuff ?? []) {
        if (!seenDebuff.has(f)) { seenDebuff.add(f); debuffs.push(f) }
      }
    }
    for (const r of removeBuff) {
      const i = buffs.indexOf(r)
      if (i >= 0) { buffs.splice(i, 1); seenBuff.delete(r) }
    }
    for (const r of removeDebuff) {
      const i = debuffs.indexOf(r)
      if (i >= 0) { debuffs.splice(i, 1); seenDebuff.delete(r) }
    }
  }

  // Tooltip-ID discovery from BuffToolTip CSV — applied last so the
  // tooltip names don't accidentally shadow BT_* labels.
  if (ctx.tooltipIds && ctx.tooltipIds.length > 0) {
    addTooltipIds(ctx.tooltipIds, ctx, buffs, debuffs, seenBuff, seenDebuff)
  }

  // Description-based overrides: exact-match first, regex patterns after.
  // Both consult the resolved English description.
  if (ctx.description) {
    const addB = (raw: string) => {
      const label = applyAlias(raw)
      if (rules.labelBlacklist.has(label)) return
      if (!seenBuff.has(label)) { seenBuff.add(label); buffs.push(label) }
    }
    const addD = (raw: string) => {
      const label = applyAlias(raw)
      if (rules.labelBlacklist.has(label)) return
      if (!seenDebuff.has(label)) { seenDebuff.add(label); debuffs.push(label) }
    }
    const removeB = (raw: string) => {
      const label = applyAlias(raw)
      const i = buffs.indexOf(label)
      if (i >= 0) { buffs.splice(i, 1); seenBuff.delete(label) }
    }
    const removeD = (raw: string) => {
      const label = applyAlias(raw)
      const i = debuffs.indexOf(label)
      if (i >= 0) { debuffs.splice(i, 1); seenDebuff.delete(label) }
    }

    // 1. Exact-match override (highest priority — curated manually)
    const override = rules.descriptionOverrides.get(ctx.description)
    if (override) {
      for (const l of override.addBuff) addB(l)
      for (const l of override.addDebuff) addD(l)
      for (const l of override.removeBuff) removeB(l)
      for (const l of override.removeDebuff) removeD(l)
    }

    // 2. Regex patterns
    for (const p of rules.descriptionPatterns) {
      if (!p.regex.test(ctx.description)) continue
      for (const l of p.addBuff) addB(l)
      for (const l of p.addDebuff) addD(l)
    }
  }

  return {
    buffs: buffs.filter(Boolean),
    debuffs: debuffs.filter(Boolean),
    removeBuff,
    removeDebuff,
  }
}
