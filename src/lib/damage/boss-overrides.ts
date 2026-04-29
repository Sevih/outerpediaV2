/**
 * Boss-specific damage mechanics — special-case behaviors of certain bosses
 * that affect damage taken in ways not encoded in the standard buff data.
 *
 * Surfaced in the damage-lab UI as toggles (visible only when the matching
 * boss is selected as target). Each toggle has a user-editable value so the
 * lab operator can dial in empirical multipliers when the exact game value
 * isn't documented in the datamine (which is the case for both Amadeus
 * mechanics below — the binary doesn't encode them in BuffTemplet).
 *
 * Application: each active mechanic contributes a multiplier on the FINAL
 * computed damage (after all formula stages — atk × DF/1000 × mit × mod ×
 * elem × …). Multiple active mechanics multiply together.
 */

export interface BossMechanicDef {
  id: string
  label: string
  description: string
  defaultValue: number   // damage-taken multiplier; 1.0 = no effect, < 1.0 = reduced
}

export interface BossOverride {
  // Monster ID prefix matching — Amadeus boss family is `4076009` (S1/S2/S3
  // stages share that prefix). Match is `monsterId.startsWith(prefix)`.
  bossPrefix: string
  bossName: string
  mechanics: BossMechanicDef[]
}

export const BOSS_OVERRIDES: BossOverride[] = [
  {
    bossPrefix: '4076009',
    bossName: 'Amadeus',
    mechanics: [
      // "Prelude of the Waning Crescent" — Amadeus St4+ passive (SKILL_NAME_32405).
      // From TextSkill.json: "Decreases damage taken from Fire/Water/Earth enemies,
      // and increases damage taken from Light/Dark enemies." The exact ratio
      // isn't in BuffTemplet — empirically calibrated via the damage-lab obs.
      {
        id: 'prelude_waning_crescent',
        label: 'Prelude of Waning Crescent (St4+)',
        description: 'Reduces damage taken from Fire/Water/Earth attackers. Ratio empirical — adjust to match obs.',
        defaultValue: 0.80,
      },
      // Enrage: Amadeus gains "Reduced Damage Taken" buff when boss HP drops
      // below 30%. Value not in datamine — calibrate empirically.
      {
        id: 'enrage_damage_reduce',
        label: 'Enrage (HP < 30%)',
        description: 'Reduced Damage Taken buff active while boss HP < 30%. Ratio empirical — adjust to match obs.',
        defaultValue: 0.70,
      },
    ],
  },
]

export interface BossMechanicState {
  active: boolean
  value: number
}

// Look up the boss override for a given monster id (or null if none match).
export function getBossOverride(monsterId: string | null | undefined): BossOverride | null {
  if (!monsterId) return null
  for (const ov of BOSS_OVERRIDES) {
    if (monsterId.startsWith(ov.bossPrefix)) return ov
  }
  return null
}

// Build a fresh "everything off, defaults loaded" state map keyed by mechanic id.
export function makeDefaultBossMechanicsState(override: BossOverride | null): Record<string, BossMechanicState> {
  const out: Record<string, BossMechanicState> = {}
  if (!override) return out
  for (const m of override.mechanics) {
    out[m.id] = { active: false, value: m.defaultValue }
  }
  return out
}

// Combine active mechanics into a single damage-taken multiplier (1.0 = no effect).
export function aggregateBossMechanics(
  override: BossOverride | null,
  state: Record<string, BossMechanicState>
): number {
  if (!override) return 1.0
  let mult = 1.0
  for (const m of override.mechanics) {
    const s = state[m.id]
    if (!s || !s.active) continue
    mult *= s.value
  }
  return mult
}
