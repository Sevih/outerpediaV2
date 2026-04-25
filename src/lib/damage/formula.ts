/**
 * Outerplane damage formula — empirically validated on Noa, Caren, Kanon,
 * Veronica (Core Fusion), Rin across 26 observations covering ATK / DEF SWAP
 * / HP SWAP scaling, neutral / disadv elements, regular / NAMED / BOSS
 * targets, and crit / no-crit on each.
 *
 *   Dmg = (DF/1000) × ATK × (1 + pool/100) × C/(C + (1-PEN) × DEF) × (1 - target_DR_eff/100) × adv_mult
 *
 *   pool = dmgInc + boss_add (+30 if isBoss) + elem_add (+50 if adv) + crit_add ((CHD-CDmgRed-100) if crit)
 *   target_DR_eff = target_DR × dr_factor                 ← see below
 *   adv_mult = 1.20 if adv, 0.80 if disadv, else 1.0
 *   skill = DamageFactor / ratioDivisor (default /1000)
 *   C = defense denominator constant, empirically 1000
 *
 *   dr_factor:
 *     - crit (regardless of boss) → 0.5  ("crit pierces 50% of DR")
 *     - boss & no crit            → 0.75 ("boss target absorbs DR at 75%")
 *     - else                      → 1.0
 *
 * VALIDATED (all 26 obs match ±0.2% with this model):
 *   - Skeleton: Dmg = skill × ATK × pool_mod × mit × DR_eff × adv_mult
 *   - C = 1000, skill = DF / 1000
 *   - Boss quirk: +30% additive in pool (sourced from Awakening_Boss_Dmg_10 PVE node)
 *   - Elem advantage:    +50% additive (from Awakening_Element_Dmg_10 per-element node, NOT
 *                        intrinsic — flows through poolBonus when applyQuirks is on) AND
 *                        ×1.20 multiplicative (intrinsic, kept hardcoded). The "+50 add"
 *                        used to be hardcoded too but that double-counted the quirk on adv
 *                        tests with applyQuirks=on (Kanon Test 30 dropped from 1.78× over to 0.9997×).
 *   - Elem disadvantage: pure ×0.80 multiplicative (no additive penalty — asymmetric with adv)
 *   - Crit: (CHD - CDmgRed - 100) additive in pool (NOT a separate multiplier!)
 *           => pool_crit = pool_no_crit + (CHD - CDmgRed - 100)
 *   - PEN: (1 - PEN/100) × DEF in mitigation denominator
 *   - Target DR: applied at reduced strength on crit / boss (see dr_factor) — this
 *               replaces the prior "~2% boss+crit residual" mystery: it was DR
 *               being mis-scaled, not a hidden multiplier.
 *   - Scaling SWAP: BT_SWAP_STAT_ATTACK replaces ATK with stat × valuePerMille/1000.
 *   - Skill chain quirks (Awakening_Chain_Dmg_*) DO NOT apply to single-skill damage —
 *               they declare BuffConditionType=NONE but the engine resolves their
 *               context via the buff name pattern, like Awakening_Boss_*_Down_*.
 *
 * TO VALIDATE:
 *   - Mage class offensive quirk: +12% additive (validated on Alice — separate from this dataset)
 *   - Striker (= "Attacker" in game data) has NO offense quirk (validated on Noa + Rin + Kanon)
 *   - Other class quirks (Ranger, Priest, Defender) — no test data yet
 *   - Character-specific passives (e.g. "+X% dmg vs <element>") — no test data yet
 */

export type CharClass = 'Attacker' | 'Mage' | 'Ranger' | 'Defender' | 'Priest' | 'Striker' | string

export interface DamageInputs {
  // Attacker
  atk: number
  damageFactor: number
  chdPct: number
  penPct: number
  dmgIncPct: number           // attacker's DMG Inc stat (gear + passives from the character sheet)
  crit: boolean
  charClass?: CharClass       // auto-applies Mage +12% if 'Mage'
  // Target
  def: number
  cdmgRedPct: number
  dmgRedPct: number
  // Context (auto-applies validated quirks)
  isBoss: boolean
  elem: 'none' | 'adv' | 'disadv'
  // Formula constants (tunable)
  C?: number
  ratioDivisor?: number
  bossBonus?: number          // default 30
  advAddBonus?: number        // default 0 — the in-game +50% adv add comes from the
                              //   per-element Awakening_Element_Dmg_10 quirk (data-driven
                              //   via /api/admin/damage-lab/quirks → poolBonus). Hardcoding
                              //   would double-count when applyQuirks is on (validated on
                              //   Kanon Test 30: 1.6×2679.3×2.30×... gave ratio 0.78,
                              //   removing the hardcoded +50 brought it to 0.9997).
  advMult?: number            // default 1.20 (intrinsic — not data-sourced)
  disadvMult?: number         // default 0.80 (validated with Rin: pure multiplicative, no additive penalty)
  mageBonus?: number          // default 12 (Mage class offensive quirk)
  critDrFactor?: number       // default 0.5  — target DR applied at this fraction when crit fires
  bossDrFactor?: number       // default 0.75 — target DR applied at this fraction when target isBoss (no crit)
  intArithmetic?: boolean     // default false — opt-in floor-at-each-step pipeline mimicking the
                              //   in-game integer arithmetic. Helps boss-no-crit DR>0 cases (e.g.
                              //   Test 1 goes from −0.05% to exact) but accumulates rounding losses
                              //   on others (Test 8 disadv-crit-DR=0 went from −0.02% to +0.03%
                              //   because float was already closer). Float math is empirically the
                              //   better global default — residual stays at ±0.05% across all 31 obs
                              //   instead of swinging ±0.1% with int floor.
}

export interface DamageBreakdown {
  poolPct: number
  mod: number
  mitigation: number
  targetDrMult: number
  elemMult: number
  calculated: number
  quirks: { name: string; value: string }[]
}

export function computeDamage(i: DamageInputs): DamageBreakdown {
  const C = i.C ?? 1000
  const ratioDivisor = i.ratioDivisor ?? 1000
  const bossBonus = i.bossBonus ?? 30
  const advAddBonus = i.advAddBonus ?? 0
  const advMult = i.advMult ?? 1.20
  const disadvMult = i.disadvMult ?? 0.80
  const mageBonus = i.mageBonus ?? 12
  const critDrFactor = i.critDrFactor ?? 0.5
  const bossDrFactor = i.bossDrFactor ?? 0.75

  const quirks: { name: string; value: string }[] = []

  let poolPct = i.dmgIncPct
  if (i.charClass === 'Mage') {
    poolPct += mageBonus
    quirks.push({ name: 'Mage', value: `+${mageBonus}% add` })
  }
  if (i.isBoss) {
    poolPct += bossBonus
    quirks.push({ name: 'Boss', value: `+${bossBonus}% add` })
  }
  if (i.elem === 'adv') {
    if (advAddBonus !== 0) poolPct += advAddBonus
    quirks.push({
      name: 'Adv',
      value: advAddBonus !== 0
        ? `+${advAddBonus}% add & ×${advMult} mult`
        : `×${advMult} mult (add comes from Awakening_Element_Dmg quirk)`,
    })
  } else if (i.elem === 'disadv') {
    quirks.push({ name: 'Disadv', value: `×${disadvMult} mult` })
  }
  if (i.crit) {
    const critAdd = Math.max(0, i.chdPct - i.cdmgRedPct - 100)
    poolPct += critAdd
    quirks.push({ name: 'Crit', value: `+${critAdd.toFixed(1)}% add (CHD−CDmgRed−100)` })
  }

  const mod = 1 + poolPct / 100

  const pen = i.penPct / 100
  const mitigation = C / (C + (1 - pen) * i.def)

  // Target DR is applied at reduced strength when crit fires or target is boss.
  // crit takes precedence over boss when both apply (validated on tests 4/9/14/25).
  const drFactor = i.crit ? critDrFactor : (i.isBoss ? bossDrFactor : 1.0)
  const targetDrMult = 1 - (i.dmgRedPct * drFactor) / 100
  if (drFactor !== 1.0 && i.dmgRedPct > 0) {
    quirks.push({
      name: i.crit ? 'Crit DR pierce' : 'Boss DR scaling',
      value: `target DR ×${drFactor} (${i.dmgRedPct.toFixed(2)}% → ${(i.dmgRedPct * drFactor).toFixed(2)}%)`,
    })
  }

  const elemMult = i.elem === 'adv' ? advMult : i.elem === 'disadv' ? disadvMult : 1.0

  const useFloor = i.intArithmetic ?? false
  const fl = (v: number) => useFloor ? Math.floor(v) : v

  // Step-by-step pipeline mirroring the in-game integer arithmetic. Each multiplication
  // commits the running total to an int, which is the source of the otherwise-mysterious
  // ±0.05% residual the float pipeline produces on DR>0 cases.
  //   atk_in       = floor(input atk)            ← effective ATK after SWAP/ADD scaling
  //   step_skill   = floor(atk_in × DF / 1000)
  //   step_mod     = floor(step_skill × pool_mod)
  //   step_mit     = floor(step_mod × C / (C + (1−PEN)·DEF))
  //   step_dr      = floor(step_mit × DR_mult)
  //   final        = step_dr × elem_mult         ← elem multiplier kept floating
  const atkInt = fl(i.atk)
  let calc: number = atkInt
  calc = fl(calc * i.damageFactor / ratioDivisor)
  calc = fl(calc * mod)
  calc = fl(calc * mitigation)
  calc = fl(calc * targetDrMult)
  const calculated = calc * elemMult

  return { poolPct, mod, mitigation, targetDrMult, elemMult, calculated, quirks }
}
