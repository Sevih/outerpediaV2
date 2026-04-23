/**
 * Outerplane damage formula — empirically validated on Noa (16 tests).
 *
 *   Dmg = (DF/1000) × ATK × (1 + pool/100) × C/(C + (1-PEN) × DEF) × (1 - target_DR/100) × adv_mult
 *
 *   pool = dmgInc + boss_add (+30 if isBoss) + elem_add (+50 if adv) + crit_add ((CHD-CDmgRed-100) if crit)
 *   adv_mult = 1.20 if adv, else 1.0
 *   skill = DamageFactor / ratioDivisor (default /1000)
 *   C = defense denominator constant, empirically 1000
 *
 * VALIDATED (16 Noa tests, 13/16 exact ±0.02%):
 *   - Skeleton: Dmg = skill × ATK × pool_mod × mit × DR × adv_mult
 *   - C = 1000, skill = DF / 1000
 *   - Boss quirk: +30% additive in pool
 *   - Elem advantage: +50% additive AND ×1.20 multiplicative ("double effect")
 *   - Crit: (CHD - CDmgRed - 100) additive in pool (NOT a separate multiplier!)
 *           => pool_crit = pool_no_crit + (CHD - CDmgRed - 100)
 *           => at CHD=188 with empty pool: pool = 88 → mod = 1.88 ✓
 *   - PEN: (1 - PEN/100) × DEF in mitigation denominator
 *   - Target DR: (1 - DR/100) multiplicative at end
 *
 * KNOWN RESIDUAL (~2%): boss + crit cases show +1.7-2.1% over formula.
 * Likely a micro-multiplier under boss+crit; not modelled here.
 *
 * TO VALIDATE:
 *   - Disadv behavior (penalty not yet measured)
 *   - Mage class offensive quirk: +12% additive (validated on Alice)
 *   - Striker (= "Attacker" in game data — same class, different label) has NO offense quirk (validated on Noa + Rin)
 *   - Other class quirks (Ranger, Priest, Defender)
 *   - Character-specific passives (e.g. "+17% dmg vs <element>")
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
  advAddBonus?: number        // default 50
  advMult?: number            // default 1.20
  disadvMult?: number         // default 0.80 (validated with Rin: pure multiplicative, no additive penalty)
  mageBonus?: number          // default 12 (Mage class offensive quirk)
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
  const advAddBonus = i.advAddBonus ?? 50
  const advMult = i.advMult ?? 1.20
  const disadvMult = i.disadvMult ?? 0.80
  const mageBonus = i.mageBonus ?? 12

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
    poolPct += advAddBonus
    quirks.push({ name: 'Adv', value: `+${advAddBonus}% add & ×${advMult} mult` })
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

  const targetDrMult = 1 - i.dmgRedPct / 100

  const elemMult = i.elem === 'adv' ? advMult : i.elem === 'disadv' ? disadvMult : 1.0

  const skill = i.damageFactor / ratioDivisor
  const calculated = skill * i.atk * mod * mitigation * targetDrMult * elemMult

  return { poolPct, mod, mitigation, targetDrMult, elemMult, calculated, quirks }
}
