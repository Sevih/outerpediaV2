# Damage Calculator V3 — 04. Runtime Model

> **Audience.** Engine + UI engineers. The bridge between
> `02-formula.md` (pure math) and `05-ui-contract.md` (panels). Anyone
> implementing or modifying `src/lib/damage/v2/{recompute,buffs,
> external-buffs,char-overrides,boss-overrides}.ts` and the public
> `compose-result.ts` orchestration.
>
> **Scope.** The full pipeline from **UI state → ApplicableBuff[] +
> RecomputeContext → recompute() → DamageBreakdown**. Each stage with
> its inputs, outputs, and gating rules.

---

## 1. The pipeline at a glance

The runtime is a 7-stage pure pipeline, no async, no side effects.

```
                ┌────────────────────────────────────────┐
                │ UI state (CalcState in the reducer)    │
                └────────────┬───────────────────────────┘
                             │
                             │ runRecompute()  (compose-result.ts)
                             ▼
        ┌──────────────────────────────────────────────────────┐
        │ STAGE 1 — Compose the applicable buff list           │
        │   composeApplicableBuffs(awakening, charBuffs, opts) │
        │   - filter PVE quirk if `!opts.pveQuirk`             │
        │   - merge awakening + char-skill + EE buffs          │
        └────────────┬─────────────────────────────────────────┘
                     │ ApplicableBuff[]
                     │
        ┌────────────┴─────────────────────────────────────────┐
        │ STAGE 2 — Compose RecomputeContext                   │
        │   composeRecomputeContext(state, detail, summary, …) │
        │   - resolve target (cascade or manual)               │
        │   - pick burst variant if S3 + burstLevel > 0        │
        │   - resolve elem / mode / AL gate                    │
        │   - apply team deltas to dealer base stats           │
        │   - bake conditional pool inputs (HP%, buff counts)  │
        │   - thread external buffs + boss mechanics through   │
        └────────────┬─────────────────────────────────────────┘
                     │ RecomputeContext + ApplicableBuff[]
                     ▼
                  recompute()
                     │
        ┌────────────┴─────────────────────────────────────────┐
        │ STAGE 3 — External buff aggregation                  │
        │   - sum all toggled toggles into ExternalBuffSums    │
        │   - apply to effAtk / effPen / effChd / effTargetDef │
        └────────────┬─────────────────────────────────────────┘
                     │
        ┌────────────┴─────────────────────────────────────────┐
        │ STAGE 4 — Build BuffContext + reduce buffs           │
        │   applyBuffs(filteredBuffs, ctx)                     │
        │   - filter by appliesTo + trigger                    │
        │   - dispatch by effect.target                        │
        │   - apply f32 chain on scaling_target_stat           │
        │   - return ReducedBuffs                              │
        └────────────┬─────────────────────────────────────────┘
                     │
        ┌────────────┴─────────────────────────────────────────┐
        │ STAGE 5 — Char overrides                             │
        │   getCharOverride(charId, slot)                      │
        │   - Ame Ume/Sakura: dfMultiplier + replaceOnAdv      │
        │   - empiricalMult for Sakura non-adv (stop-gap)      │
        └────────────┬─────────────────────────────────────────┘
                     │
        ┌────────────┴─────────────────────────────────────────┐
        │ STAGE 6 — Boss mechanic aggregation                  │
        │   aggregateBossPassiveModifiers(override, mech, …)   │
        │   - per-mech filtered buffs → DR delta + final-redu. │
        └────────────┬─────────────────────────────────────────┘
                     │
        ┌────────────┴─────────────────────────────────────────┐
        │ STAGE 7 — Final compute                              │
        │   computeDamage({ atk, df, mit, rate, … })           │
        │   - apply post-formula multipliers (charEmpirical,   │
        │     finalReduce delta)                               │
        │   - return RecomputeResult { calculated, breakdown,  │
        │     reduced }                                        │
        └──────────────────────────────────────────────────────┘
```

Stages 1-2 are public-calc orchestration (`compose-result.ts`).
Stages 3-7 are inside `recompute()` (`src/lib/damage/v2/recompute.ts`).

The reducer (`applyBuffs`) is the heaviest piece — that's where every
`BT_*` type meets its f32-faithful evaluation.

---

## 2. `RecomputeContext` (full)

The single input struct fed into `recompute()`. Documented field by
field (50+ fields; all are pass-through to the formula or the reducer).

```ts
export interface RecomputeContext {
  // ── Caster identity (drives buff filtering) ─────────────────────────
  charId: string
  charElement: string                    // 'Earth' | 'Water' | 'Fire' | 'Light' | 'Dark'
  charClass: string                      // display string ('Mage', 'Defender', …)
  charSubclass: string                   // 'WIZARD', 'BRUISER', … (uppercase)

  // ── Skill ──────────────────────────────────────────────────────────
  slot: CallerSlot                       // 'S1' | 'S2' | 'S3' | 'B1' | 'B2' | 'B3'
  damageFactor: number                   // per-mille
  /** Set when the user enabled the additional-attack toggle. */
  additionalAttackRatio?: number

  // ── Caster inputs (raw user-typed; reducer + formula handle scaling) ─
  atk: number
  chd: number                            // %
  pen: number                            // %
  dmgInc: number                         // %
  applyQuirks: boolean                   // master switch — false skips ALL awakening buffs

  /**
   * Optional ATK scaling breakdown (from the chars-stats route). When set,
   * external ATK% buffs stack additively into `pctBonus` and the formula
   * is replayed — matching in-game behavior. `null` → linear fallback.
   */
  atkScaling?: {
    baseMax: number
    flat: number
    pctBonus: number
    codexPct: number
    transcendPct: number
  } | null

  /** ST_* → numeric for secondary scaling (Stella HP, Regina CHC). */
  extraStats?: Record<string, number>

  /**
   * Guild HP buff percentage (0..15) applied to caster ST_HP for
   * `BT_DMG_OWNER_STAT` / `BT_SWAP_STAT_ATTACK` chars. Empirically NOT
   * applied (verified on Veronica CF S2/S3) — kept on context as a future
   * hook. Public calc currently passes 0.
   */
  guildHpBuffPct?: number

  // ── Target inputs ──────────────────────────────────────────────────
  targetDef: number
  targetDmgRed: number                   // %
  targetCdmgRed: number                  // %
  /** Required for BT_DMG_TARGET_STAT scaling (Noa S2). */
  targetHp?: number
  isBoss: boolean
  elem: 'none' | 'adv' | 'disadv'
  crit: boolean

  // ── Mode + AL gate ─────────────────────────────────────────────────
  mode?: string                          // raw DungeonMode token
  /** Explicit override for AL gate; falls back to `isAdventureLicenseMode(mode)`. */
  inAdventureLicense?: boolean

  // ── Char-specific UI flags ─────────────────────────────────────────
  charFlags?: CharFlags                  // umeActive, sakuraActive, ownerResourceMax, etc.

  // ── Pool-condition inputs (BT_DMG_*) ───────────────────────────────
  ownerHpRate?: number                   // 0..1 (1 = full HP)
  targetHpRate?: number
  casterHpRate?: number
  ownerBuffCount?: number
  targetBuffCount?: number
  ownerDebuffCount?: number
  targetDebuffCount?: number
  targetBroken?: boolean
  killCountStack?: number
  teamBuffCount?: number
  teamDecreaseCount?: number             // dead allies (MY_TEAM)
  enemyTeamDecreaseCount?: number        // dead enemies (ENEMY_TEAM, type 94)
  inMonadGate?: boolean
  inTower?: boolean
  inPvp?: boolean

  // ── Formula constants (tunable) ────────────────────────────────────
  C?: number                             // default 1000
  ratioDivisor?: number                  // default 1000

  // ── External buff toggles (UI) ─────────────────────────────────────
  externalBuffs?: Record<string, ExternalBuffState>

  // ── Target metadata (informational + boss mechanics) ───────────────
  monsterId?: string

  // ── Boss mechanics (only set when target has overrides) ────────────
  bossMechanics?: Record<string, BossMechanicState>
  bossOverride?: BossOverride | null

  // ── EE state ───────────────────────────────────────────────────────
  /** Target's element — gates EE mainstat target_element_* triggers. */
  targetElement?: string
  eeEnabled?: boolean
  eeLevel?: number                       // 0..10
  /** Char ID whose EE is equipped. Defaults to `charId`. CF chars wearing
   *  the BASE char's EE pass the base char ID. */
  eeCharId?: string
}
```

### 2.1 Defaults and unused fields

`recompute()` treats every optional field as a sensible default:

| Field | Missing default | Effect when missing |
|---|---|---|
| `additionalAttackRatio` | `undefined` | No sub-attack |
| `atkScaling` | `null` | Linear fallback for external ATK% buffs |
| `extraStats` | `{}` | Scaling buffs that need ST_HP / ST_DEF resolve to 0 |
| `guildHpBuffPct` | `0` | No guild boost (matches current production) |
| `targetHp` | `undefined` | `BT_DMG_TARGET_STAT` resolves to 0 |
| `inAdventureLicense` | derived from `mode` | Falls back to `isAdventureLicenseMode(mode)` |
| `charFlags` | `{}` | Per-char overrides see no flags (safe — overrides default OFF) |
| Pool-cond inputs | `0`/`1`/`false` | Conditional pool buffs contribute nothing |
| `inMonadGate`/`inTower`/`inPvp` | `false` | No content-gated buffs fire |
| `externalBuffs` | `undefined` | All sums = 0 (no toggles applied) |
| `bossMechanics` / `bossOverride` | `null` | No boss-mechanic deltas |
| `eeEnabled` | `false` | All `kind: 'ee'` buffs filtered out |
| `eeLevel` | `0` | EE Lv 0 — passive Lv 0 fires, mainstat at value[0], passive Lv 10 doesn't |

**Strict NO-NaN policy.** Pass `Number.isNaN`-clean values into the
context. UI input parsing must reject NaN; `runRecompute` validates
before delegating.

---

## 3. `BuffContext` (reducer input)

Built from `RecomputeContext` inside `recompute()`, fed into
`applyBuffs`:

```ts
export interface BuffContext {
  // Caster identity
  charId: string
  charElement: string
  charClass: string
  charSubclass: string                   // uppercased
  slot: CallerSlot
  // Conditional gates
  isBoss: boolean
  crit: boolean
  elem: 'none' | 'adv' | 'disadv'
  applyQuirks: boolean
  inAdventureLicense: boolean
  // Stat readouts
  baseAtk: number                        // = effAtk after external buffs
  statValues: Record<string, number>     // ST_ATK / ST_DEF / ST_HP / ST_BUFF_CHANCE / …
  targetStatValues?: Record<string, number>  // for BT_DMG_TARGET_STAT
  // Pool-cond inputs (verbatim from RecomputeContext)
  ownerHpRate?: number
  targetHpRate?: number
  casterHpRate?: number
  ownerBuffCount?: number
  targetBuffCount?: number
  ownerDebuffCount?: number
  targetDebuffCount?: number
  targetBroken?: boolean
  killCountStack?: number
  teamBuffCount?: number
  teamDecreaseCount?: number
  enemyTeamDecreaseCount?: number
  inMonadGate?: boolean
  inTower?: boolean
  inPvp?: boolean
  // Per-char trigger gates
  ownerResourceMax?: boolean             // Noa Kaizer Energy 5/5
  casterDefUp?: boolean                  // 'a-buff-def' toggle
  // EE
  eeEnabled?: boolean
  eeLevel?: number
  // Target element for target_element_* trigger
  targetElement?: string
}
```

### 3.1 Construction

Inside `recompute()`:

```ts
const buffCtx: BuffContext = {
  charId:       ctx.charId,
  charElement:  ctx.charElement,
  charClass:    ctx.charClass,
  charSubclass: ctx.charSubclass.toUpperCase(),  // normalized for AAT_SUBCLASS lookup
  slot:         ctx.slot,
  isBoss:       ctx.isBoss,
  crit:         ctx.crit,
  elem:         ctx.elem,
  applyQuirks:  ctx.applyQuirks,
  inAdventureLicense: ctx.inAdventureLicense ?? isAdventureLicenseMode(ctx.mode),
  baseAtk:      effAtk,                   // post-external-buff-aggregation
  statValues,                              // includes external buff +EFF/+CHC contributions
  targetStatValues,                        // ST_HP from ctx.targetHp + ST_DEF from effTargetDef
  // Pool-cond pass-through
  ownerHpRate:            ctx.ownerHpRate,
  targetHpRate:           ctx.targetHpRate,
  // …
  ownerResourceMax:       !!ctx.charFlags?.ownerResourceMax,
  casterDefUp:            !!ctx.externalBuffs?.['a-buff-def']?.active,
  eeEnabled:              !!ctx.eeEnabled,
  eeLevel:                ctx.eeLevel ?? 0,
  targetElement:          ctx.targetElement,
}
```

---

## 4. `ApplicableBuff` (cross-reference)

Schema fully documented in `03-bake-contract.md` §6.2. Quick recap:

```ts
interface ApplicableBuff {
  id: string
  source: BuffSource                     // 'awakening' | 'char_skill' | 'ee'
  appliesTo: AppliesTo                   // 'element' | 'class' | 'subclass' | 'char' | 'all'
  effect: BuffEffect                     // target + amount + unit + statRef? + poolCond? + eeLevelValues?
  trigger: BuffTrigger                   // requires + callerSlots
  ui?: BuffUI
}
```

`effect.target` enumerates 14 values (see §5.2 for the dispatch table).

---

## 5. `applyBuffs` — the reducer (Stage 4)

The heart of the engine. Converts `ApplicableBuff[]` + `BuffContext`
into `ReducedBuffs`. Pure, synchronous, ~50 LOC of dispatch.

### 5.1 Output

```ts
export interface ReducedBuffs {
  poolPct: number                        // additive % (gear DMG↑ + char + awakening + boss)
  atkBonusFlat: number
  atkBonusPct: number
  chdBonus: number                       // % points
  penBonus: number                       // % points
  critRateBonus: number                  // % points
  monsterEffPermille: number             // PVE caster debuffs to target EFF
  monsterResPermille: number             // PVE caster debuffs to target RES
  mainAtk: number                        // post-swap-stat ATK (base for the formula)
  targetStatPermille: number             // BT_DMG_TARGET_STAT contribution
  active: ApplicableBuff[]               // for breakdown UI
  debugSteps: { label: string; value: number; note?: string }[]
}
```

### 5.2 Dispatch table

For each buff, after gating (§5.3), dispatch on `effect.target`:

| `effect.target` | Action | Source examples |
|---|---|---|
| `pool` | `poolPct += amt` | `BT_DMG` always-on (Mage +12%, L/D +30%) |
| `pool_cond` | `poolPct += amt × poolCondMultiplier(cond, ctx)` | `BT_DMG_OWNER_LOST_HP_RATE`, `BT_DMG_TARGET_BUFF`, `BT_DMG_TO_BOSS` (the `boss` cond), `BT_DMG_NOT_CRITICAL`, `BT_DMG_ENEMY_TEAM_DECREASE`, … |
| `atk_flat` | `atkBonusFlat += amt` | Class-passive flat ATK |
| `atk_pct` | `atkBonusPct += amt` | Awakening +X% ATK |
| `chd` | `chdBonus += amt` | Awakening +X% CHD |
| `pen` | `penBonus += amt` | Awakening +X% PEN |
| `crit_rate` | `critRateBonus += amt` | Awakening +X% CHC |
| `monster_eff` | `monsterEffPermille += amt × 10` (% → permille) | PVE quirks "Counteract Strong Enemies" |
| `monster_res` | `monsterResPermille += amt × 10` | PVE quirks |
| `scaling_swap` | `mainAtk = ctx.statValues[statRef] × amt / 1000` | `BT_SWAP_STAT_ATTACK` (Drakhan, base Veronica) |
| `scaling_add_flat` | `mainAtk += ctx.statValues[statRef] × amt / 1000` | Stella HP-add (separate ATK component) |
| `scaling_add_pct` | `atkBonusFlat += mainAtk × (sv / 100) × (amt / 1000)` | Regina CHC scaling |
| `scaling_target_stat` | f32-faithful chain → `targetStatPermille` | Noa S2 (`BT_DMG_TARGET_STAT`) |

### 5.3 Filter rules (in order)

```ts
for (const b of buffs) {
  // Rule 1: applies-to (skipped for EE buffs — see §5.5)
  if (b.source.kind !== 'ee' && !appliesToCaster(b.appliesTo, ctx)) continue

  // Rule 2: master quirks switch
  if (!ctx.applyQuirks && b.source.kind === 'awakening') continue

  // Rule 3: AL gate
  if (b.source.kind === 'awakening' &&
      b.source.group === 'ADVENTURE_LICENSE' &&
      !ctx.inAdventureLicense) continue

  // Rule 4: EE gate
  if (b.source.kind === 'ee') {
    if (!ctx.eeEnabled) continue
    if (b.source.slot === 'passive_add' && (ctx.eeLevel ?? 0) < 10) continue
  }

  // Rule 5: trigger condition
  if (!triggerMatches(b.trigger, ctx)) continue

  // → buff fires; dispatch on effect.target
  out.active.push(b)
  // … switch on b.effect.target
}
```

`appliesToCaster`:

```ts
function appliesToCaster(at: AppliesTo, ctx: BuffContext): boolean {
  switch (at.kind) {
    case 'all':      return true
    case 'element':  return at.value === ctx.charElement
    case 'class':    return at.value === ctx.charClass
    case 'subclass': return at.value === ctx.charSubclass
    case 'char':     return at.value === ctx.charId
  }
}
```

`triggerMatches`:

```ts
function triggerMatches(t: BuffTrigger, ctx: BuffContext): boolean {
  if (t.callerSlots !== 'all' && !t.callerSlots.includes(ctx.slot)) return false
  switch (t.requires) {
    case 'always':                return true
    case 'boss':                  return ctx.isBoss
    case 'crit':                  return ctx.crit
    case 'adv':                   return ctx.elem === 'adv'
    case 'disadv':                return ctx.elem === 'disadv'
    case 'neutral':               return ctx.elem === 'none'
    case 'resource':              return !!ctx.ownerResourceMax
    case 'caster_def_up':         return !!ctx.casterDefUp
    case 'target_element_earth':  return ctx.targetElement === 'Earth'
    case 'target_element_water':  return ctx.targetElement === 'Water'
    case 'target_element_fire':   return ctx.targetElement === 'Fire'
    case 'target_element_light':  return ctx.targetElement === 'Light'
    case 'target_element_dark':   return ctx.targetElement === 'Dark'
  }
}
```

### 5.4 Pool condition multipliers

The `pool_cond` dispatch reads the multiplier from
`poolCondMultiplier(cond, ctx)`:

| `PoolCondition` | Multiplier formula | Source field |
|---|---|---|
| `owner_lost_hp` | `max(0, 1 − ownerHpRate)` | `ctx.ownerHpRate` (1 = full) |
| `target_lost_hp` | `max(0, 1 − targetHpRate)` | `ctx.targetHpRate` |
| `caster_lost_hp` | `max(0, 1 − casterHpRate ?? ownerHpRate ?? 1)` | `ctx.casterHpRate` |
| `owner_buff` | `ownerBuffCount` | `ctx.ownerBuffCount ?? 0` |
| `target_buff` | `targetBuffCount` | `ctx.targetBuffCount ?? 0` |
| `owner_debuff` | `ownerDebuffCount` | `ctx.ownerDebuffCount ?? 0` |
| `target_debuff` | `targetDebuffCount` | `ctx.targetDebuffCount ?? 0` |
| `team_buff` | `teamBuffCount` | `ctx.teamBuffCount ?? 0` |
| `team_decrease` | `teamDecreaseCount` (dead allies) | `ctx.teamDecreaseCount ?? 0` |
| `enemy_team_decrease` | `enemyTeamDecreaseCount` (dead enemies) | `ctx.enemyTeamDecreaseCount ?? 0` |
| `kill_count_stack` | `killCountStack` | `ctx.killCountStack ?? 0` |
| `target_break` | `targetBroken ? 1 : 0` | `ctx.targetBroken ?? false` |
| `not_critical` | `crit ? 0 : 1` | `ctx.crit` |
| `pvp_content` | `inPvp ? 1 : 0` | `ctx.inPvp` |
| `monadgate_content` | `inMonadGate ? 1 : 0` | `ctx.inMonadGate` |
| `tower_content` | `inTower ? 1 : 0` | `ctx.inTower` |

Returning `0` means no contribution → buff is a no-op for this cast.

### 5.5 EE buff specifics

EE buffs (`source.kind === 'ee'`) have three slots: `main`, `passive`,
`passive_add`. The reducer:

1. **Skips the `appliesToCaster` check** — EE `appliesTo` is keyed to
   the EE owner (base char ID). When a CF char wears the base's EE,
   `ctx.charId` (CF) wouldn't match. The bake's `eeCharId` filter has
   already pre-restricted EE buffs to the wearer's wearer-id. The
   appliesTo bypass keeps that mapping correct.
2. **Gates on `eeEnabled`** — when the equipment panel toggle is off,
   no EE buff fires.
3. **Gates `passive_add` on `eeLevel >= 10`** — the Lv 10 unlock
   passive doesn't fire below Lv 10.
4. **Reads per-level value** — `effect.eeLevelValues?.[ctx.eeLevel ?? 0]
   ?? effect.amount`. EE mainstats ship 11-element arrays; non-scaling
   passives use the static `amount`.

### 5.6 Swap-stat ordering

`scaling_swap` (e.g., `BT_SWAP_STAT_ATTACK ST_HP` for Drakhan) MUST
fire **before** `scaling_add_*` for chars with both:

```ts
let swapApplied = false
for (const b of buffs) {
  // …
  if (b.effect.target === 'scaling_swap') {
    if (swapApplied) break        // first swap wins
    out.mainAtk = ctx.statValues[b.effect.statRef ?? ''] × b.effect.amount / 1000
    swapApplied = true
  }
}
```

In practice, no char has both swap-stat AND add-stat scaling — but
the precedence is enforced for safety.

### 5.7 `BT_DMG_TARGET_STAT` f32 chain

Verbatim emulation of `CCharacterData.GetStatValuePermille` (VA
`0x2737274`) + the type 87 dispatch:

```ts
const sv = ctx.targetStatValues?.[b.effect.statRef ?? ''] ?? 0
if (sv > 0) {
  const statF32 = f(sv)
  const valF32  = f(b.effect.amount)
  const step1   = f32mul(statF32, PER_MILLE_POS)   // stat × 0.001
  const step2   = f32mul(step1, valF32)             // × val
  const result  = Math.floor(step2)                  // fcvtms toward −∞
  out.targetStatPermille = f32add(out.targetStatPermille, result)
}
```

The cap at `1000` happens INSIDE `computeDamage` (`PERMILLE_CAP`) —
not in the reducer. Multiple type-87 buffs accumulate; the cap fires
on the sum.

---

## 6. Stage 1 — `composeApplicableBuffs`

```ts
export function composeApplicableBuffs(
  awakening: DamageCalcAwakeningBuffs,
  charBuffs: DamageCalcCharBuffs | null,
  opts: { pveQuirk: boolean } = { pveQuirk: true },
): ApplicableBuff[] {
  const filterAwak = (b: ApplicableBuff): boolean => {
    if (b.source.kind !== 'awakening') return true
    if (!opts.pveQuirk && b.source.group === 'PVE') return false
    return true
  }
  const awak = awakening.buffs.filter(filterAwak)
  if (!charBuffs) return awak
  return [...awak, ...charBuffs.buffs]
}
```

### 6.1 PVE filter

The `pveQuirk` toggle in Settings. When OFF:
- `Awakening_Boss_Dmg_*` (+30% pool vs boss) → filtered out.
- PVE EFF/RES debuff buffs → filtered out (no PVE caster debuffs go to
  the monster).

This matches an account that hasn't unlocked the PVE awakening tree.

### 6.2 Why merge here

The reducer expects a **flat** `ApplicableBuff[]`. Awakening buffs are
shared (one catalog, many chars); char-skill buffs are per-char. The
public calc loads them separately (cold-load fast) and merges at
runtime. The merge ordering doesn't matter — the reducer is
commutative on the additive accumulators.

### 6.3 What's NOT in the merge

- **Boss-mechanic buffs** — those live in `bossOverride.passives[].buffs`
  and feed Stage 6 directly (not the reducer).
- **External buff toggles** — those are aggregated separately in
  Stage 3 (`aggregateExternalBuffs`) and modify `effAtk` / `effPen` /
  etc. before the reducer sees the stats.

---

## 7. Stage 2 — `composeRecomputeContext`

Pulls fields from the UI state to build the `RecomputeContext`:

### 7.1 Burst variant resolution

```ts
const useBurst = state.attacker.skillSlot === 'S3' && burstLevel > 0
const burstKey = useBurst ? (`B${burstLevel}` as 'B1'|'B2'|'B3') : null
const burstSkill = burstKey ? detail.skills[burstKey] : null
const effectiveSlot = burstSkill ? burstKey! : state.attacker.skillSlot
```

When the user picks S3 with burst Lv > 0, the bake's `B1`/`B2`/`B3`
skill replaces S3 for this cast. The `damageFactor` and
`additionalAttackRatio` come from the burst variant; the slot becomes
`B1`/`B2`/`B3` for trigger filtering.

### 7.2 Element relation

```ts
const elem = detectElementRelation(summary.element, target.element)
```

Pure function from `recompute.ts`:

```ts
const ELEMENT_ADV: Record<string, string> = {
  Fire: 'Earth', Earth: 'Water', Water: 'Fire',
  Light: 'Dark', Dark: 'Light',
}

export function detectElementRelation(
  attacker: string, target: string,
): 'none'|'adv'|'disadv' {
  if (!attacker || !target || attacker === target) return 'none'
  if (ELEMENT_ADV[attacker] === target) return 'adv'
  if (ELEMENT_ADV[target] === attacker) return 'disadv'
  return 'none'
}
```

Same-element matchups return `'none'` (×1.0 elem mult).

### 7.3 AL gate

```ts
const inAdvLicense = isAdventureLicenseMode(target.mode) && state.settings.quirks.adventureLicense

export function isAdventureLicenseMode(mode: string|undefined): boolean {
  return mode === 'DM_ADVENTURE_MISSION' || mode === 'DM_ADVENTURE_CHALLENGE'
}
```

Both conditions must hold:
- The selected stage's mode is `DM_ADVENTURE_MISSION` /
  `DM_ADVENTURE_CHALLENGE` (the only modes that "consume" Adventure
  License tickets).
- The Settings panel's `adventureLicense` quirk toggle is ON (= the
  user has unlocked that awakening tree).

In manual mode, `target.mode` is undefined → `inAdvLicense = false`.

### 7.4 Team deltas

The team panel adds transcend bonuses + ally talisman main stats.
Computed by `computeTeamDeltas(state.team, transcend.byChar,
equipment.talismanMainStats)` and applied to the dealer's BASE stats:

```ts
const teamDeltas = computeTeamDeltas(...)
const { stats: effectiveStats, atkScaling: effectiveScaling } =
  applyTeamDeltasToStats(state.attacker.stats, state.attacker.atkScaling, teamDeltas)
```

The dealer panel still **shows** the base values (with `(+X)`
annotations); the formula sees the cast's actual numbers. Keeps the
in-game character-sheet mapping intact.

### 7.5 Conditional pool inputs

The user's conditional inputs (under "Battle conditions" in the
attacker panel) feed the pool-cond multipliers:

```ts
ownerHpRate:            hpFractionFromLostPct(state.attacker.conditional.casterLostHpPct),
targetHpRate:           hpFractionFromLostPct(state.attacker.conditional.targetLostHpPct),
targetBuffCount:        state.attacker.conditional.targetBuffs,
targetDebuffCount:      state.attacker.conditional.targetDebuffs,
teamBuffCount:          state.attacker.conditional.teamBuffs,
enemyTeamDecreaseCount: state.attacker.conditional.enemyTeamDeaths,
killCountStack:         state.attacker.conditional.killStacks,

function hpFractionFromLostPct(lostPct: number): number {
  const remaining = 1 - lostPct / 100
  return remaining < 0 ? 0 : remaining > 1 ? 1 : remaining
}
```

UI stores HP as "lost %" (0 = full, 100 = empty); formula expects
"remaining" fraction (0..1, 1 = full). `hpFractionFromLostPct` does
the conversion + defensive clamp.

### 7.6 Environment heuristics

```ts
inMonadGate: target.mode?.includes('MONAD_GATE') ?? false,
inTower:     target.mode?.includes('TOWER') ?? false,
inPvp:       target.mode ? (target.mode.includes('PVP') || target.mode.includes('ARENA')) : false,
```

Same substring checks as the admin lab. The `DungeonMode` enum names
are stable enough — `DM_TOWER`, `DM_TOWER_HARD`, `DM_TOWER_VERY_HARD`
all match `includes('TOWER')`.

### 7.7 EE wearer mapping

```ts
eeCharId: state.attacker.equipment.ee.variant === 'base' && summary.baseCharId
  ? summary.baseCharId
  : summary.id,
```

CF chars wearing the BASE char's EE pass the base char ID so the EE
filter selects the right buff catalog. Standard chars (or CF chars
wearing their own CF EE if it ever exists) pass `summary.id`.

---

## 8. Stage 3 — External buff aggregation

```ts
export function aggregateExternalBuffs(
  state: Record<string, ExternalBuffState>,
): ExternalBuffSums { ... }
```

Sums up all `active=true` external buff toggles into the 10-axis
struct:

```ts
interface ExternalBuffSums {
  attackerATK:   number  // pct (× (1 + sum/100) on ATK)
  attackerDEF:   number  // pct (caster ST_DEF for DEF-scaling chars)
  attackerPEN:   number  // pct points (additive)
  attackerCHC:   number  // pct points
  attackerCHD:   number  // pct points
  attackerEFF:   number  // pct points
  attackerDMG:   number  // pct points (DMG_INCREASE)
  targetDEF:     number  // pct (× (1 + sum/100) on target DEF)
  targetDR:      number  // speculative
  targetCDMGRed: number  // speculative
}
```

### 8.1 Application

Inside `recompute()`:

```ts
const effAtk = ctx.atkScaling != null && extSums.attackerATK !== 0
  ? replayStatWithBuff(ctx.atkScaling, extSums.attackerATK)   // recompose with chars-stats formula
  : ctx.atk * (1 + extSums.attackerATK / 100)                  // linear fallback
const effPen = ctx.pen + extSums.attackerPEN
const effChd = ctx.chd + extSums.attackerCHD
const effTargetDef = ctx.targetDef * (1 + extSums.targetDEF / 100)
```

`replayStatWithBuff` mirrors `src/app/api/admin/characters/[id]/stats`
so the buff stacks ADDITIVELY against the permanent %-layer (matches
the in-game behavior — combat-time +ATK% adds to permanent ATK%
rather than multiplying the displayed ATK).

### 8.2 EFF / CHC routed via `extraStats`

External `+EFF` and `+CHC` buffs aren't applied to the user-typed
`chd` / `pen`; they go into `statValues.ST_BUFF_CHANCE` /
`ST_CRITICAL_RATE`:

```ts
if (extSums.attackerEFF !== 0) {
  statValues.ST_BUFF_CHANCE = (statValues.ST_BUFF_CHANCE ?? 0) + extSums.attackerEFF
}
if (extSums.attackerCHC !== 0) {
  statValues.ST_CRITICAL_RATE = (statValues.ST_CRITICAL_RATE ?? 0) + extSums.attackerCHC
}
```

The reducer reads these for scaling buffs that key off ST_*.

### 8.3 Caster DEF for DEF-scaling chars

```ts
if (extSums.attackerDEF !== 0 && statValues.ST_DEF) {
  statValues.ST_DEF = Math.floor(statValues.ST_DEF * (1 + extSums.attackerDEF / 100))
}
```

For DEF-scaling chars (if/when `BT_SWAP_STAT_ATTACK` reads
`ST_DEF`), the caster's defense up buff propagates to the scaling.

### 8.4 The `a-buff-def` toggle's dual role

The `a-buff-def` external buff toggle has two effects:
1. **Boosts caster DEF** (above) — feeds DEF-scaling chars.
2. **Sets `casterDefUp = true`** in `BuffContext` — gates buffs whose
   `requires: 'caster_def_up'` (Veronica core fusion's "Increases
   Damage for allies under Increased Defense").

Same toggle, two semantically distinct roles.

---

## 9. Stage 5 — Char overrides

```ts
const override = getCharOverride(ctx.charId, ctx.slot)
let mainDF = ctx.damageFactor
let addRatio = ctx.additionalAttackRatio
let charEmpiricalMult = 1

if (override) {
  if (override.dfMultiplier != null) mainDF = ctx.damageFactor * override.dfMultiplier
  for (const cond of override.conditionals ?? []) {
    if (!ctx.charFlags?.[cond.flag]) continue
    if (cond.replaceOnAdv && ctx.elem === 'adv') {
      mainDF = mainDF * cond.ratio                              // replace path
    } else {
      addRatio = cond.ratio                                       // additive path
      if (cond.empiricalMult) {
        const m = ctx.crit ? cond.empiricalMult.crit : cond.empiricalMult.nonCrit
        if (m != null) charEmpiricalMult *= m
      }
    }
  }
}
const additionalAttackDF = addRatio && addRatio > 0
  ? mainDF * addRatio
  : 0
```

### 9.1 Currently-shipped overrides

- **Ame `2000065` S1**: `dfMultiplier = 0.5` always-on (the half-DF
  hidden in game-code, not in the templet). Conditionals:
  - `umeActive`: ADD path with `ratio = 2.0`.
  - `sakuraActive` & `replaceOnAdv = true`: on advantage, REPLACE
    path with `ratio = 1.0` (effectively `mainDF × 1.0 / 1`).
  - `sakuraActive` non-adv: ADD path with `ratio = 2.0` and
    `empiricalMult = { nonCrit: 1.010, crit: 0.948 }` (stop-gap until
    `BT_DMG_ELEMENT_SUPERIORITY` is modeled — see `06-gotchas.md` §5).

### 9.2 Why a stop-gap

Type 92 (`BT_DMG_ELEMENT_SUPERIORITY`) and type 93
(`BT_DMG_ELEMENT_ENCHANT`) are not modeled. Ame's S1 carries a type-92
buff gated by `BuffConditionValue=55` whose semantics aren't statically
resolvable. The empirical multiplier brings Ame Sakura non-adv obs
within tolerance.

When a future RE chore models types 92/93, these `empiricalMult`
entries should be removed.

### 9.3 `charFlags`

Per-char UI flags are surfaced in the AttackerPanel only when the
selected char has matching `getCharOverride().conditionals[].flag`
entries. Currently used by Ame; future per-char hardcoded behaviors
add to the flag list.

---

## 10. Stage 6 — Boss mechanic aggregation

Boss bosses with documented mechanics carry a `bossOverride` object
(loaded from `mechanics/{monsterId}.json`). The user toggles each
mechanic's "active" state in the BossMechanicsPanel.

```ts
const bossMods = ctx.bossOverride && ctx.bossMechanics
  ? aggregateBossPassiveModifiers(
      ctx.bossOverride,
      ctx.bossMechanics,
      { elem: ctx.elem, attackerElement: ctx.charElement },
    )
  : { dmgRedPctDelta: 0, finalReducePctDelta: 0 }
```

### 10.1 What it does

For each active passive in the override:

1. Iterate the passive's `buffs[]` (the raw `ApplicableBuff[]` from
   the bake).
2. Filter by element relation (some buffs are gated by the attacker
   element matchup).
3. Sum `dmg_red` contributions into `dmgRedPctDelta`.
4. Sum `final_reduce_max` contributions into `finalReducePctDelta` —
   but using MAX (per `BT_DMG_REDUCE_FINAL` semantics), not sum.

### 10.2 Output

- `dmgRedPctDelta` — added to `targetDmgRed` in the formula's input.
- `finalReducePctDelta` — fed into the post-formula multiplier (Stage 7).

### 10.3 Currently-shipped boss overrides

- **Amadeus St 4+ Prelude of the Waning Crescent** — DR delta
  ~+50% from Fire/Water/Earth attackers (Light/Dark take +X% damage,
  matching the mechanic).
- **Amadeus Enrage (HP < 30%)** — partial calibration; doc'd but the
  exact value is still an open question (`damage-lab-v2-spec.md` §7.1-2).
- Other bosses: not shipped. The bake's `mechanics/_index.json` lists
  what's available.

---

## 11. Stage 7 — Final compute + post-formula multipliers

```ts
const breakdown = computeDamage({
  atk:               reduced.mainAtk,
  damageFactor:      mainDF,
  additionalAttackDF,
  chdPct:            effChd + reduced.chdBonus,
  penPct:            effPen + reduced.penBonus,
  dmgIncPct:         ctx.dmgInc + reduced.poolPct,
  crit:              ctx.crit,
  def:               effTargetDef,
  cdmgRedPct:        ctx.targetCdmgRed,
  dmgRedPct:         ctx.targetDmgRed + bossMods.dmgRedPctDelta,
  isBoss:            ctx.isBoss,
  elem:              ctx.elem,
  targetStatPermille: reduced.targetStatPermille,
  C:                 ctx.C ?? 1000,
  ratioDivisor:      ctx.ratioDivisor ?? 1000,
})
```

### 11.1 Post-formula multipliers

```ts
const finalReduceMult = bossMods.finalReducePctDelta !== 0
  ? Math.max(0, 1 - bossMods.finalReducePctDelta / 100)
  : 1.0
const postMult = charEmpiricalMult * finalReduceMult

let calculated = breakdown.calculated
if (postMult !== 1.0) {
  calculated = Math.max(1, Math.floor(
    breakdown.mainCalc * postMult + breakdown.additionalCalc * postMult
  ))
  breakdown.mainCalc       = breakdown.mainCalc       * postMult
  breakdown.additionalCalc = breakdown.additionalCalc * postMult
  breakdown.calculated     = calculated
}
```

Two multipliers stack:
- `charEmpiricalMult` — per-char stop-gap (currently Ame Sakura).
- `finalReduceMult` — boss-mechanic final reduce (Amadeus Prelude).

The breakdown's `mainCalc` / `additionalCalc` / `calculated` are
**all updated** so the UI's breakdown panel stays consistent with the
final integer.

### 11.2 Why a single re-floor

The formula already floors once. Multiplying by a non-unit `postMult`
introduces a fractional residue. We re-floor on the SUM (`mainCalc *
postMult + additionalCalc * postMult`) to match in-game integer
display.

---

## 12. PVE quirks runtime application

The PVE awakening (Counteract Strong Enemies) is special: it doesn't
contribute to the damage rate directly. It applies caster debuffs
**on the target's EFF / RES**, which affects the debuff hit-chance
math (not modeled in the calc since the calc doesn't simulate
debuffs).

But the PVE display gating IS in the calc:

```ts
// _lib/quirks.ts
export function computePveBossDebuffs(
  awakening: DamageCalcAwakeningBuffs,
  settings: SettingsState,
  isBoss: boolean,
): PveBossDebuffs {
  if (!settings.quirks.pve || !isBoss) return { effPermille: 0, resPermille: 0 }
  let effPermille = 0
  let resPermille = 0
  for (const b of awakening.buffs) {
    if (b.source.kind !== 'awakening' || b.source.group !== 'PVE') continue
    if (b.trigger.requires !== 'boss') continue
    const e = b.effect
    const amt = e.unit === '%' ? e.amount * 10 : e.amount
    if (e.target === 'monster_eff') effPermille += amt
    else if (e.target === 'monster_res') resPermille += amt
  }
  return { effPermille, resPermille }
}
```

This is computed in the UI and **displayed** on the TargetPanel as
"effective EFF / RES under your PVE quirks" — not re-injected into
the calc since the formula doesn't read EFF/RES.

The `applyPveDebuffs` helper applies the per-mille deltas to a
target stat block via `applyCasterDebuffs` (`src/lib/damage/v2/stats.ts`)
for display purposes only.

---

## 13. Guild HP buff (NOT applied)

The recompute context has a `guildHpBuffPct` field, but the engine
**does NOT apply it** to scaling buffs that read `ST_HP`. Empirically
verified: Veronica CF S2/S3 against Amadeus with Guild Lv 10 matches
calc using raw base `ST_HP`, not `ST_HP × 1.15`.

**Why.** The in-game `EBT_MAX_HP` system buff is an in-COMBAT MaxHP
boost. `BT_SWAP_STAT_ATTACK` and `BT_DMG_OWNER_STAT` are PASSIVE
buffs that snapshot the BASE max HP at battle start (BEFORE the
system buff applies).

The `GUILD_HP_BY_LEVEL` table is kept in `recompute.ts` (and exposed
via `guildHpPctForLevel(level)`) for future use:

```ts
export const GUILD_HP_BY_LEVEL: readonly number[] = [
  0, 8, 8, 8, 10, 10, 10, 12, 13, 14, 15,
]

export function guildHpPctForLevel(level: number): number {
  if (!Number.isFinite(level) || level <= 0) return 0
  if (level >= GUILD_HP_BY_LEVEL.length) return GUILD_HP_BY_LEVEL[GUILD_HP_BY_LEVEL.length - 1]
  return GUILD_HP_BY_LEVEL[level]
}
```

The PUBLIC calc never sets `guildHpBuffPct` (no UI input). If a
future char emerges that DOES scale on the in-combat HP, this toggle
becomes relevant.

---

## 14. Output: `RecomputeResult`

```ts
export interface RecomputeResult {
  /** Final integer damage (already floored, max(1, …)). */
  calculated: number
  breakdown: DamageBreakdown
  reduced: ReducedBuffs
}
```

Consumers:

- **`ResultPanel`** — displays `calculated`, the breakdown subset
  (mit, rate, elem, marking, finalReduce), and the active buffs list
  (`reduced.active`). Has an optional "show debug" toggle that
  reveals `breakdown.debugSteps` + `reduced.debugSteps` (the f32 trace).
- **`SharePanel`** — embeds the `RecomputeContext` (+ result) into the
  share envelope so a shared link reproduces the cast deterministically.
- **CI fixture replay** — feeds historic `RecomputeContext`s and
  asserts `calculated` matches the observed value within tolerance.

---

## 15. Memoization strategy

The runtime is pure synchronous → memoization is straightforward:

```ts
// CalculatorClient.tsx
const result = useMemo(
  () => runRecompute(state, awakening, charBuffs, monsters, manifest, transcend, equipment),
  [state, awakening, charBuffs, monsters, manifest, transcend, equipment],
)
```

`state` is a deep-frozen reducer state; the reducer returns a NEW
top-level object only when something changed. Equality is reference-
based at the React level, so unrelated re-renders skip the recompute.

The bake datasets (`awakening`, `charBuffs`, etc.) are stable across
the session — once loaded, they don't change.

A tighter memo (per-cast key) is possible but not currently needed —
`recompute()` runs in < 5 ms p99.

---

## 16. Testing the runtime

Three test layers:

### 16.1 Unit tests on `applyBuffs`

Feed synthetic `ApplicableBuff[]` with known `BuffContext` values and
assert each `ReducedBuffs` field. One test per `effect.target` x
`PoolCondition` x `TriggerCondition`. ~50 cases.

### 16.2 Unit tests on `computeDamage`

Feed canonical inputs (Mage +12% pool boss adv crit etc.) and assert
the integer output. ~20 cases covering the multiplier interactions.

### 16.3 Integration: fixture replay

```ts
import { recompute } from '@/lib/damage/v2/recompute'
import obs from '@data/admin/damage-lab-observations-v2.jsonl'

for (const o of obs) {
  const result = recompute(o.ctx, allBuffs)
  expect(result.calculated).toBeWithin(o.observed * 0.998, o.observed * 1.002)
}
```

CI must replay this fixture set on every PR that touches the engine.
A pass requires:
- Single-hit obs: ratio 1.000 ± 0.001.
- Multi-hit obs: ratio 1.000 ± 0.002 (acceptance band).

---

## 17. What changes when game data updates

When a game patch ships:

1. **Datamine refresh** — `data/admin/json2/*.json` updated.
2. **Pipeline rebuild** — `pipeline/steps/damage-calc/index.ts` re-runs.
3. **Bake updates** — `public/damage-calc/*.json` re-emitted.
4. **Frontend** — no code change needed for value-only changes (e.g.,
   a buff's `Value` shifted +50‰ → +60‰). The reducer reads the new
   value automatically.
5. **New buff types** — if the patch introduces a new `BT_*` enum
   value, the reducer's dispatch must be extended. Rare but happens
   every 6-12 months.
6. **Validation** — re-run fixture replay. Single-hit obs should still
   match within ±0.001. Failures require:
   - Identifying which buff drifted (compare `reduced.active` between
     pre-patch and post-patch).
   - Updating the patch handling (e.g., new condition, new multiplier).
   - Adding a new fixture from the post-patch in-game observation.

---

## 18. Common pitfalls

### 18.1 Forgetting to uppercase subclass

`BuffContext.charSubclass` MUST be uppercased. Awakening nodes use
`AAT_SUBCLASS` with uppercase values (`'WIZARD'`, `'BRUISER'`). The
bake emits subclass in uppercase already, but if you ever read from
the raw datamine, normalize.

### 18.2 Forgetting to gate EE on `eeEnabled`

Without the gate, an EE buff fires when the user toggles EE OFF —
instant accuracy regression. The reducer enforces this rule (§5.5)
but every consumer that filters buffs separately (e.g., for display
purposes) MUST replicate.

### 18.3 Sign confusion on `targetDmgRed`

`targetDmgRed` is the defender's reduce — POSITIVE values reduce
damage. A boss buff that `BT_DMG_REDUCE val=-150‰` (= +15% damage
taken) emits `dmg_red: -15` in `ApplicableBuff`. Treating it as
"taking damage" reverses the sign.

### 18.4 `floor` vs `round`

The binary uses `frintm` + `fcvtms` = floor toward −∞. Never
`Math.round`. The discrepancy is invisible on most positive inputs but
breaks edge cases.

### 18.5 Breaking the f32 chain

A bare `+` or `*` inside `applyBuffs` or `computeDamage` causes
silent f64 contamination. The drift might be 0 on some inputs and
±1 on others. Always use `f32add`/`f32mul`/`f32sub`/`f32div`.

---

End of runtime model. Continue to `05-ui-contract.md`.
