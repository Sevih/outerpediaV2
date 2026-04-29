/**
 * Outerplane damage formula — reverse-engineered from libil2cpp.so disassembly +
 * empirically validated on Noa 11 obs (S1 boss × 3 stages × crit/no-crit + S2/S3
 * with HP-target-stat extras) at residual ±0.013% on basic / ±0.12% on extras.
 *
 * ── Reverse-engineered pipeline (from CFormula.CalcDamage / inner g__CalcDamage) ──
 *
 *   running = fDamageRate × DF/1000 × skillFactor/1000 × ATK × mit
 *   if (defender has BT_MARKING):  running ×= 1.15
 *   running ×= elem_mult                              (1.20 / 0.80 / 1.0 — see GetElementeryDamageRate)
 *   if (skillRecord.DamageRateType == MISSED): running ×= MISSED_DAMAGE_RATE  (= 0.5)
 *   running ×= (1 − finalReduce)                      (finalReduce = max of defender's BT_DMG_REDUCE_FINAL
 *                                                       buffs, types 111/112/113 — verified by binary
 *                                                       disasm of GetBuffDamgeFinalReduce iterating only
 *                                                       these 3 types and taking max). Defender without
 *                                                       any such buff: finalReduce = 0 → no effect.
 *   final    = max(1, floor(running))
 *
 *   `fDamageRate` is the additive POOL (= 1 + (inc − red)/100) precomputed by the
 *   caller of CFormula.CalcDamage. Inc = dmgInc + (chd − 100) on crit + boss bonus
 *   + mage bonus + adv-add etc. Red = cdmgRed on crit + targetDR. We compute it
 *   via `mod` and pass through as the leading multiplier.
 *
 *   mit = C / (C + (1 − PEN/1000) × DEF − PEN_flat)
 *   pool = inc_total − red_total
 *   inc_total = dmgInc + (chd − 100) if crit
 *   red_total = cdmgRed if crit + targetDR
 *   adv_mult: 1.20 if adv, 0.80 if disadv, 1.0 otherwise (from binary VA 0x1033e70 / 0x1033e14)
 *
 * ── Resolved function names (Il2CppDumper script.json) ──
 *   - 0x2639bb8  CCharacterBattle.GetAttackStat                     → ATK
 *   - 0x2728574  CCharacter.get_SkillManager
 *   - 0x2439588  CSkillManager.GetSkillFactor                       → per-skill mult (per-mille, typ 1000)
 *   - 0x27362e0  CCharacterData.get_PiercePowerRate                  → PEN%
 *   - 0x2736204  CCharacterData.get_PiercePower                      → PEN flat (PEN_flat in mit denom)
 *   - 0x2735e94  CCharacterData.get_Def                              → defender DEF
 *   - 0x2622740  CCharacterBattle.get_SkillRecord
 *   - 0x262109c  CCharacterBattle.FindBuffByType                     → BT_MARKING (=5) check
 *   - 0x2638adc  CCharacterBattle.GetBuffDamgeFinalReduce            → s9 = (red − inc)/100
 *   - 0x28291f0  CCommonDefine.get_MISSED_DAMAGE_RATE                → 0.5 (from GameConfigTemplet 500/1000)
 *   - 0x262d294  CCharacterBattle.FindBuffElementSuperiority          → flag for stacked elem boost
 *   - 0x2639004  CCharacterBattle.FindBuffElementDamageRate          → returns int (per-mille) for elem stack
 *   - 0x273558c  CCharacterData.get_Element                          → element index (0..4)
 *   - VA 0x1033e70 = 1.20  (adv_mult)
 *   - VA 0x1033e14 = 0.80  (disadv_mult)
 *   - VA 0x1034038 = 0.001 (per-mille decoder)
 *   - VA 0x1034064 = 1.15  (BT_MARKING bonus)
 *
 * ── Final integer conversion ──
 * The game uses `frintm` + `fcvtms` (= floor toward −∞) and clamps with `csinc → max(1, w)`
 * to ensure damage ≥ 1. Our `mainCalc` returns the raw float; the caller (page UI)
 * historically uses `Math.round` for display because empirically that matches the
 * obs slightly better on borderline cases (game's intermediate float carries a
 * ~0.5-unit positive drift we can't reproduce without the exact runtime arithmetic).
 *
 * ── Empirical validation set (Noa, Striker/Attacker) ──
 *   S1, ATK 2033, CHD 188 — boss × 3 Amadeus stages × crit/no-crit (6 obs):
 *     ratios 1.000 ± 0.013% (5/6 perfect floor-match, #6 St3 crit off by 1 unit).
 *   S1 + S3, ATK 4585, CHD 208 — Amadeus St2 boss crit (obs #9, #11):
 *     Δ = −1 unit (−0.008%) on BOTH skills with f32 emulator + binary-faithful
 *     order (chd × 0.001 base → +additionalSum → −DR × 0.001 → cap 0.30).
 *     This proves the rate-aggregation pipeline is essentially perfect.
 *   S2 + BT_DMG_TARGET_STAT (HP scaling), ATK 4585 — Amadeus St2 boss crit (#10):
 *     - f64 legacy:  Δ = +13 (+0.118%)  — separate-component model
 *     - f32 binary:  Δ = +11 (+0.100%)  — target_stat folded in pool with exact
 *                                          GetStatValuePermille emulation
 *     The residual is LOCALIZED to the target_stat path (S1/S3 are clean).
 *     Runtime instrumentation would be needed to pin the last 0.10% — most
 *     likely candidates: (a) HP value mismatch (game uses ~22350 instead of
 *     our 22453 from manual interp due to different round point in the runtime
 *     spawn-rate scaling), (b) hidden boss-side BT_DMG_REDUCE buff, or (c)
 *     ULP-level f32 drift in FindBuffAdditionalDamage's iteration order.
 *
 * ── Reverse-engineered constants from libil2cpp.so .rodata ──
 *   0x1033d78 = −0.0010000000474974513f  (negative per-mille decoder, used for
 *                                          DR/CDR/MAGE_DMG_DECREASE subtraction)
 *   0x1034038 = +0.0010000000474974513f  (positive per-mille decoder, used for
 *                                          CHD/DMG/BOSS/element/awakening adds)
 *   0x1034064 = 1.149999976158142f       (BT_MARKING multiplier ×1.15)
 *   0x1034074 = 0.30000001192092896f     (rateMin: max 70% damage reduction cap)
 *   0x1033e14 = 0.800000011920929f       (disadv multiplier ×0.80)
 *   0x1033e70 = 1.2000000476837158f      (adv multiplier ×1.20)
 *   w20 = 0x447a0000 (bits)              = 1000.0f (cap on per-mille stat values
 *                                          inside GetStatValuePermille handlers)
 *   CalcStat: 99.0f (= 0x42c60000 bits) — divisor for level interp (99 = lv 1..100 span)
 *
 * ── Confirmed binary call graph for damage computation ──
 *   CFormula.CalcDamage (entry)
 *     → CFormula.CheckDamageRate (VA 0x2b53518) — builds `_fDamageRate` (= our `mod`)
 *         → CCharacterBattle.FindBuffAdditionalDamage (VA 0x2637548) — sums attacker BT_DMG_*
 *           → CCharacterData.GetStatValuePermille (VA 0x2737274) — for BT_DMG_TARGET_STAT
 *             → CCharacterData.GetStatValue (VA 0x273717c) — routes by ST_* enum
 *               → CCharacterData.get_MaxHP (VA 0x27358dc) — for ST_HP
 *                 → CFormula.CalcStat (VA 0x2b52d24) — level interp formula
 *         → CCharacterBattle.FindBuffDamageReduce (VA 0x2638638) — sums defender BT_DMG_REDUCE_*
 *         → CCharacterData.get_DMGBoost / get_DMGReduceRate — gear stats
 *     → CCharacterBattle.GetBuffDamgeFinalReduce (VA 0x2638adc) — finalReducePct
 *     → CCharacterBattle.FindBuffElementDamageRate (VA 0x2639004) — element multiplier stack
 *
 * ── Empirical-validation summary (12 Noa obs, all Amadeus St1/St2/St3) ──
 * After applying the dual fix (int-truncated CalcStat in interpolate() AND
 * Math.floor instead of Math.round on the final calc), obs match game EXACTLY:
 *
 *   10/12 obs:  Δ = 0  (PERFECT) — all S1/S3 obs across boss/non-boss × crit/no-crit
 *   2/12 obs:   Δ = +11 (S2 #10) / +10 (S2 #8) — ONLY S2 with BT_DMG_TARGET_STAT
 *
 * The two key fixes:
 *   1. interpolate() in stages route uses f32 chain `(max-min)/99 × (level-1)
 *      + min` then floor (= binary CalcStat at VA 0x2b52d24). Closes Δ=−1 → 0
 *      on S1/S3 by using DR=29 (int per-mille = 2.9%) instead of float 29.293.
 *   2. Lab UI's calc display uses Math.floor (= binary fcvtms toward −∞) instead
 *      of toFixed(0) (= Math.round). Closes Δ=+1 on borderline cases.
 *
 * The S2 target_stat residual (+0.10%) is LOCALIZED to BT_DMG_TARGET_STAT.
 * Debug-mode back-calculation from 2 Noa S2 obs reveals:
 *
 *   #10 (St2 lv 30): our permille=673, required=670, Δ=−3 (HP req ≈ 22350)
 *   #8  (St3 lv 35): our permille=790, required=787, Δ=−3 (HP req ≈ 26250)
 *
 * Both obs require the runtime maxHP to be ~100 less than what `floor(HPRate
 * × CalcStat)` produces, where HPRate = 1+spawnRate/1000 from DungeonTemplet:
 *
 *   St2: needs HPRate ≈ 0.4243 (= spawnRate ≈ −576)  vs DungeonTemplet −574
 *   St3: needs HPRate ≈ 0.4267 (= spawnRate ≈ −574)  vs DungeonTemplet −572
 *
 * Consistent +1.5 to +2.0 per-mille extra HP reduction. We've ruled out:
 * (a) hidden BT_DMG_REDUCE on boss; (b) other Noa S2 buffs (`_2_1` is BT_RUN_PASSIVE,
 * `_2_3` is BT_RESOURCE_CHARGE — non-damage); (c) different CalcStat ordering
 * (f32-int and f32-raw chains both give 22453); (d) different rounding (fcvtms
 * = floor for positive). The HPRate value at CharData+0x100 must be set to
 * something other than `1+spawnRate/1000` for raid bosses — possibly an
 * additional per-stage modifier we haven't located in the data files yet.
 *
 * The lab's debug mode (toggle in formula constants panel) shows the per-step
 * f32 trace + back-calculated required permille so future investigation of
 * other characters with BT_DMG_TARGET_STAT can quickly verify whether they
 * exhibit the same +0.10% residual or behave differently.
 *
 * ── Old multiplicative DR model (deprecated) ──
 * Previous iteration used `× (1 − DR_eff/100)` with empirical fudges
 * (`critDrFactor=0.5`, `bossDrFactor=0.75`) that approximated the right answer
 * but produced a systematic ping-pong on crit ↔ no-crit: 0.21% spread vs 0.026%
 * with the additive model. Confirmed by binary: game uses additive netting
 * inside GetBuffDamgeFinalReduce and applies the result as a single
 * multiplicative `(1 − s9)`.
 *
 * VALIDATED:
 *   - C = 1000, skill = DF / 1000 (binary VA 0x1034038 = 0.001f confirms)
 *   - Adv ×1.20 / disadv ×0.80 multiplicative (binary VA 0x1033e70/e14)
 *   - PEN: (1 − PEN/1000) × DEF − PEN_flat in mitigation denominator (PEN_flat
 *     usually 0; non-zero only when char has explicit ARMOR_PIERCE_FLAT buff)
 *   - skillFactor: per-mille, typically 1000 (=1.0× pass-through). Non-1000 values
 *     come from skill-specific BT_DMG that mutate the skill manager's factor.
 *   - Boss +30%, Mage +12%, adv +50% (Fire/Water/Earth) / +30% (Light/Dark)
 *     come through `dmgIncPct` via the buffs reducer.
 *   - Target DR / CDR: subtractive in pool (NOT a multiplicative stage).
 *   - Scaling SWAP: BT_SWAP_STAT_ATTACK replaces ATK with stat × valuePerMille/1000.
 *   - Scaling ADD on percentage stats: BT_DMG_OWNER_STAT (caster) and
 *     BT_DMG_TARGET_STAT (target HP, e.g. Noa S2) → SEPARATE no-pool component.
 *
 * NOT YET MODELED (no observed cases):
 *   - BT_MARKING bonus (×1.15 if defender carries the buff). Hook: `markingActive`.
 *   - MISSED attacks (×0.5). Hook: `missed`. The damage-lab only stores hits, so
 *     never fires there, but downstream tools may need it.
 *
 * ── The "Cap on Maximum Reduction" floor — IMPLEMENTED ──
 * Confirmed by binary disasm of CFormula.CheckDamageRate end:
 *     if (rate < 0.30) rate = 0.30;     // global float at VA 0x1034074 = 0.30
 * So `_fDamageRate` (= our `mod`) has a HARD MINIMUM of 0.30 after all the additive
 * inc/red contributions. This caps damage reduction at 70% (matches dev note's
 * "approximately 60-70% maximum reducible damage" announcement). Never fires in
 * our 11 Noa obs (pool stays in [1.27, 2.15]) but always fires when target stacks
 * extreme DR / CDR / Cri / DMG_REDUCE.
 *
 * ── Full pool composition (from CFormula.CheckDamageRate binary) ──
 * The rate is built as:
 *   rate = base                                (1.0 normal, CHD/1000 crit, CDR/1000 subtracted)
 *   rate += FindBuffAdditionalDamage(defender, attacker)   (sum of attacker BT_DMG_* per-mille)
 *   rate -= FindBuffDamageReduce(defender, attacker)        (sum of defender BT_DMG_REDUCE_* per-mille)
 *   rate += attacker.DMGBoost / 1000                         (DMG UP% stat — already in dmgIncPct)
 *   rate -= defender.DMGReduceRate / 1000                    (DR stat — already in dmgRedPct)
 *   rate = max(rate, 0.30)                                   (the cap above)
 *
 * Buff types iterated by FindBuffAdditionalDamage (all per-mille, additive
 * into the rate as `value/1000 × multiplier`). Confirmed by binary disasm
 * of each cmp #N ; b.ne <next-cmp> dispatch chain at VA 0x2637548.
 *   83  BT_DMG                          → pool (our `pool` target, mult=1)
 *   84  BT_DMG_OWNER_LOST_HP_RATE       → pool_cond { mult = max(0, 1−ownerHpRate) }
 *   85  BT_DMG_TARGET_LOST_HP_RATE      → pool_cond { mult = max(0, 1−targetHpRate) }
 *   86  BT_DMG_OWNER_STAT               → scaling_add_pct/flat (separate component)
 *   87  BT_DMG_TARGET_STAT              → scaling_target_stat (Noa S2)
 *   88  BT_DMG_OWNER_BUFF               → pool_cond { mult = ownerBuffCount }
 *   89  BT_DMG_TARGET_BUFF              → pool_cond { mult = targetBuffCount }
 *   90  BT_DMG_OWNER_DEBUFF             → pool_cond { mult = ownerDebuffCount }
 *   91  BT_DMG_TARGET_DEBUFF            → pool_cond { mult = targetDebuffCount }
 *   95  BT_DMG_TARGET_BREAK             → pool_cond { mult = targetBroken ? 1 : 0 }
 *                                          (gated by RageManager.IsBreak)
 *   96  BT_DMG_TO_BOSS                  → pool with requires:'boss'
 *   97  BT_DMG_KILL_COUNT_STACK         → pool_cond { mult = killCountStack }
 *   98  BT_DMG_NOT_CRITICAL             → pool_cond { mult = !crit ? 1 : 0 }
 *   99  BT_DMG_PVP_CONTENT              → pool_cond { mult = inPvp ? 1 : 0 }
 *   100 BT_DMG_CASTER_STAT              → scaling_add_pct/flat (alias of 86)
 *   101 BT_DMG_CASTER_LOST_HP_RATE      → pool_cond { mult = max(0, 1−casterHpRate) }
 *                                          (orig caster of the buff, ≈ owner in lab)
 *   102 BT_DMG_OWNER_TEAM_BUFF          → pool_cond { mult = teamBuffCount }
 *   103 BT_DMG_(MY|ENEMY)_TEAM_DECREASE → pool_cond { mult = teamDecreaseCount }
 *   104 BT_DMG_MONADGATE_CONTENT        → pool_cond { mult = inMonadGate ? 1 : 0 }
 *   105 BT_DMG_TOWER_CONTENT            → pool_cond { mult = inTower ? 1 : 0 }
 *
 * The pool_cond layer is plumbed through buffs.ts + extract-buffs.ts. All
 * mults default to 0 when their BuffContext field is unset, so adding the
 * layer doesn't change Noa's existing tests (no buff fires until the user
 * sets the gating flag). The lab UI surfaces these gating flags only when a
 * char actually has a buff that needs them.
 *
 * Buff types iterated by FindBuffDamageReduce (defender-side, attacker lab
 * doesn't model these — the formula's `dmgRedPct` covers the defender stat
 * channel, and `finalReducePct` reserves a slot for BT_DMG_REDUCE_FINAL):
 *   107 BT_DMG_REDUCE                   (defender — not extracted)
 *   110 BT_DMG_REDUCE_MY_TEAM_INCREASE  (defender — not extracted)
 *   111 BT_DMG_REDUCE_FINAL             → finalReducePct (max of all 111/112/113)
 *   112 BT_DMG_REDUCE_FINAL_MY_TEAM_INCREASE
 *   113 BT_DMG_REDUCE_FINAL_WITH_OUT_FIRST_SKILL
 *   145 BT_STEALTHED                    (defender — not extracted)
 */

export interface DamageInputs {
  // Attacker
  atk: number
  addAtkNoPool?: number       // Optional secondary ATK contribution that produces a SEPARATE
                              //   damage component (no pool modifier). Source: BT_DMG_OWNER_STAT
                              //   on a percentage-display stat (e.g. Regina CHC ADD), or
                              //   BT_DMG_TARGET_STAT (e.g. Noa S2 target-HP scaling).
  additionalAttackDF?: number // Optional skill-internal "additional attack" DamageFactor
                              //   (per-mille like the main `damageFactor`). Goes through the
                              //   FULL pool path like the main attack.
  damageFactor: number
  chdPct: number              // Critical Damage stat (e.g. 200% means 2× damage on crit baseline).
                              //   On crit: contributes (chd − 100) to the inc group.
  penPct: number              // PEN% (per-mille interpreted as percent here, so 30 = 30%). Used
                              //   in mit denominator as `(1 − PEN/100) × DEF`. Caller divides
                              //   by 10 if loaded raw from BuffTemplet (which is per-mille).
  penFlat?: number            // PEN flat — additional armor pierce subtracted directly from
                              //   `(1 − PEN%)·DEF` in the mitigation denominator. Source:
                              //   CCharacterData.get_PiercePower (binary 0x2736204). Typically
                              //   0; non-zero only with explicit BT_DMG_REDUCE-style buffs.
  skillFactor?: number        // per-mille skill multiplier from CSkillManager.GetSkillFactor
                              //   (binary 0x2439588). Default 1000 (= 1.0× pass-through).
                              //   Multiplied with main path: × (skillFactor / 1000).
  dmgIncPct: number           // attacker's DMG Inc stat (gear + passives + reducer-fed quirks).
                              //   inc group total (everything except crit, handled separately).
  crit: boolean
  // Target
  def: number
  cdmgRedPct: number          // Target's Critical Damage Reduction. On crit: subtracted from pool.
  dmgRedPct: number           // Target's Damage Reduction. Always subtracted from pool.
                              //   See header for empirical justification.
  // Context
  isBoss: boolean             // kept for future use (boss-specific quirks); does not directly
                              //   affect the formula since +30 boss bonus flows via dmgIncPct.
  elem: 'none' | 'adv' | 'disadv'
  // ── Conditional multipliers (from binary; not yet wired in damage-lab UI) ──
  markingActive?: boolean     // True if the defender carries BT_MARKING (type 5). Applies ×1.15.
                              //   Binary check: defender.FindBuffByType(BT_MARKING) != null.
  missed?: boolean            // True if SkillRecord.DamageRateType == MISSED (3). Applies ×0.5
                              //   (= MISSED_DAMAGE_RATE from GameConfigTemplet, val 500 per-mille).
  finalReducePct?: number     // Defender's BT_DMG_REDUCE_FINAL aggregated value (in %, 0..100).
                              //   Sourced from the MAX of defender's active buffs of types
                              //   BT_DMG_REDUCE_FINAL (111), BT_DMG_REDUCE_FINAL_MY_TEAM_INCREASE (112),
                              //   BT_DMG_REDUCE_FINAL_WITH_OUT_FIRST_SKILL (113). Applied
                              //   multiplicatively as `× (1 − finalReducePct/100)` AFTER all other
                              //   factors. This is the "Final Damage Reduction" the dev note refers
                              //   to as separate from the additive pool — bypasses the inc/red cap.
                              //   Default 0 (no buff active).
  // Formula constants (tunable)
  C?: number
  ratioDivisor?: number
  advMult?: number            // default 1.20 (binary VA 0x1033e70)
  disadvMult?: number         // default 0.80 (binary VA 0x1033e14)
  markingMult?: number        // default 1.15 (binary VA 0x1034064) — when markingActive=true
  missedMult?: number         // default 0.5 (GameConfigTemplet MISSED_DAMAGE_RATE/1000) — when missed=true
  rateMin?: number            // default 0.30 (binary VA 0x1034074) — minimum `_fDamageRate` after
                              //   all inc/red additions (= max 70% damage reduction). The "Cap on
                              //   Maximum Reduction" from the dev note. Floor never fires for normal
                              //   inputs (pool ≥ 1.0), but kicks in when defender stacks extreme DR.
  intArithmetic?: boolean     // default false — opt-in floor-at-each-step pipeline mimicking the
                              //   in-game integer arithmetic. Float math is the better default
                              //   since the formula's residual is now bounded by game-internal
                              //   precision (±0.013% on basic, ±0.12% on extras).
  f32arithmetic?: boolean     // default false — emulate the ARM f32 pipeline by wrapping every
                              //   intermediate `*`/`+`/`-`/`/` with Math.fround (= IEEE 754 single
                              //   precision). The binary uses single-precision FPU registers
                              //   (s0..s31), so each step accumulates ~1.19e-7 relative error.
                              //   Combined with `addAtkNoPoolPermille` (target-stat as pool
                              //   addition, matching the binary's GetStatValuePermille int return)
                              //   this should reproduce the game's damage to within rounding —
                              //   useful for closing the residual on Noa S2 obs (#8 / #10).
  addAtkNoPoolPermille?: number  // BT_DMG_TARGET_STAT modeled as a pool addition. The binary
                              //   computes `int(stat × val / 1000)` (truncated), then adds
                              //   `min(int_result, 1000) × 0.001` to the rate. When this field
                              //   is provided AND `f32arithmetic` is on, we apply that exact
                              //   pipeline; otherwise the formula falls back to the legacy
                              //   `addAtkNoPool` separate-component model. Reducer sets this
                              //   alongside `addAtkNoPool` so both modes coexist.
  debugSteps?: boolean        // When true, populate `breakdown.debugSteps` with every f32
                              //   intermediate value (rate aggregation, mit, main path muls,
                              //   target_stat extras). For UI debug panel.
}

export interface DamageBreakdown {
  poolPct: number             // inc_total − red_total
  mod: number                 // 1 + poolPct/100
  mitigation: number          // C / (C + (1−PEN)·DEF − PEN_flat)
  elemMult: number            // 1.20 / 0.80 / 1.00
  mainCalc: number            // main path damage (atk × df × skillFactor × pool × mit × elem × cond)
  extraCalc: number           // ADD-scaling no-pool path — 0 if absent
  additionalCalc: number      // skill-internal additional attack — 0 if absent
  calculated: number          // mainCalc + extraCalc + additionalCalc
  quirks: { name: string; value: string }[]
  // Step-by-step trace of every intermediate f32 op — populated only when
  // `debugSteps: true` is passed in DamageInputs. Used by the lab debug panel
  // to pinpoint where game runtime diverges from our emulation (typically on
  // BT_DMG_TARGET_STAT obs).
  debugSteps?: { label: string; value: number; note?: string }[]
}

export function computeDamage(i: DamageInputs): DamageBreakdown {
  // f32 mode: every intermediate `*`/`+`/`-`/`/` is wrapped with Math.fround so
  // we accumulate exactly like the ARM single-precision FPU. Pass-through in f64.
  const useF32 = i.f32arithmetic ?? false
  const f: (x: number) => number = useF32 ? Math.fround : (x) => x
  const fmul = (a: number, b: number) => f(a * b)
  const fadd = (a: number, b: number) => f(a + b)
  const fsub = (a: number, b: number) => f(a - b)
  const fdiv = (a: number, b: number) => f(a / b)

  const C = f(i.C ?? 1000)
  const ratioDivisor = f(i.ratioDivisor ?? 1000)
  const advMult = f(i.advMult ?? 1.20)
  const disadvMult = f(i.disadvMult ?? 0.80)
  const markingMult = f(i.markingMult ?? 1.15)
  const missedMult = f(i.missedMult ?? 0.5)
  const rateMin = f(i.rateMin ?? 0.30)
  const skillFactor = f(i.skillFactor ?? 1000)
  const penFlat = f(i.penFlat ?? 0)
  const PER_MILLE = f(0.001)              // binary loads this from .rodata at 0x1034038

  const quirks: { name: string; value: string }[] = []
  // Debug step capture — pushes one entry per f32 intermediate so the lab UI
  // can pinpoint where game runtime diverges from our emulation.
  const debug: { label: string; value: number; note?: string }[] = []
  const trace = (label: string, value: number, note?: string) => {
    if (i.debugSteps) debug.push({ label, value, note })
  }
  trace('PER_MILLE constant', PER_MILLE, 'f32 of 0.001 from .rodata 0x1034038')
  trace('Mode', useF32 ? 1 : 0, useF32 ? 'f32 emulation' : 'f64 default')

  // ── Rate aggregation (pool) ────────────────────────────────────────────
  // Confirmed by binary disasm of CFormula.CheckDamageRate (VA 0x2b53518):
  //
  //   1. base = chd × 0.001 (f32)            if crit; else base = 1.0
  //   2. if cdr > 0: base += cdr × −0.001    (f32 single fadd, decoder = −0.001 from
  //                                           .rodata 0x1033d78 = −0.0010000000474974513f)
  //   3. additionalSum = FindBuffAdditionalDamage(...)
  //                    = Σ (attacker BT_DMG_* contribs)  ← incremental f32 fadd
  //                    [target_stat → capped/1000, boss → 300×0.001, etc.]
  //      if additionalSum != 0:  base += additionalSum  (f32, single fadd)
  //   4. reduceSum = FindBuffDamageReduce(...)  ← Σ defender BT_DMG_REDUCE_*
  //      if reduceSum != 0:  base −= reduceSum  (f32, single fsub)
  //   5. base += DMGBoost × 0.001  (gear stat from CharacterData)
  //   6. base −= DR × 0.001        (uses the −0.001 decoder for fadd)
  //   7. if base < 0.30: base = 0.30   (rateMin from .rodata 0x1034074 = 0.30000001f)
  //
  // We pre-aggregate poolPct (= boss BT_DMG_TO_BOSS + Awakening + char BT_DMG)
  // and target_stat (via addAtkNoPoolPermille) into a single `additionalSum`
  // before adding to rate, so the f32 ordering matches the binary at the ULP.
  let rate: number
  if (i.crit) {
    const chdPermille = fmul(f(i.chdPct), f(10))
    trace('1a. chdPermille = chd × 10', chdPermille, `chd ${i.chdPct} → permille`)
    rate = fmul(chdPermille, PER_MILLE)
    trace('1b. rate = chdPermille × 0.001', rate, 'crit base')
    if (i.cdmgRedPct > 0) {
      const cdrPermille = fmul(f(i.cdmgRedPct), f(10))
      const cdrContrib = fmul(cdrPermille, f(-Math.fround(0.001)))
      trace('2a. cdrContrib = cdr × −0.001', cdrContrib)
      rate = fadd(rate, cdrContrib)
      trace('2b. rate += cdrContrib', rate, 'after CDR sub')
    }
    quirks.push({ name: 'Crit base', value: `CHD ${i.chdPct.toFixed(1)}% → rate ${rate.toFixed(4)}` })
  } else {
    rate = f(1)
    trace('1. rate = 1 (non-crit base)', rate)
  }

  const useTargetStatPool = useF32 && !!i.addAtkNoPoolPermille && i.addAtkNoPoolPermille > 0
  let additionalSum = f(0)
  if (useTargetStatPool) {
    const trunc = Math.trunc(i.addAtkNoPoolPermille!)
    const capped = Math.min(trunc, 1000)
    const contribution = fmul(f(capped), PER_MILLE)
    trace('3a. target_stat permille (from GetStatValuePermille)', trunc, 'before cap')
    trace('3b. target_stat capped at 1000', capped)
    trace('3c. target_stat contrib = capped × 0.001', contribution, 'BT_DMG_TARGET_STAT add to rate')
    additionalSum = fadd(additionalSum, contribution)
    trace('3d. additionalSum after target_stat', additionalSum)
    quirks.push({ name: 'Target-stat pool', value: `+${contribution.toFixed(4)} (permille=${trunc}, capped=${capped})` })
  }
  if (i.dmgIncPct !== 0) {
    const incPermille = fmul(f(i.dmgIncPct), f(10))
    const incContrib = fmul(incPermille, PER_MILLE)
    trace('4a. dmgInc permille', incPermille, `dmgIncPct ${i.dmgIncPct}%`)
    trace('4b. dmgInc contrib = permille × 0.001', incContrib, 'boss BT_DMG_TO_BOSS + Awakening + ...')
    additionalSum = fadd(additionalSum, incContrib)
    trace('4c. additionalSum after dmgInc', additionalSum)
  }
  if (additionalSum !== 0) {
    rate = fadd(rate, additionalSum)
    trace('5. rate += additionalSum', rate, 'after FindBuffAdditionalDamage')
  }

  if (i.dmgRedPct > 0) {
    const drPermille = fmul(f(i.dmgRedPct), f(10))
    const drContrib = fmul(drPermille, f(-Math.fround(0.001)))
    trace('6a. DR permille', drPermille, `targetDmgRed ${i.dmgRedPct}%`)
    trace('6b. DR contrib = permille × −0.001', drContrib)
    rate = fadd(rate, drContrib)
    trace('6c. rate += DR contrib', rate, 'after DR (binary step 6)')
    quirks.push({ name: 'Target DR (red)', value: `−${i.dmgRedPct.toFixed(2)}%` })
  }

  const modRaw = rate
  const mod = modRaw < rateMin ? rateMin : modRaw
  trace('7. mod = max(rate, 0.30)', mod, 'final rate after cap')
  if (modRaw < rateMin) {
    quirks.push({ name: 'Rate cap', value: `mod clamped from ${modRaw.toFixed(3)} to ${rateMin} (max 70% reduction)` })
  }
  const poolPct = (rate - 1) * 100

  // ── Mitigation ─────────────────────────────────────────────────────────
  const pen = fdiv(f(i.penPct), f(100))
  trace('8a. pen = penPct / 100', pen)
  const oneMinusPen = fsub(f(1), pen)
  trace('8b. (1 − pen)', oneMinusPen)
  const defMul = fmul(oneMinusPen, f(i.def))
  trace('8c. (1−pen) × DEF', defMul, `def ${i.def}`)
  const mitDenom = fsub(fadd(C, defMul), penFlat)
  trace('8d. mitDenom = C + (1−pen)×DEF − penFlat', mitDenom)
  const mitigation = mitDenom > 0 ? fdiv(C, mitDenom) : C
  trace('8e. mit = C / mitDenom', mitigation)

  // ── Element / conditional multipliers ──────────────────────────────────
  const elemMult = i.elem === 'adv' ? advMult : i.elem === 'disadv' ? disadvMult : f(1)
  if (i.elem === 'adv') {
    quirks.push({ name: 'Adv', value: `×${advMult} mult` })
  } else if (i.elem === 'disadv') {
    quirks.push({ name: 'Disadv', value: `×${disadvMult} mult` })
  }
  if (i.markingActive) {
    quirks.push({ name: 'Marked target', value: `×${markingMult} (BT_MARKING)` })
  }
  if (i.missed) {
    quirks.push({ name: 'Missed', value: `×${missedMult} (MISSED_DAMAGE_RATE)` })
  }
  if (skillFactor !== 1000) {
    quirks.push({ name: 'SkillFactor', value: `×${(skillFactor / 1000).toFixed(3)}` })
  }
  if (penFlat > 0) {
    quirks.push({ name: 'PEN flat', value: `−${penFlat.toFixed(0)} on (1−PEN%)·DEF` })
  }

  const useFloor = i.intArithmetic ?? false
  const fl = (v: number) => useFloor ? Math.floor(v) : v

  const markingFactor = i.markingActive ? markingMult : f(1)
  const missedFactor  = i.missed ? missedMult : f(1)
  const skillFactorMult = fdiv(skillFactor, f(1000))
  const finalReducePct = Math.max(0, Math.min(100, i.finalReducePct ?? 0))
  const finalReduceMult = fsub(f(1), fdiv(f(finalReducePct), f(100)))
  if (finalReducePct > 0) {
    quirks.push({ name: 'Final reduce', value: `×${finalReduceMult.toFixed(3)} (BT_DMG_REDUCE_FINAL)` })
  }

  // ── Main damage path ───────────────────────────────────────────────────
  // Binary multiplication order (CFormula inner CalcDamage):
  //   s1 = (skillFactor/1000) × ATK
  //   s1 = s1 × (DF/1000)
  //   s0 = s1 × mit
  //   s8 = mod × s0
  //   s9 = s8 × marking
  //   s8 = s9 × elem
  //   s8 = s8 × missed
  //   s8 = s8 × (1 − finalReduce)
  //   return max(1, floor(s8))
  const atkInt = fl(f(i.atk))
  trace('9. atk (f32)', atkInt, `input ${i.atk}`)
  let mc: number = atkInt
  if (skillFactorMult !== 1.0) {
    mc = fl(fmul(mc, skillFactorMult))
    trace('10. mc × skillFactor', mc)
  }
  const dfRatio = fdiv(f(i.damageFactor), ratioDivisor)
  trace('11a. dfRatio = DF / 1000', dfRatio, `DF ${i.damageFactor}`)
  mc = fl(fmul(mc, dfRatio))
  trace('11b. mc × dfRatio', mc, 'after ATK × DF/1000')
  mc = fl(fmul(mc, mitigation))
  trace('12. mc × mitigation', mc, 'after mit')
  mc = fl(fmul(mc, mod))
  trace('13. mc × mod', mc, 'pool applied (LAST step before elem)')
  if (markingFactor !== 1.0) {
    mc = fl(fmul(mc, markingFactor))
    trace('14. mc × marking', mc, '×1.15 for BT_MARKING')
  }
  mc = fmul(mc, elemMult)
  trace('15. mc × elem', mc, `elem ${i.elem} → ×${elemMult}`)
  if (missedFactor !== 1.0) {
    mc = fl(fmul(mc, missedFactor))
    trace('16. mc × missed', mc)
  }
  if (finalReduceMult !== 1.0) {
    mc = fl(fmul(mc, finalReduceMult))
    trace('17. mc × (1−finalReduce)', mc)
  }
  const mainCalc = Math.max(1, mc)
  trace('18. mainCalc = max(1, mc)', mainCalc, `floor → ${Math.floor(mainCalc)}`)

  // ── Extra path (legacy: addAtkNoPool separate component) ───────────────
  // Skipped only when target_stat is folded into mod via the f32 binary path.
  // In f64 default mode, this is the path Noa S2 has always used.
  let extraCalc = 0
  const addAtk = i.addAtkNoPool ?? 0
  if (!useTargetStatPool && addAtk > 0) {
    const eInt = fl(f(addAtk))
    let ec: number = eInt
    if (skillFactorMult !== 1.0) ec = fl(fmul(ec, skillFactorMult))
    ec = fl(fmul(ec, fdiv(f(i.damageFactor), ratioDivisor)))
    ec = fl(fmul(ec, mitigation))
    if (markingFactor !== 1.0) ec = fl(fmul(ec, markingFactor))
    ec = fmul(ec, elemMult)
    if (missedFactor !== 1.0) ec = fl(fmul(ec, missedFactor))
    if (finalReduceMult !== 1.0) ec = fl(fmul(ec, finalReduceMult))
    extraCalc = ec
    quirks.push({ name: 'Scaling+ (no pool)', value: `+${extraCalc.toFixed(0)} from addAtkNoPool=${addAtk.toFixed(1)}` })
  }

  // ── Skill-internal additional attack ───────────────────────────────────
  let additionalCalc = 0
  const addDF = i.additionalAttackDF ?? 0
  if (addDF > 0) {
    let ac: number = atkInt
    if (skillFactorMult !== 1.0) ac = fl(fmul(ac, skillFactorMult))
    ac = fl(fmul(ac, fdiv(f(addDF), ratioDivisor)))
    ac = fl(fmul(ac, mitigation))
    ac = fl(fmul(ac, mod))
    if (markingFactor !== 1.0) ac = fl(fmul(ac, markingFactor))
    ac = fmul(ac, elemMult)
    if (missedFactor !== 1.0) ac = fl(fmul(ac, missedFactor))
    if (finalReduceMult !== 1.0) ac = fl(fmul(ac, finalReduceMult))
    additionalCalc = ac
    quirks.push({ name: 'Additional attack', value: `+${additionalCalc.toFixed(0)} (DF=${addDF.toFixed(0)})` })
  }

  const calculated = mainCalc + extraCalc + additionalCalc
  trace('99. final calculated', calculated, `mainCalc ${mainCalc.toFixed(3)} + extraCalc ${extraCalc.toFixed(3)} + additionalCalc ${additionalCalc.toFixed(3)} → floor = ${Math.floor(calculated)}`)

  return { poolPct, mod, mitigation, elemMult, mainCalc, extraCalc, additionalCalc, calculated, quirks, debugSteps: i.debugSteps ? debug : undefined }
}
