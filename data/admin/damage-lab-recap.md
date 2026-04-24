# Damage Lab — Recap (Outerplane)

## Goal

Reverse-engineer the full damage formula for the game **Outerplane**. The workflow is:
1. Log in-game damage observations via `/admin/damage-lab` (dev only)
2. Derive the formula empirically from the ratios obs/calc
3. Update `src/lib/damage/formula.ts` progressively

## Current state — formula (validated on 29 tests)

```
Dmg = (DF/1000) × ATK × (1 + pool/100) × 1000/(1000 + (1-PEN/100)×DEF) × (1 - targetDR/100) × elem_mult

pool = DMG Inc (attacker stat, gear + character passives)
     + 12 if Mage class
     + 30 if isBoss   [lvl 1 boss — may scale higher with boss level, NOT YET MODELED]
     + 50 if elem adv
     + (CHD - CDmgRed - 100) if crit

elem_mult = 1.20 if adv, 0.80 if disadv, 1.0 if neutral
```

### Validation stats (29 obs)

- **22/29 exact** (<0.1% error)
- **7/29** show ~0.7-2.1% residual — all on lvl-30 Sentry Archer boss (`ID 4003012`, 2⭐)
- Avg error: 0.4%, max: 2.06%

### Validated empirically

- ✅ Skeleton (structure, C=1000, skill=DF/1000, PEN formula, target DR multiplicative)
- ✅ **Crit: `(CHD - CDmgRed - 100)` additive in pool** — NOT a separate multiplier. The in-game CHD stat is the TOTAL crit damage multiplier (CHD=188 → 1.88×).
- ✅ **Boss quirk: +30% additive** (validated on low-level boss def=44 DR=0)
- ✅ **Adv: +50% additive AND ×1.20 multiplicative** (dual effect)
- ✅ **Disadv: ×0.80 multiplicative only** (no additive penalty — asymmetric with adv)
- ✅ **Mage class: +12% additive** (validated on Alice)
- ✅ **Striker/Attacker (same class): no offense quirk** (Noa, Rin)
- ✅ **Priest/Healer: no offense quirk** (Viella — class field is "Healer" in game data)

### NOT yet validated

- ❓ **Boss quirk scales with boss level** — suspected. Lvl 1 boss gives +30% exact. Lvl 30 Sentry Archer gives ~+31%. Need tests at lvl 15, 50, 99 to fit relation.
- ❓ Boss + crit interaction — persistent +~1% extra on boss+crit cases beyond the above.
- ❓ Ranger, Defender class quirks (suspected: Ranger +EFF defensive, Defender +DMG_REDUCE defensive — neither offensive)
- ❓ Character-specific passives (e.g. Noa has +17% DMG Inc when in advantage; Aer has +23% vs Earth — user manually enters these in `dmgInc`)
- ❓ "Quirks disabled" targets (e.g. lvl 99 bosses disable all quirks — user's earlier Alice tests on lvl 99 showed -18% mystery)
- ❓ Ingame values display by UI may be round causing maybe the 1% variation

## Class mapping (in-game label → data file label)

| In-game | Data file |
|---|---|
| Striker | `CCT_ATTACKER` / "Attacker" (SAME class, different label) |
| Mage | `CCT_MAGE` / "Mage" |
| Ranger | `CCT_RANGER` / "Ranger" |
| Defender | `CCT_DEFENDER` / "Defender" |
| Priest | `CCT_PRIEST` / "Healer" (different label!) |

There's also a `SubClass` field in data (e.g., "Attacker" subclass) — unknown if it affects damage.

## Element advantage matrix (Outerplane)

- Fire > Earth, Earth > Water, Water > Fire (rock-paper-scissors) => +/-50%
- Light & Dark => +30% on every element

## Key files

- `src/lib/damage/formula.ts` — the validated formula with auto-quirks
- `src/app/admin/damage-lab/page.tsx` — UI for logging & live ratio check
- `src/app/api/admin/damage-lab/observations/route.ts` — GET/POST/DELETE to JSONL store
- `src/app/api/admin/damage-lab/characters/route.ts` — character data + skill DFs per lvl
- `src/app/api/admin/damage-lab/stages/route.ts` — mode → stage → monster index (reuses extractor-v3 location tables)
- `data/admin/damage-lab-observations.jsonl` — the store (append-only JSONL, auto-save)
- `data/admin/json2/MonsterTemplet.json` — boss stats (Def_Min/Max, DR, Stars)
- `data/admin/json2/CharacterTemplet.json` — character data (class, element)
- `data/admin/json2/DungeonTemplet.json` — stages (DungeonMode, NameID, SpawnID_Pos0/1/2)
- `data/admin/json2/DungeonSpawnTemplet.json` — spawn groups (GroupID → ID0..3 + Level0..3)

## Attacker quirks panel (auto-detected from context)

When a character is selected:
- **Lv100 base** (`atkMax`/`chdMax`/`critRateMax`) read from `CharacterTemplet`. Note: `CriticalDMGRate_Max` and `CriticalRate_Max` are stored per-mille (÷10 → %).
- **Transcendance** dropdown (Lv0 / Lv3 / Lv4-1 / Lv4-2 / Lv5-1 / Lv5-2 / Lv5-3 / Lv6), default **Lv6**. The ATK% bonus is parsed from `data/character/{id}.json` → `transcend[lvl]` via regex `ATK DEF HP +(\d+)%`.
- **Evolution stat bonuses** (`CharacterEvolutionStatTemplet`): cumulative flat ATK/DEF/HP from stars 2→6 + % CHD/Crit Rate when present.
- **Class passive** — `parseClassPassive()` walks **every** `Skill_N` slot (not just Skill_22), resolves each skill's max-level `BuffID` CSV, accumulates unconditional (`cond=NONE`) buffs whose `Type` is `BT_STAT_PREMIUM` or `BT_DMG`. This captures class passives (Skill_22 → `MAGE_PASSIVE_2` +10% ATK, `PRIEST_PASSIVE_2` +10% HP, `ATTACKER_PASSIVE_2` +5% Crit Rate) **AND** transcendent-8 upgrades (Skill_8 → `trancendent_8_hp_upgrade` +10% HP, etc.). Combat-triggered types (`BT_STAT` without PREMIUM, `BT_DOT_*`, `BT_SHIELD_*`, `BT_HEAL_*`) are excluded.
- **Hero Codex** (`CharacterArchiveStatTemplet`): global roster-wide stat bonus tied to the player's codex progression (Lv.1–11). Lv.11 = +10% ATK / +10% DEF / +10% HP. Values are per-mille (100 → 10%). Applied to EVERY character — default to Lv.11 (max) but user-configurable via dropdown.
- ~~Rarity core passive (`core_passive_Nstar_ablity_*`)~~ — these buffs exist in `BuffTemplet` but are only attached to non-playable entities (char IDs 2700003/2700005/2710005 via skill 372/572 → Detachment/Trust). They do **NOT** apply to regular playable chars. Don't auto-apply.
- **Gift node quirks** — every applicable awakening/gift node is listed as a checkbox, all auto-checked (ADVENTURE_LICENSE off by default).
- **Element advantage/disadvantage** auto-detected from `char.element` vs `monster.element` using Fire > Earth > Water RPS matrix.

### Stat stacking model — **Model B** (codex only on `statMax`)

Derived empirically from **Rin** (3★ Striker, no class ATK passive), **Tio** (2★ Healer/Reliever/Fire), **Astei** (3★ Healer/Reliever/Fire).

```
stat = floor(
  statMax × (1 + trans + heroCodex + classPct + quirkPct)
  + (evoFlat + classFlat + giftFlat) × (1 + trans + classPct + quirkPct)
)
```

**Hero Codex applies ONLY to `statMax`**, not to evolution or gift flats. Transcend, class passive, and gift `%` apply to all flat pools.

Validation (transcend Lv6 + Hero Codex Lv.11, **no gift quirks**):

| Char | Stat | Formula | Calc | In-game | Diff |
|---|---|---|---|---|---|
| Rin | ATK | `930 × 1.40 + 169 × 1.30` | 1521 | 1520 | +1 |
| Rin | DEF | `247 × 1.40 + 73 × 1.30` | 440 | 439 | +1 |
| Rin | HP | `3481 × 1.40 + 403 × 1.30` | **5397** | 5397 | **0 EXACT** |
| Tio | ATK | `624 × 1.40 + 0 × 1.30` | **873** | 873 | **0 EXACT** |
| Tio | DEF | `353 × 1.40 + 125 × 1.30` | **656** | 656 | **0 EXACT** |
| Tio | HP  | `3204 × 1.65 + 931 × 1.55` (classHP=25%) | 6729 | 6771 | −42 (0.6%) |
| Astei | ATK | `717 × 1.40 + 0 × 1.30` | **1003** | 1003 | **0 EXACT** |
| Astei | DEF | `405 × 1.40 + 125 × 1.30` | **729** | 729 | **0 EXACT** |
| Astei | HP  | `3684 × 1.65 + 931 × 1.55` (classHP=25%) | 7521 | 7567 | −46 (0.6%) |

Additional spot-check with gifts:
- Tio ATK with 2 × Reliever ATK +100 flat: `624 × 1.40 + 200 × 1.30 = 1133` (in-game 1133, **EXACT**) ✓

**Codex display** (what the in-game character codex shows, WITHOUT transcend and WITHOUT Hero Codex, class passive included) = `(statMax + evoFlat) × (1 + classPct)`. Confirmed:
- Rin codex ATK `(930 + 169) × 1.00 = 1099` (in-game 1098, −1 rounding) — Striker has no ATK class passive
- Rin codex HP  `(3481 + 403) × 1.00 = 3884` (in-game 3884, EXACT) ✓
- Iris codex ATK `(655 + 120) × 1.10 = 852` (in-game 852, EXACT) — Mage +10% ATK class passive ✓

### Class passive sources (data-driven via `CharacterTemplet.Skill_N` slots)

`parseClassPassive()` walks every `Skill_N` slot for a character, resolves each skill's max-level `BuffID` CSV, and accumulates every unconditional (`cond=NONE`) buff whose `Type` is `BT_STAT_PREMIUM` (always-on innate stat) or `BT_DMG` (damage pool). Combat-triggered types (`BT_STAT`, `BT_DOT_*`, `BT_SHIELD_*`, `BT_HEAL_*`) are excluded — they fire on skill cast, not on the base stat sheet.

Common hits per class (Skill_22):
- Mage → `MAGE_PASSIVE_2` = +10% ATK
- Priest → `PRIEST_PASSIVE_2` = +10% HP
- Striker → `ATTACKER_PASSIVE_2` = +5% Crit Rate (not ATK — that's why Rin has no ATK class passive)
- Defender / Ranger → TBD (similar pattern, usually +5% Crit Rate or def-related)

Common hits per transcend unlock (Skill_8):
- `trancendent_8_hp_upgrade` = +10% HP (Healers)
- `trancendent_8_cri_dmg_upgrade` = +8% CHD (DPS classes)
- `trancendent_8_cri_upgrade` = +6% Crit Rate

### Transcend text extras (Lv6)

The curated `data/character/{id}.json` `transcend['6']` string sometimes carries extra self-targeted bonuses beyond the `ATK DEF HP +X%` line — e.g. Tio Lv6 `"+5% Health"` or Astei Lv6 `"+5% Ally Team Health"`. `parseTranscendExtras()` regex-scans the remaining lines for `+N% Health`, `+N% Critical Damage`, `+N% Critical Hit Chance` — including `Ally Team …` variants since **the caster counts as a team member and benefits from her own team aura**.

Parsed into `classPassive.{hpPct, chdPct, critRatePct}`.

### Skill_8 transcendent 8 buffs (BT_STAT_PREMIUM, always-on)

At Skill_8 Lv4 (max), the `trancendent_8_*_upgrade` buff is unlocked and persists as an innate passive. Examples:
- Healers: `trancendent_8_hp_upgrade` = +10% self HP (Tio) or `trancendent_8_hp_team_upgrade` = +10% team HP (Astei — also benefits self)
- DPS: `trancendent_8_cri_dmg_upgrade` / `trancendent_8_cri_dmg_team_upgrade` = +8% CHD
- etc.

At Lv2–3 the base variant (`trancendent_8_hp`, +5%) is active; at Lv4 it is **replaced** by the upgrade (`_upgrade`, +10%). Max-level scan picks up only the upgrade — the base is not stacked on top.

### Known HP residual on Healers (~0.6%, ~+1% missing)

Tio and Astei both end up **~1% under** the in-game HP. Likely causes (impossible to confirm without more data):
- Lv6 transcend text says `+5% Health` but the game may apply `+6%` internally (rounding or text typo in curated data)
- An unaccounted Reliever subclass HP buff

Neither ATK nor DEF show this residual, so the fix is isolated to HP on Priests. For HP-scaling characters (some characters deal damage based on HP rather than ATK), the user should override the HP field manually with the in-game value to get exact damage calcs.

CHD / Crit Rate / PEN: always additive percentage points (no multiplicative layer).

Auto-fill triggers on character or transcend change **post-hydration only** — saved form values are preserved on page load.

## Gift-node quirks system (data-driven)

The game has 5 "gift" trees (`CharacterAwakeningTemplet`): **ELEMENTAL**, **JOB**, **UTILITY**, **PVE**, **ADVENTURE_LICENSE**. Each tree has nodes defined in `CharacterAwakeningNodeTemplet`; unlocking a node grants a buff from `BuffTemplet` (indirected through `CharacterAwakeningLevelTemplet`).

The famous **Mage +12% damage** is the JOB02 MAIN node (ID 121 in `CharacterAwakeningNodeTemplet`) — `BuffID MAGE_PASSIVE_3_10`, `Type: BT_DMG`, `ApplyingType: OAT_RATE`, `Value: 120` (per-mille → 12.0%), `BuffConditionType: NONE`.

### Decoded `AwakeningApplyTypeValue` enums

| AAT_CLASS | label    | AAT_SUBCLASS | label     | AAT_ELEMENTAL | label |
|-----------|----------|--------------|-----------|----------------|-------|
| 1         | Defender | 1/2          | Attacker / Bruiser   | 0 | Earth |
| 2         | Striker  | 3/4          | Wizard / Enchanter   | 1 | Water |
| 3         | Ranger   | 5/6          | Vanguard / Tactician | 2 | Fire  |
| 4         | Mage     | 7/8          | Sweeper / Phalanx    | 3 | Light |
| 5         | Healer   | 9/10         | Reliever / Sage      | 4 | Dark  |

Note: *Tactician* is a Ranger subclass (not Defender), *Sweeper* is Defender (not Ranger).

### API — `GET /api/admin/damage-lab/quirks`

Returns every resolved gift node at **max level** with its filter (`appliesTo.kind/value`), the max-level buff row, and a computed `QuirkEffect` targeting the formula input:

- `effect.target === 'pool'` → adds to `dmgIncPct` (covers `BT_DMG` and `ST_DMG_BOOST`)
- `effect.target === 'atk' | 'chd' | 'pen' | 'critRate'` → displayed only, not auto-applied (the user's in-game ATK/CHD/PEN fields already reflect these unlocked stat nodes — auto-applying would double-count)
- `effect.requires` tag ties the buff's `BuffConditionType` to a UI state (`adv`/`disadv`/`neutral`/`crit`/`boss`). A quirk only contributes when its condition matches. Unsupported conditions (OWNER_HPRATE_UNDER, TARGET_HAS_BUFF…) are returned as `effect: null` and shown with an `unmapped` badge.

### Formula — hardcoded Mage +12% still in legacy path

`src/lib/damage/formula.ts` still contains the `if (charClass === 'Mage') poolPct += 12` branch. It's **only exercised by `recomputeWithCurrentConstants`** (historical observations that stored `class: 'Mage'`). Live computation passes `charClass: ''` — the Mage +12% now comes from the quirk checkbox `MAGE_PASSIVE_3_10`. Removing the legacy branch would break the ratios of older Alice/Viella observations.

## Stage picker (loads target from game data)

The Target panel now has a **Load from game** cascade: *Mode → Stage → Monster*. Selecting a monster auto-fills `DEF`, `DMG Reduction %`, and `isBoss` from `MonsterTemplet` with computed stats at the spawn level, then stores `monsterId`, `monsterName`, `monsterLvl`, `stageId`, `stageName`, `mode`, `tClass`, `tElement` on the observation.

**Scaling hypothesis** (2 validated points only — lvl 1 and lvl 30 on Sentry Archer):

```
def(lvl)   = Def_Min + (Def_Max - Def_Min) * (lvl - 1) / 99
drPct(lvl) = DMGReduceRate_Max * (lvl - 1) / 99 / 10   // Max is per-mille (÷10 for %)
atk(lvl)   = Atk_Min + (Atk_Max - Atk_Min) * (lvl - 1) / 99   // not validated, informative
```

The DEF/DR fields remain editable — override them if the interpolation disagrees with the in-game display. Next-level tests (lvl 15/50/99) will confirm or refine this scaling.

## The 29 observations (copy-paste into data/admin/damage-lab-observations.jsonl)

## Results store path :

C:\Users\Sevih\Documents\dev\outerpedia\data\admin\damage-lab-observations.jsonl

## Context summary

- L1-L16: Noa tests (Striker/Earth) — validated skeleton, crit, boss lvl 1, DR, PEN, and partial boss lvl 30 (def=382 residuals)
- L17-L21: Alice (Mage/Earth) → validated Mage +12% additive
- L22-L25: Rin (Striker/Water) → validated disadv = ×0.80 multiplicative pure
- L26-L29: Viella (Healer/Earth) → validated Priest has no offense quirk

The boss at def=44 (Noa L3/L5) is a different boss (possibly lvl 1 of some boss) and gives exactly +30%. The boss at def=382 DR=2.9% is the **Sentry Archer lvl 30, 2⭐ Ranger/Earth** (ID 4003012 in MonsterTemplet.json) and gives **~+31%** (residual ~+1%).

## Next tests to pin down boss quirk level scaling

**Priority 1 — boss quirk level dependency**:
- Same character (e.g., Alice or Noa), no-crit, no-adv, no-dmgInc
- Test on bosses at different levels (lvl 15, lvl 50, lvl 99)
- Fit `boss_quirk(level)` relation (linear, exponential?)

**Priority 2 — Ranger, Defender classes**:
- A Ranger character, baseline no-crit on mob → confirm no offense quirk
- A Defender character, same → confirm

**Priority 3 — quirksDisabled targets** (endgame bosses where all quirks disabled):
- Test same character on a lvl 99 quirks-disabled boss
- Should give `pool = dmgInc only` exactly (no boss, no adv, no Mage)

## Known residuals

| Pattern | Residual | Likely cause |
|---|---|---|
| Sentry Archer lvl 30 boss, no-crit | +0.7-0.95% | Boss quirk ≈ +31% (not +30%) for this level |
| Sentry Archer + crit | +1.7-2.1% | Above + ~+1% boss-crit interaction? |
| Priest/Healer HP prefill | −0.6% (~−45 HP) | Lv6 text `+5% Health` seemingly applied as `+6%` in game. Tio & Astei both need `classHP=26%` to match exactly (we currently compute 25%). Affects only HP, not ATK/DEF. |

## User preferences (from this session)

- JSONL for damage-lab observations (compact keys, optimized for AI reading, not human)
- Formula in `src/lib/damage/formula.ts` — keep it clean and documented
- No auto-quirks that aren't validated — the methodology is: enter pool=0, ratio reveals the quirk value

## Commands cheat sheet

```bash
# quick ratio check on current obs (run from project root):
node -e "
function computeDamage(i) {
  const C = 1000, bossBonus = 30, advAddBonus = 50, advMult = 1.20, disadvMult = 0.80, mageBonus = 12;
  let poolPct = i.dmgInc;
  if (i.class === 'Mage') poolPct += mageBonus;
  if (i.isBoss) poolPct += bossBonus;
  if (i.elem === 'adv') poolPct += advAddBonus;
  if (i.crit) poolPct += Math.max(0, i.chd - i.tCdmgRed - 100);
  const mod = 1 + poolPct/100;
  const mit = C/(C+(1-i.pen/100)*i.def);
  const drMult = 1 - i.tDmgRed/100;
  const elemMult = i.elem === 'adv' ? advMult : (i.elem === 'disadv' ? disadvMult : 1.0);
  return (i.df/1000) * i.atk * mod * mit * drMult * elemMult;
}
const obs = require('fs').readFileSync('data/admin/damage-lab-observations.jsonl','utf8').split('\n').filter(l=>l.trim()).map(JSON.parse);
obs.forEach((o,i) => { const calc = computeDamage(o); const ratio = o.obs/calc; console.log('L'+(i+1), 'ratio='+ratio.toFixed(4)); });
"
```
