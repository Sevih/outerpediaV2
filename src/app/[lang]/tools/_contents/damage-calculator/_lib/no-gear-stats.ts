import type {
  DamageCalcCodexEntry,
  DamageCalcNoGearStats,
  DamageCalcStatContribution,
  DamageCalcTalismanMainStat,
  DamageCalcTranscendCharEntry,
  DamageCalcTranscendTier,
} from '@/lib/data/damage-calc'
import type { StatKey, StatScaling, StatValues, TeamState } from '../_state/types'
import { INITIAL_STATS } from '../_state/types'
import { resolveActiveTeamBonuses } from '../_components/TranscendActiveInfo'

/**
 * Compose a char's no-gear stat block from baked contributors + user settings.
 *
 * Mirrors the admin route's `calcStat` formula
 * (`src/app/api/admin/characters/[id]/stats/route.ts`):
 *
 *   compoundPct = ((1 + transcend/100) × (1 + Σpct/100) − 1) × 100
 *   onBase      = codex + compoundPct          (applied to base ATK/DEF/HP)
 *   onFlat      = compoundPct                  (applied to evo + flat bonuses)
 *   final ATK   = floor(base × (1 + onBase/100) + flat × (1 + onFlat/100))
 *
 * Only ATK/DEF/HP go through the codex × transcend × pct compound. Other
 * stats (SPD/EFF/RES, %-points stats CHC/CHD/PEN/DMG↑) are pure additive.
 *
 * `transcendTier` may be null when the char has no transcend chain (or the
 * picked tier is below `basicStar` — defensive default).
 */

/**
 * In-game quirk gift categories surfaced in Settings.
 *   - `element`/`job`        contribute to the always-on stat sheet
 *   - `pve`                  no stat impact (pure BT_DMG modifier; gated at
 *                            recompute time via `composeApplicableBuffs`)
 *   - `adventureLicense`     contributes to the stat sheet ONLY when the
 *                            picked target sits in an Adventure License
 *                            dungeon mode (gated by `inAdventureLicense`
 *                            below); main-node BT_DMG buff handled at
 *                            recompute time
 */
export interface QuirksToggles {
  element: boolean
  job: boolean
  pve: boolean
  adventureLicense: boolean
}

export interface ComputeFinalStatsArgs {
  noGear: DamageCalcNoGearStats
  codex: DamageCalcCodexEntry
  transcendTier: DamageCalcTranscendTier | null
  quirks: QuirksToggles
  /** TransStar key into `noGear.skill8ByTransStar`. */
  transStar: number
  /**
   * `true` when the picked target is in an Adventure License dungeon mode
   * (`DM_ADVENTURE_MISSION` / `DM_ADVENTURE_CHALLENGE`). Combined with
   * `quirks.adventureLicense`, gates the AL stat-bonus contribution. Manual
   * targets (no mode) → always `false`.
   */
  inAdventureLicense?: boolean
}

/** Read a possibly-undefined sparse contribution field as a number. */
const v = (c: DamageCalcStatContribution, key: keyof DamageCalcStatContribution): number => c[key] ?? 0

/** Sum a single field across the contributors that are currently active. */
function sumField(blocks: DamageCalcStatContribution[], key: keyof DamageCalcStatContribution): number {
  let total = 0
  for (const b of blocks) total += v(b, key)
  return total
}

/** Replicates the admin route's `calcStat` exactly — float arithmetic, single floor at the end. */
function calcStat(baseMax: number, flat: number, pctBonus: number, codexPct: number, transcendPct: number): number {
  const compoundPct = ((1 + transcendPct / 100) * (1 + pctBonus / 100) - 1) * 100
  const onBase = codexPct + compoundPct
  const onFlat = compoundPct
  return Math.floor(baseMax * (1 + onBase / 100) + flat * (1 + onFlat / 100))
}

export function computeFinalStats(args: ComputeFinalStatsArgs): StatValues {
  const { noGear, codex, transcendTier, quirks, transStar, inAdventureLicense } = args
  const skill8 = noGear.skill8ByTransStar[String(transStar)] ?? {}

  // Active contributors. Base + evolution + classPassive + skill8 are
  // always-on; quirks gated by per-category toggles. Adventure License
  // additionally needs the target to be in an AL dungeon mode.
  const flatBlocks: DamageCalcStatContribution[] = [noGear.evolution, noGear.classPassive, skill8]
  const pctBlocks: DamageCalcStatContribution[]  = [noGear.classPassive, skill8]
  if (quirks.element) { flatBlocks.push(noGear.quirks.element); pctBlocks.push(noGear.quirks.element) }
  if (quirks.job)     { flatBlocks.push(noGear.quirks.job);     pctBlocks.push(noGear.quirks.job) }
  if (quirks.adventureLicense && inAdventureLicense && noGear.quirks.adventureLicense) {
    flatBlocks.push(noGear.quirks.adventureLicense)
    pctBlocks.push(noGear.quirks.adventureLicense)
  }

  const transAtkPct = (transcendTier?.atkRate ?? 0) / 10
  const transDefPct = (transcendTier?.defRate ?? 0) / 10
  const transHpPct  = (transcendTier?.hpRate  ?? 0) / 10

  const baseAtk = v(noGear.base, 'atk')
  const baseDef = v(noGear.base, 'def')
  const baseHp  = v(noGear.base, 'hp')

  return {
    ATK: calcStat(baseAtk, sumField(flatBlocks, 'atk'), sumField(pctBlocks, 'atkPct'), codex.atkPct, transAtkPct),
    DEF: calcStat(baseDef, sumField(flatBlocks, 'def'), sumField(pctBlocks, 'defPct'), codex.defPct, transDefPct),
    HP:  calcStat(baseHp,  sumField(flatBlocks, 'hp'),  sumField(pctBlocks, 'hpPct'),  codex.hpPct,  transHpPct),
    SPD: v(noGear.base, 'spd') + sumField(flatBlocks, 'spd'),
    CHC: v(noGear.base, 'chc') + sumField(flatBlocks, 'chc'),
    CHD: v(noGear.base, 'chd') + sumField(flatBlocks, 'chd'),
    EFF: v(noGear.base, 'eff') + sumField(flatBlocks, 'eff'),
    RES: v(noGear.base, 'res') + sumField(flatBlocks, 'res'),
    // PEN comes from quirks/passives only (no base value); DMG↑ same logic.
    PEN: sumField(flatBlocks, 'pen'),
    DMG_INC: sumField(flatBlocks, 'dmgInc'),
  }
}

/**
 * Aggregate the team contributions (transcend team bonuses + ally talismans)
 * into per-stat deltas the dealer's stat sheet should pick up:
 *
 *   - `pctOnBase`: ATK/DEF/HP `'rate'` bonuses summed per stat — fed into
 *     `calcStat`'s `pctBonus` so they compound with codex/transcend the
 *     same way the dealer's own classPassive does (matches in-game stack
 *     model). Sources: transcend `'rate'` bonuses + talisman `'rate'`
 *     ATK%/DEF%/HP% bonuses.
 *   - `flatAdds`: `'add'` bonuses per stat key — added directly to the
 *     final stat value. Includes flat SPD/EFF/RES from transcend, additive
 *     %-points for CHC/CHD/PEN/DMG↑/DMG↓ (transcend + talisman CHC/CHD).
 *   - `pctOfFlat`: talisman OAT_RATE on flat-display stats (EFF/RES) —
 *     value is "% of base", resolves to `floor(base × val/100)` AFTER the
 *     dealer's base+evo+passives are computed (mirrors the in-game premium
 *     buff convention). Pre-team baseline so transcend team flat adds
 *     don't double-count into the multiplier.
 *
 * Iterates each team slot for both the slot's transcend bonuses (resolved
 * at the slot's `transStar`) and the slot's talisman main-stat (resolved
 * at the picked rarity × level).
 */
export interface TeamDeltas {
  pctOnBase: { atk: number; def: number; hp: number }
  flatAdds: Partial<Record<StatKey, number>>
  pctOfFlat: { EFF: number; RES: number }
}

export function computeTeamDeltas(
  team: TeamState,
  transcendByChar: Record<string, DamageCalcTranscendCharEntry>,
  talismanCatalog: DamageCalcTalismanMainStat[],
): TeamDeltas {
  const out: TeamDeltas = {
    pctOnBase: { atk: 0, def: 0, hp: 0 },
    flatAdds: {},
    pctOfFlat: { EFF: 0, RES: 0 },
  }

  for (const member of team.members) {
    if (!member.charId) continue

    // ── Transcend team bonuses ───────────────────────────────────────────
    const tEntry = transcendByChar[member.charId]
    if (tEntry) {
      const active = resolveActiveTeamBonuses(tEntry.teamBonusesByTier, member.transStar)
      for (const b of active) {
        if (b.apply === 'rate') {
          if (b.stat === 'ATK')      out.pctOnBase.atk += b.value
          else if (b.stat === 'DEF') out.pctOnBase.def += b.value
          else if (b.stat === 'HP')  out.pctOnBase.hp  += b.value
        } else {
          const key = bonusStatToStatKey(b.stat)
          if (key) out.flatAdds[key] = (out.flatAdds[key] ?? 0) + b.value
        }
      }
    }

    // ── Talisman main stat ───────────────────────────────────────────────
    if (member.talisman.stat) {
      const entry = talismanCatalog.find(c => c.stat === member.talisman.stat)
      if (entry) {
        const rarityKey = String(member.talisman.rarity) as '4' | '5' | '6'
        const values = entry.byRarity[rarityKey] ?? []
        const idx = Math.min(member.talisman.level, values.length - 1)
        const value = idx >= 0 ? values[idx] : 0
        if (value > 0) {
          // Dispatch on the full stat token — `'ATK%'` / `'DMG UP%'` are
          // distinct keys (the trailing `%` is part of the canonical name
          // for DMG↑ / DMG RED%, while ATK%/DEF%/HP% strip it for the
          // ST_ATK / ST_DEF / ST_HP lookup).
          if (entry.apply === 'rate') {
            if (entry.stat === 'ATK%')      out.pctOnBase.atk += value
            else if (entry.stat === 'DEF%') out.pctOnBase.def += value
            else if (entry.stat === 'HP%')  out.pctOnBase.hp  += value
            else if (entry.stat === 'EFF')  out.pctOfFlat.EFF += value
            else if (entry.stat === 'RES')  out.pctOfFlat.RES += value
          } else {
            // 'add' — CHC / CHD / DMG↑ additive %-points. DMG RED% is
            // target-side and `bonusStatToStatKey` returns null so it's
            // dropped (defensive talisman, no dealer-damage impact).
            const key = bonusStatToStatKey(entry.stat)
            if (key) out.flatAdds[key] = (out.flatAdds[key] ?? 0) + value
          }
        }
      }
    }
  }
  return out
}

function bonusStatToStatKey(stat: string): StatKey | null {
  switch (stat) {
    case 'ATK':      return 'ATK'
    case 'DEF':      return 'DEF'
    case 'HP':       return 'HP'
    case 'SPD':      return 'SPD'
    case 'CHC':      return 'CHC'
    case 'CHD':      return 'CHD'
    case 'EFF':      return 'EFF'
    case 'RES':      return 'RES'
    case 'PEN':      return 'PEN'
    case 'DMG UP%':  return 'DMG_INC'
    // 'DMG RED%' is target-side; doesn't apply to dealer's outgoing damage.
    default:         return null
  }
}

/**
 * Variant of `computeFinalStats` that folds team-transcend `'rate'` deltas
 * into the calcStat `pctBonus` layer for ATK/DEF/HP, then adds the flat
 * deltas on top of the resolved stats. Mirrors how the dealer's own
 * classPassive contributes — same in-game stacking math.
 *
 * The returned `atkScaling` accounts for the team's ATK% contribution so
 * external buff stacking in `recompute()` stays additive against the full
 * permanent layer (team contribution included).
 */
/**
 * Compute the dealer's BASE stat sheet — no team contributions. This is
 * what the user sees in the AttackerPanel grid (so the in-game character
 * sheet maps 1:1 to the inputs). Team contributions surface separately as
 * `(+X)` annotations and feed the calc through `applyTeamDeltasToStats`
 * inside compose-result.ts.
 *
 * Returns both stats and the `atkScaling` breakdown for the dealer's own
 * %-bonus layer (no team). The team's ATK%-rate folds into the scaling
 * downstream so external buffs still stack additively against the full
 * permanent layer when computing damage.
 */
export function computeBaseStatsAndScaling(
  args: ComputeFinalStatsArgs,
): { stats: StatValues; atkScaling: StatScaling | null } {
  const { noGear, codex, transcendTier, quirks, transStar, inAdventureLicense } = args
  const skill8 = noGear.skill8ByTransStar[String(transStar)] ?? {}

  const flatBlocks: DamageCalcStatContribution[] = [noGear.evolution, noGear.classPassive, skill8]
  const pctBlocks: DamageCalcStatContribution[]  = [noGear.classPassive, skill8]
  if (quirks.element) { flatBlocks.push(noGear.quirks.element); pctBlocks.push(noGear.quirks.element) }
  if (quirks.job)     { flatBlocks.push(noGear.quirks.job);     pctBlocks.push(noGear.quirks.job) }
  // Mode-gated AL contribution — folded into the always-on layer when both
  // the user toggle and the dungeon-mode flag are on. Keeps the math simple
  // (same calcStat compounding); the stat sheet just changes when the user
  // swaps the target between AL and non-AL.
  if (quirks.adventureLicense && inAdventureLicense && noGear.quirks.adventureLicense) {
    flatBlocks.push(noGear.quirks.adventureLicense)
    pctBlocks.push(noGear.quirks.adventureLicense)
  }

  const transAtkPct = (transcendTier?.atkRate ?? 0) / 10
  const transDefPct = (transcendTier?.defRate ?? 0) / 10
  const transHpPct  = (transcendTier?.hpRate  ?? 0) / 10

  const baseAtk = v(noGear.base, 'atk')
  const baseDef = v(noGear.base, 'def')
  const baseHp  = v(noGear.base, 'hp')

  const atkPctBonus = sumField(pctBlocks, 'atkPct')
  const defPctBonus = sumField(pctBlocks, 'defPct')
  const hpPctBonus  = sumField(pctBlocks, 'hpPct')

  const stats: StatValues = {
    ATK: calcStat(baseAtk, sumField(flatBlocks, 'atk'), atkPctBonus, codex.atkPct, transAtkPct),
    DEF: calcStat(baseDef, sumField(flatBlocks, 'def'), defPctBonus, codex.defPct, transDefPct),
    HP:  calcStat(baseHp,  sumField(flatBlocks, 'hp'),  hpPctBonus,  codex.hpPct,  transHpPct),
    SPD: v(noGear.base, 'spd') + sumField(flatBlocks, 'spd'),
    CHC: v(noGear.base, 'chc') + sumField(flatBlocks, 'chc'),
    CHD: v(noGear.base, 'chd') + sumField(flatBlocks, 'chd'),
    EFF: v(noGear.base, 'eff') + sumField(flatBlocks, 'eff'),
    RES: v(noGear.base, 'res') + sumField(flatBlocks, 'res'),
    PEN: sumField(flatBlocks, 'pen'),
    DMG_INC: sumField(flatBlocks, 'dmgInc'),
  }

  const atkScaling: StatScaling | null = baseAtk > 0
    ? { baseMax: baseAtk, flat: sumField(flatBlocks, 'atk'), pctBonus: atkPctBonus, codexPct: codex.atkPct, transcendPct: transAtkPct }
    : null

  return { stats, atkScaling }
}

/**
 * Resolve per-stat team-delta DISPLAY values — what to show next to each
 * stat field as `(+X)` annotation. Distinct from the recompute-time apply
 * because:
 *   - ATK/DEF/HP `'rate'`: display the EFFECTIVE flat delta on the dealer's
 *     stat (e.g. dealer ATK 13000 + ally +5% → display "+650"), since
 *     additive rate stacking against the dealer's permanent %-layer would
 *     differ from a naive percent-of-displayed.
 *   - EFF/RES `'rate'`: `floor(base × val/100)` flat per the in-game rule.
 *   - flat additive: same as the recompute delta.
 *
 * Returns an annotation map keyed by StatKey. Zero / missing entries
 * mean "no team contribution to surface."
 */
export function resolveTeamDeltaDisplay(
  baseStats: StatValues,
  team: TeamDeltas,
): Partial<Record<StatKey, number>> {
  const out: Partial<Record<StatKey, number>> = {}
  // ATK/DEF/HP — apply the rate against the displayed base (informational
  // approximation; the recompute uses the additive-into-pctBonus path).
  if (team.pctOnBase.atk !== 0) out.ATK = Math.floor(baseStats.ATK * team.pctOnBase.atk / 100)
  if (team.pctOnBase.def !== 0) out.DEF = Math.floor(baseStats.DEF * team.pctOnBase.def / 100)
  if (team.pctOnBase.hp  !== 0) out.HP  = Math.floor(baseStats.HP  * team.pctOnBase.hp  / 100)
  // EFF/RES — `floor(base × val/100)` exactly as the recompute resolves them.
  if (team.pctOfFlat.EFF !== 0) out.EFF = Math.floor(baseStats.EFF * team.pctOfFlat.EFF / 100)
  if (team.pctOfFlat.RES !== 0) out.RES = Math.floor(baseStats.RES * team.pctOfFlat.RES / 100)
  // Flat additive (CHC/CHD/SPD/etc.) — direct sum.
  for (const [key, val] of Object.entries(team.flatAdds) as Array<[StatKey, number]>) {
    if (val !== 0) out[key] = (out[key] ?? 0) + val
  }
  return out
}

/**
 * Apply team deltas to the user-typed dealer stats to produce the
 * EFFECTIVE stat block fed to `recompute()`. The two split surfaces:
 *   - `displayStats`: untouched dealer panel inputs (1:1 with in-game
 *     character sheet, friction-free for the user comparing values).
 *   - `effectiveStats`: returned here, includes ally talisman + transcend
 *     team contributions so the calc reflects the cast accurately.
 *
 * `atkScaling` is augmented with the team's `pctOnBase.atk` so external
 * ATK% buffs in `recompute()` stack additively against the full permanent
 * layer (dealer's own + team).
 */
export function applyTeamDeltasToStats(
  baseStats: StatValues,
  baseScaling: StatScaling | null,
  team: TeamDeltas,
): { stats: StatValues; atkScaling: StatScaling | null } {
  // Multiplicative stats (ATK/DEF/HP rate) re-derive against the dealer's
  // base layer — replay the calcStat math with team `pctOnBase` summed in.
  // For non-scaling stats (CHC/CHD/SPD/PEN/DMG↑) the team contribution is
  // additive on top of the user's input.
  const fa = team.flatAdds

  // ATK/DEF/HP — rate folds into the calcStat pctBonus, EFFECTIVELY applied
  // here as `displayed × (1 + pctOnBase/100)` rounded down. This gives the
  // same in-game value when `baseScaling` matches the displayed stat.
  const atk = baseStats.ATK + Math.floor(baseStats.ATK * team.pctOnBase.atk / 100) + (fa.ATK ?? 0)
  const def = baseStats.DEF + Math.floor(baseStats.DEF * team.pctOnBase.def / 100) + (fa.DEF ?? 0)
  const hp  = baseStats.HP  + Math.floor(baseStats.HP  * team.pctOnBase.hp  / 100) + (fa.HP  ?? 0)

  // EFF/RES — `floor(base × val/100)` from talisman OAT_RATE.
  const eff = baseStats.EFF + Math.floor(baseStats.EFF * team.pctOfFlat.EFF / 100) + (fa.EFF ?? 0)
  const res = baseStats.RES + Math.floor(baseStats.RES * team.pctOfFlat.RES / 100) + (fa.RES ?? 0)

  const stats: StatValues = {
    ATK: atk,
    DEF: def,
    HP:  hp,
    SPD: baseStats.SPD + (fa.SPD ?? 0),
    CHC: baseStats.CHC + (fa.CHC ?? 0),
    CHD: baseStats.CHD + (fa.CHD ?? 0),
    EFF: eff,
    RES: res,
    PEN: baseStats.PEN + (fa.PEN ?? 0),
    DMG_INC: baseStats.DMG_INC + (fa.DMG_INC ?? 0),
  }

  // Augment scaling so external ATK% buffs see the team's permanent
  // contribution as part of the dealer's pctBonus layer.
  const atkScaling: StatScaling | null = baseScaling
    ? { ...baseScaling, pctBonus: baseScaling.pctBonus + team.pctOnBase.atk }
    : null

  return { stats, atkScaling }
}

/**
 * Read the codex row for a given level. Defensive against an out-of-range
 * value in stored settings (returns the lv 0 / no-codex row in that case).
 */
export function pickCodexEntry(codexTable: DamageCalcCodexEntry[], level: number): DamageCalcCodexEntry {
  const row = codexTable.find(e => e.level === level)
  if (row) return row
  return codexTable[0] ?? { level: 0, atkPct: 0, defPct: 0, hpPct: 0 }
}

/**
 * Convenience for components that need the panel-default fallback. Mirrors
 * the no-char baseline — used when the char-detail load fails.
 */
export function fallbackStats(): StatValues {
  return { ...INITIAL_STATS }
}
