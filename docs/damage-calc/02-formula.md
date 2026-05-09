# Damage Calculator V3 — 02. Formula

> **Audience.** Engine engineers. Anyone implementing or modifying
> `src/lib/damage/v2/{formula,recompute,buffs,extract-*,f32}.ts`.
>
> **Scope.** The binary-faithful damage formula, every f32 step, the
> stat interpolation primitives (`CalcStat`, `CalcFinalStat`), the
> buff dispatch chains (additive pool / defender reduce / final reduce
> MAX), the stat-stacking model used to prefill char stats at Lv 100,
> and the validation contract.
>
> **Source of truth.** This document was reconstructed from
> `data/admin/damage-lab-v2-spec.md` (binary RE notes), the live
> `src/lib/damage/v2/formula.ts`, and observation fixtures in
> `data/admin/damage-lab-observations-v2.jsonl`. Where this doc and
> the binary disagree, **the binary wins** — file an issue.

---

## 1. The damage formula at a glance

```
Dmg = ATK × (skillFactor/1000) × (DF/1000) × mit × rate
    × (markingActive ? 1.15 : 1.0)        // BT_MARKING on defender
    × elem_mult                            // 1.20 / 0.80 / 1.0
    × (missed ? 0.5 : 1.0)                 // SkillRecord.DamageRateType == MISSED (3)
    × (1 − finalReduce/100)                // BT_DMG_REDUCE_FINAL agg MAX

mit  = C / (C + (1 − PEN/100) × DEF − PEN_flat)
rate = base + Σ(attacker pool) − Σ(defender reduce) + DMG_INC/1000 − DMG_RED/1000
rate = max(rate, 0.30)                     // RATE_MIN floor (cap on max reduction)

final = max(1, floor(Dmg))                 // single floor at the end (frintm + fcvtms)
```

Crit base: `1.0` non-crit, `CHD/1000` on crit, then `−CDR/1000` if crit
and target carries CDmgRed.

The chain is bit-faithful with `CFormula.CalcDamage` (VA `0x2B53EC8`)
and its helper `g__CalcDamage|17_0` (VA `0x2B54660`). Every intermediate
step is wrapped in `Math.fround` to match the ARM64 single-precision
FPU register chain (`s0..s31`).

---

## 2. Constants (`.rodata`)

The binary stores its constants at fixed virtual addresses. Their
exact f64 expansion of the f32 bit pattern:

```ts
export const RODATA = {
  /** −0.001f — per-mille decoder for negative additions (DR, CDR, BT_DMG_REDUCE). VA 0x1033D78. */
  PER_MILLE_NEG: -0.0010000000474974513,
  /** +0.001f — per-mille decoder for positive additions (CHD, BT_DMG, target_stat). VA 0x1034038. */
  PER_MILLE_POS:  0.0010000000474974513,
  /** 1.15f — BT_MARKING multiplier. VA 0x1034064. */
  MARKING:   1.149999976158142,
  /** 0.30f — rateMin, the "Cap on Maximum Reduction" floor (max −70% damage). VA 0x1034074. */
  RATE_MIN:  0.30000001192092896,
  /** 1.20f — element advantage multiplier. VA 0x1033E70. */
  ADV:       1.2000000476837158,
  /** 0.80f — element disadvantage multiplier. VA 0x1033E14. */
  DISADV:    0.800000011920929,
  /** 0.5 — MISSED_DAMAGE_RATE (GameConfigTemplet val 500‰). */
  MISSED_DAMAGE_RATE: 0.5,
  /** 99.0f — divisor for level interpolation (CalcStat, span Lv 1..100). */
  LEVEL_INTERP_DIVISOR: 99,
  /** 1000.0f — cap on `BT_DMG_TARGET_STAT` permille contributions before adding to rate. */
  PERMILLE_CAP: 1000,
} as const
```

**`Math.fround(literal)` is a no-op** when the literal is already at
f32 precision in f64 — but wrap critical operations with `f()` anyway
to make intent explicit (every f32 op rounds; the wrapper is the
contract, not the optimization).

### 2.1 f32 primitives

```ts
export const f = Math.fround

export function f32mul(a: number, b: number): number { return Math.fround(a * b) }
export function f32add(a: number, b: number): number { return Math.fround(a + b) }
export function f32sub(a: number, b: number): number { return Math.fround(a - b) }
export function f32div(a: number, b: number): number { return Math.fround(a / b) }
```

**Never use unwrapped JS arithmetic in the formula.** `(a + b) * c`
keeps f64 precision and drifts on edge cases (the binary does
`f32(f32(a + b) × c)`).

---

## 3. Stat interpolation (`CalcStat`)

Mirrors `CFormula.CalcStat` (VA `0x2B52D24`). Used for char stats
(Lv 1..100), monster stats (per-spawn-slot level), and any context
where a stat scales linearly with level.

```ts
export function interpolate(min: number, max: number, level: number): number {
  if (level <= 1) return min
  const diff = Math.fround(max - min)
  const div  = Math.fround(diff / Math.fround(RODATA.LEVEL_INTERP_DIVISOR))
  const mul  = Math.fround(div * Math.fround(level - 1))
  const sum  = Math.fround(mul + Math.fround(min))
  return Math.floor(sum)   // fcvtms — toward −∞
}
```

### 3.1 Properties

- **No upper cap.** Extrapolation past level 100 is intentional; Joint
  Challenge and Adventure License tiers spawn monsters at Lv 110, 120,
  even higher. The linear formula stays empirically correct.
- **`Math.floor`, not `Math.round`.** `fcvtms` truncates toward −∞ on
  ARM. This matches negative values (rare for stats but possible in
  per-mille rate computations).
- **Boundary at Lv 1.** The formula short-circuits to `min` to match
  the binary's `cmp w8, #1; b.le ...` early return.

### 3.2 `applyAdvantageRate`

Per-mille rate adjustment. Used by monster stat readouts to apply
`SpawnAdvantageRate` (signed per-mille):

```ts
export function applyAdvantageRate(stat: number, ratePermille: number): number {
  if (ratePermille === 0) return stat
  const rate = Math.fround(
    Math.fround(1) + Math.fround(ratePermille) * Math.fround(RODATA.PER_MILLE_POS)
  )
  return Math.floor(Math.fround(rate * stat))
}
```

Validated: Amadeus St2 Lv 30 with HP rate `−574‰` → `floor(0.426 × 52707) = 22453`.
This is exactly what `BT_DMG_TARGET_STAT` reads as ST_HP for Noa S2's
HP-scaling attack.

### 3.3 `interpolateRated`

Combined `interpolate` + `applyAdvantageRate` with a **single floor**
at the end. The binary keeps f32 precision between the level-interp
step and the rate multiplication, flooring once when emitting the int
the rest of the engine reads.

```ts
export function interpolateRated(
  min: number, max: number, level: number, ratePermille: number,
): number {
  if (level <= 1) {
    return ratePermille === 0 ? min : applyAdvantageRate(min, ratePermille)
  }
  const diff = Math.fround(max - min)
  const div  = Math.fround(diff / Math.fround(RODATA.LEVEL_INTERP_DIVISOR))
  const mul  = Math.fround(div * Math.fround(level - 1))
  const sumF32 = Math.fround(mul + Math.fround(min))   // pre-floor
  if (ratePermille === 0) return Math.floor(sumF32)
  const rate = Math.fround(
    Math.fround(1) + Math.fround(ratePermille) * Math.fround(RODATA.PER_MILLE_POS)
  )
  return Math.floor(Math.fround(rate * sumF32))         // single floor
}
```

**Why this matters.** Calling `applyAdvantageRate(interpolate(...), rate)`
floors twice. Empirically that's wrong by up to 1 unit (Ars Nova St1
Lv 25 HP rate `−616‰`: 14352 in-game vs 14351 with double-floor).
Use `interpolateRated` everywhere monster stats are read for the
calc; never compose the two helpers manually.

---

## 4. Master final-stat formula (`CalcFinalStat`)

Mirrors `CFormula.CalcFinalStat` (VA `0x2B52E28`). The full game-engine
formula handles every stat layer (codex, archive, item options, buffs).
For the public calc, it shows up as the prefill computation for chars.

```
final = floor(
  baseValue × ArchiveStatRate / 1000 +
  (BuffValueRate + 1000) × (
    ((sumValues) × (1000 + sumRates)) / 1000
    + ItemOptionValue + BuffValue
  ) / 1000
)
```

For monsters (the calc target), simplifies to:

```ts
sumValues = baseValue                        // post-interpolation
sumRates = SpawnAdvantageRate                // per-mille, signed
ItemOptionValue = 0
BuffValue = 0
BuffValueRate = 0
ArchiveStatRate = 0  // monsters don't have a codex
```

→ which collapses to `interpolateRated(min, max, level, rate)`.
Validated on Amadeus St2: `22453 = floor(52707 × 426 / 1000)` (with
rate `−574‰`).

---

## 5. Mitigation

```
mit = C / (C + (1 − PEN/100) × DEF − PEN_flat)
```

`C` is a tunable constant, default `1000`. `PEN` is attacker
penetration % (additive: gear PEN + buff PEN). `PEN_flat` is the
caster's `PiercePower` flat value (from `CCharacterData.get_PiercePower`,
VA `0x2736204`).

In the formula:

```ts
const pen         = f32div(f(i.penPct), f(100))
const oneMinusPen = f32sub(f(1), pen)
const defMul      = f32mul(oneMinusPen, f(i.def))
const mitDenom    = f32sub(f32add(C, defMul), penFlat)
const mitigation  = mitDenom > 0 ? f32div(C, mitDenom) : C
```

`mitDenom > 0` guard: if the denominator goes non-positive (extreme
PEN_flat values), the mitigation falls back to `C` (i.e., 1.0). Should
never happen with valid inputs but the binary has this guard, so the
TS port mirrors it.

### 5.1 Effective HP (EHP) — for the stats guide, not the calc

For the EHP calculation users see in the stats guide:

```
EHP             = HP × (1 + DEF / 1000)                       // no PEN
EHP (w/ PEN)    = HP × (1 + (1 − PEN%) × DEF / 1000)          // PEN-adjusted
```

These are derived from inverting the mitigation formula at `C = 1000`.
The calc itself doesn't compute EHP — the stats guide does (see
`src/app/[lang]/guides/_contents/general-guides/stats/`).

---

## 6. Rate (pool) aggregation

The damage rate is built from a base value, additive contributions
from attacker buffs, subtractive contributions from defender buffs, and
gear stats. Then floored at `RATE_MIN = 0.30`.

### 6.1 Base

```ts
let rate: number
if (i.crit) {
  // base = chd × 0.001 (e.g. CHD 188% → rate 1.88)
  const chdPermille = f32mul(f(i.chdPct), f(10))
  rate = f32mul(chdPermille, PER_MILLE_POS)
  // base += cdr × −0.001 (only on crit; subtracted from CHD pool)
  if (i.cdmgRedPct > 0) {
    const cdrPermille = f32mul(f(i.cdmgRedPct), f(10))
    const cdrContrib  = f32mul(cdrPermille, PER_MILLE_NEG)
    rate = f32add(rate, cdrContrib)
  }
} else {
  rate = f(1)
}
```

CHD stat is the **TOTAL** crit damage multiplier (CHD = 188 → ×1.88,
not "+88% on top of base"). This matches the in-game stat sheet display.

### 6.2 Additive sum (attacker pool)

```
additionalSum = target_stat_capped + dmgInc_permille
```

- **`target_stat_capped`** comes from `BT_DMG_TARGET_STAT` (Noa S2):
  `min(floor(targetStat × val / 1000), 1000)` per-mille, multiplied by
  `PER_MILLE_POS`. Capped at 1000 inside the formula. See §8 type 87.
- **`dmgInc_permille`** is the pre-aggregated pool % (boss +30, mage
  +12, adv +50, gear DMG↑, etc.) converted from % to per-mille
  (`× 10`) then to ratio (`× PER_MILLE_POS`).

The reducer (`buffs.ts`) is responsible for summing all `BT_DMG_*`
buffs into the `dmgIncPct` value passed into `computeDamage`. The
formula never iterates buffs.

### 6.3 Subtractive sum (defender reduce)

```
rate -= DR × 0.001
```

`DR` here is the gear DR + buff-aggregated `BT_DMG_REDUCE` /
`BT_DMG_REDUCE_MY_TEAM_INCREASE` / `BT_STEALTHED` (types 107, 110,
145). Negative values are legal: a boss passive `BT_DMG_REDUCE val=-150`
gives `+15%` damage taken (Amadeus Prelude case). The formula doesn't
gate on sign; gating would silently drop the bonus.

### 6.4 Cap on Max Reduction (`RATE_MIN`)

```ts
const rateRaw = rate
if (rate < rateMin) {
  rate = rateMin   // cap fired — clamps at 0.30 (= −70% damage)
}
```

This is the "Cap on Maximum Reduction" the in-game help text refers
to. The cap fires when the combined pool + DR + CDR pushes the rate
below 0.30. It implies that a defender cannot reduce damage by more
than 70% from the rate side. (Other multipliers — element disadv,
final reduce, mitigation — stack independently.)

**Tracking the cap.** The breakdown UI surfaces both `rate` (post-cap)
and `rateRaw` (pre-cap). When `rate !== rateRaw`, display "Capped at
70% reduction" so the user understands stacking more DR/CDR has no
further effect.

---

## 7. Element multiplier

```
attacker_elem ≤ 2 (Earth/Water/Fire) AND target_elem ≤ 2 → cycle RPS
attacker_elem > 2 (Light/Dark) OR target_elem > 2 → branch L/D
```

### 7.1 RPS branch

`Fire > Earth, Earth > Water, Water > Fire`:

```ts
const ELEMENT_ADV: Record<string, string> = {
  Fire: 'Earth', Earth: 'Water', Water: 'Fire',
  Light: 'Dark', Dark: 'Light',
}

function detectElementRelation(att: string, tgt: string): 'adv'|'disadv'|'none' {
  if (!att || !tgt || att === tgt) return 'none'
  if (ELEMENT_ADV[att] === tgt) return 'adv'
  if (ELEMENT_ADV[tgt] === att) return 'disadv'
  return 'none'
}
```

Multiplier: `1.20` adv / `0.80` disadv / `1.00` neutral.

### 7.2 Light ↔ Dark branch

Mutual advantage:

```
if attacker_elem < 3 → return 1.0   (F/W/E vs L/D)
if target_elem ≤ 2 → return 1.0      (L/D vs F/W/E)
if attacker == target → return 1.0   (L vs L, D vs D)
else → 1.20                          (L↔D mutual adv)
```

Validated: Maxwell Dark → Ars Nova Light ×3 obs ratio 1.000, Skadi
Light → Amadeus Dark ×5 obs ratio 1.000.

### 7.3 The Light/Dark passive coexists separately

`Awakening_Element_Dmg_Dark_Light_10` is a **separate** mechanism from
the elem multiplier:

- **Element mult**: ×1.20 only when attacker is L/D AND target is the
  opposite L/D.
- **L/D passive**: `BT_DMG = +300‰` with `BuffConditionType: NONE` — fires
  on **every** target, regardless of element.

The two stack. L attacker vs D defender: ×1.20 elem mult AND +30%
pool. L attacker vs F/W/E defender: ×1.0 elem mult BUT still +30%
pool. Don't conflate them.

### 7.4 Earth/Water/Fire +50% pool

`Awakening_Element_Dmg_10` (groups 10101/10201/10301): `BT_DMG = +500‰`
with `BuffConditionType: ATTACKER_ELEMENT_WIN` — only fires on
target advantage. So an Earth attacker vs a Water defender gets:

- ×1.20 elem mult (RPS) AND
- +50% pool (Earth advantage passive).

Both stack. Note: for Earth/Water/Fire, the +50% **only fires on adv**;
unlike the L/D passive which fires on every target.

---

## 8. Buff dispatch tables

The reducer (`src/lib/damage/v2/buffs.ts`) walks every applicable
buff and sums contributions into `ReducedBuffs`. The formula never
sees individual buffs; it sees aggregated values.

This section enumerates each `BT_*` type the engine handles, with its
ARM64 dispatch site for cross-reference.

### 8.1 Additive pool (`FindBuffAdditionalDamage` VA `0x2637548`)

Pipeline (per buff): `contrib = (value × multiplier) × 0.001` (f32),
accumulated into the additive pool sum.

| Type # | `BT_*` | Multiplier | VA |
|---|---|---|---|
| 83  | `BT_DMG`                    | `1`                                      | `0x26376b4` |
| 84  | `BT_DMG_OWNER_LOST_HP_RATE` | `max(0, 1 − ownerHpRate)`                 | `0x26376f8` |
| 85  | `BT_DMG_TARGET_LOST_HP_RATE`| `max(0, 1 − targetHpRate)`                | `0x2637744` |
| 86  | `BT_DMG_OWNER_STAT`         | `min(floor(ownerStat × val/1000), 1000)`  | `0x26377b4` |
| 87  | `BT_DMG_TARGET_STAT`        | `min(floor(targetStat × val/1000), 1000)` | `0x263781c` |
| 88  | `BT_DMG_OWNER_BUFF`         | `ownerBuffCount` (`GetBuffCount(side=0)`) | `0x2637938` |
| 89  | `BT_DMG_TARGET_BUFF`        | `targetBuffCount` (side=0)                | `0x2637988` |
| 90  | `BT_DMG_OWNER_DEBUFF`       | `ownerDebuffCount` (side=1)               | `0x26379dc` |
| 91  | `BT_DMG_TARGET_DEBUFF`      | `targetDebuffCount` (side=1)              | `0x2637a2c` |
| 95  | `BT_DMG_TARGET_BREAK`       | `target.IsBreak ? 1 : 0`                  | `0x2637a94` |
| 96  | `BT_DMG_TO_BOSS`            | `target.Type ≥ 4 ? 1 : 0` (boss types)    | `0x2637af0` |
| 97  | `BT_DMG_KILL_COUNT_STACK`   | **1** (runtime stack baked into Value)    | `0x2637b50` |
| 98  | `BT_DMG_NOT_CRITICAL`       | `target.DamageRateType ∈ {1,3} ? 1 : 0`   | `0x2637b90` |
| 99  | `BT_DMG_PVP_CONTENT`        | `IsPvp ? 1 : 0`                           | `0x2637c04` |
| 100 | `BT_DMG_CASTER_STAT`        | as 86 but uses original caster (`buff[0x18]`) | `0x26378a0` |
| 101 | `BT_DMG_CASTER_LOST_HP_RATE`| `max(0, 1 − casterHpRate)`                | `0x2637c84` |
| 102 | `BT_DMG_OWNER_TEAM_BUFF`    | `Σ teamMember.GetBuffList(side=0).Count`  | `0x2637d0c` |
| 103 | `BT_DMG_MY_TEAM_DECREASE`   | analogous to 102                          | `0x2637e20` |
| 104 | `BT_DMG_MONADGATE_CONTENT`  | `IsMonadGate ? 1 : 0`                     | `0x2637f18` |
| 105 | `BT_DMG_TOWER_CONTENT`      | `IsTower ? 1 : 0`                         | `0x2637fec` |

### 8.2 `BT_DMG_TARGET_STAT` (87) — exact f32 chain

The most reverse-engineered handler (Noa S2 +3% × HP). Inline at
VA `0x2637824`:

```ts
const PER_MILLE_F32 = Math.fround(0.001)            // .rodata 0x1034038
const statF32 = Math.fround(targetStatValue)        // ST_HP from get_MaxHP
const valF32  = Math.fround(buffTemplet.Value)      // ex: 30
const step1   = Math.fround(statF32 * PER_MILLE_F32)
const step2   = Math.fround(step1 * valF32)
const result  = Math.floor(step2)                   // GetStatValuePermille
const capped  = Math.min(result, 1000)              // cap at 1000 permille
const contrib = Math.fround(capped * PER_MILLE_F32) // back to ratio
accumulator   = Math.fround(accumulator + contrib)
```

`ST_HP` routes through `CCharacterData.get_MaxHP()` (VA `0x27358DC`).
The `MaxHPRate` (offset `0x100`) defaults to `1.0` (`ResetMaxHPRate`
VA `0x263A0B4`) — meaning the buff reads the BASE max HP, not the
current bar.

### 8.3 Type 94 — `BT_DMG_ENEMY_TEAM_DECREASE`

Type 94 lives in a **dedicated handler**: `FindBuffEnemyTeamDecreaseDamageRate`
VA `0x2639194`. Wrapper: `CFormula.AddCheckEnemyTeamDecreaseDamageRate`
VA `0x2B53E80`. Caller: `CCharacterBattle.UseSkill` (offset `+0xBE8 =
0x262E838`).

```
// Inside UseSkill, AFTER CFormula.CheckDamageRate populates fDamageRate:
w28 = count of valid (alive, non-destroyed) members on the *enemy* team
w23 = 4 − w28                            // = number of dead enemies
fDamageRate = SkillRecord.fDamageRate    // current rate after CheckDamageRate

call AddCheckEnemyTeamDecreaseDamageRate(caster, w23, &fDamageRate):
  s0 = FindBuffEnemyTeamDecreaseDamageRate(caster)   // sums Σ(value × 0.001)
  fDamageRate += s0 × float(w23)                     // multiplied by dead count

SkillRecord.fDamageRate = fDamageRate    // store back
```

Activation gates (in addition to `CheckAvailable`):

- `skill.TargetTeamType == 3` (skill targets enemies)
- `SkillRecord.fDamageRate > 0` (damage skill, not a heal/buff)
- `SkillRecord.DamageRateType - 1 < 3` (standard damage types)

**For Maxwell `2000028_1_3` Value=100**: contribution = `0.1 × deadEnemyCount`
to the rate. With 3 dead enemies: +30% pool.

The reducer must accept `enemyTeamDecreaseCount` from
`RecomputeContext` and apply this multiplier on type-94 buffs.

### 8.4 Defender reduce (`FindBuffDamageReduce` VA `0x2638638`)

Pipeline: **integer accumulator** (sum of permille values), multiplied
by `0.001` at the end. Subtracted from rate via `PER_MILLE_NEG`.

| Type # | `BT_*` | Multiplier | VA |
|---|---|---|---|
| 107 | `BT_DMG_REDUCE`                  | `1`                                | `0x263876c` |
| 110 | `BT_DMG_REDUCE_MY_TEAM_INCREASE` | `aliveTeamCount − 1`               | `0x2638820` |
| 145 | `BT_STEALTHED`                   | `1` (simple handler)               | `0x26387cc` |

Type 110 iterates the caster's team, counts `IsAlive`, subtracts 1
(excludes self), multiplies the buff's permille by that count.

### 8.5 Final reduce (`GetBuffDamgeFinalReduce` VA `0x2638ADC`)

Pipeline: **MAX**, not sum. Iterates and keeps the largest contribution.

| Type # | `BT_*` | Multiplier | VA |
|---|---|---|---|
| 111 | `BT_DMG_REDUCE_FINAL`                       | `1`                       | `0x2638c4c` |
| 112 | `BT_DMG_REDUCE_FINAL_MY_TEAM_INCREASE`      | `aliveTeamCount − 1`      | `0x2638cbc` |
| 113 | `BT_DMG_REDUCE_FINAL_WITH_OUT_FIRST_SKILL`  | gated on "first skill"    | `0x2638dc0` |

Pattern (type 111 binary at `0x2638c64`):

```
s9 = *acc                       // current accumulator (= max so far)
s0 = value × 0.001              // candidate
if s9 < s0:                     // if candidate larger
  *acc = s0                     // keep new max
  buff.MarkUsedHitOverThisSkill()
```

Applied as `× (1 − finalReduce/100)` at the end of the formula
(post-elem, post-marking, post-missed). The MAX semantics mean
stacking multiple `BT_DMG_REDUCE_FINAL` buffs only counts the largest.

Examples in-game:
- Amadeus Prelude of the Waning Crescent (St 4+) — applies `BT_DMG_REDUCE_FINAL`
  reducing damage from F/W/E by ~50%.
- The "boss is enraging, take less damage" mechanic (Skadi case) was
  removed from the public calc as of 2026-05-08 update.

---

## 9. Conditional multipliers

Applied multiplicatively at the end of the chain.

### 9.1 Marking (×1.15)

```ts
const markingFactor = i.markingActive ? markingMult : f(1)
```

`markingActive` is true when the defender carries `BT_MARKING` (the
attacker has marked them). `RODATA.MARKING = 1.149999976158142f`.

Validated: Skadi S3 burst on Amadeus marked obs ratio 1.000 — the
×1.15 fires deterministically.

### 9.2 Missed (×0.5)

```ts
const missedFactor = i.missed ? missedMult : f(1)
```

`missed` is true when `SkillRecord.DamageRateType == MISSED (3)` —
i.e., the attack rolled a "miss" on the hit-chance check. `RODATA.MISSED_DAMAGE_RATE = 0.5`.

Public calc surface: a "Missed" toggle in the Result panel debug
section. Default off. Useful for theorycrafting EFF / RES races.

### 9.3 Final reduce (`× (1 − finalReducePct/100)`)

```ts
const finalReducePctClamp = Math.max(0, Math.min(100, i.finalReducePct ?? 0))
const finalReduceMult = f32sub(f(1), f32div(f(finalReducePctClamp), f(100)))
```

`finalReducePct` is the MAX-aggregated `BT_DMG_REDUCE_FINAL` value.
Clamped `[0, 100]`. At 100, damage is exactly 1 (post `max(1, ...)`).

---

## 10. Multiplication order (the f32 chain)

```
s1 = (skillFactor/1000) × ATK
s1 = s1 × (DF/1000)
s0 = s1 × mit
s8 = s0 × rate                  // mod × s0 in disasm
s9 = s8 × marking
s8 = s9 × elem
s8 = s8 × missed
s8 = s8 × (1 − finalReduce)
return max(1, floor(s8))
```

Each multiplication is wrapped in `f32mul`. The `frintm + fcvtms`
pair at the end produces the int (`floor` toward −∞). The `csinc`
clamps to `max(1, w)` so a sub-1 damage rounds to 1.

**Single floor at the very end.** Don't floor intermediate steps;
that drifts. The TS port (`computeDamage`) keeps full f32 precision
through every multiplication and floors once.

```ts
// from formula.ts
const mainCalc = Math.max(1, Math.floor(mc))
```

---

## 11. Skill-internal additional attack

Some skills fire a SEPARATE hit at a different DF, with the full
mitigation/rate/elem pipeline re-run. Modeled with `additionalAttackDF`:

```ts
let additionalCalc = 0
if (i.additionalAttackDF && i.additionalAttackDF > 0) {
  const addDfRatio = f32div(f(i.additionalAttackDF), ratioDivisor)
  let ac = f(i.atk)
  ac = f32mul(ac, skillFactorMult)
  ac = f32mul(ac, addDfRatio)
  ac = f32mul(ac, mitigation)
  ac = f32mul(ac, rate)
  ac = f32mul(ac, markingFactor)
  ac = f32mul(ac, elemMult)
  ac = f32mul(ac, missedFactor)
  ac = f32mul(ac, finalReduceMult)
  additionalCalc = Math.max(1, Math.floor(ac))
}

const calculated = mainCalc + additionalCalc
```

Examples: Luna Barrier S2 has a sub-attack on shielded targets; some
chars have a follow-up on crit. The UI surfaces an "additional attack"
toggle to enable/disable the sub-attack; when ON, the sub-DF feeds
`additionalAttackDF`.

---

## 12. Stat stacking model (Model B)

The public calc auto-prefills char stats at Lv 100 with the user's
Codex / quirks / transcend selection. The stacking math derives from
empirical fits on Rin (3★ Striker, no class ATK passive), Tio (2★
Healer, Reliever, Fire) and Astei (3★ Healer, Reliever, Fire).

**Model B** (codex pct only on `statMax`, evolution / class / gift
flat additions get `(1 + trans + classPct + quirkPct)` only):

```
stat = floor(
  statMax × (1 + trans + heroCodex + classPct + quirkPct)
  + (evoFlat + classFlat + giftFlat) × (1 + trans + classPct + quirkPct)
)
```

Where:

- `statMax` = `Atk_Max` / `Def_Max` / `HP_Max` / etc. from `CharacterTemplet`.
- `trans` = transcend ATK% bonus (per-mille from `CharacterTranscendentTemplet.RewardAtkRate`).
- `heroCodex` = codex pct from `manifest.codexTable[level].atkPct` (etc.).
- `classPct` = class-passive stat % (e.g., Mage `MAGE_PASSIVE_2_10` +10% ATK).
- `quirkPct` = applicable awakening %-stat nodes (for the user's element/class/subclass).
- `evoFlat` = sum of `RewardValue_N` (evolution flat adds, e.g., Maxwell ev2 +29 ATK).
- `classFlat` = class-passive flat adds (rare).
- `giftFlat` = awakening flat adds.

The codex factor compounds **only** with `trans` — it doesn't
multiply the evo flat layer.

### 12.1 Skill_8 unlock (transcend-gated)

`Skill_22 → BuffID = "transcendent_8_hp_upgrade"` (or similar) carries
class-passive upgrades, gated on a transcend condition. The bake reads
each tier's gating condition:

```
skill8ByTransStar: Record<string, DamageCalcStatContribution>
//   '0' → empty (no skill8 unlock without transcend)
//   '6' → { hpPct: 10 }    e.g. transcendent 8 HP +10% bonus
```

The runtime picks the contributor matching the user's selected
transcend tier.

### 12.2 Skill_23 fallback (CF chars)

12 Core Fusion chars carry an upgraded class passive on `Skill_23`
that replaces `Skill_22` when present. The bake applies:

```ts
const classPassiveSkillId = char.Skill_23 ?? char.Skill_22
```

If the user picks the CF base char, `Skill_23` is absent → fall
through to `Skill_22`.

---

## 13. Crit mechanics

The crit pool computation is integrated into the rate (§6.1). Two
notes:

- **CHD is the multiplier, not the bonus.** CHD = 188% means crit
  damage rate = 1.88, NOT (1 + 0.88).
- **CDR is subtracted from CHD on crit.** A target with CDR = 30 +
  attacker CHD = 200 yields rate = `(200 − 30) × 0.001 = 1.70` on
  crit, not `2.00 − 0.30 / max(...)`.

CHC (crit chance) is NOT in the formula — the calc takes a `crit:
boolean` input. The user picks crit-or-not; the calc shows the damage
under that scenario. CHC enters only as a probability the user
considers separately.

---

## 14. Validation contract

Inherited from `damage-lab-v2-spec.md` §1, §7, §9.

### 14.1 Single-hit accuracy

**Bit-exact** on 17+ observation fixtures. Drift typically `±0` or
`±1` damage point on a 5-figure number. The validation set includes:

- Maxwell (S1 single-hit, S2, S3) on Amadeus / Ars Nova at multiple stages.
- Skadi (S1, S3 with burst) on Amadeus / Ars Nova.
- Demiurge Stella (HP-scaling sub-attack).
- Noa (S2 with `BT_DMG_TARGET_STAT`, validated 11 obs).
- Veronica (CF, swap-stat ATK←DEF).
- Various Mage-class chars (passive +12% pool).
- Various L/D chars (passive +30% pool).

### 14.2 Multi-hit drift (±0.2%, accepted)

`MaxHitCount > 1` skills drift by ±0.2% (sign and magnitude depend on
the per-skill hit distribution). Examples:

- Maxwell S1 Amadeus 3 hits: calc 2789 vs obs 2786 → 0.999 (+3)
- Maxwell S1 Ars Nova adv 3 hits: calc 4610 vs obs 4605 → 0.999 (+5)
- Maxwell S1 Ars Nova adv crit 3 hits: 6444 vs 6437 → 0.999 (+7)
- Skadi S2 Amadeus crit adv 3+7+7 hits: 3959 vs 3967 → 1.002 (−8)
- Skadi S1, S3 (single-hit) and Maxwell S2: ratio 1.000 ✓

The single-shot chain (`g__CalcDamage|17_0`) is binary-faithful. The
multi-hit dispatch lives in `CCharacterBattle.UseSkill` (or an
upstream orchestrator) and goes through IL2CPP virtual dispatch — no
direct `BL #0x2B53EC8` exists in the binary, so static disasm can't
trace per-hit DF distribution. Closing this drift requires Frida
runtime hooks on `SkillRecord.fDamageRate`. **Decision: accepted as
documented limit.**

### 14.3 Known unmodeled mechanics

- **Type 92 `BT_DMG_ELEMENT_SUPERIORITY`** — marker buff that forces
  the elem path to ×1.20 baseline. Ame S1 carries it gated by
  `CASTER_HAS_BUFF, BuffConditionValue: 55` (which doesn't match any
  static `BUFF_TYPE` enum entry — likely a custom group ID that
  Frida-only resolves at runtime).
- **Type 93 `BT_DMG_ELEMENT_ENCHANT`** — adds permille above the 1.20
  base when type 92 is active.
- **Ame Sakura non-adv residual** — stop-gap `empiricalMult` in
  `char-overrides.ts` (`nonCrit: 1.010, crit: 0.948`) brings obs
  within tolerance until type 92/93 are properly modeled.

These are documented in `06-gotchas.md` §5 with Frida hook
prerequisites if a future RE chore tackles them.

### 14.4 Acceptance test

V3 must pass the same fixture replay:

```ts
import { recompute } from '@/lib/damage/v2/recompute'
import obs from '@data/admin/damage-lab-observations-v2.jsonl'

for (const o of obs) {
  const result = recompute(o.ctx, allBuffs)
  const ratio = o.observed / result.calculated
  if (o.singleHit) expect(ratio).toBeCloseTo(1.0, 3)  // ±0.001 (1‰)
  else expect(ratio).toBeWithin(0.998, 1.002)         // ±0.2%
}
```

CI must replay this fixture set on every PR that touches
`src/lib/damage/v2/`.

---

## 15. Public surface

The engine exposes only the following functions / types (everything
else is implementation detail):

```ts
// src/lib/damage/v2/recompute.ts
export interface RecomputeContext { /* see 04-runtime-model.md §3 */ }
export interface RecomputeResult { calculated: number; breakdown: DamageBreakdown; reduced: ReducedBuffs }
export function recompute(ctx: RecomputeContext, allBuffs: ApplicableBuff[]): RecomputeResult
export function detectElementRelation(att: string, tgt: string): 'adv'|'disadv'|'none'
export function isAdventureLicenseMode(mode: string|undefined): boolean
export function guildHpPctForLevel(level: number): number
export const GUILD_HP_BY_LEVEL: readonly number[]

// src/lib/damage/v2/formula.ts
export interface DamageInputs { /* see §1 */ }
export interface DamageBreakdown { /* see §1 */ }
export interface DebugStep { label: string; value: number; note?: string }
export interface DamageQuirk { name: string; value: string }
export type ElemRelation = 'none' | 'adv' | 'disadv'
export function computeDamage(i: DamageInputs): DamageBreakdown

// src/lib/damage/v2/buffs.ts
export interface ApplicableBuff { /* see 04-runtime-model.md §4 */ }
export interface BuffContext { /* see 04 §4 */ }
export interface ReducedBuffs { /* see 04 §4 */ }
export type CallerSlot = 'S1' | 'S2' | 'S3'
export function applyBuffs(buffs: ApplicableBuff[], ctx: BuffContext): ReducedBuffs

// src/lib/damage/v2/f32.ts
export const RODATA: { ... }
export const f: typeof Math.fround
export function f32mul / f32add / f32sub / f32div(a, b): number
export function interpolate(min, max, level): number
export function applyAdvantageRate(stat, ratePermille): number
export function interpolateRated(min, max, level, ratePermille): number

// src/lib/damage/v2/stats.ts
export function applyCasterDebuffs(stats, debuffs: { eff, res }): MonsterStats
```

External buff aggregation (`external-buffs.ts`), char overrides
(`char-overrides.ts`), boss overrides (`boss-overrides.ts`), and
extractors (`extract-*.ts`) are also exposed but consumed only by
`recompute` internally. Public-calc UI imports `recompute` and the
extractors' types; that's it.

---

## 16. Performance budget

- `recompute()` median: < 1 ms on a mid-range laptop. p99 < 5 ms.
- `applyBuffs()` is pure synchronous — no async, no microtasks.
- Per call, the reducer iterates every applicable buff once. With ~250
  buffs in scope for an awakened char, the loop is hot but inside the
  budget.
- `computeDamage()` is constant-time (~80 f32 ops + a few branches).

Memoization is not required at the engine level. The UI
`useMemo`-wraps `recompute` at the component level so re-renders
without state change skip the call.

---

## 17. Notes on JS portability

- **`Math.fround`** is universally supported (ES2015+). The chain
  works in Node, browsers, edge runtimes.
- **f32 vs f64.** TypeScript's `number` is f64. `Math.fround` rounds
  to f32 and returns the f64 expansion of that f32 value. Every f32
  op must be wrapped or the result silently drifts.
- **Integer overflow.** Damage values can exceed 2^32 in pathological
  inputs but never reach 2^53 (JS safe-int). No BigInt needed.
- **NaN propagation.** A NaN input (parse failure, missing field)
  cascades through `f32mul/add/sub/div`. The runtime should reject
  NaN at the boundary (`recompute` validates ctx; UI validates
  inputs). Don't try to recover from NaN inside the formula.

---

End of formula. Continue to `03-bake-contract.md`.
