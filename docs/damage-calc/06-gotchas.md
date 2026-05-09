# Damage Calculator V3 — 06. Gotchas

> **Audience.** Anyone debugging a damage discrepancy or making a
> non-trivial change. Consolidates every edge case, accepted limit,
> and "gotcha" the previous implementation hit, with the resolution
> applied (or "accept as-is" with rationale).
>
> **How to use.** When a value is wrong: read this file first. ~80%
> of past divergences trace back to one of these items.

---

## 1. Adventure License stage expansion

### 1.1 What

Adventure License modes (`DM_ADVENTURE_MISSION`,
`DM_ADVENTURE_CHALLENGE`) have ONE parent dungeon row but **N
per-tier rows** in `AdventureDungeonTemplet` (one per AL tier 1..10).
Each tier overrides:
- The boss level (`DungeonLevel` — e.g., AL Lv 8 = Lv 140).
- The boss HP (`BossHP`).
- The boss break count (`BossLimitCount`).
- Sometimes the spawn advantage rate (`SpawnAdvantageRate_Atk`,
  `_Def`, `_Spd`) — **sparse**, only on high-tier rows.

### 1.2 Why it bit us (the Ksai bug)

Pre-fix, the bake didn't expand AL tiers. Result: all tiers used the
parent dungeon's stats, ignoring per-tier `SpawnAdvantageRate_*`. Ksai
Lv 10 came out at ATK 5639 / DEF 2626 instead of in-game ATK 10714 /
DEF 4989 (a ×1.9 ATK and ×1.9 DEF underestimate).

### 1.3 How V3 handles it

The bake **expands every AL tier into its own stage**, with composite
ID `${dungeonId}@al${tierLevel}`. Each tier carries its own
`stats.atk`, `stats.def`, `stats.hp` (computed via `interpolateRated`
with the per-tier `SpawnAdvantageRate_*`).

The picker shows tiers as separate stages, sortable by difficulty
via `recommendLevel = tierLevel`. UI label suffix: `"AL Lv 8"`.

See `03-bake-contract.md` §5.3 for the contract.

### 1.4 Validation

Replay Ksai Lv 10 obs:

```
in-game (observed): ATK 10714, DEF 4989
calc (post-fix):    ATK 10714, DEF 4989  ✓
```

A regression here would surface immediately on the AL fixture set.

---

## 2. AL quirk gating

### 2.1 What

The Adventure License awakening sub-nodes (group=ADVENTURE_LICENSE)
only fire when:
- The user's `Settings.quirks.adventureLicense === true`, AND
- The target's mode is `DM_ADVENTURE_MISSION` or `DM_ADVENTURE_CHALLENGE`.

### 2.2 Why

The +100% boss DMG awakening "main node" (the headline AL bonus) is
NOT in this group — it's a regular `BT_DMG_TO_BOSS` quirk that lives
in the main awakening tree and applies in any boss-content fight.
Only the `sub-nodes` (smaller stat-bonus nodes that compose the AL
tab in-game) are mode-gated.

### 2.3 How V3 handles it

```ts
// Stage 2 of recompute pipeline (composeRecomputeContext):
const inAdvLicense = isAdventureLicenseMode(target.mode) && state.settings.quirks.adventureLicense

// Stage 4 (applyBuffs filter):
if (b.source.kind === 'awakening' &&
    b.source.group === 'ADVENTURE_LICENSE' &&
    !ctx.inAdventureLicense) continue
```

Manual targets don't have a `mode`, so `inAdvLicense` resolves to
`false` and AL sub-nodes don't fire. (The user can flip the toggle
ON in Settings, but without an AL mode picked, the toggle does
nothing.)

---

## 3. PVE quirk filter

### 3.1 What

The PVE awakening tree (group=PVE — Counteract Strong Enemies) ships
8 nodes:
- 4 × `monster_eff` (boss caster EFF debuff: −4%, −6%, −4%, −6% =
  total −20%).
- 4 × `monster_res` (boss caster RES debuff, same totals).
- 1 × `BT_DMG_TO_BOSS` (`Awakening_Boss_Dmg_*` = +30% pool vs boss).

### 3.2 Why a separate filter

When a user has NOT unlocked the PVE awakening tab, none of those
buffs apply. Filtering at the awakening source (rather than at the
trigger level) is the cleanest way to model an unawakened-PVE
account.

### 3.3 How V3 handles it

```ts
// _lib/compose-result.ts:
export function composeApplicableBuffs(awakening, charBuffs, opts: { pveQuirk: boolean }) {
  const filterAwak = (b) => {
    if (b.source.kind !== 'awakening') return true
    if (!opts.pveQuirk && b.source.group === 'PVE') return false
    return true
  }
  // …
}

// Settings.quirks.pve drives the toggle.
```

When `pveQuirk = false`:
- `Awakening_Boss_Dmg_*` is filtered out → no +30% pool vs boss.
- PVE EFF/RES debuff buffs are filtered out → no `monster_eff` /
  `monster_res` contribution.

The TargetPanel's "Effective EFF/RES under PVE" display reads the
same toggle and zeroes the debuffs when off.

---

## 4. `Skill_23` fallback (CF chars)

### 4.1 What

12 Core Fusion chars carry an upgraded class passive in `Skill_23`
that replaces their `Skill_22` (the stock class passive).

### 4.2 Why

CF chars get a buffed class passive as part of their Core Fusion
identity. The datamine puts the upgrade at `Skill_23` (a slot most
chars don't use); when present, it wins.

### 4.3 How V3 handles it

```ts
// Bake-time (build-chars.ts):
const classPassiveSkillId = char.Skill_23 ?? char.Skill_22
```

Use `??` (nullish coalescing), NOT `||` — `char.Skill_22` could be
the string `"0"` which is truthy in TS but represents "no class
passive index". Actually wait — `Skill_22` carries the CLASS INDEX
(`"4"` = Mage), not a slot ID. The CF override is full skill ID like
`"2823"`.

Be careful not to swap the **type** of value when reading these:
- `Skill_22` is a class index (1..5).
- `Skill_23`, when present, is a Skill ID (`"2823"` etc.).

The bake distinguishes: when `Skill_23` is set, look it up in
`CharacterSkillTemplet` and use its `BuffID` chain directly. When
only `Skill_22` is set, look up the class-passive row in
`CharacterSkillLevelTemplet` (which is keyed by class index).

### 4.4 Validation

CF Veronica (`2700037`) has `Skill_23` pointing to an upgraded class
passive. The bake's `noGearStats.classPassive` should match the
char-stats API output for CF Veronica with the upgraded passive
(verified during the original V2 implementation).

---

## 5. Evolution sum at Lv 100 (ev1-ev5 bug)

### 5.1 What

`CharacterEvolutionStatTemplet` has rows for `EvolutionLevel` 2..9
for each char. At Lv 100, only evolutions through level **6** apply
(matching the in-game ascension cap for Lv 100).

The existing `_no-gear-stats.ts` extracts ALL evolution rows
(`EvolutionLevel` 2..9), summing them into the `noGearStats.evolution`
contributor.

### 5.2 Why the over-count

Maxwell (3-star char):
- `EvolutionLevel = 7`: +43 ATK, +105 HP, +20 BUFF_CHANCE
- `EvolutionLevel = 8`: +43 ATK, +20 BUFF_CHANCE, +20 DMG_BOOST
- `EvolutionLevel = 9`: …

Including levels 7-9 adds ~84 ATK and ~600 HP that wouldn't apply
at Lv 100. For S-tier DPS chars where stat prefill matters, this is
visible (~+1% damage on a fresh mature account, less on a maxed one).

### 5.3 How V3 should handle it

```ts
// pipeline/steps/damage-calc/_no-gear-stats.ts
function extractEvolution(rows: EvolutionRow[]): StatContribution {
  const out: StatContribution = {}
  for (const row of rows) {
    if (Number(row.EvolutionLevel) > 6) continue   // ← THE FIX
    addEvolutionRowToContribution(out, row)
  }
  return out
}
```

### 5.4 Why "evolution 6" specifically

The in-game ascension cap at Lv 100 is at "+6 stars" beyond `BasicStar`.
A 3-star char ascended fully sits at 9 stars in-game — but only stars
4..6 in the templet's `EvolutionLevel` (the next step would require
Lv 105+).

The mapping is:
- `BasicStar` 1 → ascends 2..6 (5 evolutions at Lv 100)
- `BasicStar` 2 → ascends 3..6 (4 evolutions)
- `BasicStar` 3 → ascends 4..6 (3 evolutions)

Levels 7-9 require Lv 105+ (the "post-100" character cap progression).

### 5.5 Decision

**Acceptable to defer the fix.** The Lv 100 prefill is just a
starting point — the user always overrides with their actual stats
from in-game. The drift is small (<1% on most chars). But it's the
**right** thing to do from a correctness standpoint.

If V3 ships with the fix: document the change in the migration notes
since users will see slightly lower auto-prefill values.

---

## 6. Lv 120 has NO impact on the damage formula

### 6.1 What

Outerplane characters can be leveled past 100 via
`CharacterMaxLevelTemplet` (Lv 100 → 105 → 110 → 120, with bonus
stats per step).

### 6.2 Why "no impact"

The damage formula (`computeDamage`) reads the user-supplied raw
stats (ATK, DEF, HP, …). It never reads attacker level. Lv 105 / 110
/ 120 grant **extra raw stats** but **no extra passives**.

Whatever stats the user types reflect their in-game character sheet
— the calc is level-agnostic.

### 6.3 The previous attempt (and why it was wrong)

A prior implementation added a `playerLevel` setting (`100` /
`105` / `110` / `120`) and tried to compose `noGearStats` per-level.
Two mistakes:

1. **Confused player level with character level.** `playerLevel` is
   account-wide; per-char Lv is independent. The setting conflated them.
2. **Even at the per-char level, the damage formula doesn't read it.**
   The bonus stats just shift the prefill numbers. Users who type their
   actual in-game stats already see the post-Lv-120 numbers.

### 6.4 How V3 handles it

NO `playerLevel` setting. NO `playerLevel` in `RecomputeContext`. Lv 100
is the implicit prefill anchor; users enter their actual stats above
that.

If a user wants to see the Lv 120 prefill: they'd need a separate
"display character at Lv X" UI feature, which is out of scope for
the calc (different tool: `/[lang]/characters/[slug]`).

---

## 7. Stat units (`%` vs flat) by source

### 7.1 What

Outerplane shows the same stat key with different unit conventions
depending on the source. The calc must respect this.

### 7.2 The rules (memorized)

From `MEMORY.md`:

- **Stats with `%` in the key** (`ATK%`, `DEF%`, `HP%`): always `%`.
- **`CHC`, `CHD`**: always `%`.
- **`SPD`, `ATK`, `DEF`, `HP`** (flat keys): no unit.
- **`EFF`, `RES`**: context-dependent:
  - Accessories / Armor sets → flat (no `%`).
  - EE / Talismans → percentage (`%`).

### 7.3 Why this matters

A talisman main stat `EFF` of `30` means `+30%`. The same `30` on an
armor accessory means `+30 flat`. Confusing the two breaks the
prefill calculation.

### 7.4 How V3 handles it

The `equipment.json` bake encodes `apply: 'rate' | 'add'` on every
talisman main stat:

```ts
interface DamageCalcTalismanMainStat {
  stat: string
  apply: 'rate' | 'add'           // ← the discriminator
  byRarity: { '4': number[]; '5': number[]; '6': number[] }
}
```

`'rate'` = % of base (compound with other %-bonuses). `'add'` =
additive (flat for SPD/EFF/RES, percentage points for CHC/CHD).

For `EFF`/`RES`, `apply: 'rate'` resolves to flat at runtime via
`floor(base × val/100)` (the in-game premium-buff convention).

Per-mille values from the datamine are converted at bake time to the
unit the runtime expects.

---

## 8. Gear caps (informational)

### 8.1 What

In-game maximum gear stat values (theoretical max with the highest-rolling
single-roll on a 6★ piece + EE Lv 10):

- **SPD**: 145 (= 18×5 from 5 armor pieces + 55 from accessory main stat).
  - Plus base 124 (Maxwell-tier Speed_Min) + buff pool, max realistic
    speed at battle start ~367 (no additional buff) or ~477 (with a
    +30% SPD buff).
  - Ryu Lion (specific char with extra base SPD) reaches ~377 / ~490.

These caps are **informational only**. The calc takes the user's
typed values without enforcing them; "what if SPD = 1000?" is a valid
hypothetical the user can explore.

### 8.2 Why mention

Earlier docs / UI labels referenced an outdated cap ("Gear SPD: 138"
from the old +48 accessory). Memorize: **+55 from accessory** is the
post-update max as of 2026-04-30.

---

## 9. Multi-hit drift (±0.2%, accepted)

### 9.1 What

Skills with `MaxHitCount > 1` (Maxwell S1 3 hits, Skadi S2 17 hits, …)
drift by ±0.2% from observation. Sign and magnitude depend on the
per-skill hit distribution.

### 9.2 Why

The single-shot path (`g__CalcDamage|17_0` VA `0x2B54660`) is binary-
faithful. The multi-hit dispatch lives in `CCharacterBattle.UseSkill`
(or an upstream orchestrator) and reaches `CalcDamage` only through
IL2CPP virtual dispatch.

Static disasm shows:
- `CFormula.CalcDamage` (`0x2B53EC8`) is mono-shot.
- Scan of the binary's `.text` (52 MB): **0 instruction `BL #0x2B53EC8`**
  (zero compile-time direct calls).
- Tens of `BLR Xn` (indirect calls) hit it — all virtual dispatch
  through IL2CPP method tables.

Without symbol resolution (Il2CppDumper full pass + `global-metadata.dat`),
we can't trace the per-hit DF distribution. Hypotheses (unverified):
- `UseSkill` reads `CharacterDamageTemplet.MaxHitCount`, divides
  `fDamageRate` per-hit, calls `CalcDamage` per-hit, sums.
- `floor(originalDF / MaxHitCount)` per hit is close but not exact.
  No simple distribution reproduces 2786 vs 2789 (Maxwell S1 case)
  without runtime tie-breaking rules.

### 9.3 Validation

| Skill | Hits | Calc | Observed | Δ | Ratio |
|---|---|---|---|---|---|
| Maxwell S1 (Amadeus) | 3 | 2789 | 2786 | +3 | 0.999 |
| Maxwell S1 (Ars Nova adv) | 3 | 4610 | 4605 | +5 | 0.999 |
| Maxwell S1 (Ars Nova adv crit) | 3 | 6444 | 6437 | +7 | 0.999 |
| Skadi S2 (Amadeus crit adv) | 3+7+7 | 3959 | 3967 | −8 | 1.002 |
| Skadi S1, S3 (single-hit) | 1 | exact | exact | 0 | 1.000 |
| Maxwell S2 | 1 | exact | exact | 0 | 1.000 |

### 9.4 Decision

**Accepted as documented limit.** ±0.2% is sufficient for ranking /
comparison; not sufficient for pixel-perfect prediction on a 5-figure
multi-hit number.

Closing this drift requires:
1. Il2CppDumper full pass to resolve method symbols.
2. Locate `CCharacterBattle.UseSkill.MultiHitDispatch` (or equivalent)
   in the symbolicated code.
3. Frida hook on `SkillRecord.fDamageRate` to observe per-hit values.

Estimated effort: 1-2 days RE work. Out of V3 scope.

---

## 10. Type 92 / 93 not modeled (Ame Sakura drift)

### 10.1 What

Two `BT_DMG_*` types are NOT modeled in the engine:
- **Type 92 `BT_DMG_ELEMENT_SUPERIORITY`** — marker buff that forces
  the elem path to ×1.20 baseline.
- **Type 93 `BT_DMG_ELEMENT_ENCHANT`** — adds `Value‰` above the 1.20
  base when type 92 is active.

### 10.2 Why

`CFormula.GetElementeryDamageRate` (VA `0x2B53C74`) checks:

```
if FindBuffElementSuperiority(caster):       // type 92 scan
    sum = FindBuffElementDamageRate(caster)  // type 93 sum
    rate = 1.20 + (sum × 0.001)
else:
    rate = standard RPS check (×1.20 / 1.0 / 0.80) + L↔D mutual adv
```

Ame's S1 carries `2000065_1_4` (type 92) gated by
`BuffConditionType: CASTER_HAS_BUFF, BuffConditionValue: 55`. The
value `55` doesn't match any static enum entry — it's likely a custom
group ID resolvable only at runtime.

### 10.3 The drift

Without modeling 92/93, Ame Sakura non-adv runs:
- non-crit: ratio 1.010-1.016
- crit: ratio 0.942-0.951

### 10.4 Stop-gap (currently shipped)

`char-overrides.ts` Ame entry has an `empiricalMult`:

```ts
{
  flag: 'sakuraActive',
  ratio: 2.0,
  empiricalMult: { nonCrit: 1.010, crit: 0.948 },  // stop-gap
}
```

Brings Ame Sakura non-adv obs within tolerance.

### 10.5 Future fix

When (if) type 92/93 are properly modeled:
1. Frida hook on `FindBuffElementSuperiority` to observe what value 55
   resolves to at runtime.
2. Hook `CBattleManager.ProcessDamage` to confirm the Sakura/Ume
   skill loading paths (`[0x545D478]` Ume / `[0x545D498]` Sakura).
3. Add `effect.target: 'elem_superiority'` (marker) and
   `effect.target: 'elem_enchant_permille'` to the reducer.
4. Remove the `empiricalMult` stop-gap.

Documented as deferred RE chore in `damage-lab-v2-spec.md` §7.5-6.

---

## 11. Light/Dark mutual advantage vs awakening +30% pool

### 11.1 What

Two distinct mechanisms apply on Light/Dark element matchups:

1. **Element multiplier** (`GetElementeryDamageRate`): ×1.20 on L→D
   AND ×1.20 on D→L. Validated empirically.
2. **Light/Dark awakening passive** (`Awakening_Element_Dmg_Dark_Light_10`):
   `BT_DMG = +300‰` with `BuffConditionType: NONE`. Fires on EVERY
   target regardless of element.

### 11.2 Why mention

Easy to conflate. Validated:
- L attacker → D defender: ×1.20 elem mult AND +30% pool. **Both fire.**
- L attacker → F/W/E defender: ×1.0 elem mult BUT +30% pool. **Only the
  passive fires.**
- L attacker → L defender: ×1.0 elem mult AND +30% pool. **Only the
  passive fires.** (Note: the passive does NOT exclude same-element.)

### 11.3 Why is the `BuffConditionType: NONE` not surprising

The awakening node is described in-game as "When attacking an enemy
of any element, increases damage dealt by 30%". The "any element"
phrasing matches `BuffConditionType: NONE` — no gating on attacker /
target element.

### 11.4 The Earth/Water/Fire variant

The same awakening tab has Earth/Water/Fire element nodes, but those
fire `BT_DMG = +500‰` (= +50%) with `BuffConditionType:
ATTACKER_ELEMENT_WIN` — only on advantage. So:

- E attacker → W defender (E adv W): ×1.20 elem mult AND +50% pool.
  Both fire.
- E attacker → F defender (E disadv F): ×0.80 elem mult, NO +50%
  pool (no advantage).
- E attacker → L defender: ×1.0 elem mult, NO +50% pool (no advantage).

**Light/Dark passive is +30% always; Earth/Water/Fire is +50% on
adv only.** Asymmetric.

---

## 12. Guild HP buff is NOT applied to ST_HP scaling

### 12.1 What

The Guild Level system grants an in-combat MaxHP buff
(`SYS_BUFF_GUILD_MAXHP_LEVEL_*` from `BuffSystemTemplet`) — at Lv 10,
`+15%` MaxHP.

### 12.2 Why "not applied"

The in-game `EBT_MAX_HP` system buff is an **in-combat** MaxHP boost,
applied AFTER battle start. `BT_SWAP_STAT_ATTACK` and `BT_DMG_OWNER_STAT`
are PASSIVE buffs that snapshot the BASE max HP at battle start —
**before** the system buff applies.

Empirically validated: Veronica CF S2/S3 against Amadeus with Guild
Lv 10 matches calc using the raw base `ST_HP`, not `ST_HP × 1.15`.

### 12.3 How V3 handles it

The `RecomputeContext` has a `guildHpBuffPct` field (kept as a
future hook). The runtime sets it to `0` for the public calc. The
admin lab also doesn't apply it.

```ts
// recompute.ts comment:
// Guild HP buff — `BuffSystemTemplet` EBT_MAX_HP boosts the in-combat HP
// bar (survival/heal/shield), but `BT_SWAP_STAT_ATTACK` and `BT_DMG_OWNER_STAT`
// are PASSIVE buffs that snapshot the BASE max HP at battle start (before
// the system buff applies), so the scaling reads pre-guild HP.
// → guild buff intentionally NOT applied to `statValues.ST_HP` here.
```

If a future char ships scaling on the in-combat HP (rather than base
HP), this changes. Currently no such char exists.

---

## 13. Cap on Maximum Reduction (`RATE_MIN = 0.30`)

### 13.1 What

The damage rate is floored at `0.30` (= −70% damage from rate alone):

```ts
rate = max(rate, 0.30)        // RATE_MIN
```

### 13.2 Why

The binary's `.rodata 0x1034074` stores `0.30000001192092896f`. This
is the "Cap on Maximum Reduction" the in-game help text refers to.

### 13.3 What it doesn't cap

- **Element disadvantage** (×0.80) is independent of the rate cap.
  An adv-attacker against a +70% DR boss with 0% PEN sees rate
  capped at 0.30 BUT then ×0.80 for disadv → effective 0.24.
- **Final reduce** (`× (1 − finalReduce/100)`) is independent.
- **Marking** (×1.15) is independent.
- **Mitigation** is independent (it's per-mille on DEF, not on rate).

So combining rate-cap + disadv + final-reduce CAN drop damage below
the −70% threshold. The cap is on the **rate component** only.

### 13.4 Surfacing the cap in UI

The `DamageBreakdown` exposes both `rate` (post-cap) and `rateRaw`
(pre-cap). When `rate !== rateRaw`, the UI should show "Rate capped"
so the user understands stacking more DR has no further effect.

```tsx
{Math.abs(breakdown.rate - breakdown.rateRaw) > 1e-6 && (
  <div className="text-orange-500 text-xs">
    Rate capped at {breakdown.rate.toFixed(2)} (raw: {breakdown.rateRaw.toFixed(2)})
  </div>
)}
```

---

## 14. Boss types ≥ 4 = `isBoss`

### 14.1 What

`MonsterTemplet.Type` has values like:
- `CT_NORMAL_MONSTER` (regular mob)
- `CT_ELITE_MONSTER`
- `CT_BOSS_MONSTER`
- `CT_NAMED_BOSS`
- … and more

The reducer's `BT_DMG_TO_BOSS` (type 96) checks `target.Type > 3`. The
exact mapping (which `CT_*` values map to which numeric indexes) lives
in the C++ enum.

### 14.2 How V3 handles it

The bake's `MonsterEntry.isBoss: boolean` pre-computes this — runtime
just reads the boolean. The bake's logic:

```ts
const BOSS_TYPES = new Set(['CT_BOSS_MONSTER', 'CT_NAMED_BOSS', 'CT_ELITE_BOSS', /* … */])
isBoss = BOSS_TYPES.has(monster.Type)
```

If a new monster type is added in a patch, the set may need updating.
Otherwise the boss-quirk doesn't fire.

---

## 15. Subclass uppercase normalization

### 15.1 What

`CharacterTemplet.SubClass` ships values like `"WIZARD"`, `"BRUISER"`
(already uppercase, no prefix). But awakening nodes use
`AAT_SUBCLASS` with lowercase-or-mixed values? **No** — they're
uppercase too. But:

The reducer's `BuffContext.charSubclass` MUST be uppercased before
filtering. The current code does:

```ts
charSubclass: ctx.charSubclass.toUpperCase()
```

### 15.2 Why

If an upstream pipeline modifies the case (e.g., a localization or
formatting step in `manifest.json`'s `summary.subclass`), the filter
would silently fail. Uppercasing is a defensive normalization at the
context-build boundary.

### 15.3 How V3 handles it

Mirror the existing pattern in `recompute.ts`:

```ts
const buffCtx: BuffContext = {
  // …
  charSubclass: ctx.charSubclass.toUpperCase(),
  // …
}
```

---

## 16. EE buffs bypass `appliesToCaster`

### 16.1 What

The reducer's filter:

```ts
if (b.source.kind !== 'ee' && !appliesToCaster(b.appliesTo, ctx)) continue
```

EE buffs SKIP the `appliesToCaster` check.

### 16.2 Why

EE `appliesTo` is keyed to the EE OWNER (the base char's ID for CF
chars wearing the base EE). When a CF char wears the BASE char's EE,
`ctx.charId` (CF) wouldn't match. Bypassing the check is intentional;
the bake's `eeCharId` filter (in the recompute precompose) already
restricts EE buffs to the wearer's ID:

```ts
const eeCharId = ctx.eeCharId ?? ctx.charId
const relevant = allBuffs.filter(b =>
  b.source.kind === 'awakening' ||
  (b.source.kind === 'char_skill' && b.source.charId === ctx.charId) ||
  (b.source.kind === 'ee' && b.source.charId === eeCharId)
)
```

### 16.3 Why the rule exists

If `appliesToCaster` were enforced on EE buffs, a CF char wearing the
base char's EE would never see the EE fire (since the EE's
`appliesTo` would refer to the base char, and `ctx.charId` would be
the CF). The bypass is correct.

---

## 17. CF char EE wearer mapping (`eeCharId`)

### 17.1 What

The `RecomputeContext.eeCharId` field tells the runtime which char's
EE catalog applies. Defaults to `charId`. Set differently for CF
chars wearing the base char's EE.

### 17.2 How V3 handles it

```ts
// _lib/compose-result.ts:
eeCharId: state.attacker.equipment.ee.variant === 'base' && summary.baseCharId
  ? summary.baseCharId
  : summary.id,
```

CF chars get a UI toggle in `EquipmentPanel`: "Equip self EE" /
"Equip base EE". The `variant: 'self' | 'base'` field captures the
choice.

### 17.3 Why

Some CF chars don't have their own dedicated EE. They wear the base
char's EE in-game. The calc must surface this option to match.

---

## 18. Manual target mode → `inAdvLicense = false`

### 18.1 What

Manual target mode (`state.target.mode === 'manual'`) has no
`DungeonMode` token. The AL gate resolves to `false`:

```ts
const inAdvLicense = isAdventureLicenseMode(target.mode) && state.settings.quirks.adventureLicense
// target.mode is undefined → isAdventureLicenseMode returns false
// → inAdvLicense = false
```

### 18.2 Why

A manual target has no in-game category to honor. Even with the AL
quirk toggle ON, the AL sub-nodes don't fire — there's no AL mode to
gate on.

### 18.3 Implication for users

If a user wants to model AL damage with custom stats, they'd need
to:
- Pick an AL stage (cascade mode), OR
- Use cascade mode AL stage and override stats inline on the target
  panel — keeping the mode while editing stats.

The latter is the recommended workflow.

---

## 19. EE Lv 0 vs EE not enabled

### 19.1 What

Two distinct states:
- `eeEnabled: false` — no EE equipped at all. ALL EE buffs filtered
  out.
- `eeEnabled: true, eeLevel: 0` — EE equipped at Lv 0. Mainstat fires
  with `eeLevelValues[0]` (often 0 or low). Lv 0 baseline passive
  fires. Lv 10 unlock passive does NOT fire.

### 19.2 Why distinct

The base chars who DO equip EE at Lv 0 still get the baseline passive.
The picker UI lets the user see Lv-0 passive contribution before
they enchant.

### 19.3 How V3 handles it

```ts
if (b.source.kind === 'ee') {
  if (!ctx.eeEnabled) continue                          // gate 1
  if (b.source.slot === 'passive_add' && (ctx.eeLevel ?? 0) < 10) continue  // gate 2
}

const eeLv = ctx.eeLevel ?? 0
const amt = b.effect.eeLevelValues?.[eeLv] ?? b.effect.amount
```

---

## 20. Marker buffs vs additive buffs

### 20.1 What

Some `BT_*` types are "marker" buffs — they don't contribute a
numeric value to the rate; their presence triggers a multiplier.

Examples:
- `BT_MARKING` (the in-game "Marked" debuff): defender carries → ×1.15
  multiplier on the damage formula.
- `BT_DMG_ELEMENT_SUPERIORITY` (type 92, not modeled): caster carries
  → forces the elem mult path to ×1.20 baseline.

### 20.2 How V3 handles `BT_MARKING`

The user toggles a "Marked" boolean in `BuffsState.marked`. Compose-result
threads this into `RecomputeContext.markingActive` (currently named
`markingActive` in `DamageInputs` — see `formula.ts` §1).

The formula reads it:

```ts
const markingFactor = i.markingActive ? markingMult : f(1)
```

`RODATA.MARKING = 1.149999976158142` — applied AFTER rate.

### 20.3 Why it's not in the reducer

Unlike pool / scaling buffs that aggregate, the marker is binary
(on/off). Routing it through the reducer's loop would add complexity
without benefit.

---

## 21. Stage IDs include `@al{N}` for AL tiers

### 21.1 What

Adventure License stages have composite IDs:

```
70600101         ← parent dungeon (NOT a valid stage in the bake)
70600101@al1     ← AL tier 1 (Lv 100, base stats)
70600101@al8     ← AL tier 8 (Lv 140, with SpawnAdvantageRate_*)
70600101@al10    ← AL tier 10 (Lv 160)
```

### 21.2 Why

The bake expands AL tiers into independent stages (see §1). Composite
ID is the unique key.

### 21.3 Implications

- **URL share.** The `tg=` field URL-encodes `@` → `%40`:
  `tg=70600101%40al8`.
- **Picker.** The picker labels these stages "AL Lv 8" etc. (not
  showing the composite ID).
- **Search.** Searching by stage ID must match the composite, not
  the parent.
- **Fixture replay.** Old observation contexts may use the parent ID;
  pre-fix obs would need migration to the composite. The CI fixture
  set was rebaked post-fix.

---

## 22. Single floor at the END of the formula

### 22.1 What

```ts
const mainCalc = Math.max(1, Math.floor(mc))    // single floor
```

The formula keeps full f32 precision through every multiplication
and floors ONCE at the end (`frintm + fcvtms` in the binary).

### 22.2 Why "single"

Flooring intermediate values drifts. Example:
- `2789.7 × 0.95 × 1.20` correctly floors to `3180`.
- But `floor(floor(2789.7) × 0.95) × 1.20 = floor(2789 × 0.95) × 1.20
  = 2649 × 1.20 = 3178.8 → floor = 3178`. Off by 2.

The binary uses `frintm` (round toward −∞) only at the end.

### 22.3 Common bug

Helper functions that emit `Math.floor` mid-chain. Always check
multi-step transformations don't sneak in an extra floor.

---

## 23. `casterDefUp` dual role

### 23.1 What

The `a-buff-def` external buff toggle has TWO effects:

1. **Boosts caster DEF**: external_buff.attackerDEF aggregator picks
   it up → multiplies caster `ST_DEF` (for DEF-scaling chars like
   Veronica's swap-stat).
2. **Sets `casterDefUp = true`** in `BuffContext`: gates buffs whose
   `BuffConditionType: OWNER_HAS_BUFF=6` resolved to
   `requires: 'caster_def_up'` (Veronica core fusion's "Increases
   Damage for allies under Increased Defense").

### 23.2 Why dual

A defense-up buff in-game does both: gives the caster +DEF AND
satisfies "has DEF buff" preconditions for ally-scaling buffs.

### 23.3 How V3 handles it

```ts
casterDefUp: !!ctx.externalBuffs?.['a-buff-def']?.active
```

The reducer's trigger matcher reads `ctx.casterDefUp`:

```ts
case 'caster_def_up': return !!ctx.casterDefUp
```

Documented this way so a future maintainer doesn't decouple them.

---

## 24. Class label rename (`PRIEST` → `Healer`)

### 24.1 What

The datamine uses `CCT_PRIEST` for the healer class. The in-game UI
displays "Healer". The bake emits "Healer" in `summary.class`.

### 24.2 Why mention

When matching against `Class` in awakening filters, use `CCT_PRIEST`
(if reading from raw datamine) or `'Healer'` (if reading from bake).
**Don't mix.**

The bake-time mapping:

```ts
const CLASS_DISPLAY: Record<string, string> = {
  CCT_DEFENDER: 'Defender',
  CCT_ATTACKER: 'Striker',          // also renamed (CCT_ATTACKER → "Striker")
  CCT_RANGER:   'Ranger',
  CCT_MAGE:     'Mage',
  CCT_PRIEST:   'Healer',           // ← rename
}
```

### 24.3 Awakening filter implications

Awakening nodes with `AwakeningApplyType: AAT_CLASS` use the numeric
class value:
- `1` = Defender
- `2` = Attacker (Striker)
- `3` = Ranger
- `4` = Mage
- `5` = Priest (Healer)

The reducer's `appliesToCaster`:

```ts
case 'class': return at.value === ctx.charClass
```

`at.value` from the bake is the DISPLAY string (`'Mage'` etc.).
`ctx.charClass` from the bake's manifest.summary is also the display
string. Match.

If you ever read raw `CharacterTemplet.Class`, normalize to the
display string at the boundary.

---

## 25. CHC isn't in the formula

### 25.1 What

The damage formula reads a `crit: boolean` input. CHC (crit chance %)
is NOT used.

### 25.2 Why

The user picks "show me damage on crit" or "show me damage non-crit".
The calc never rolls — it just computes the deterministic value
under the picked scenario.

CHC enters the user's calculation indirectly: they multiply by
`CHC/100` for expected damage:

```
ExpectedDamage = (CHC / 100) × CritDamage + (1 − CHC / 100) × NonCritDamage
```

This is OUT OF SCOPE for the calc itself but a natural follow-up
the user does manually.

### 25.3 Future feature (not committed)

A "show expected damage" toggle could show both crit + non-crit and
the CHC-weighted average. Out of V3 scope.

---

## 26. `BT_MARKING` is a marker, not a stat

### 26.1 What

Confusion: `BT_MARKING` shows up as a `BuffType` enum value but it
doesn't fit the `effect.target` taxonomy (no pool, no atk, no
scaling).

### 26.2 How V3 handles it

`BT_MARKING` is NOT extracted as an `ApplicableBuff`. It's a
**boolean toggle** in `BuffsState.marked`. The pipeline doesn't
need to model it as a buff — it's a UI-driven flag.

### 26.3 Why

The in-game "Marked" debuff is applied by certain skills. The user
knows whether their team has marked the target — they just toggle
it. No need for the bake to enumerate every "Marker apply" buff.

---

## 27. NaN propagation defense

### 27.1 What

An f32 chain with a NaN input cascades NaN through every operation.
`f32mul(NaN, 1)` returns NaN.

### 27.2 Why mention

UI inputs are user-typed. A `parseInt('')` returns NaN. Allowing the
NaN to reach the formula corrupts the entire calculation.

### 27.3 How V3 handles it

- **UI input parser:** never propagate NaN to the reducer. If parsing
  fails, keep the previous valid value:

```ts
const v = parseInt(input, 10)
if (Number.isNaN(v)) return  // skip dispatch
dispatch({ type: 'attacker/setStat', key: 'ATK', value: v })
```

- **`runRecompute` boundary:** validate `RecomputeContext` for NaN
  before calling `recompute()`. Return null if any required field is
  NaN.

- **Engine:** doesn't try to recover from NaN. Trust the caller.

---

## 28. Don't trust slugs for filter / group

### 28.1 What

Slugs are kebab-case derived from EN names. Memorized
(`MEMORY.md → CLAUDE.md`):

> Slugs are kebab-case, used as primary identifiers — never filter /
> group on localized fields

### 28.2 Why

Localized fields (e.g., `name_jp`) can change without breaking the
ID. Slugs are stable. But filtering / grouping by slug is fragile if
a slug ever changes.

### 28.3 How V3 handles it

- Use `id` for storage keys (`charId`, `monsterId`, `stageId`).
- Use `slug` for URLs only (and keep stable across patches via the
  bake integrity check).
- For grouping (e.g., grouping CF chars under their base): use
  `id` + the `baseCharId` / `coreFusionId` link in `manifest.chars[]`,
  NOT name matching.

---

## 29. The `crit` toggle vs CHC

### 29.1 What

The attacker panel has a `crit: boolean` toggle. The stats grid has
a `CHC` field. The two are independent.

### 29.2 Why

The `crit` toggle is "show me the crit-hit damage". CHC is a stat
that contributes to the **likelihood** of a crit but doesn't change
the formula's branch. The user toggles `crit` to see worst-case /
best-case damage.

### 29.3 Implication

CHC enters the formula only if a buff scales on `ST_CRITICAL_RATE`
(Regina's ATK scaling). Otherwise it's purely informational.

---

## 30. Class-passive Skill_22 stores the class INDEX

### 30.1 What

`CharacterTemplet.Skill_22` does NOT store a skill ID. It stores the
**class index** (`"1"` for Defender, `"4"` for Mage, etc.). To
resolve the class passive, look up `CharacterSkillLevelTemplet` rows
where `SkillID = N` (with `N` = the index).

### 30.2 Why

Class passives are shared across all chars of that class. Storing the
index per-char (instead of duplicating the skill ID) saves space.

### 30.3 Skill_23 is different

`Skill_23` (when present) IS a full skill ID (e.g., `"2823"`). The
runtime distinguishes by checking presence:
- `Skill_23` set → use it as a Skill ID.
- Only `Skill_22` set → use it as a class index, look up shared class
  passive.

### 30.4 The bake handles this

`build-chars.ts` resolves the class passive correctly:

```ts
if (char.Skill_23) {
  // CF char with upgraded passive
  passiveSkillId = char.Skill_23
  passiveBuffIds = readSkillLevelBuffs(passiveSkillId, /* level */ 5)
} else if (char.Skill_22) {
  const classIndex = char.Skill_22
  // Class passive: SkillID = classIndex, SkillLevel = 1 typically
  passiveBuffIds = readSkillLevelBuffs(classIndex, 1)
}
```

---

## 31. Quick checklist for new features

When adding to the calc:

1. **New `BT_*` enum value** — extend `extract-buffs.ts` to emit the
   right `effect.target` and `PoolCondition`. Extend `applyBuffs`
   dispatch.
2. **New char with non-standard scaling** — try existing
   `scaling_swap` / `scaling_add_*` / `scaling_target_stat` first.
   Extend `getCharOverride` only if needed.
3. **New external buff** — add to `EXTERNAL_BUFFS` catalog. UI
   auto-renders.
4. **New boss mechanic** — add the override to
   `mechanics/{monsterId}.json` bake. UI auto-renders.
5. **New stage in the picker** — bake re-run picks it up. UI category
   may need a new entry in `MODE_GROUPS` if the mode is new.
6. **New skill (B4 or beyond)** — would require schema changes:
   `DamageCalcSkillDetail` keys, `CallerSlot` type, etc.
7. **New stat axis** — see `05-ui-contract.md` §17.1.
8. **New equipment slot** — currently the calc takes raw stat numbers,
   not gear pieces. New slots would be a major architectural change.

---

## 32. Validation checklist for a release

Before merging a calc-affecting PR:

1. **Engine fixture replay** — `data/admin/damage-lab-observations-v2.jsonl`
   replays, single-hit obs ratio 1.000 ± 0.001, multi-hit ±0.002.
2. **Bake integrity** — every char in `manifest.chars[]` has a
   `chars/{id}.json`; no orphan buff IDs; AL stage IDs match
   `^\d+@al\d+$`.
3. **URL round-trip** — 50 random states serialize → deserialize →
   recompute → assert `calculated` matches.
4. **i18n line alignment** — all 4 locale files (`en.ts`, `jp.ts`,
   `kr.ts`, `zh.ts`) have keys and section comments at the same line
   numbers.
5. **No `BT_*` in user copy** — grep the locale files; user-facing
   text should never reference internal enum names.
6. **TypeCheck + Lint pass.**
7. **Cold-load size** — total bake fetch ≤ 300 KB gzipped.
8. **`recompute` perf** — median < 1 ms.
9. **Mobile layout sanity** — checked on a phone-sized viewport.
10. **Gotcha review** — anything in this doc that the change touches
    has been considered.

---

## 33. Where to look when something's off

| Symptom | First place to look | Why |
|---|---|---|
| Wrong damage on AL stage | This doc §1 | Per-tier advantage bug |
| Damage off by ±0.2% on multi-hit | This doc §9 | Accepted limit |
| Ame Sakura non-adv off | This doc §10 | Type 92/93 not modeled |
| L/D damage seems doubled | This doc §11 | Mutual adv + passive both fire |
| Codex/quirks not affecting damage | This doc §3, §6.6 | Pre-applied at prefill, not formula |
| Stats display % vs flat wrong | This doc §7 | Source-dependent unit |
| EE not firing | This doc §16, §19 | `eeEnabled` + level gates |
| CF char EE wrong | This doc §17 | `eeCharId` mapping |
| AL quirks not firing | This doc §2 | Mode-gate AND toggle |
| Manual target damage off | This doc §18 | No mode → no AL gate |
| Stage filter misses tier | This doc §21 | Composite ID `@al{N}` |
| Drift on some 5-figure damage | This doc §22 | Single-floor invariant |
| Boss buff doesn't trigger boss quirk | This doc §14 | Boss type set |
| Subclass filter not firing | This doc §15 | Uppercase normalization |

---

End of gotchas. End of brief. Implementations should pass through
the seven docs in order on a first read; this last doc is the
reference for "I'm seeing X, why?" debugging.
