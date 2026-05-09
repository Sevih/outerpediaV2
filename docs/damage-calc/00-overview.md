# Damage Calculator V3 — 00. Overview

> **Audience.** Engineers (human or AI agents) tasked with implementing the
> public damage calculator from scratch in an isolated worktree. The seven
> documents in this directory are the **single source of truth** for V3.
> Treat them as the contract; the existing `src/lib/damage/v2/`,
> `src/app/[lang]/tools/_contents/damage-calculator/`, and
> `pipeline/steps/damage-calc/` trees are **reference**, not blueprint.
>
> **Goal of V3.** Re-implement `/[lang]/tools/damage-calculator` end-to-end
> (datamine pipeline → baked JSON → server reader → compute engine → React
> UI → URL share) without inheriting the architectural compromises of the
> current implementation. Feature parity is required.

---

## 1. Product context

### 1.1 What it is

Outerpedia hosts a public-facing **damage calculator** at the URL
`/[lang]/tools/damage-calculator` (one route per language: `en`, `jp`, `kr`,
`zh`). It is one of the site's headline tools — a free-to-use simulator that
predicts the integer damage a player character will deal to a chosen target
(boss or trash mob) in the mobile gacha game **Outerplane**.

The calculator's core promise is **bit-faithful prediction**: when a user
inputs realistic stats and selects a stage, the displayed value matches the
in-game damage number to within the documented tolerance (single-hit skills:
exact; multi-hit skills: ±0.2%). This is not a back-of-envelope estimator.
The formula is reverse-engineered from the game's ARM64 binary
(`libil2cpp.so`), validated bit-for-bit against an internal
admin-only damage lab, and shipped to the public via a stripped-down preset
UI that hides the binary-precision toggles.

### 1.2 Who uses it

Three personas the UX must serve well:

1. **Theorycrafters.** Compare DPS across builds, validate gear choices,
   answer "is this 60% CHC + 250% CHD better than 80% CHC + 220% CHD?"
   They will pour stats in by hand, toggle external buffs, switch skill
   slots. Need accuracy and a visible **breakdown** (mit, rate, elem,
   marking, finalReduce) so they can sanity-check the answer.

2. **Active raid players.** Want to know "will my party kill the boss
   under the soft enrage timer?" They will pick a stage, pick their
   attacker, accept the auto-prefilled stats with light overrides, and
   read the bottom-line number. Need fast load, good defaults, and
   share URLs to compare with guildmates.

3. **Casual users.** Picked the page because it ranked high on a search.
   They will explore one or two characters before bouncing. The UX must
   teach them what each input means without overwhelming. Defaults
   matter more than depth.

The admin damage-lab at `/admin/damage-lab/v2` is a different audience
(internal RE work) and is **out of scope** for V3. The two share the
compute engine but diverge on UI, persistence, and inputs.

### 1.3 Non-goals

The following are explicitly **not** part of V3:

- Mock or estimate gear loadouts. The calc takes raw stats; users type
  what their hero shows in the equipment panel. Gear set bonuses are
  tracked separately (loadout / gear reco tools).
- Re-create the admin damage-lab observation logging or back-calculation
  panels.
- Multi-target / AOE simulation (single-target only — the formula is
  per-hit on one defender).
- Buff timeline simulation. Buffs are point-in-time toggles; the user
  decides whether each is "on" at the moment of the hit.
- Loadout persistence across devices (no auth, no server-side save).
  Users get URL-share + `localStorage` and that's it.
- Multi-hit per-shot precision. Skills with `MaxHitCount > 1` (Maxwell
  S1 3 hits, Skadi S2 17 hits, …) drift by ±0.2% — accepted limit.

### 1.4 Validation contract

**Single-hit accuracy: 100%** (ratio 1.000 ± 0.002 across 17+ test obs).
**Multi-hit accuracy: ±0.2%** (sign and magnitude depend on the per-skill
`MaxHitCount` distribution; documented limit, see `06-gotchas.md` §5).
**Stat readouts** (auto-prefilled ATK/DEF/HP/SPD/EFF/RES at Lv 100 for
the chosen char with their codex/quirks/transcend selection) match the
in-game character sheet to ±0 unit on the ATK/DEF/HP/SPD axis when the
user picks the same toggle states they have unlocked in-game.

The above is enforced by **the same observation set** the admin
damage-lab uses (`data/admin/damage-lab-observations-v2.jsonl`). V3 does
not need to expose that store, but a smoke test in CI must replay the
shipped fixtures and assert the ratio band.

---

## 2. Glossary

Terms used throughout the seven docs. **Read this before §3.**

### 2.1 Core terms

- **Char / Character.** Playable hero. ID: 7-digit string starting with
  `2` (e.g., `2000028` Maxwell, `2000022` Noa). Core Fusion variants use
  `27000xx` — see §2.2.
- **Monster / Boss / Target.** Defending NPC. ID: 7-digit string starting
  with `4` (e.g., `4003012` Sentry Archer). The damage formula does not
  branch on attacker vs defender being a hero or NPC; "char" and "monster"
  are just data sources for stats.
- **Skill slot.** `S1`, `S2`, `S3` — the three combat skills every
  playable char exposes. Each skill has 5 levels (1..5), gated by skill
  books. The DamageFactor (per-mille) varies per level.
- **Burst skill.** When a char with the right transcend tier casts S3
  under their burst stance, the game swaps in `Skill_19` / `Skill_20` /
  `Skill_21` (= `B1` / `B2` / `B3`) which replace S3's DamageFactor and
  buff list. Gated by the dealer's transcend; absent when the tier
  templet has no `burst2` / `burst3` flag.
- **Class.** One of `Striker` (`CCT_ATTACKER` = 2), `Mage` (4),
  `Ranger` (3), `Defender` (1), `Healer` (5, datamine label) /
  `Priest` (in-game label). The class drives one passive (Mage +12%
  pool, Striker / Ranger / Defender / Priest = no offense passive
  validated to date).
- **Subclass.** Finer specialization (`ATTACKER`, `BRUISER`,
  `WIZARD`, `ENCHANTER`, `VANGUARD`, `TACTICIAN`, `SWEEPER`, `PHALANX`,
  `RELIEVER`, `SAGE` — enum 1..10). Drives subclass-tagged awakening
  nodes.
- **Element.** `Earth` (0), `Water` (1), `Fire` (2), `Light` (3), `Dark`
  (4). Combat advantage matrix: Fire > Earth, Earth > Water, Water > Fire
  (cycle); Light ↔ Dark mutual advantage. See §6.

### 2.2 Char variants

Outerplane has four mechanically-distinct ways the same "fictional
person" can show up in the roster. The calc treats each variant as its
own char (separate ID, separate skill set, separate stats):

- **Base char.** Standard playable. ID `2000xxx`.
- **Awakened char.** Same ID, gated transcend tier swaps `Skill_22` →
  `Skill_23` (the upgraded class passive — see `06-gotchas.md` §5). The
  awakening tree is the player-account-wide grid (separate from
  per-char transcend).
- **Core Fusion (CF).** Higher-rarity remix of a base char. ID `27000xx`
  (e.g., `2700037` Core Fusion Veronica from `2000037` Veronica).
  Tracked via `baseCharId` (CF → base) and `coreFusionId` (base → CF)
  in the manifest. CF chars often wear the BASE char's EE — see EE entry.
- **Reskin / collab.** Different name / portrait, separate ID, no shared
  data with the base. Treated as an unrelated char from the calc's POV.

### 2.3 Stat axes

The calc reads / writes the following stat axes:

| Key | Display | Unit | Source |
|---|---|---|---|
| `ATK` | Attack | flat | Char base + gear + buffs |
| `DEF` | Defense | flat | Char base + gear + buffs |
| `HP` | Max HP | flat | Char base + gear + buffs |
| `SPD` | Speed | flat | Char base + gear + buffs (cap discussed in `06-gotchas.md`) |
| `CHC` | Crit Chance | % | Char base + gear |
| `CHD` | Crit Damage | % | Char base + gear |
| `EFF` | Effectiveness | % or flat | Source-dependent (see below) |
| `RES` | Resistance | % or flat | Source-dependent |
| `PEN` | Penetration | % | Gear (% on accessory mainstat) + flat from EE |
| `DMG_INC` | Damage ↑ | % | Gear (% on weapon mainstat) |
| `DMG_RED` | Damage ↓ (taken) | % | Boss / armor mainstat |

**Stat units logic** (memorized: `MEMORY.md → Stat Units Logic`):

- Stats whose key contains `%` (`ATK%`, `DEF%`, `HP%`) → display `%`.
- `CHC`, `CHD` → always `%`.
- `SPD`, `ATK`, `DEF`, `HP` (flat keys) → no unit.
- `EFF`, `RES` → context-dependent:
  - Accessory / Armor sets → flat (no `%`).
  - EE / Talismans → percentage (`%`).

### 2.4 Buff / debuff vocabulary

- **Buff.** Effect that increases an attacker stat or pool (or decreases
  a target stat). In the binary they are `BuffTemplet` rows; each row has
  a `Type` (the `BT_*` enum), a `Value` (signed integer, often per-mille),
  a `BuffConditionType` (when it fires), and an `AwakeningType` /
  `AwakeningApplyType` (which char it can apply to).
- **Debuff.** Same shape, semantically reduces target. Modeled as a buff
  with negative value or distinct `BT_DMG_REDUCE_*` type.
- **Pool.** Additive damage rate aggregator. `BT_DMG`, `BT_DMG_TO_BOSS`,
  `BT_DMG_OWNER_LOST_HP_RATE`, etc. all dump into the pool. The crit
  base is the starting value (1.0 normal, CHD/1000 on crit) and the
  pool is added on top.
- **External buff.** Click-toggle in the UI that adjusts attacker /
  target stat inputs BEFORE the formula runs. Distinct from
  awakening / char_skill buffs which flow through the reducer.
- **Quirk.** Implicit buff that always fires under context — e.g. `+30%
  pool when target is boss` (`BT_DMG_TO_BOSS = +300‰` from awakening
  node 96), `+50% pool on advantage` (`BT_DMG = +500‰`, gated `requires:
  adv`). The user can disable the entire quirk layer via the
  `applyQuirks` toggle, or per-group via the Settings panel.

### 2.5 UI / state vocabulary

- **Settings.** Account-wide knobs that pre-fill the calc:
  - **Codex level** (0..11) — global atk/def/hp pct bonus from hero
    archive progression.
  - **Quirks toggles** — element / job / adventure-license gates that
    enable awakening nodes.
  - **Transcend tier** — char-specific (`Lv0` … `Lv6`) — gates skill8
    bonus and burst skills.
  - **EE level** (0..10) — Exclusive Equipment level for the wearer.
- **Mode.** A `DungeonMode` enum value (`DM_ADVENTURE_MISSION`,
  `DM_TOWER`, `DM_RAID_1`, …). Drives which quirks fire and which
  stages are listed.
- **Stage.** A specific encounter (e.g., "Weekly Conquest Lv 8 — Ksai").
  For Adventure License modes, every (dungeon, AL tier) pair is a
  separate stage (see `06-gotchas.md` §1).
- **Wave / Spawn slot.** Inside a stage, up to 4 enemies (`ID0`..`ID3`).
  Pickable independently — the user fights one slot at a time.
- **Caster slot.** Synonym for skill slot in `RecomputeContext.slot`.

---

## 3. Domain model

### 3.1 The act of "computing damage"

Every damage value the calc shows is the result of evaluating one of
these expressions:

```
Dmg = ATK × (skillFactor/1000) × (DF/1000) × mit × rate
    × (markingActive ? 1.15 : 1.0)
    × elem_mult                                 // 1.20 / 0.80 / 1.0
    × (missed ? 0.5 : 1.0)
    × (1 − finalReduce/100)

mit  = C / (C + (1 − PEN/100) × DEF − PEN_flat)
rate = base + Σ(attacker pool buffs) − Σ(defender reduce buffs) + DMG_INC/1000 − DMG_RED/1000
rate = max(rate, 0.30)                          // RATE_MIN floor
```

with `final = max(1, floor(dmg))`. Constants and full step-by-step are
in `02-formula.md` §1.

The pieces feeding `ATK`, `mit`, `rate`, `elem_mult`, `markingActive`,
`missed`, `finalReduce` and `DF` come from a chain of resolvers. Each
resolver is a pure function of the input state — there is no global
state, no time-stepped simulation, no observable side effect.

### 3.2 The chain of resolvers

```
                   ┌────────────────────────────────────────┐
                   │ User input (UI state)                  │
                   │  - char id, slot, skill level          │
                   │  - ATK/CHD/PEN/DMG_INC/DMG_RED         │
                   │  - target id, mode, isBoss             │
                   │  - settings (codex, quirks, transcend) │
                   │  - external buff toggles               │
                   └────────┬───────────────────────────────┘
                            │ buildRecomputeCtx
                            ▼
                   ┌────────────────────────────────────────┐
                   │ RecomputeContext                       │
                   │  + ApplicableBuff[] (from baked data)  │
                   └────────┬───────────────────────────────┘
                            │ recompute()
                            ▼
                   ┌────────────────────────────────────────┐
                   │ Stage 1: external buffs aggregation    │
                   │  → effAtk, effPen, effChd, effTargetDef│
                   └────────┬───────────────────────────────┘
                            │
                            ▼
                   ┌────────────────────────────────────────┐
                   │ Stage 2: build BuffContext             │
                   │  + statValues (ST_* secondary scaling) │
                   │  + targetStatValues (BT_DMG_TARGET_STAT)│
                   └────────┬───────────────────────────────┘
                            │
                            ▼
                   ┌────────────────────────────────────────┐
                   │ Stage 3: filter + reduce buffs         │
                   │  → ReducedBuffs { mainAtk, addAtk,     │
                   │      chdBonus, penBonus, poolPct,      │
                   │      targetStatPermille, ... }         │
                   └────────┬───────────────────────────────┘
                            │
                            ▼
                   ┌────────────────────────────────────────┐
                   │ Stage 4: char overrides                │
                   │  (Ame Ume/Sakura, Noa kaizer, ...)     │
                   │  → adjusted DF + addAttackDF           │
                   └────────┬───────────────────────────────┘
                            │
                            ▼
                   ┌────────────────────────────────────────┐
                   │ Stage 5: boss mechanic deltas          │
                   │  (Amadeus Prelude/Enrage)              │
                   │  → dmgRedPctDelta, finalReducePctDelta │
                   └────────┬───────────────────────────────┘
                            │
                            ▼
                   ┌────────────────────────────────────────┐
                   │ Stage 6: computeDamage()               │
                   │  → DamageBreakdown (mainCalc, etc.)    │
                   └────────┬───────────────────────────────┘
                            │
                            ▼
                   ┌────────────────────────────────────────┐
                   │ Stage 7: post-formula multipliers      │
                   │  (charEmpiricalMult, finalReduce)      │
                   │  → final calculated integer            │
                   └────────────────────────────────────────┘
```

Each stage is documented in `04-runtime-model.md`.

### 3.3 Where each input comes from

| Input | Source | Refresh trigger |
|---|---|---|
| Char metadata (element, class, subclass, skills, scalings) | `public/damage-calc/chars/{id}.json` (fetched on demand) | User picks a char |
| Skill DamageFactor | Char detail's `skills[slot].damageFactors[level-1]` | Slot or level change |
| Auto-prefilled ATK / DEF / HP / SPD / EFF / RES | `computeFinalStats(charDetail.noGearStats, settings)` | Char pick or settings change |
| Awakening / char-skill / EE buff catalog | `public/damage-calc/buffs.json` (single load, cached) | App boot |
| Codex level → atk/def/hp pct | `manifest.json.codexTable[level]` | Settings change |
| Transcend tier → atk pct | `public/damage-calc/transcend.json[charId]` | Settings change |
| Mode list | `public/damage-calc/monsters.json.modes[]` | App boot |
| Stage list (per mode) | `public/damage-calc/monsters.json.modes[].stages[]` | Mode change |
| Monster slot stats | `public/damage-calc/monsters.json.modes[].stages[].waves[].slots[]` | Stage / slot pick |
| Boss override (mechanics) | `public/damage-calc/mechanics.json[monsterId]` | Monster pick |
| EE catalog | Inside `public/damage-calc/equipment.json` | App boot |

The **bake** is the single contract between datamine and runtime —
documented in `03-bake-contract.md`. The runtime never reads
`data/admin/json2/*` directly.

### 3.4 Settings semantics

The Settings panel exposes four account-level knobs:

1. **Hero Codex level** (0..11). Default 11 (max). Multiplies char base
   stats by `(1 + atkPct/100)` etc. — see codex stacking in
   `02-formula.md` §3.
2. **Quirks toggles** (multi-select). Each toggle gates a *category* of
   awakening buffs:
   - `element` — `AAT_ELEMENTAL` group buffs (e.g., Light/Dark +30%
     pool, Fire/Earth/Water +50% pool on advantage).
   - `job` — `AAT_CLASS` + `AAT_SUBCLASS` group buffs (e.g., Mage
     +12% pool).
   - `adventureLicense` — `AwakeningType=ADVENTURE_LICENSE` sub-nodes.
     Mode-gated: only applies when `mode ∈ {DM_ADVENTURE_MISSION,
     DM_ADVENTURE_CHALLENGE}` AND the toggle is on. The +100% boss DMG
     main node lives elsewhere (in the awakening buffs catalog as a
     regular `BT_DMG_TO_BOSS` quirk).
   - `pve` — `AwakeningType=PVE` sub-nodes (Counteract Strong Enemies).
     Apply caster debuffs to boss EFF / RES (−20% / −20% across 8
     nodes) — does not affect damage rate directly but hits the
     debuff-roll math when the user models a debuff hit chance.
   - `utility` — not surfaced (no-stat utility nodes; they affect AI /
     turn order / non-combat behavior).
3. **Transcend tier per char** (`Lv0` `Lv3` `Lv4-1` `Lv4-2` `Lv5-1`
   `Lv5-2` `Lv5-3` `Lv6`). Default `Lv6`. Drives:
   - `transcendPct` ATK% bonus (parsed from char templet).
   - skill8 unlock (`AwakeningType=SKILL8` buff, gated by a tier-keyed
     condition).
   - Burst skill availability (`burst2` flag for `B1`/`B2`, `burst3`
     for `B3`).
4. **EE level** (0..10). Default 10 if EE equipped, 0 otherwise.
   Drives the `eeLevel` index into `eeLevelValues` for EE buffs.

There is **NO player-level setting**. (Char Lv 100 is the implicit
prefill anchor; Lv 105 / 110 / 120 give extra raw stats but no extra
passives. The damage formula never reads attacker level — see
`06-gotchas.md` §6.)

There is **NO guild-level setting in the public calc** (the admin
lab has it; it boosts MaxHP for survival math but the calc's damage
formula does not branch on caster HP — except for chars with
`scaling_swap → ST_HP` like Drakhan/Veronica. For V3 PUBLIC parity,
the guild buff goes under a "Guild buff" section of the BuffsPanel,
mirroring how external buffs work; it adjusts `statValues.ST_HP` by
multiplicative pct. **It is NOT applied automatically** to keep the
public UX simple; the user toggles it explicitly.

### 3.5 Mode taxonomy

V3 must reproduce the same Category → Mode tree as the current
implementation. The grouping is:

| Category | Sub-mode | Raw `DungeonMode` | Notes |
|---|---|---|---|
| Special Request | Ecology Study | `DM_RAID_1` | Outerplane analog of Ecology |
| Special Request | Identification | `DM_RAID_2` | |
| Adventure License | Weekly Conquest | `DM_ADVENTURE_MISSION` | AL stage expansion (see `06-gotchas.md` §1) |
| Adventure License | Promotion | `DM_ADVENTURE_CHALLENGE` | AL stage expansion |
| Story | Normal | `DM_NORMAL` (label /normal/i) | |
| Story | Hard | `DM_NORMAL` (label /hard/i) | Same raw mode, label-disambiguated |
| Skyward Towers | Normal | `DM_TOWER` | |
| Skyward Towers | Hard | `DM_TOWER_HARD` | |
| Skyward Towers | Very Hard | `DM_TOWER_VERY_HARD` | |
| Elemental Towers | Earth/Water/Fire/Light/Dark | `DM_TOWER_ELEMENT` | Label-disambiguated by element |
| Irregular Extermination | Pursuit | `DM_IRREGULAR_CHASE` | |
| Irregular Extermination | Infiltration | `DM_IRREGULAR_INFILTRATE` | |
| Temporary Modes | Guild Raid (main) | `DM_GUILD_RAID_MAIN_BOSS` | |
| Temporary Modes | Guild Raid (sub) | `DM_GUILD_RAID_SUB_BOSS` | |
| Temporary Modes | World Boss | `DM_WORLD_BOSS` | |
| Temporary Modes | Joint Challenge | `DM_EVENT_BOSS` | |

Modes outside this list are surfaced "uncategorized" if they appear in
the bake. The classifier is a pure function `classifyMode(rawMode,
labelEn) → { categoryKey, subKey } | null`.

### 3.6 Stage labels

The picker's secondary label (under the dungeon name) is parsed from
the stage's EN name:

1. If `season != null && episodeNum != null`: `EP {N}: {chapter.en}`
   for the dungeon row, `{episodeNum}-{stageNum}` for the stage row.
2. `<base> (Stage N)` → `Stage N`.
3. `<base> NF` (e.g., `Skyward Tower 25F`) → `25F`.
4. `<base> (Difficulty)` → `Difficulty` (Normal / Hard / Very Hard).
5. Fallback: stage name verbatim, no split.

EN labels are the picker's canonical join key; localized labels go
through `lRec(stage.name, lang)`. This contract must survive V3.

---

## 4. Architecture layers

V3 has six logical layers. Each has a stable contract; agents working
on one layer should treat the others as black boxes (read the relevant
section of these docs, do not read the source).

### 4.1 Datamine (input)

**Source.** `data/admin/json2/*.json` — IL2CPP-decoded JSON of the
game's `*Templet` definitions. Raw, unfiltered, multi-language strings
under nested `LangMap` objects. Updated on every game patch by an
external pipeline that lives outside this repo.

**Schema.** Documented in `01-datamine-schema.md`. Every templet field
the V3 reads is enumerated there with example rows.

**Stability.** The dump format is stable across patches but field
names occasionally drift (the game team adds new fields, renames rare
ones). The pipeline must defend against missing fields by defaulting
to neutral values, never by crashing.

### 4.2 Pipeline (bake)

**Source.** `pipeline/steps/damage-calc/` (V3 destination). Reads
datamine, walks the awakening tree, joins skill / buff data, expands
AL stages, and writes:

```
public/damage-calc/
  manifest.json        ← char list summary + codex table
  chars/{charId}.json  ← per-char detail (~120 chars × ~30 KB each)
  monsters.json        ← mode → stage → wave → slot tree
  buffs.json           ← awakening + char-skill + EE catalog
  transcend.json       ← per-char ATK% bonuses by tier
  equipment.json       ← EE catalog (per-char per-level)
  mechanics.json       ← boss override definitions
```

**Schema.** `03-bake-contract.md` is the contract. Every JSON file
versioned via `_v` field; runtime reads must match.

**Cadence.** Re-run per patch. The pipeline is offline (Node script,
not part of `next build`).

### 4.3 Reader (server)

**Source.** `src/lib/data/damage-calc/` (V3 destination). Thin typed
wrappers over `fs.readFile` + `JSON.parse`, cached in module memory.

**Contract.** Every public-calc consumer (server-rendered page, API
route, RSC) calls these. No direct JSON imports.

**Why server-side.** Some pages need the manifest at build time for
SEO (char list with localized names). The browser fetches the same
files directly via `fetch('/damage-calc/...')` — no API hop.

### 4.4 Engine (compute)

**Source.** `src/lib/damage/v2/` (kept; the binary-faithful core lives
here). V3 may rewrite it from spec but **must produce bit-identical
output** for the test fixture set.

**Public surface.**

```ts
import { recompute, type RecomputeContext } from '@/lib/damage/v2/recompute'
import { computeDamage } from '@/lib/damage/v2/formula'      // low-level, rarely used directly
import { applyBuffs } from '@/lib/damage/v2/buffs'           // exposed for the public calc's compose-result

const result = recompute(ctx, allBuffs)
//   result.calculated          // integer damage
//   result.breakdown.mainCalc  // pre-post-mult main hit (float)
//   result.breakdown.rate      // post-cap rate
//   result.reduced.poolPct     // % the pool contributed
//   result.breakdown.debugSteps // f32 trace for the debug panel
```

`02-formula.md` documents `computeDamage`'s invariants. `04-runtime-model.md`
documents `recompute`'s wiring.

### 4.5 UI (client)

**Source.** `src/app/[lang]/tools/_contents/damage-calculator/` (V3
destination, full rewrite under feature parity).

**Subdirs.**

```
damage-calculator/
  index.tsx                  # Server entry — sets metadata, mounts client
  CalculatorClient.tsx       # Client root — owns reducer, mounts panels
  _components/               # AttackerPanel, TargetPanel, SettingsPanel,
                             # BuffsPanel, ResultPanel, BossMechanicsPanel,
                             # CharPickerModal, EquipmentPickerModal,
                             # TranscendControl, etc.
  _state/                    # types.ts, reducer.ts (FormState, actions)
  _lib/                      # share.ts, mode-taxonomy.ts, quirks.ts,
                             # compose-result.ts, no-gear-stats.ts,
                             # transcend.ts, fetch-data.ts
```

**State management.** Single `useReducer` rooted in `CalculatorClient`,
hydrated from `localStorage` post-mount (avoids SSR hydration mismatch),
debounced save 200ms. Versioned key `damage-calc-form-v{N}`.

**Layout.** 3-column desktop, accordion mobile. See `05-ui-contract.md`
for full layout + per-panel contracts.

### 4.6 URL share (orthogonal)

**Source.** `_lib/share.ts`. Pure function pair `serialize(state) →
queryString` and `deserialize(queryString) → Partial<State>`.
Compact (single-letter keys, base36 numbers, packed booleans). Versioned;
new versions deserialize older URLs through a migration table.

### 4.7 Layer boundaries

```
            ┌──────────────────────────────┐
            │ Datamine (data/admin/json2)  │     git-ignored on prod
            └────────────┬─────────────────┘
                         │ pipeline/steps/damage-calc
                         ▼
            ┌──────────────────────────────┐
            │ Bake (public/damage-calc)    │     committed
            └─────┬─────────────────┬──────┘
                  │ HTTP fetch      │ fs.readFile
                  ▼                 ▼
            ┌──────────────┐  ┌──────────────────┐
            │ Browser      │  │ Server reader    │
            │ (UI client)  │  │ (RSC, API)       │
            └──────┬───────┘  └────────┬─────────┘
                   │   useReducer       │
                   │                    │
                   ▼                    ▼
            ┌──────────────────────────────┐
            │ Engine (src/lib/damage/v2)   │
            └──────────────────────────────┘
```

The arrows are one-way. The browser never calls the server reader; the
server reader never reaches into UI state. The engine is pure and
reachable from both sides.

---

## 5. File map (V3 destination)

The expected V3 file tree, with one-line responsibility per file. Agents
implementing a layer should produce files at these paths.

### 5.1 Pipeline

```
pipeline/steps/damage-calc/
  index.ts                # Orchestrator — runs all builders, writes _v
  raw-loader.ts           # Lazy + memoized loaders for each json2 templet
  shared.ts               # Common helpers (LangMap normalize, slug, etc.)
  monster-resolver.ts     # Spawn group → monster ID resolution
  build-chars.ts          # → manifest.json + chars/{id}.json
  build-monsters.ts       # → monsters.json (with AL expansion)
  build-buffs.ts          # → buffs.json
  build-transcend.ts      # → transcend.json
  build-equipment.ts      # → equipment.json
  build-mechanics.ts      # → mechanics.json (boss overrides)
  _no-gear-stats.ts       # NoGearStats composition (base + evo + class
                          # passive + skill8 + quirks)
  _location.ts            # Stage / season / chapter resolution helpers
```

### 5.2 Server reader

```
src/lib/data/damage-calc/
  index.ts                # Re-export of public API
  _cache.ts               # readDamageCalcJson<T>(path): in-memory cache
  chars.ts                # getDamageCalcCharManifest, getDamageCalcCharDetail
  monsters.ts             # getDamageCalcMonsters
  buffs.ts                # getDamageCalcAwakeningBuffs (et al)
  transcend.ts            # getDamageCalcTranscend
  equipment.ts            # getDamageCalcEquipment
  mechanics.ts            # getDamageCalcMechanics
```

Each file exports both `Promise<T>` async getters AND the TS types for
the JSON shape.

### 5.3 Engine

```
src/lib/damage/v2/
  f32.ts                  # f, f32mul/add/sub/div, RODATA, interpolate, applyAdvantageRate
  formula.ts              # computeDamage (pure, single-shot)
  recompute.ts            # recompute (the orchestrator + element relations + guild HP)
  buffs.ts                # ApplicableBuff, BuffContext, applyBuffs (reducer)
  extract-buffs.ts        # Datamine → ApplicableBuff conversion (used at bake time)
  extract-monster.ts      # Datamine → Monster stats (used at bake time)
  extract-ee.ts           # Datamine → EE buffs (used at bake time)
  external-buffs.ts       # Click-toggle external buff aggregation
  char-overrides.ts       # Per-char hardcoded behavior (Ame Ume/Sakura, Noa, etc.)
  boss-overrides.ts       # Boss mechanic aggregation (Amadeus Prelude/Enrage)
  stats.ts                # applyCasterDebuffs (PVE quirks → boss EFF/RES)
```

### 5.4 UI

```
src/app/[lang]/tools/_contents/damage-calculator/
  index.tsx                          # Server entry, metadata, mounts client
  CalculatorClient.tsx               # Client root: reducer, layout, panels
  _components/
    AttackerPanel.tsx                # Char picker + ATK/CHD/PEN/DMG↑ inputs + slot/level + crit + per-char flags
    TargetPanel.tsx                  # Mode/stage/wave/slot picker + DEF/DR/CDR/HP overrides + isBoss + element
    SettingsPanel.tsx                # Codex + quirks + EE level (per session)
    TranscendControl.tsx             # Per-char transcend tier picker (sits inside AttackerPanel)
    TranscendActiveInfo.tsx          # Tooltip / preview of active transcend bonuses
    EquipmentPanel.tsx               # EE selection (uses EquipmentPickerModal)
    EquipmentPickerModal.tsx         # Modal grid for EE picking
    BuffsPanel.tsx                   # External buff toggles (4 sections: atkr buff/debuff, target buff/debuff)
    BossMechanicsPanel.tsx           # Conditional panel (only shown if boss has overrides)
    ResultPanel.tsx                  # Computed value + breakdown + debug + share button
    SharePanel.tsx                   # URL display + copy + open in new tab
    StatBadges.tsx                   # Stat chips above ATK/DEF/HP/SPD inputs (auto vs manual)
    CharPickerModal.tsx              # Modal for char selection
    TeamPanel.tsx                    # (optional) party-buff aggregator (stretch goal)
    ObsTablePanel.tsx                # NOT USED in public — admin only
  _state/
    types.ts                         # FormState, SettingsState, AttackerState, TargetState, all action types
    reducer.ts                       # The reducer + buildRecomputeCtx
  _lib/
    fetch-data.ts                    # Browser-side fetch helpers (manifest, char detail, etc.)
    mode-taxonomy.ts                 # MODE_GROUPS, classifyMode, parseDungeonStage
    quirks.ts                        # computePveBossDebuffs, applyPveDebuffs
    transcend.ts                     # Transcend tier helpers
    no-gear-stats.ts                 # computeFinalStats (base + evo + class + skill8 + codex + quirks)
    compose-result.ts                # composeApplicableBuffs (filter quirks per settings)
    share.ts                         # serialize/deserialize URL state
    equipment-display.ts             # EE display helpers
    observations.ts                  # NOT USED in public — admin only (pre-loaded fixture replay)
    load-observations.ts             # NOT USED in public
```

### 5.5 i18n keys

```
src/i18n/locales/
  en.ts, jp.ts, kr.ts, zh.ts        # All 4 must define the same keys at
                                      # the SAME LINE NUMBERS. New keys go
                                      # under: tools.damage-calculator.*
```

Required key namespaces:

- `tools.damage-calculator.cat.*` — taxonomy categories (Story, Skyward
  Towers, Elemental Towers, Temporary Modes).
- `tools.damage-calculator.sub.*` — taxonomy sub-modes.
- `tools.damage-calculator.attacker.*` — AttackerPanel labels.
- `tools.damage-calculator.target.*` — TargetPanel labels.
- `tools.damage-calculator.settings.*` — SettingsPanel labels.
- `tools.damage-calculator.buffs.*` — BuffsPanel labels.
- `tools.damage-calculator.result.*` — ResultPanel labels.
- `tools.damage-calculator.share.*` — SharePanel labels.

CLAUDE.md rule: `Inline tags ({B/...}, {D/...}, etc.) must stay
identical across all languages`.

---

## 6. Key invariants

These hold across all V3 layers and must not be broken without a
documented migration.

### 6.1 ID conventions

- Char IDs are 7-digit strings, never integers (preserve leading zeros).
- Monster IDs are 7-digit strings.
- Stage IDs are 7-digit (or composite like `0102001@al8` — see
  `06-gotchas.md` §1).
- Buff IDs are `{type}:{key}` e.g. `awak:121`,
  `char:2000022:S2:2000022_2_2`, `ee:2000028:level5`. Stable across
  bakes for same input.
- Slugs are kebab-case derived from the EN name. Never use slugs as
  primary keys (filter / group on IDs).

### 6.2 Locale convention

Localized fields are objects shaped `{ en, jp, kr, zh }` (not
nested-by-language objects on the wrapper). Read with the `l()` /
`lRec()` helpers from `@/lib/i18n`. EN is the canonical join key; if
EN is missing, the data is treated as untranslated.

### 6.3 No `BT_*` in user-facing copy

Internal binary-engine names (`BT_DMG_REDUCE_FINAL`, `BT_MARKING`,
`AAT_PVE`, etc.) never appear in UI text. The user sees descriptive
phrasing: "final-damage-reduction passives", "marked target", etc.
Memorized: `MEMORY.md → feedback / video title format`-adjacent.

### 6.4 No mocking the engine in tests

Test the public calc against the SAME `recompute` that ships to users.
Mocked engines hide the formula drift the calc is meant to catch.
(Memorized: `MEMORY.md → feedback_strict_scope`-adjacent — applies
broadly.)

### 6.5 Single source of truth per concept

- Element advantage matrix lives in `recompute.ts → ELEMENT_ADV`.
  Don't redeclare in the UI.
- Class enum + subclass enum live in `01-datamine-schema.md`. UI labels
  reference them; don't re-encode the index.
- Codex pct table lives in `manifest.json.codexTable`. Reader exposes
  it; no client copy.
- Transcend tier ordering lives in `transcend.json`. Reader exposes it;
  no client copy.

### 6.6 Versioning

- Every baked JSON file MUST have a top-level `_v: string` field.
- Reader code MUST read `_v` and emit a console warning when the
  version differs from its compile-time expectation. The reader does
  not crash on version mismatch — V3 should still serve what it can.
- `localStorage` keys MUST be versioned (`damage-calc-form-v{N}`). On
  version mismatch, parse fails → defaults; no migration shim. Users
  re-pick their settings.

### 6.7 Performance budgets

- Cold load (browser, no cache): manifest + monsters + buffs +
  transcend + equipment + mechanics ≤ 300 KB gzipped total. Currently
  ~210 KB at the time of writing.
- Char detail fetch ≤ 50 KB per file gzipped. ~120 chars on disk;
  individual files lazy-loaded on pick.
- `recompute` execution: ≤ 1 ms median, ≤ 5 ms p99, on a mid-range
  laptop. Pure synchronous JS — no async, no microtasks.

### 6.8 Browser support

ES2022 baseline (Next.js 15 default). `Math.fround` is universally
available; the f32 chain assumes it.

### 6.9 No dependency on the admin damage-lab

The public calc does not import from `src/app/admin/damage-lab/v2/*`.
Shared types and helpers live in `@/lib/data/damage-calc` and
`@/lib/damage/v2`. If a piece of admin code is useful publicly, it
must be lifted up to those shared modules first.

---

## 7. Out-of-scope items

Listed for clarity; do not implement.

- **Account login / save.** No auth in the public calc. No server-side
  state. `localStorage` only.
- **Char ladder / rankings.** That's a different tool (`/[lang]/tier-list`).
- **Gear loadout simulator.** Different tool. The calc just takes raw
  stat numbers.
- **Buff-timing / turn-by-turn simulation.** Single point-in-time damage
  evaluation only.
- **Damage taken simulator.** The calc is offense-side. EHP charts live
  in `/[lang]/guides/general-guides/stats`.
- **Multi-target / cleave.** Single-target only.
- **Per-equipment-piece breakdown** (showing how a +12% ATK helmet
  changes the result). Out of scope; the calc takes the final stats.
- **Outerplane Indonesia (ID) / China (CN) localization.** The four
  supported langs are en/jp/kr/zh. `MEMORY.md` confirms.
- **Dark mode toggle.** The site has dark mode globally; the calc
  inherits it.
- **Player-level setting.** Lv 100 is the prefill anchor; Lv 105/110/120
  give extra stats but no extra passives, and the formula is independent
  of attacker level. Skipped (`06-gotchas.md` §6).

---

## 8. Validation status (engine — inherited from V2)

Carried over from `damage-lab-v2-spec.md` §1, §7:

| Item | Status |
|---|---|
| Single-hit damage (binary path) | ✅ Bit-exact, validated 17 obs at ratio 1.000 ± 0.002 |
| Multi-hit (`MaxHitCount > 1`) | ⚠️ ±0.2% drift, accepted limit |
| `BT_DMG_TARGET_STAT` (Noa S2) | ✅ Validated 11 obs, +0.10% residual on target_stat (cause unidentified) |
| `BT_DMG_ENEMY_TEAM_DECREASE` (type 94, Maxwell S3) | ✅ Validated, dedicated handler |
| Awakening boss +30% | ✅ Validated `BT_DMG_TO_BOSS = +300‰` |
| Mage class +12% | ✅ Validated |
| Element advantage / disadvantage | ✅ Validated (RPS + L↔D mutual) |
| Light/Dark passive +30% pool | ✅ Validated stacks with elem mult |
| Marking ×1.15 | ✅ Validated |
| MISSED ×0.5 | ✅ Validated (GameConfigTemplet 500‰) |
| RATE_MIN floor 0.30 (cap −70%) | ✅ Validated (.rodata 0x1034074) |
| Stat interpolation Lv 1..100 | ✅ Validated bit-exact (`CalcStat` VA `0x2B52D24`) |
| `SpawnAdvantageRate` per-mille | ✅ Validated (`interpolateRated`) |
| AL per-tier `SpawnAdvantageRate_*` (Ksai fix) | ✅ Validated post-fix in current pipeline |
| Type 92 `BT_DMG_ELEMENT_SUPERIORITY` | ❌ Not modeled — Ame Sakura non-adv ±5% drift |
| Type 93 `BT_DMG_ELEMENT_ENCHANT` | ❌ Not modeled |
| Boss-mechanics Amadeus Prelude / Enrage | ⚠️ Partial — calibration data thin |
| Guild HP buff applied to ST_HP scaling | ❌ NOT applied (verified Veronica CF — guild HP is in-combat MaxHP only) |

This contract carries into V3. The drift is acceptable for the public
calc; documented in `06-gotchas.md`.

---

## 9. Document layout

Each of the seven docs in this directory has a fixed scope:

| File | Scope | Audience |
|---|---|---|
| `00-overview.md` | This file. Scope, glossary, layers, file map, invariants. | Anyone touching the calc |
| `01-datamine-schema.md` | Every templet field the bake reads, with examples. | Pipeline engineer |
| `02-formula.md` | Binary-faithful formula, f32 chain, CalcStat, stat stacking. | Engine engineer |
| `03-bake-contract.md` | JSON schemas for every file under `public/damage-calc/`. | Pipeline + Reader engineers |
| `04-runtime-model.md` | The `recompute` chain stage by stage, BuffContext, char overrides, boss mechanics. | Engine + UI engineers |
| `05-ui-contract.md` | Layout, panels, state, actions, share URL, i18n. | UI engineer |
| `06-gotchas.md` | All known edge cases, validated quirks, accepted limits. | Anyone debugging |

Read them in order on a first pass. Skip backwards as needed.

---

## 10. How to use this brief in a worktree

1. Create a fresh worktree (or accept whatever isolation strategy the
   spawn agent uses).
2. Copy or symlink the seven files in this directory into the
   worktree's `docs/damage-calc/`. They are the contract.
3. Implement layer-by-layer. The pipeline can be smoke-tested without
   the engine; the engine can be unit-tested without the UI; the UI can
   be storybooked against fixture data without the pipeline.
4. Acceptance: replay `data/admin/damage-lab-observations-v2.jsonl`
   through the new `recompute`. Match the same ratio band as the V2
   contract (single-hit 1.000 ± 0.002, multi-hit ±0.2%).
5. Acceptance: char-stats prefill at Lv 100 with default settings
   (Codex 11, all quirks on, transcend Lv6, EE Lv 10) matches in-game
   character sheet ATK/DEF/HP/SPD/EFF/RES on a sampled set (Maxwell,
   Noa, Skadi, Demiurge Stella, Drakhan).
6. Acceptance: every URL-shared link from a V2-era user that lands on
   the V3 page either deserializes cleanly or falls back to defaults
   gracefully (no crash, no mid-state corruption).

When in doubt, ask the user before guessing. Memorized:
`MEMORY.md → feedback / no_assumptions`.

---

End of overview. Continue to `01-datamine-schema.md`.
