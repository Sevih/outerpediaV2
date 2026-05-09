# Damage Calculator V3 — 01. Datamine Schema

> **Audience.** Pipeline engineers. Anyone touching `pipeline/steps/damage-calc/`
> or extending the engine to read a new templet field.
>
> **Scope.** Documents every field of every datamine templet the public
> damage calculator reads, with example rows from the live game data.
> Field names match the JSON keys verbatim — they are case-sensitive.
>
> **Source path.** All templets live under `data/admin/json2/*.json`,
> shipped by an offline IL2CPP-decode pipeline that runs outside this
> repo. Files are top-level arrays of row objects (every row is a
> `Record<string, string>` — see §1.1).

---

## 1. Conventions

### 1.1 String-only values

**Every** scalar in `data/admin/json2/*.json` is a JSON string. Numbers,
booleans, IDs, enums — all strings. Examples:

```json
{
  "ID": "2000028",
  "BasicStar": "3",
  "DamageFactor": "1260",
  "ShowMainPage": "true",
  "PVPIllustMirrorLeft": "TRUE"
}
```

Coerce as you read:

```ts
function num(v: string | undefined): number {
  return v == null || v === '' ? 0 : Number(v)
}
function bool(v: string | undefined): boolean {
  // Game JSON ships variants "true", "True", "TRUE", "false", "False", "FALSE".
  return v != null && v.toLowerCase() === 'true'
}
```

Don't strip quotes. Don't trust `Number.parseInt` to handle empty
strings (it returns `NaN` and silently corrupts arithmetic). Always
default empty / missing to a neutral value (`0`, `false`, `''`).

### 1.2 Sparse fields

Templet rows omit fields that have no value (no defaults). Example —
`AdventureDungeonTemplet` rows below tier 8 have no
`SpawnAdvantageRate_*` fields; those above do. Treat missing fields as
"no override" (= `0` for additive, `1.0` for multiplicative, `null`
for ID lookups).

### 1.3 Enum prefixes

Common prefixes you will encounter:

| Prefix | Meaning |
|---|---|
| `CT_` | CharacterType (e.g., `CT_PC`, `CT_ELITE_BOSS`, `CT_NORMAL_MONSTER`) |
| `CCT_` | CharacterClassType (e.g., `CCT_MAGE`, `CCT_ATTACKER`) |
| `CET_` | CharacterElementType (e.g., `CET_DARK`, `CET_FIRE`) |
| `CRT_` | CharacterRaceType (e.g., `CRT_HUMAN`, `CRT_DEMON`) |
| `BT_` | BuffType (e.g., `BT_DMG`, `BT_DMG_REDUCE_FINAL`, `BT_STAT_PREMIUM`) |
| `OAT_` | OptionApplyType (e.g., `OAT_RATE`, `OAT_VALUE`) |
| `IOT_` | ItemOptionType (e.g., `IOT_BUFF`, `IOT_STAT`) |
| `ST_` | StatType (e.g., `ST_ATK`, `ST_HP`, `ST_DEF`, `ST_BUFF_CHANCE`) |
| `AAT_` | AwakeningApplyType (e.g., `AAT_ELEMENTAL`, `AAT_CLASS`) |
| `ANT_` | AwakeningNodeType (e.g., `ANT_MAIN`, `ANT_SUB`) |
| `DM_` | DungeonMode (e.g., `DM_ADVENTURE_MISSION`, `DM_NORMAL`) |
| `DPM_` | DungeonPlayMode (e.g., `DPM_NORMAL`, `DPM_REPLAY`) |
| `BFT_` | BattleFormationType (e.g., `BFT_BACK`, `BFT_FRONT`) |
| `BCT_` | BuffCCType (`NONE`, `STUN`, `SILENCE`, `BIND`, etc.) |
| `SYS_` | System string ID (used for tooltip / buff text resolution) |
| `SE_DESC_` | Skill effect description tag |
| `BID_` | Built-in buff ID prefix (e.g., `BID_BREAK_1`) |
| `MAX_` / `MIN_` / `DEFAULT_` | GameConfigTemplet IDs |

Enums marked with the prefix are stored as the prefixed string; you
match them as `"CCT_MAGE"`, never `"MAGE"`.

### 1.4 Per-mille convention

Most numeric values that represent percentages are in **per-mille**
(one tenth of a percent), e.g. `Atk_Rate: "100"` from
`CharacterArchiveStatTemplet` means `+10%`. Damage / buff value fields
that are percentages are typically per-mille. Use `value / 10` when
displaying as a percentage, `value / 1000` when computing as a ratio.

The few exceptions that store true percentages (no `÷ 10`) are:

- `MonsterTemplet.DMGReduceRate_Max` — already a percentage like `"30"`.
- Some `BuffTemplet.Value` rows use percentages (`OAT_VALUE`) and others
  per-mille (`OAT_RATE`). The `ApplyingType` field disambiguates.
- `CharacterTemplet.HP_Max`, `Atk_Max`, etc. — flat stat values.

When in doubt, validate against an in-game observation.

### 1.5 LangMap fields

A handful of templets carry localized strings under a nested object
shaped:

```json
{
  "name": { "en": "Maxwell", "jp": "マクスウェル", "kr": "맥스웰", "zh": "麦克斯威尔" }
}
```

These come from a separate translation pipeline (the templet itself
holds a `NameID` that resolves through `StringTemplet.json` /
`*_Name.json`). The `LangMap` shape is what the V3 bake emits, NOT the
shape the raw templet has — see `03-bake-contract.md` for the bake
contract.

### 1.6 Joining strategy

Templets are denormalized — joins happen at bake time. Common joins:

- `CharacterTemplet.Skill_N` (string skill ID) → `CharacterSkillTemplet.ID`
- `CharacterSkillTemplet.ID` × `SkillLevel` → `CharacterSkillLevelTemplet.SkillID, SkillLevel`
- `CharacterSkillLevelTemplet.BuffID` (CSV) → `BuffTemplet.BuffID, Level` (latest level if not specified)
- `CharacterAwakeningLevelTemplet.BuffID` → `BuffTemplet.BuffID`
- `CharacterEvolutionStatTemplet.CharacterID` → `CharacterTemplet.ID`
- `CharacterTranscendentTemplet.CharacterID` → `CharacterTemplet.ID`
- `DungeonTemplet.SpawnID_PosN` → `DungeonSpawnTemplet.GroupID`
- `DungeonSpawnTemplet.IDn` → `MonsterTemplet.ID`
- `AdventureDungeonTemplet.DungeonID` → `DungeonTemplet.ID`
- `CharacterAwakeningNodeTemplet.AwakeningLevelGroupID` → `CharacterAwakeningLevelTemplet.AwakeningLevelGroupID`

The bake performs all joins ahead of time. Runtime never touches
`data/admin/json2/*` — only the baked output.

### 1.7 ID formats

| Entity | Pattern | Example |
|---|---|---|
| Character (PC) | `2xxxxxx` (7 digits) | `2000028` Maxwell |
| Character (Core Fusion) | `27xxxxx` (7 digits) | `2700037` CF Veronica |
| Monster (NPC) | `4xxxxxxx` (7 or 8 digits) | `4003012` Sentry Archer, `41140067` Goblin |
| Dungeon | `7xxxxxxx` (8 digits) | `70600000` Weekly Conquest 1 |
| Spawn group | `7xxxxxxxx` (9 digits) | `706000001` |
| Skill | numeric, varies (1-4 digit) | `2801` Maxwell S1, `1` class passive |
| Buff (binary ID) | numeric | `682` Awakening_Boss_Dmg |
| Buff (string key) | descriptive | `"Awakening_Boss_Dmg_1"`, `"2000022_2_2"` |

Char & monster IDs are stable across patches. Skill IDs occasionally
shift when the game team renumbers — never hard-code skill IDs;
always look up via `CharacterTemplet.Skill_N`.

---

## 2. Enum tables

### 2.1 `CharacterElementType` (`CET_*`)

| Value (binary) | String | Display name | Damage axis |
|---|---|---|---|
| 0 | `CET_EARTH` | Earth | Earth > Water > Fire > Earth (RPS) |
| 1 | `CET_WATER` | Water | |
| 2 | `CET_FIRE` | Fire | |
| 3 | `CET_LIGHT` | Light | Light ↔ Dark mutual advantage |
| 4 | `CET_DARK` | Dark | |

The advantage cycle: `Fire > Earth, Earth > Water, Water > Fire`.
Light and Dark have **mutual** advantage (×1.20 in both directions, see
`02-formula.md` §2.2). Same-element interactions return ×1.0.

### 2.2 `CharacterClassType` (`CCT_*`)

| Value (binary) | Templet string | In-game label | Validated offense quirk |
|---|---|---|---|
| 1 | `CCT_DEFENDER` | Defender | None confirmed |
| 2 | `CCT_ATTACKER` | Striker | None confirmed (despite "Striker" branding) |
| 3 | `CCT_RANGER` | Ranger | None confirmed |
| 4 | `CCT_MAGE` | Mage | `BT_DMG` +12% pool (`MAGE_PASSIVE_3_10`) |
| 5 | `CCT_PRIEST` | Healer (in-game label!) | None confirmed |

Note the rename: `CCT_PRIEST` is rendered as `Healer` in-game text but
`Priest` in older datamine references. Use `Class === 'CCT_PRIEST'` as
the canonical check.

### 2.3 Subclass

Numeric, no prefix. `CharacterTemplet.SubClass` is one of:

| Value | Subclass |
|---|---|
| 1 | `ATTACKER` |
| 2 | `BRUISER` |
| 3 | `WIZARD` |
| 4 | `ENCHANTER` |
| 5 | `VANGUARD` |
| 6 | `TACTICIAN` |
| 7 | `SWEEPER` |
| 8 | `PHALANX` |
| 9 | `RELIEVER` |
| 10 | `SAGE` |

Note `CharacterTemplet.SubClass` ships **the string name** (`"WIZARD"`,
not `"3"`). The numeric value is exposed by some downstream awakening
nodes via `AwakeningSubTypeValue` — that's where you read it as an int.

### 2.4 `BuffType` (`BT_*`)

The full enum has 200+ entries; the calc only handles a subset. The
table below lists every type the engine recognizes.

#### Stat-affecting buffs (read by `extract-buffs.ts`)

| BT | Value semantics | Engine effect |
|---|---|---|
| `BT_STAT` | `Value` per-mille on `StatType` | Combat-time stat buff (only certain types are picked up — class passives, skill buffs that match `BT_STAT_PREMIUM` rule) |
| `BT_STAT_PREMIUM` | Same as `BT_STAT` but always-on | Pre-combat permanent stat (class passives, awakening flat / pct) |
| `BT_DMG` | `Value` per-mille added to attacker pool | Type 83 — additive damage rate |
| `BT_DMG_OWNER_LOST_HP_RATE` | Type 84, `Value` × `(1 − ownerHpRate)` |
| `BT_DMG_TARGET_LOST_HP_RATE` | Type 85, `Value` × `(1 − targetHpRate)` |
| `BT_DMG_OWNER_STAT` | Type 86, `min(floor(ownerStat × Value/1000), 1000)` per-mille |
| `BT_DMG_TARGET_STAT` | Type 87, same chain on `targetStat` (Noa S2) |
| `BT_DMG_OWNER_BUFF` | Type 88, `Value × ownerBuffCount` |
| `BT_DMG_TARGET_BUFF` | Type 89, `Value × targetBuffCount` |
| `BT_DMG_OWNER_DEBUFF` | Type 90, `Value × ownerDebuffCount` |
| `BT_DMG_TARGET_DEBUFF` | Type 91, `Value × targetDebuffCount` |
| `BT_DMG_ELEMENT_SUPERIORITY` | Type 92, marker buff (forces ×1.20 elem path) — **not modeled** |
| `BT_DMG_ELEMENT_ENCHANT` | Type 93, adds `Value‰` above 1.20 base — **not modeled** |
| `BT_DMG_ENEMY_TEAM_DECREASE` | Type 94, `Value × deadEnemyCount` (Maxwell S3) |
| `BT_DMG_TARGET_BREAK` | Type 95, `1` if target is `IsBreak` |
| `BT_DMG_TO_BOSS` | Type 96, `1` if target is boss (boss types ≥ 4) |
| `BT_DMG_KILL_COUNT_STACK` | Type 97, runtime-fed stack |
| `BT_DMG_NOT_CRITICAL` | Type 98, `1` if non-crit |
| `BT_DMG_PVP_CONTENT` | Type 99, `1` if PVP |
| `BT_DMG_CASTER_STAT` | Type 100, alias of 86 but uses original caster |
| `BT_DMG_CASTER_LOST_HP_RATE` | Type 101 |
| `BT_DMG_OWNER_TEAM_BUFF` | Type 102, sum over caster's team buffs |
| `BT_DMG_MY_TEAM_DECREASE` | Type 103 |
| `BT_DMG_MONADGATE_CONTENT` | Type 104, `1` in Monad Gate |
| `BT_DMG_TOWER_CONTENT` | Type 105, `1` in Tower |
| `BT_DMG_REDUCE` | Type 107, defender-side damage reduce (per-mille subtracted from rate) |
| `BT_DMG_REDUCE_MY_TEAM_INCREASE` | Type 110, `(aliveAllies − 1) × Value‰` |
| `BT_DMG_REDUCE_FINAL` | Type 111, applied as `× (1 − value/100)` post-rate (MAX agg) |
| `BT_DMG_REDUCE_FINAL_MY_TEAM_INCREASE` | Type 112 |
| `BT_DMG_REDUCE_FINAL_WITH_OUT_FIRST_SKILL` | Type 113, gated on "first skill" (S1 not yet cast) |
| `BT_STEALTHED` | Type 145, also feeds the reduce sum |
| `BT_MARKING` | Marker type — defender carries → ×1.15 multiplier (`RODATA.MARKING`) |
| `BT_SWAP_STAT_ATTACK` | Used by Drakhan / base Veronica — replaces `ST_ATK` with `ST_HP` or `ST_DEF` for the main scaling |

The full enum (with VAs, ARM64 dispatch sites) is documented in
`damage-lab-v2-spec.md` §2 and reproduced in `02-formula.md` §3.

#### Cosmetic / cc / removed-from-engine

Buffs whose `BuffDebuffType` is `DEBUFF_IGNORE_ALL` and `BuffCCType` is
`STUN/SILENCE/BIND/SLEEP/FREEZE/...` etc. are CC, not damage. The
extractor ignores them (the calc does not simulate turn order).

### 2.5 `BuffConditionType`

Gates a buff so it only contributes under certain in-combat states.
Common values:

| String | Meaning |
|---|---|
| `NONE` | Always on |
| `ATTACKER_ELEMENT_WIN` | Attacker has elemental advantage on target |
| `ATTACKER_ELEMENT_LOSE` | Attacker has disadvantage |
| `IS_BOSS` | Target is a boss |
| `IS_PVP` | In PvP (`CDungeonScene.IsPvp`) |
| `IS_TOWER` | Combat in Tower mode |
| `IS_MONADGATE` | Combat in Monad Gate |
| `OWNER_HPRATE_UNDER` | Caster HP% ≤ `BuffConditionValue` |
| `OWNER_HPRATE_OVER` | Caster HP% ≥ `BuffConditionValue` |
| `TARGET_HPRATE_UNDER` | Target HP% ≤ `BuffConditionValue` |
| `OWNER_HAS_BUFF` | Caster carries a specific buff (`BuffConditionValue`) |
| `TARGET_HAS_BUFF` | Target carries a specific buff |
| `CASTER_HAS_BUFF` | Same but tied to the buff's original caster |
| `KILL_COUNT_STACK` | Reads the `killCountStack` runtime accumulator |
| `TARGET_ELEMENT` | Target's element matches `BuffConditionValue` |
| `OWNER_RESOURCE_MAX` | Caster's char-specific resource at max (e.g., Noa Kaizer) |
| `BREAK` | Target is in break state |

`BuffConditionValue` is the parameter (can be a stat threshold, a
buff ID to check for, an enum value, etc.). Its meaning depends on the
condition type.

### 2.6 `ApplyingType` (`OAT_*`)

| String | Meaning |
|---|---|
| `OAT_NONE` | No application (used for marker buffs without a stat side effect) |
| `OAT_VALUE` | Flat value — `Value` is added directly (e.g., +50 ATK) |
| `OAT_RATE` | Per-mille — `Value/1000` is the multiplier (e.g., `100` → +10%) |

The combination `(StatType, ApplyingType, Value)` fully describes the
stat effect.

### 2.7 `StatType` (`ST_*`)

| String | Maps to |
|---|---|
| `ST_NONE` | No stat (e.g., for `BT_DMG_*` buffs) |
| `ST_ATK` | Attack |
| `ST_DEF` | Defense |
| `ST_HP` | Max HP |
| `ST_SPEED` | Speed (a.k.a. `SPD`) |
| `ST_CRITICAL_RATE` | Crit chance |
| `ST_CRITICAL_DAMAGE_RATE` | Crit damage |
| `ST_BUFF_CHANCE` | Effect (EFF) |
| `ST_BUFF_RESIST` | Resistance (RES) |
| `ST_DMG_BOOST` | Damage Inc % |
| `ST_DMG_REDUCE_RATE` | Damage Reduce % |
| `ST_PIERCE_POWER_RATE` | Penetration % |

### 2.8 `AwakeningType`

`CharacterAwakeningNodeTemplet.AwakeningType` values:

| String | Meaning | Quirks toggle |
|---|---|---|
| `ELEMENTAL` | Elemental main + sub nodes (Light/Dark passive, Fire/Earth/Water adv pool) | `quirks.element` |
| `JOB` | Class + Subclass nodes (Mage +12%, Striker bonuses, etc.) | `quirks.job` |
| `UTILITY` | No-stat utility (turn order, AI) | NOT surfaced |
| `PVE` | Counteract Strong Enemies (boss EFF/RES debuffs) | `quirks.pve` |
| `ADVENTURE_LICENSE` | Paid AL nodes — only fire in `DM_ADVENTURE_*` modes | `quirks.adventureLicense` |

There is also `SKILL8` (the awakening that unlocks the 8th skill) —
gated by transcend tier rather than by a quirks toggle.

### 2.9 `AwakeningApplyType` (`AAT_*`)

| String | Meaning | Filter |
|---|---|---|
| `AAT_ELEMENTAL` | Filters on `Element` | `AwakeningApplyTypeValue` matches `CharacterElementType` (0..4) |
| `AAT_CLASS` | Filters on `Class` | `AwakeningApplyTypeValue` matches `CharacterClassType` (1..5) |
| `AAT_SUBCLASS` | Filters on `SubClass` | `AwakeningApplyTypeValue` matches subclass enum (1..10) |
| `AAT_NONE` | Applies to every char (PVE / AL nodes use this) | n/a |

A char qualifies for a node when its `Element` / `Class` / `SubClass`
matches the node's `(AwakeningApplyType, AwakeningApplyTypeValue)`.

### 2.10 `DungeonMode` (`DM_*`)

| String | In-game category |
|---|---|
| `DM_NORMAL` | Story (Normal & Hard, label-disambiguated) |
| `DM_TOWER` | Skyward Tower (Normal) |
| `DM_TOWER_HARD` | Skyward Tower (Hard) |
| `DM_TOWER_VERY_HARD` | Skyward Tower (Very Hard) |
| `DM_TOWER_ELEMENT` | Elemental Towers (each element label-disambiguated) |
| `DM_RAID_1` | Special Request: Ecology Study |
| `DM_RAID_2` | Special Request: Identification |
| `DM_ADVENTURE_MISSION` | Adventure License: Weekly Conquest |
| `DM_ADVENTURE_CHALLENGE` | Adventure License: Promotion |
| `DM_IRREGULAR_CHASE` | Irregular: Pursuit |
| `DM_IRREGULAR_INFILTRATE` | Irregular: Infiltration |
| `DM_GUILD_RAID_MAIN_BOSS` | Guild Raid (main) |
| `DM_GUILD_RAID_SUB_BOSS` | Guild Raid (sub) |
| `DM_WORLD_BOSS` | World Boss |
| `DM_EVENT_BOSS` | Joint Challenge |

Modes outside this list still load (the calc surfaces them
"uncategorized") but have no quirk gate.

---

## 3. CharacterTemplet

**File.** `data/admin/json2/CharacterTemplet.json`.
**Rows.** ~310 at the time of writing (count grows with new releases).

**Sample row** (Maxwell, `2000028`):

```json
{
  "ID": "2000028",
  "ModelID": "2000028",
  "FaceIconID": "2000028",
  "NameID": "2000028_Name",
  "NickNameID": "2000028_NickName",
  "FirstMeetID": "2000028_First_Meet",
  "GachaCommentID": "2000028_Gacha_Comment",
  "Type": "CT_PC",
  "Race": "CRT_HUMAN",
  "Class": "CCT_MAGE",
  "SubClass": "WIZARD",
  "Element": "CET_DARK",
  "BasicStar": "3",
  "Skill_1": "2801",
  "Skill_2": "2802",
  "Skill_3": "2803",
  "Skill_4": "2804",
  "Skill_5": "2805",
  "Skill_6": "2806",
  "Skill_8": "2808",
  "Skill_9": "2809",
  "Skill_10": "2810",
  "Skill_19": "2819",
  "Skill_20": "2820",
  "Skill_21": "2821",
  "Skill_22": "4",
  "HP_Min": "498",
  "HP_Max": "3433",
  "Speed_Min": "124",
  "Speed_Max": "124",
  "Atk_Min": "86",
  "Atk_Max": "861",
  "Def_Min": "16",
  "Def_Max": "167",
  "CriticalRate_Min": "50",
  "CriticalRate_Max": "50",
  "CriticalDMGRate_Min": "1500",
  "CriticalDMGRate_Max": "1500",
  "BuffChance_Min": "10",
  "BuffChance_Max": "10",
  "BuffResist_Min": "10",
  "BuffResist_Max": "100",
  "ShowMainPage": "true",
  "AIType": "ATTACK",
  "RecommandSetOptionID": "1,12,13"
}
```

### 3.1 Identity fields

| Field | Type | Notes |
|---|---|---|
| `ID` | string (7 digits) | Primary key, `2xxxxxx` for PC, `27xxxxx` for CF |
| `Type` | enum | `CT_PC` for player chars, others for non-PC entities |
| `Race` | enum | Lore field (`CRT_HUMAN`, `CRT_DEMON`, `CRT_ANGEL`, …) |
| `Class` | `CCT_*` | Drives class passive |
| `SubClass` | string name | One of `ATTACKER` / `BRUISER` / `WIZARD` / etc. |
| `Element` | `CET_*` | Drives elemental advantage + ELEMENTAL awakening |
| `BasicStar` | int (1/2/3) | Base rarity (≠ in-game star count after evolution) |
| `NameID` | string | Lookup key for localized name (resolves through `StringTemplet` / `*_Name.json`) |
| `NickNameID`, `FirstMeetID`, `GachaCommentID` | string | Other localized strings (not used by calc) |

### 3.2 Skill slots

`Skill_N` fields hold a *Skill ID* string (the row in
`CharacterSkillTemplet`). Conventional slots:

| Slot | Meaning |
|---|---|
| `Skill_1` | Active skill `S1` |
| `Skill_2` | Active skill `S2` |
| `Skill_3` | Active skill `S3` |
| `Skill_4` | Auto attack |
| `Skill_5`..`Skill_7` | Reserved (counter, follow-up) |
| `Skill_8` | Awakening skill (gated by transcend tier) |
| `Skill_9`, `Skill_10` | Reserved (some chars have extra passives) |
| `Skill_19` | Burst variant of `S1` (a.k.a. `B1`) — gated by `Burst2` / `Burst3` flags |
| `Skill_20` | Burst variant of `S2` (`B2`) |
| `Skill_21` | Burst variant of `S3` (`B3`) |
| `Skill_22` | Class passive (the value is the **class index** 1..5 — points into the class passive's skill row, NOT a per-char skill ID). For Maxwell: `"4"` = Mage. |
| `Skill_23` | Upgraded class passive — present on ~12 CF chars. Replaces `Skill_22` when present. **Use `Skill_23 ?? Skill_22`** in the bake. |

If a slot is absent, the char does not have that skill.
`CharacterTemplet.Skill_22 = "0"` should be treated as absent.

### 3.3 Stat fields

Each axis has a `_Min` / `_Max` pair:

| Field | Encoding | Notes |
|---|---|---|
| `HP_Min` / `HP_Max` | flat | Lv 1 / Lv 100 base HP |
| `Atk_Min` / `Atk_Max` | flat | Lv 1 / Lv 100 base ATK |
| `Def_Min` / `Def_Max` | flat | Lv 1 / Lv 100 base DEF |
| `Speed_Min` / `Speed_Max` | flat | Usually `Min === Max` (no level interp on SPD) |
| `CriticalRate_Min` / `_Max` | per-mille | `50` → `5%` |
| `CriticalDMGRate_Min` / `_Max` | per-mille | `1500` → `150%` |
| `BuffChance_Min` / `_Max` | per-mille | `10` → `1%` (default), `100` → `10%` |
| `BuffResist_Min` / `_Max` | per-mille | Same |

The `Min` value is the stat at Lv 1; `Max` is at Lv 100. Use linear
interpolation for in-between levels — the formula `floor(Min + (Max −
Min) × (level − 1) / 99)` is binary-faithful (see `02-formula.md` §3).

### 3.4 Variant linking

There is **no** `BaseCharacterID` field in `CharacterTemplet`. Core
Fusion linking is derived at bake time from `CharacterFusionTemplet` —
see §11.

---

## 4. CharacterSkillTemplet

**File.** `data/admin/json2/CharacterSkillTemplet.json`.
**Rows.** Many.

**Schema.**

```json
{
  "ID": "2801",
  "SkillType": "SKT_ACTIVE",
  "SkillSubType": "ACTIVE",
  "TargetTeamType": "ENEMY",
  "RangeType": "SINGLE",
  "FocusType": "SINGLE",
  "ApproachType": "RANGE",
  "UseJiggleBone": "True",
  "AIType": "ATTACK"
}
```

### 4.1 Fields

| Field | Notes |
|---|---|
| `ID` | Primary key — referenced by `CharacterTemplet.Skill_N` |
| `SkillType` | `SKT_ACTIVE` / `SKT_PASSIVE` / `SKT_CLASS_PASSIVE` / `SKT_AWAKENING` |
| `SkillSubType` | `ACTIVE` / `PASSIVE` |
| `TargetTeamType` | `ENEMY` (target enemy team) / `ALLY` / `NONE` |
| `RangeType` | `SINGLE` / `MULTI` / `ALL` |
| `FocusType` | Targeting hint — `SINGLE`, `RANDOM`, etc. |
| `ApproachType` | Animation hint — `RANGE` (ranged) / `MELEE` |
| `AIType` | `ATTACK` / `BUFF` / `HEAL` / `NONE` |

The calc cares only about `SkillType`, `TargetTeamType`, and
`SkillSubType` (to filter active enemy-targeted damage skills from
passives / heals).

The actual damage data is **NOT here** — it's in
`CharacterSkillLevelTemplet`. This templet is the metadata layer.

---

## 5. CharacterSkillLevelTemplet

**File.** `data/admin/json2/CharacterSkillLevelTemplet.json`.
**Rows.** ~7300.

**Schema.**

```json
{
  "ID": "1015001",
  "SkillID": "101",
  "SkillLevel": "5",
  "DescID": "SE_DESC_DMG_10%,SE_DESC_BUFF_C_10%",
  "DamageFactor": "1260",
  "WGReduce": "2",
  "BuffID": "2000001_1_1"
}
```

### 5.1 Fields

| Field | Notes |
|---|---|
| `ID` | Composite primary key (rarely used directly) |
| `SkillID` | Foreign key into `CharacterSkillTemplet.ID` |
| `SkillLevel` | `1`..`5` (the 5 skill book levels). Some skills go up to 15 (admin lab supports it). |
| `DescID` | CSV of skill effect description tags (the in-game tooltip pieces) |
| `DamageFactor` | per-mille — the listed DF used in the formula |
| `AdditionalAttackRatio` | per-mille — sub-attack factor for skills with a follow-up hit (Luna Barrier, etc.). Often missing. |
| `WGReduce` | Wait Gauge reduction (turn-order mechanic — calc ignores) |
| `BuffID` | CSV of buff ID **strings** (not numeric IDs!). Each maps to one or more rows in `BuffTemplet` via `BuffTemplet.BuffID`. |

### 5.2 BuffID resolution

`BuffID` is a comma-separated list of string keys, e.g.
`"2000001_1_1,COMMON_CLASS_PASSIVE"`. Each entry resolves to the
**level-keyed family** in `BuffTemplet` — e.g.,
`"Awakening_Boss_Dmg"` matches every row whose `BuffID` field is
`"Awakening_Boss_Dmg_1"`, `"Awakening_Boss_Dmg_2"`, …,
`"Awakening_Boss_Dmg_10"`.

For char-skill buffs, the `_N` suffix is usually the skill level
(matching `SkillLevel`). For awakening buffs, `_N` is the awakening
level (1..10).

When the calc needs a single row, it picks the **highest-level** row
whose `Level ≤ SkillLevel` (or the highest available if no upper
bound is given). This matters when a buff's value scales with level.

### 5.3 First rows are NOT char skills

The first ~30 rows of this templet describe **class passives**:
`SkillID = 1` (Defender), `2` (Attacker), `3` (Ranger), `4` (Mage),
`5` (Priest). These are not char-keyed. The bake separates them out
when walking through `CharacterTemplet.Skill_22 = N` (where N is the
class index).

---

## 6. BuffTemplet

**File.** `data/admin/json2/BuffTemplet.json`.
**Rows.** ~10500.

**Schema.**

```json
{
  "ID": "681",
  "BuffID": "Awakening_Boss_Dmg_1",
  "Level": "1",
  "Type": "BT_DMG_TO_BOSS",
  "TargetType": "ME",
  "CreateRate": "1000",
  "StackCount": "1",
  "IsIDOverlap": "False",
  "IsTypeOverlap": "True",
  "BuffDebuffType": "BUFF",
  "IsIgnoreInterruption": "False",
  "IsEquip": "False",
  "IsEquipBuff": "False",
  "BuffCCType": "NONE",
  "StatType": "ST_NONE",
  "ApplyingType": "OAT_RATE",
  "Value": "30",
  "TargetSkillType": "SKT_NONE",
  "BuffCreateType": "PASSIVE",
  "BuffConditionType": "NONE",
  "IsLastCheck": "True",
  "IgnoreCreateCheckCondition": "False",
  "CallerSkillType": "SKT_ALL",
  "TurnDuration": "-1",
  "BuffRemoveType": "NONE",
  "AdditiveAttack": "True",
  "RemoveOnCasterDie": "False",
  "MaterialType": "CMT_NONE"
}
```

### 6.1 Identity

| Field | Notes |
|---|---|
| `ID` | Numeric primary key (rarely used directly) |
| `BuffID` | Descriptive string key — joins with `CharacterSkillLevelTemplet.BuffID` and `CharacterAwakeningLevelTemplet.BuffID` |
| `Level` | `1`..`N` — the per-level row in a buff family |
| `Type` | `BT_*` — the buff dispatch type (see §2.4) |

### 6.2 Effect fields

| Field | Notes |
|---|---|
| `StatType` | `ST_*` — which stat the buff affects (or `ST_NONE` for non-stat buffs like `BT_DMG_*`) |
| `ApplyingType` | `OAT_RATE` (per-mille) / `OAT_VALUE` (flat) / `OAT_NONE` |
| `Value` | Signed integer — the value to apply (+30 ATK, −300 DR, etc.) |
| `StackCount` | Max stacks (1 = single instance). Most damage-relevant buffs stack=1. |
| `TurnDuration` | Turns the buff lasts (`-1` = permanent / passive) |

### 6.3 Triggering

| Field | Notes |
|---|---|
| `BuffCreateType` | `PASSIVE` (always-on at battle start) / `ON_BREAK` / `ON_HIT` / etc. |
| `BuffConditionType` | See §2.5 — gates application |
| `BuffConditionValue` | Parameter for the condition (HP threshold, buff ID to check, etc.) |
| `BuffRemoveType` | `NONE` (permanent), `ON_BREAK_FINISH`, `ON_TURN_END`, etc. |
| `CallerSkillType` | Filter — which caller's skill triggers this buff. `SKT_ALL` means any. |
| `TargetSkillType` | Filter on the target's skill (rarely used) |

### 6.4 Awakening fields (sub-set)

Awakening buff rows additionally carry awakening metadata, but it lives
in `CharacterAwakeningNodeTemplet` / `CharacterAwakeningLevelTemplet`,
NOT in `BuffTemplet`. The buff itself is identical in shape regardless
of where it's referenced from.

### 6.5 Family progression example

Awakening boss damage progression (`Awakening_Boss_Dmg_*`):

| BuffID | Level | Value (per-mille) | Effective |
|---|---|---|---|
| `Awakening_Boss_Dmg_1` | 1 | 30 | +3% |
| `Awakening_Boss_Dmg_2` | 2 | 60 | +6% |
| `Awakening_Boss_Dmg_3` | 3 | 90 | +9% |
| ... | ... | ... | ... |
| `Awakening_Boss_Dmg_10` | 10 | 300 | +30% |

The calc uses the **last row** (`_10`) when surfacing the awakened
quirk. Lower levels are intermediate user progression and not
relevant to the public calc (which assumes max awakening).

---

## 7. CharacterAwakeningNodeTemplet

**File.** `data/admin/json2/CharacterAwakeningNodeTemplet.json`.
**Rows.** ~207.

**Schema.**

```json
{
  "ID": "1",
  "NodeIconName": "CM_Gift_MainNode_03",
  "NodeIconBgColorHex": "#7FEE66",
  "NodeNameID": "SYS_GIFT_NODE_ELEMENT01_MAIN_NAME",
  "NodeDescID": "SYS_GIFT_NODE_ELEMENT01_MAIN_DESC",
  "AwakeningGroupID": "1",
  "AwakeningType": "ELEMENTAL",
  "AwakeningSubTypeValue": "0",
  "AwakeningApplyType": "AAT_ELEMENTAL",
  "AwakeningApplyTypeValue": "0",
  "AwakeningLevelGroupID": "10101",
  "PageNum": "0",
  "NodePosition": "0",
  "ConnectionNodeID": "2,8",
  "AwakeningNodeType": "ANT_MAIN",
  "RequireMainNodeID": "0",
  "RequireMainNodeLevel": "0"
}
```

### 7.1 Fields

| Field | Notes |
|---|---|
| `ID` | Node primary key |
| `AwakeningType` | One of `ELEMENTAL` / `JOB` / `UTILITY` / `PVE` / `ADVENTURE_LICENSE` (see §2.8) |
| `AwakeningSubTypeValue` | Sub-discriminator within the type (e.g., `0` Earth, `1` Water for ELEMENTAL) |
| `AwakeningApplyType` | `AAT_ELEMENTAL` / `AAT_CLASS` / `AAT_SUBCLASS` / `AAT_NONE` (see §2.9) |
| `AwakeningApplyTypeValue` | Numeric — the element/class/subclass index this node applies to. Ignored when `AwakeningApplyType = AAT_NONE`. |
| `AwakeningLevelGroupID` | Foreign key into `CharacterAwakeningLevelTemplet.AwakeningLevelGroupID` |
| `AwakeningGroupID` | Higher-level grouping (the node's tab in-game) |
| `AwakeningNodeType` | `ANT_MAIN` (the headline node) / `ANT_SUB` (small sub-bonus nodes) |
| `PageNum`, `NodePosition`, `ConnectionNodeID` | Layout fields for the in-game node graph (irrelevant to the calc) |
| `RequireMainNodeID`, `RequireMainNodeLevel` | Prerequisite (the main node must be level X before this sub-node unlocks) |

### 7.2 How awakening filters apply

A char qualifies for a node when:

```
node.AwakeningApplyType === 'AAT_NONE'
  OR (node.AwakeningApplyType === 'AAT_ELEMENTAL' && node.AwakeningApplyTypeValue == elementIndex(char.Element))
  OR (node.AwakeningApplyType === 'AAT_CLASS'     && node.AwakeningApplyTypeValue == classIndex(char.Class))
  OR (node.AwakeningApplyType === 'AAT_SUBCLASS'  && node.AwakeningApplyTypeValue == subclassIndex(char.SubClass))
```

The bake walks every node, computes its qualifying char set, then
attaches the resulting `ApplicableBuff[]` to the manifest.

---

## 8. CharacterAwakeningLevelTemplet

**File.** `data/admin/json2/CharacterAwakeningLevelTemplet.json`.
**Rows.** ~229.

**Schema.**

```json
{
  "ID": "1",
  "AwakeningLevelGroupID": "10101",
  "AwakeningLevel": "1",
  "RequireItemID": "24001,24002",
  "RequireItemValue": "60,12",
  "RequireGold": "75000",
  "OptionType": "IOT_BUFF",
  "StatType": "ST_NONE",
  "ApplyingType": "OAT_NONE",
  "OptionValue": "0",
  "BuffID": "Awakening_Element_Dmg_1",
  "BuffType": "",
  "BuffValue": ""
}
```

### 8.1 Fields

| Field | Notes |
|---|---|
| `AwakeningLevelGroupID` | Foreign key from `CharacterAwakeningNodeTemplet` |
| `AwakeningLevel` | Level within the group (1..N) |
| `OptionType` | `IOT_BUFF` (refers to `BuffID` for resolution) / `IOT_STAT` (uses `StatType` + `OptionValue` directly) |
| `BuffID` | String key into `BuffTemplet` family — typically the `_N` suffix matches `AwakeningLevel` |
| `StatType` | When `OptionType === 'IOT_STAT'`, the stat axis |
| `OptionValue` | When `OptionType === 'IOT_STAT'`, the value |
| `ApplyingType` | `OAT_RATE` / `OAT_VALUE` (for stat-direct nodes) |

The bake resolves `BuffID` to the matching `BuffTemplet` row at the
**max** level (group's last level) — this is what the public calc
treats as "fully awakened".

---

## 9. CharacterEvolutionStatTemplet

**File.** `data/admin/json2/CharacterEvolutionStatTemplet.json`.
**Rows.** ~920.

**Schema.**

```json
{
  "ID": "217",
  "CharacterID": "2000028",
  "EvolutionLevel": "2",
  "RewardStatType_1": "ST_ATK",
  "RewardValue_1": "29",
  "RewardStatType_2": "ST_HP",
  "RewardValue_2": "70",
  "RewardStatType_3": "ST_BUFF_CHANCE",
  "RewardValue_3": "20"
}
```

### 9.1 Fields

| Field | Notes |
|---|---|
| `CharacterID` | Foreign key |
| `EvolutionLevel` | Integer evolution step (typically 2..9 for 3-star chars). Not the in-game star count directly — the bake encodes it as `evN` index. |
| `RewardStatType_N` (1..3) | One of three stat axes the evolution grants |
| `RewardValue_N` | Per-stat value (flat for ATK/DEF/HP/SPD, per-mille for crit / EFF / RES / DMG_BOOST) |

### 9.2 Evolution semantics

Each row is **incremental** — granted upon reaching that evolution
level. The total stat bonus at level N is the sum of rows from
`EvolutionLevel = 2..N`.

For Lv 100 prefill (the calc's anchor), the public calc applies
`EvolutionLevel ≤ 6` only — beyond that requires Lv > 100, which the
calc doesn't model. **Important:** the existing pipeline at the time
of writing sums *all* evolution rows including 7/8/9. This over-counts
~600 HP / 84 ATK on chars with ev7/8/9 baked. See `06-gotchas.md` §3.

### 9.3 ST_DMG_BOOST quirk

Some evolutions grant `ST_DMG_BOOST` (e.g., Maxwell ev6 +20). This is
DMG↑ %, additive into the gear DMG_INC pool, NOT an ATK% bonus. The
bake feeds it into `noGearStats.evolution.dmgInc` rather than `atkPct`.

---

## 10. CharacterArchiveStatTemplet (Hero Codex)

**File.** `data/admin/json2/CharacterArchiveStatTemplet.json`.
**Rows.** 11 — fixed.

**Schema.**

```json
[
  { "ID": "1",  "Atk_Rate": "20",  "Def_Rate": "0",   "HP_Rate": "0"   },
  { "ID": "2",  "Atk_Rate": "20",  "Def_Rate": "20",  "HP_Rate": "0"   },
  { "ID": "3",  "Atk_Rate": "20",  "Def_Rate": "20",  "HP_Rate": "40"  },
  { "ID": "4",  "Atk_Rate": "40",  "Def_Rate": "20",  "HP_Rate": "40"  },
  { "ID": "5",  "Atk_Rate": "40",  "Def_Rate": "40",  "HP_Rate": "40"  },
  { "ID": "6",  "Atk_Rate": "40",  "Def_Rate": "40",  "HP_Rate": "70"  },
  { "ID": "7",  "Atk_Rate": "70",  "Def_Rate": "40",  "HP_Rate": "70"  },
  { "ID": "8",  "Atk_Rate": "70",  "Def_Rate": "70",  "HP_Rate": "70"  },
  { "ID": "9",  "Atk_Rate": "70",  "Def_Rate": "70",  "HP_Rate": "100" },
  { "ID": "10", "Atk_Rate": "100", "Def_Rate": "70",  "HP_Rate": "100" },
  { "ID": "11", "Atk_Rate": "100", "Def_Rate": "100", "HP_Rate": "100" }
]
```

`ID` matches the in-game **Codex Level**. Values are per-mille (e.g.,
`100` → +10%). Apply uniformly to **all** chars (account-wide bonus).

The bake materializes this as a 12-row table (Lv 0..11) with the
per-mille values converted to percentage:

```ts
codexTable = [
  { level: 0,  atkPct: 0,   defPct: 0,   hpPct: 0   },
  { level: 1,  atkPct: 2,   defPct: 0,   hpPct: 0   },
  { level: 2,  atkPct: 2,   defPct: 2,   hpPct: 0   },
  ...
  { level: 11, atkPct: 10,  defPct: 10,  hpPct: 10  },
]
```

(Note: the example values `20` / `40` / etc. in the templet divide by
10 to get the percentage, NOT 100. So `Atk_Rate: "20"` = +2%.)

---

## 11. CharacterTranscendentTemplet

**File.** `data/admin/json2/CharacterTranscendentTemplet.json`.
**Rows.** ~80 (stable per char × tier combinations).

**Schema.**

```json
{
  "ID": "1",
  "UseTransStar": "True",
  "CharacterID": "...",
  "BasicStar": "3",
  "TransStar": "1",
  "NextStar": "2",
  "MaterialCount": "...",
  "Price": "...",
  "RewardHPRate": "10",
  "RewardAtkRate": "10",
  "RewardDefRate": "10",
  "CharacterSeasonalRewardID": "0",
  "StarPlus": "1",
  "ShowUIStar": "4",
  "StarColor": "GOLD",
  "SkillLevel": "0",
  "WGDMG": "0",
  "Burst2": "False",
  "Burst3": "False"
}
```

### 11.1 Fields

| Field | Notes |
|---|---|
| `CharacterID` | Foreign key (sometimes empty — generic-tier rows) |
| `BasicStar` | The char's base rarity |
| `TransStar` | The transcend tier index (1..9 — see §11.2) |
| `RewardAtkRate` / `RewardDefRate` / `RewardHPRate` | Per-mille (`100` → +10%) |
| `Burst2` | If `"True"`, transcend tier unlocks burst 2 (B1/B2 skills) |
| `Burst3` | If `"True"`, transcend tier unlocks burst 3 (B3 skill) |
| `SkillLevel` | Bonus skill levels granted (rarely > 0) |
| `WGDMG` | WG damage modifier (turn-order — calc ignores) |
| `StarPlus`, `ShowUIStar`, `StarColor` | Display metadata |

### 11.2 Tier mapping

In-game labels map to `TransStar` values:

| In-game | TransStar |
|---|---|
| Lv 0 (no transcend) | n/a (use 0 as sentinel) |
| Lv 3 | 1 |
| Lv 4-1 | 2 |
| Lv 4-2 | 3 |
| Lv 5-1 | 4 |
| Lv 5-2 | 5 |
| Lv 5-3 | 6 |
| Lv 6-1 | 7 |
| Lv 6-2 | 8 |
| Lv 6-3 (max) | 9 |

The bake emits a per-char `transcend.json` with the cumulative ATK%
bonus per tier (sum of all rewards up to that tier).

---

## 12. CharacterMaxLevelTemplet

**File.** `data/admin/json2/CharacterMaxLevelTemplet.json`.
**Rows.** 45 (5 elements × 3 stars × 3 steps).

**Schema.**

```json
{
  "ID": "1",
  "BasicStar": "1",
  "Element": "CET_EARTH",
  "Step": "1",
  "RequireLevel": "100",
  "MaxLevel": "105",
  "MaterialID": "0",
  "MaterialCount": "0",
  "CharBreakPieceQuantity": "25",
  "CharBreakPieceRecallItemID": "30514",
  "Price": "250000",
  "LevelUpStatModifierAfter100": "200"
}
```

### 12.1 Step progression

| Step | RequireLevel | MaxLevel | LevelUpStatModifierAfter100 | Effective gain |
|---|---|---|---|---|
| 1 | 100 | 105 | 200‰ | +20% per-step base stats |
| 2 | 105 | 110 | 400‰ | +40% per-step |
| 3 | 110 | 120 | 700‰ | +70% per-step |

### 12.2 Calc impact

**The damage formula does NOT branch on attacker level.** Lv 105 / 110
/ 120 grant raw stats but no extra passives, and `recompute()` reads
the stat values directly. The public calc currently anchors at Lv 100
(the sweet spot for prefill accuracy). See `06-gotchas.md` §6.

---

## 13. DungeonTemplet

**File.** `data/admin/json2/DungeonTemplet.json`.
**Rows.** ~4400.

**Schema.**

```json
{
  "ID": "70600000",
  "NameID": "SYS_ADVENTURE_WEEKLY_1",
  "SceneID": "5040050",
  "RecommendBattlePower": "72090",
  "RecommandLevel": "100",
  "RequireTicket": "TICKET_STAMINA",
  "RequireValue": "10",
  "SpawnID_Pos0": "706000001",
  "_unknown_0": "False",
  "MoveToField": "True",
  "DungeonPlayMode": "DPM_NORMAL",
  "DungeonMode": "DM_ADVENTURE_MISSION",
  "BGImage": "Dungeon_Img_5030060",
  "IsSweep": "False",
  "BGM": "...",
  "ClearHistory": "False",
  "FriendSupportUse": "FALSE"
}
```

### 13.1 Fields

| Field | Notes |
|---|---|
| `ID` | Dungeon primary key (8-digit) |
| `NameID` | String ID for localized stage name |
| `RecommandLevel` | Recommended attacker level |
| `SpawnID_Pos0` / `_Pos1` / `_Pos2` | Spawn group IDs (multiple waves possible). Frequently only `_Pos0` is set. |
| `DungeonMode` | `DM_*` enum (see §2.10) |
| `DungeonPlayMode` | `DPM_NORMAL` / `DPM_REPLAY` (irrelevant to calc) |
| `IsSweep` | If `"true"`, can be sweep-cleared (irrelevant to calc) |
| `RecommendBattlePower` | Display sugar |

### 13.2 Stage waves

`SpawnID_Pos0..2` each point to a row in `DungeonSpawnTemplet`. Each
spawn group describes up to 4 enemy slots (with their levels). The
public calc surfaces ALL slots from ALL waves as picker options.

---

## 14. DungeonSpawnTemplet

**File.** `data/admin/json2/DungeonSpawnTemplet.json`.
**Rows.** ~7500.

**Schema.**

```json
{
  "ID": "200001",
  "GroupID": "701010011",
  "ID0": "411400670",
  "Offset0": "1.0,0.0",
  "Offset1": "0.0,0.0",
  "Offset2": "0.0,0.0",
  "Offset3": "0.0,0.0",
  "Scale0": "2.3",
  "Scale1": "1.0",
  "Scale2": "1.0",
  "Scale3": "1.0",
  "Level0": "50",
  "Level1": "50",
  "Level2": "50",
  "Level3": "50",
  "BattleFormationType": "BFT_BACK",
  "HPLineCount": "1"
}
```

### 14.1 Fields

| Field | Notes |
|---|---|
| `GroupID` | Foreign key from `DungeonTemplet.SpawnID_PosN` |
| `ID0`, `ID1`, `ID2`, `ID3` | Monster IDs (`MonsterTemplet.ID`) for each slot. Empty / `0` = empty slot |
| `Level0`..`Level3` | Per-slot level — used for stat interpolation (`interpolate(min, max, level)`) |
| `Offset0..3`, `Scale0..3` | Visual layout (irrelevant) |
| `BattleFormationType` | Front / back row hint (irrelevant) |
| `HPLineCount` | Number of HP bars the boss has (= number of rage breaks the boss can survive) |

### 14.2 Empty slot handling

If `IDn === ""` or `IDn === "0"`, slot is empty — skip when surfacing
in the picker.

---

## 15. AdventureDungeonTemplet

**File.** `data/admin/json2/AdventureDungeonTemplet.json`.
**Rows.** ~243.

**Schema (sample, tier 1).**

```json
{
  "ID": "2",
  "GroupID": "7",
  "Level": "1",
  "DungeonID": "70600101",
  "DungeonLevel": "120",
  "BossHP": "655539",
  "RecommendBattlePower": "1000000",
  "BossLimitCount": "2",
  "SpawnAdvantageRate_Atk": "400",
  "SpawnAdvantageRate_Def": "400",
  "LimitTurn": "20",
  "BossRewardID": "97002",
  "ImageStr": "T_Licence_2000059"
}
```

### 15.1 Fields

| Field | Notes |
|---|---|
| `DungeonID` | Foreign key into `DungeonTemplet.ID` (the underlying dungeon) |
| `Level` | The AL **tier** within the dungeon (1..10) |
| `DungeonLevel` | Per-tier monster level (overrides `DungeonSpawnTemplet.LevelN`) |
| `BossHP` | Per-tier raw HP (overrides the interpolated MonsterTemplet HP) |
| `BossLimitCount` | Number of times the boss can rage break (overrides `HPLineCount`) |
| `LimitTurn` | Soft enrage turn count (display sugar) |
| `SpawnAdvantageRate_Atk` | per-mille — **sparse**, present only on high tiers (e.g., Ksai Lv 8/9/10). Adds to `MonsterTemplet.Atk_Min/Max`. |
| `SpawnAdvantageRate_Def` | per-mille — sparse |
| `SpawnAdvantageRate_Spd` | per-mille — sparse |

### 15.2 Per-tier expansion

Adventure License dungeons have one parent `DungeonTemplet` row but
N rows in `AdventureDungeonTemplet` (one per tier). For each tier, the
boss has different stats, levels, and advantage rates.

The bake **expands each tier into its own stage**, with a composite ID
like `${dungeonId}@al${level}`. See `03-bake-contract.md` §3 +
`06-gotchas.md` §1 for the contract.

### 15.3 The Ksai bug (historical)

Pre-fix, the pipeline didn't read per-tier `SpawnAdvantageRate_*`.
Result: Ksai Lv 10 calc gave ATK=5639, DEF=2626 vs in-game ATK=10714,
DEF=4989. Fix: read `SpawnAdvantageRate_Atk/Def/Spd` from the AL row
and apply them via `applyAdvantageRate(stat, ratePermille)` in the
bake's `interpolateRated` chain.

---

## 16. MonsterTemplet

**File.** `data/admin/json2/MonsterTemplet.json`.
**Rows.** ~4400.

**Schema (subset).**

```json
{
  "ID": "...",
  "ModelID": "...",
  "FaceIconID": "...",
  "NameID": "..._Name",
  "Type": "CT_ELITE_BOSS",
  "Race": "CRT_DEMON",
  "Class": "CCT_RANGER",
  "SubClass": "VANGUARD",
  "Element": "CET_DARK",
  "BasicStar": "3",
  "Skill_1": "...",
  "Skill_2": "...",
  "Skill_3": "...",
  "Skill_15": "...",
  "Skill_16": "...",
  "HP_Min": "5000",
  "HP_Max": "120000",
  "Speed_Min": "100",
  "Speed_Max": "100",
  "Atk_Min": "200",
  "Atk_Max": "1500",
  "Def_Min": "30",
  "Def_Max": "350",
  "DMGReduceRate_Max": "30",
  "CriticalRate_Min": "50",
  "CriticalRate_Max": "50",
  "CriticalDMGRate_Min": "1500",
  "CriticalDMGRate_Max": "1500",
  "BuffChance_Min": "10",
  "BuffChance_Max": "10",
  "BuffResist_Min": "10",
  "BuffResist_Max": "100"
}
```

### 16.1 Differences vs `CharacterTemplet`

- `Type` distinguishes monster category — `CT_ELITE_BOSS` (boss),
  `CT_NORMAL_MONSTER` (mob), etc. The calc treats `Type ≥ CT_BOSS_*` as
  `isBoss = true`.
- `DMGReduceRate_Max` (note: only `_Max`, no `_Min`) — flat percentage
  of damage reduce (`30` → 30% DR). This is the "Boss Defense" stat.
- `Skill_15..18` are reserved for boss passive skills (often the
  break/enrage passives). The calc reads these for boss-mechanic
  detection.
- No `Skill_22` (no class passive — monsters don't have one).
- No evolution / awakening hookup — monsters don't level up via the
  player progression system.

### 16.2 Stat interpolation

Monster stats interpolate with the **per-spawn-slot level**, not a
fixed Lv 1 / 100. Use `interpolate(MonsterTemplet.Atk_Min,
MonsterTemplet.Atk_Max, DungeonSpawnTemplet.LevelN)`. For AL tiers,
the level is `AdventureDungeonTemplet.DungeonLevel`.

The advantage rate (when present) wraps via `interpolateRated`:

```ts
atk = interpolateRated(
  monster.Atk_Min,
  monster.Atk_Max,
  level,
  spawnAdvantageAtk,   // per-mille, signed; 0 if absent
)
```

See `02-formula.md` §3 for the f32-faithful chain.

---

## 17. GameConfigTemplet

**File.** `data/admin/json2/GameConfigTemplet.json`.
**Rows.** ~198.

**Schema.**

```json
{
  "ID": "MAX_CHARACTER_LEVEL",
  "ValueString": "120"
}
```

### 17.1 Relevant entries

| ID | Value | Use |
|---|---|---|
| `MAX_CHARACTER_LEVEL` | 120 | Display sugar |
| `MAX_PVE_DUNGEON_LEVEL` | 13 | (Sometimes used to cap dropdowns) |
| `MISSED_DAMAGE_RATE` | 500 | per-mille → ×0.5 multiplier in formula |

The `MISSED_DAMAGE_RATE` constant is hardcoded as `RODATA.MISSED_DAMAGE_RATE
= 0.5` in the engine; reading the config row at bake time is a sanity
check rather than a runtime input.

---

## 18. BuffSystemTemplet

**File.** `data/admin/json2/BuffSystemTemplet.json`.
**Rows.** ~96.

**Schema.**

```json
{
  "ID": "...",
  "GroupID": "...",
  "BuffType": "EBT_MAX_HP",
  "BuffValue": "150",
  "DungeonMode": "DM_NORMAL",
  "IgnoreDungeonMode": "False",
  "Title": "...",
  "IconName": "...",
  "PurchaseBuff": "True"
}
```

### 18.1 Guild HP buff

The Guild Level HP buff lives here as `BuffType=EBT_MAX_HP` rows. The
mapping `guildLevel → multiplier` is empirically:

```ts
const GUILD_HP_BY_LEVEL = [0, 8, 8, 8, 10, 10, 10, 12, 13, 14, 15]
//                         ^L0 ^L1               ^L7 ^L8 ^L9 ^L10
```

Values are **percentage points** (15 → +15% MaxHP at Guild Lv 10).
The bake currently hardcodes this table since the templet IDs aren't
stable (see `recompute.ts` `GUILD_HP_BY_LEVEL`).

### 18.2 Buff system gotcha

`EBT_MAX_HP` is an **in-combat** MaxHP boost — applied to the HP bar
the user sees. **It is NOT applied to** `BT_DMG_OWNER_STAT` /
`BT_SWAP_STAT_ATTACK` scaling. Those buffs read the BASE pre-guild
MaxHP at battle start (verified empirically: Veronica CF S2/S3 with
guildLevel=10 against Amadeus matches calc with raw `ST_HP`, not
`× 1.15`). See `06-gotchas.md` §7.

---

## 19. Equipment templets (summary)

The damage calc reads three equipment-related templets, but the bake
shape (in `equipment.json`) is simpler than the raw datamine. Detailed
schemas in `03-bake-contract.md` §6.

- `EquipmentTemplet.json` — gear pieces (weapon, armor, accessory)
  with mainstat ranges per rarity / level.
- `EquipmentSetTemplet.json` — set bonuses (2 / 4 / 6 piece effects).
  Currently NOT modeled in the calc (out of scope).
- `EETemplet.json` (or similar) — Exclusive Equipment per char with
  per-level buff catalogs.

The public calc only reads EE buffs from the bake; raw gear stats
come from user-typed numbers (the calc takes ATK / DEF / HP / SPD /
EFF / RES from the user, not from a gear loadout).

---

## 20. Cross-template join cheatsheet

Quick reference for the most common joins.

```
CharacterTemplet.ID                                      [Chars]
  ├─→ Skill_N → CharacterSkillTemplet.ID                 [Skill metadata]
  │                ├─→ CharacterSkillLevelTemplet.SkillID×SkillLevel
  │                │       ├─→ DamageFactor (per-mille)
  │                │       └─→ BuffID (CSV) → BuffTemplet.BuffID
  │                │                              └─→ Type, Value, Condition, …
  │                └─→ MonsterDamageTemplet.SkillID    [Monster bosses use this]
  ├─→ CharacterEvolutionStatTemplet.CharacterID         [Star evolutions]
  ├─→ CharacterTranscendentTemplet.CharacterID          [Transcend tiers]
  └─→ (implicit) CharacterArchiveStatTemplet            [Codex — applies to all]

CharacterAwakeningNodeTemplet.AwakeningLevelGroupID
  └─→ CharacterAwakeningLevelTemplet.AwakeningLevelGroupID
        └─→ BuffID → BuffTemplet.BuffID

DungeonTemplet.ID
  ├─→ SpawnID_PosN → DungeonSpawnTemplet.GroupID
  │                    └─→ IDn → MonsterTemplet.ID    [Monster catalog]
  └─→ AdventureDungeonTemplet.DungeonID                [Per-tier overrides]
        └─→ DungeonLevel, BossHP, SpawnAdvantageRate_*
```

Use these chains to materialize the bake without holding intermediate
state across builders. Each builder reads what it needs and writes one
output JSON.

---

## 21. Patches that break the schema

Game updates occasionally:

- **Add new `BT_*` enum values.** New types are silently ignored by the
  extractor (unrecognized → no contribution). Audit the spec when
  drift is detected.
- **Rename a field.** Rare but happens (e.g., `_unknown_0` cleanups).
  The extractor must default missing fields, not crash.
- **Add a new `DungeonMode`.** New mode → uncategorized in the picker
  (a no-op for the calc). Add an entry to `MODE_GROUPS` to surface.
- **Rebalance buff values.** Common — every patch shifts some `Value`
  fields. The bake re-runs picks them up automatically.

Defensive coding: every numeric coerce must default `0`; every enum
match must have a fall-through; the bake must not throw on a missing
join (log a warning, skip the row).

---

End of datamine schema. Continue to `02-formula.md`.
