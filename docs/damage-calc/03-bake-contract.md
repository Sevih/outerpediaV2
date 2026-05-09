# Damage Calculator V3 — 03. Bake Contract

> **Audience.** Pipeline engineers (the producer) and reader / runtime
> engineers (the consumer). Anyone touching files under
> `pipeline/steps/damage-calc/`, `src/lib/data/damage-calc/`, or
> `public/damage-calc/`.
>
> **Scope.** Defines the on-disk schema of every file the damage-calc
> pipeline emits, and the typed reader functions that consume them.
> The bake is the **only** contract between datamine and runtime.
>
> **Versioning.** Every file emits a top-level `_v` (string). Reader
> code MUST log a warning on mismatch but never crash — V3 should
> still serve what it can.

---

## 1. File map

```
public/damage-calc/
  manifest.json              ← character roster + account-wide codex table
  chars/
    {charId}.json            ← per-char detail (~120 files)
  monsters.json              ← all targets (modes → stages → waves → monsters)
  buffs/
    awakening.json           ← awakening tree (shared across chars)
    {charId}.json            ← per-char skill + EE buffs (~120 files)
  transcend.json             ← per-char transcend tier table
  equipment.json             ← gear effects (weapons / accessories / talismans / sets / EEs)
  mechanics/
    _index.json              ← list of monster IDs with non-empty mechanics
    {monsterId}.json         ← boss-override definition (lazy-loaded)
```

Total bake size at the time of writing:
- ~210 KB gzipped excluding char details + boss mechanics.
- ~6 MB total uncompressed across all files (lazy-loaded for chars and
  mechanics).

The browser fetches the same files directly via `fetch('/damage-calc/...')`
— **no API hop**. The server reader (`src/lib/data/damage-calc/`) reads
them via `fs.readFile` for SSR and RSC.

---

## 2. Reader API

The single entry point for consuming the bake:

```ts
// src/lib/data/damage-calc/index.ts

export {
  getDamageCalcCharManifest,
  getDamageCalcCharDetail,         // (charId)
} from './chars'

export {
  getDamageCalcMonsters,
} from './monsters'

export {
  getDamageCalcAwakeningBuffs,
  getDamageCalcCharBuffs,          // (charId)
} from './buffs'

export {
  getDamageCalcTranscend,
} from './transcend'

export {
  getDamageCalcEquipment,
} from './equipment'

export {
  getDamageCalcMechanicsIndex,
  getDamageCalcMechanics,          // (monsterId)
} from './mechanics'
```

All getters return `Promise<T>`. The internal `_cache.ts` memoizes the
parsed JSON in module memory (process-local for SSR; per-tab for the
browser fetch helper).

```ts
// src/lib/data/damage-calc/_cache.ts
const cache = new Map<string, unknown>()

export async function readDamageCalcJson<T>(path: string): Promise<T> {
  if (cache.has(path)) return cache.get(path) as T
  const file = await fs.readFile(`public/damage-calc/${path}`, 'utf8')
  const parsed = JSON.parse(file) as T
  cache.set(path, parsed)
  return parsed
}
```

The browser-side equivalent is in `_lib/fetch-data.ts` — same shape,
uses `fetch()` instead of `fs.readFile`.

---

## 3. `manifest.json`

**Path.** `public/damage-calc/manifest.json`.
**Type.** `DamageCalcCharManifest`.

### 3.1 Schema

```ts
export interface DamageCalcCodexEntry {
  /** 0 = no codex; 1..11 = in-game Lv 1..Lv 11. */
  level: number
  /** %-bonus on base ATK (already converted from per-mille). */
  atkPct: number
  defPct: number
  hpPct: number
}

export type DamageCalcCharSummary = WithLocalizedFields<{
  id: string
  slug: string
  name: string
  element: string
  class: string
  subclass: string
  rarity: number
  role?: string                // 'dps' | 'support' | 'sustain'
  rank?: string                // 'S' | 'A' | 'B' | 'C' | 'D' | 'E'
  iconUrl: string
  /** CF chars: id of the base char they originate from. */
  baseCharId?: string
  /** Base chars: id of their CF variant if one exists. */
  coreFusionId?: string
}, 'name'>;

export interface DamageCalcCharManifest {
  _v: string
  chars: DamageCalcCharSummary[]
  /** Account-wide codex table (12 rows: Lv 0 → Lv 11). Char-agnostic. */
  codexTable: DamageCalcCodexEntry[]
}
```

### 3.2 Sample

```json
{
  "_v": "1",
  "chars": [
    {
      "id": "2000028",
      "slug": "maxwell",
      "name": "Maxwell",
      "element": "Dark",
      "class": "Mage",
      "subclass": "Wizard",
      "rarity": 3,
      "iconUrl": "/images/characters/atb/IG_Turn_2000028.webp",
      "name_jp": "マクスウェル",
      "name_kr": "맥스웰",
      "name_zh": "麦克斯威尔",
      "role": "dps",
      "rank": "S"
    },
    {
      "id": "2700037",
      "slug": "core-fusion-veronica",
      "name": "Core Fusion Veronica",
      "element": "Water",
      "class": "Defender",
      "subclass": "Sweeper",
      "rarity": 3,
      "iconUrl": "/images/characters/atb/IG_Turn_2700037.webp",
      "name_jp": "コアフュージョン ヴェロニカ",
      "name_kr": "코어 융합 베로니카",
      "name_zh": "核心融合 贝罗妮卡",
      "role": "sustain",
      "rank": "A",
      "baseCharId": "2000037"
    }
  ],
  "codexTable": [
    { "level": 0,  "atkPct": 0,   "defPct": 0,   "hpPct": 0   },
    { "level": 1,  "atkPct": 2,   "defPct": 0,   "hpPct": 0   },
    { "level": 2,  "atkPct": 2,   "defPct": 2,   "hpPct": 0   },
    { "level": 3,  "atkPct": 2,   "defPct": 2,   "hpPct": 4   },
    { "level": 4,  "atkPct": 4,   "defPct": 2,   "hpPct": 4   },
    { "level": 5,  "atkPct": 4,   "defPct": 4,   "hpPct": 4   },
    { "level": 6,  "atkPct": 4,   "defPct": 4,   "hpPct": 7   },
    { "level": 7,  "atkPct": 7,   "defPct": 4,   "hpPct": 7   },
    { "level": 8,  "atkPct": 7,   "defPct": 7,   "hpPct": 7   },
    { "level": 9,  "atkPct": 7,   "defPct": 7,   "hpPct": 10  },
    { "level": 10, "atkPct": 10,  "defPct": 7,   "hpPct": 10  },
    { "level": 11, "atkPct": 10,  "defPct": 10,  "hpPct": 10  }
  ]
}
```

### 3.3 Field semantics

- `id` — `CharacterTemplet.ID`. 7 digits, leading zeros preserved.
- `slug` — kebab-case derived from EN name. Stable. Used in URLs.
- `name` / `name_jp` / `name_kr` / `name_zh` — `WithLocalizedFields` shape
  (the EN value lives in `name`; other langs as `name_{lang}` siblings).
- `element` — display string (`Earth`, `Water`, `Fire`, `Light`, `Dark`).
  NOT the `CET_*` enum form. Maps from `CharacterTemplet.Element`.
- `class` — display string (`Striker`, `Defender`, `Mage`, `Ranger`,
  `Healer`). Maps from `CharacterTemplet.Class` after stripping `CCT_`
  prefix and renaming `PRIEST` → `Healer`.
- `subclass` — display string (`Wizard`, `Bruiser`, …). Maps directly
  from `CharacterTemplet.SubClass` (already without prefix).
- `rarity` — integer (1, 2, 3). Same as `BasicStar`.
- `iconUrl` — relative URL to the char's portrait icon.
- `role` / `rank` — curated metadata (NOT from datamine; from a separate
  curation file used by tier list / rankings). Optional.
- `baseCharId` / `coreFusionId` — derived from `CharacterFusionTemplet`.
  Each CF char points to its base; each base char with a CF points to it.
- `codexTable` — fixed 12 rows. Per-mille values from
  `CharacterArchiveStatTemplet` divided by 10 to give percentage.

### 3.4 Stability guarantees

- Char IDs never change.
- Slugs never change for existing chars (must be tracked across
  patches; the bake fails if a char's slug attempts to mutate).
- Order of `chars` array: alphabetical by `slug` (or by `id`, both
  acceptable — runtime sorts on demand).
- `codexTable` length is always 12 (Lv 0..11).

---

## 4. `chars/{charId}.json`

**Path.** `public/damage-calc/chars/{charId}.json`.
**Type.** `DamageCalcCharDetail`.

### 4.1 Schema

```ts
export type DamageCalcSkillDetail = WithLocalizedFields<{
  name: string
  iconName: string
  /** Index 0 = level 1, length 5. Null entries = no DamageFactor at that level. */
  damageFactors: (number | null)[]
  additionalAttackRatio: number | null
  /**
   * Level-keyed localized descriptions: `'1' | '1_jp' | '1_kr' | '1_zh' | '2' | ...`.
   * Lifted verbatim from curated `true_desc_levels`. Use `getSkillDescription`
   * with English fallback.
   */
  descLevels?: Record<string, string>
}, 'name'>;

export interface DamageCalcStatsStep {
  ATK: number; DEF: number; HP: number; SPD: number
  EFF: number; RES: number; CHC: number; CHD: number
  DMG_RED: number; DMG_INC: number
}

export type DamageCalcStatKey =
  | 'ATK' | 'DEF' | 'HP' | 'SPD'
  | 'CHC' | 'CHD' | 'EFF' | 'RES'
  | 'PEN' | 'DMG_INC'

export interface DamageCalcCharScalings {
  /** Stat the formula uses for the main multiplier. `'ATK'` for most chars;
   *  `'HP'` / `'DEF'` for swap-stat chars (Drakhan, base Veronica). */
  main: DamageCalcStatKey
  /** Additional stats this char's skills scale on. Excludes `main`. */
  secondaries: DamageCalcStatKey[]
}

export interface DamageCalcStatContribution {
  atk?: number; def?: number; hp?: number; spd?: number
  chc?: number; chd?: number
  pen?: number
  dmgInc?: number; dmgRed?: number
  eff?: number; res?: number
  atkPct?: number; defPct?: number; hpPct?: number
}

export interface DamageCalcNoGearStats {
  base: DamageCalcStatContribution
  evolution: DamageCalcStatContribution
  classPassive: DamageCalcStatContribution
  /** Keyed by transStar (string). Empty entries omitted. */
  skill8ByTransStar: Record<string, DamageCalcStatContribution>
  /**
   * Quirk groups exposed to settings — mirror in-game gift menu categories.
   *   - `element`: AAT_ELEMENTAL (always-on for the char's element)
   *   - `job`: AAT_CLASS + AAT_SUBCLASS (always-on)
   *   - `adventureLicense`: AwakeningType=ADVENTURE_LICENSE sub-nodes
   *     (mode-gated)
   *
   * UTILITY / PVE awakening sub-nodes are not surfaced here.
   */
  quirks: {
    element: DamageCalcStatContribution
    job: DamageCalcStatContribution
    adventureLicense: DamageCalcStatContribution
  }
}

export interface DamageCalcCharDetail {
  _v: string
  id: string
  skills: {
    S1: DamageCalcSkillDetail | null
    S2: DamageCalcSkillDetail | null
    S3: DamageCalcSkillDetail | null
    /** Burst Lv 1/2/3 — replace S3's DF + buff list. Gated by tier templet's
     *  `burst2` / `burst3` flags. Null when char has no burst variant. */
    B1: DamageCalcSkillDetail | null
    B2: DamageCalcSkillDetail | null
    B3: DamageCalcSkillDetail | null
  }
  /** Six evolution steps (`lv1_ev0` … `lv100_ev5`). Null when no curated stats. */
  baseStats: Record<string, DamageCalcStatsStep> | null
  scalings: DamageCalcCharScalings
  /** No-gear stat contributors — recomposed client-side via `computeFinalStats`. */
  noGearStats: DamageCalcNoGearStats
}
```

### 4.2 Sample (Maxwell, abridged)

```json
{
  "_v": "1",
  "id": "2000028",
  "skills": {
    "S1": {
      "name": "...",
      "iconName": "Skill_2000028_1",
      "damageFactors": [1010, 1080, 1140, 1200, 1260],
      "additionalAttackRatio": null,
      "descLevels": {
        "5":    "Attacks all enemies, dealing damage equal to 126% of ATK and ...",
        "5_jp": "...",
        "5_kr": "...",
        "5_zh": "..."
      }
    },
    "S2": { /* ... */ },
    "S3": { /* ... */ },
    "B1": { /* burst variant — null if no burst */ },
    "B2": null,
    "B3": null
  },
  "baseStats": {
    "lv1_ev0":   { "ATK": 86,  "DEF": 16,  "HP": 498,  "SPD": 124, "EFF": 1, "RES": 1, "CHC": 5, "CHD": 150, "DMG_RED": 0, "DMG_INC": 0 },
    "lv100_ev0": { "ATK": 861, "DEF": 167, "HP": 3433, "SPD": 124, "EFF": 1, "RES": 10, "CHC": 5, "CHD": 150, "DMG_RED": 0, "DMG_INC": 0 },
    "lv100_ev3": { "ATK": 919, "DEF": 167, "HP": 3573, "SPD": 124, "EFF": 1, "RES": 10, "CHC": 5, "CHD": 150, "DMG_RED": 0, "DMG_INC": 0 },
    "lv100_ev5": { /* ... */ }
  },
  "scalings": {
    "main": "ATK",
    "secondaries": []
  },
  "noGearStats": {
    "base":         { "atk": 861, "def": 167, "hp": 3433, "spd": 124, "eff": 10, "res": 100, "chc": 5, "chd": 150 },
    "evolution":    { "atk": 217, "hp": 853,  "eff": 100 },
    "classPassive": { "atkPct": 10 },
    "skill8ByTransStar": {
      "1": {},  "2": {}, "3": {}, "4": {}, "5": {},
      "6": { "hpPct": 10 },
      "7": { "hpPct": 10 }, "8": { "hpPct": 10 }, "9": { "hpPct": 10 }
    },
    "quirks": {
      "element":          { "atkPct": 5, "hpPct": 5 },
      "job":              { "atkPct": 5, "chc": 2 },
      "adventureLicense": { "atkPct": 0 }
    }
  }
}
```

### 4.3 Field semantics

#### `skills`

Always 6 keys (`S1`/`S2`/`S3`/`B1`/`B2`/`B3`), each `DamageCalcSkillDetail | null`:

- `S1` / `S2` / `S3` — main skills. Read from `CharacterTemplet.Skill_1/2/3`,
  joined with `CharacterSkillLevelTemplet`. `null` if a char doesn't have
  the slot (rare).
- `B1` / `B2` / `B3` — burst variants. Read from `Skill_19/20/21`. `null`
  for chars without burst skills (most chars don't have any).
- `damageFactors` — array of length 5 (one per skill level 1..5). `null`
  entries when a level has no `DamageFactor`. Per-mille (already int).
- `additionalAttackRatio` — per-mille; `null` when absent. Drives the
  optional sub-attack toggle in the UI.
- `descLevels` — keyed by `level` and `level_lang` (`"5"`, `"5_jp"`,
  `"5_kr"`, `"5_zh"`). EN under bare key. Curated text — falls back to
  the auto-generated description if absent.

#### `baseStats`

Optional curated lookup table for char stats at specific (level,
evolution) combos. Format: keys like `lv1_ev0`, `lv100_ev3`, `lv100_ev5`.
The runtime ignores this when `noGearStats` is present (preferred).
Kept for legacy compat / debug display.

#### `scalings`

What stat keys the engine highlights for the user. The damage formula
itself reads `ATK` from the user input; `scalings.main` tells the UI
"this char is HP-scaling, prompt for HP". Examples:
- Most chars: `{ main: 'ATK', secondaries: [] }`.
- Drakhan: `{ main: 'HP', secondaries: [] }` (swap-stat ATK ← HP).
- base Veronica: `{ main: 'HP', secondaries: [] }`.
- Demiurge Stella: `{ main: 'ATK', secondaries: ['HP'] }` (HP-scaling
  sub-attack via `BT_DMG_TARGET_STAT`).
- Regina: `{ main: 'ATK', secondaries: ['CHC'] }`.

The `secondaries` list drives which extra stat inputs the UI shows
under the main ATK field.

#### `noGearStats`

The five-layer stat contributor model. The runtime composes them:

```ts
function computeFinalStats(
  noGearStats: DamageCalcNoGearStats,
  settings: SettingsState,
  transStar: number,
  codexLevel: number,
): DamageCalcStatsStep
```

Layers, in order:

1. **`base`** — Lv 100 raw stats from `CharacterTemplet`.
2. **`evolution`** — sum of `CharacterEvolutionStatTemplet` rows up to
   evolution 6 (the Lv 100 cap). Anything beyond is gated by Lv > 100
   (not modeled).
3. **`classPassive`** — `Skill_22` (or `Skill_23` for CF chars) class
   passive stats. Always-on.
4. **`skill8ByTransStar[transStar]`** — `Skill_8` upgrades. Empty
   entries omitted; runtime falls back to `{}` if the user's transStar
   has no entry.
5. **`quirks.element` / `.job` / `.adventureLicense`** — applied
   conditionally based on the user's quirks toggles. Each is a
   `DamageCalcStatContribution` aggregating all qualifying awakening
   nodes for the char's (element, class, subclass).

Stacking math: see `02-formula.md` §12 (Model B). The composer
returns a final `DamageCalcStatsStep` with all 10 stat axes filled.

### 4.4 Why per-char files

The detail file is loaded only when the user picks the char. With ~120
chars × ~30 KB each, the bake is ~3.6 MB total but only one file is
fetched per session. Keeps cold-load fast; switching chars triggers a
single 30 KB fetch.

---

## 5. `monsters.json`

**Path.** `public/damage-calc/monsters.json`.
**Type.** `DamageCalcMonstersFile`.

### 5.1 Schema

```ts
export interface DamageCalcLangDict {
  en: string
  jp: string
  kr: string
  zh: string
}

export interface DamageCalcMonsterStats {
  atk: number; def: number; hp: number; spd: number
  chc: number             // % (per-mille ÷ 10)
  chd: number             // %
  pen: number             // %
  dmgInc: number          // %
  dmgRed: number          // %
  eff: number             // flat int (raw BuffChance, in-game displayed)
  res: number             // flat int (raw BuffResist)
}

export interface DamageCalcMonsterEntry {
  monsterId: string
  faceIconId: string                      // → /images/characters/boss/portrait/MT_{faceIconId}.webp
  name: DamageCalcLangDict
  type: string                            // CT_BOSS_MONSTER / CT_MONSTER / etc.
  isBoss: boolean
  class: string                           // display string, post-rename
  element: string                         // Fire/Water/Earth/Light/Dark
  subClass: string
  basicStar: number                       // 1/2/3 (drives portrait star overlay)
  level: number                           // spawn level — drives stat interp
  stats: DamageCalcMonsterStats
  position: number                        // wave index (SpawnID_Pos{position})
  slot: number                            // slot within spawn group (0..3)
}

export interface DamageCalcWaveEntry {
  position: number
  monsters: DamageCalcMonsterEntry[]
}

export interface DamageCalcStageEntry {
  /** Stable id — DungeonTemplet.ID for plain stages,
   *  `${dungeonId}@al${alLevel}` for AL tier expansion. */
  id: string
  name: DamageCalcLangDict
  chapter: DamageCalcLangDict | null      // story-only
  season: number | null                   // story-only
  episodeNum: number | null               // story-only
  stageNum: number | null                 // story-only (e.g. 12 for "1-12")
  recommendLevel: number
  waves: DamageCalcWaveEntry[]
  /** AL tier (1..10) when this stage is an AL expansion. Undefined otherwise. */
  alLevel?: number
}

export interface DamageCalcModeEntry {
  mode: string                            // raw DungeonMode token (DM_*)
  label: DamageCalcLangDict               // localized mode label
  stages: DamageCalcStageEntry[]
}

export interface DamageCalcMonstersFile {
  _v: string
  modes: DamageCalcModeEntry[]
}
```

### 5.2 Sample (abridged)

```json
{
  "_v": "1",
  "modes": [
    {
      "mode": "DM_ADVENTURE_MISSION",
      "label": {
        "en": "Weekly Conquest",
        "jp": "週間制圧",
        "kr": "주간 정복",
        "zh": "每周征伐"
      },
      "stages": [
        {
          "id": "70600101@al1",
          "name": { "en": "Demiurge Astei", "jp": "...", "kr": "...", "zh": "..." },
          "chapter": null,
          "season": null,
          "episodeNum": null,
          "stageNum": null,
          "recommendLevel": 100,
          "alLevel": 1,
          "waves": [
            {
              "position": 0,
              "monsters": [
                {
                  "monsterId": "...",
                  "faceIconId": "...",
                  "name": { "en": "Ksai", "jp": "...", "kr": "...", "zh": "..." },
                  "type": "CT_BOSS_MONSTER",
                  "isBoss": true,
                  "class": "Mage",
                  "element": "Dark",
                  "subClass": "Wizard",
                  "basicStar": 3,
                  "level": 100,
                  "stats": {
                    "atk": 2626,
                    "def": 1030,
                    "hp": 655539,
                    "spd": 100,
                    "chc": 5,
                    "chd": 150,
                    "pen": 0,
                    "dmgInc": 0,
                    "dmgRed": 30,
                    "eff": 10,
                    "res": 100
                  },
                  "position": 0,
                  "slot": 0
                }
              ]
            }
          ]
        },
        { "id": "70600101@al8",  "alLevel": 8,  "level": 140, "...": "..." },
        { "id": "70600101@al9",  "alLevel": 9,  "level": 150, "...": "..." },
        { "id": "70600101@al10", "alLevel": 10, "level": 160,
          "waves": [{ "position": 0, "monsters": [{
            "monsterId": "...",
            "stats": {
              "atk": 10714,    /* with SpawnAdvantageRate_Atk applied */
              "def": 4989,    /* with SpawnAdvantageRate_Def applied */
              "...": "..."
            }
          }]}]
        }
      ]
    },
    {
      "mode": "DM_NORMAL",
      "label": { "en": "Story (Normal)", "...": "..." },
      "stages": [ /* ~hundreds of story stages */ ]
    }
  ]
}
```

### 5.3 AL tier expansion

For Adventure License modes, the bake **expands each AL dungeon's
tiers into independent stages**. Composite ID format:

```
{DungeonTemplet.ID}@al{AdventureDungeonTemplet.Level}
```

Each tier has:
- Its own `level` (per `DungeonLevel` from `AdventureDungeonTemplet`).
- Its own `stats` (per-tier `BossHP` override + per-tier
  `SpawnAdvantageRate_*` applied via `interpolateRated`).
- Its own `recommendLevel` (matches the tier's `level`, so the picker
  sorts naturally by difficulty).

**Stage label** in the picker: `"Demiurge Astei AL Lv 8"` (or similar
— UI builds from base name + alLevel).

This is the **Ksai bug fix**: pre-fix, all tiers shared the parent
dungeon's stats, so high-tier obs diverged. Post-fix, each tier
carries its own bake.

### 5.4 Stat interpolation at bake time

For each monster slot, the bake applies:

```ts
const advAtk = adventureRow?.SpawnAdvantageRate_Atk ?? 0
const advDef = adventureRow?.SpawnAdvantageRate_Def ?? 0
const advSpd = adventureRow?.SpawnAdvantageRate_Spd ?? 0

stats.atk = interpolateRated(monster.Atk_Min, monster.Atk_Max, level, advAtk)
stats.def = interpolateRated(monster.Def_Min, monster.Def_Max, level, advDef)
stats.spd = interpolateRated(monster.Speed_Min, monster.Speed_Max, level, advSpd)
stats.hp  = adventureRow?.BossHP   /* per-tier override */
         ?? interpolateRated(monster.HP_Min, monster.HP_Max, level, 0)
```

The advantage rate is **per-mille signed** — `+400` is +40%, `−574` is
−57.4%. Mostly applies on AL high tiers (boost) and select raid bosses
(reduction).

---

## 6. `buffs/awakening.json` + `buffs/{charId}.json`

**Paths.** `public/damage-calc/buffs/awakening.json`,
`public/damage-calc/buffs/{charId}.json`.
**Types.** `DamageCalcAwakeningBuffs`, `DamageCalcCharBuffs`.

### 6.1 Schemas

```ts
export interface DamageCalcAwakeningBuffs {
  _v: string
  buffs: ApplicableBuff[]
}

export interface DamageCalcCharBuffs {
  _v: string
  charId: string
  buffs: ApplicableBuff[]
}
```

`ApplicableBuff` is the engine's canonical buff shape, extracted from
the datamine at bake time.

### 6.2 `ApplicableBuff` schema

```ts
export interface ApplicableBuff {
  id: string                              // e.g. "awak:121", "char:2000022:S2:2000022_2_2", "ee:2000028:level5"
  source: BuffSource
  appliesTo: BuffAppliesTo
  effect: BuffEffect
  trigger: BuffTrigger
  ui?: BuffUI
}

interface BuffSource {
  kind: 'awakening' | 'char_skill' | 'ee'
  /** For 'char_skill' / 'ee' — the char this buff is bound to. Awakening buffs are char-agnostic. */
  charId?: string
  /** For 'awakening' — the AwakeningType group (ELEMENTAL, JOB, UTILITY, PVE, ADVENTURE_LICENSE, SKILL8). */
  group?: 'ELEMENTAL' | 'JOB' | 'UTILITY' | 'PVE' | 'ADVENTURE_LICENSE' | 'SKILL8'
  /** For 'awakening' — the qualifying scope (used for further filter). */
  applyType?: 'AAT_ELEMENTAL' | 'AAT_CLASS' | 'AAT_SUBCLASS' | 'AAT_NONE'
  applyValue?: number
}

interface BuffAppliesTo {
  kind: 'class' | 'element' | 'subclass' | 'pve' | 'all'
  value: string | number | null
}

interface BuffEffect {
  target:
    | 'pool'                 // BT_DMG (always-on additive)
    | 'pool_cond'            // BT_DMG_OWNER_HPRATE_UNDER, BT_DMG_TARGET_BUFF, ...
    | 'atk_pct' | 'atk_flat'
    | 'def_pct' | 'def_flat'
    | 'hp_pct'  | 'hp_flat'
    | 'spd_flat'
    | 'chc' | 'chd' | 'pen'
    | 'dmg_inc' | 'dmg_red'
    | 'eff' | 'res'
    | 'monster_eff' | 'monster_res'        // PVE caster debuffs
    | 'scaling_swap'                       // BT_SWAP_STAT_ATTACK
    | 'scaling_add_pct' | 'scaling_add_flat'
    | 'scaling_target_stat'                // BT_DMG_TARGET_STAT (Noa S2)
    | 'final_reduce_max'                   // BT_DMG_REDUCE_FINAL
  /** When `target === 'pool_cond'`, the runtime context the value depends on. */
  poolCondition?: PoolCondition
  /** When `target` is a scaling effect, the stat the buff scales on (ST_HP/ST_DEF/ST_*). */
  statKey?: string
  amount: number                           // signed (% for pool, permille for scaling, etc.)
  unit: '%' | 'permille' | 'flat'
  /** EE buffs: per-level value override. Length 11 (Lv 0..10); used when `source.kind === 'ee'`. */
  eeLevelValues?: number[]
}

type PoolCondition =
  | 'owner_hp_under'         // BuffConditionType: OWNER_HPRATE_UNDER
  | 'owner_hp_over'
  | 'target_hp_under'
  | 'target_hp_over'
  | 'caster_hp_under'
  | 'owner_buff_count'
  | 'target_buff_count'
  | 'owner_debuff_count'
  | 'target_debuff_count'
  | 'target_break'
  | 'kill_count_stack'
  | 'team_buff_count'
  | 'team_decrease_count'
  | 'enemy_team_decrease_count'
  | 'in_monad_gate'
  | 'in_tower'
  | 'in_pvp'
  | 'caster_def_up'
  | 'owner_resource_max'

interface BuffTrigger {
  /** What context state must be true for the buff to apply. */
  requires: 'always' | 'boss' | 'crit' | 'adv' | 'disadv' | 'neutral'
  /** Caller skill slot — restricts which slot triggers the buff. */
  callerSlots: 'all' | ('S1' | 'S2' | 'S3')[]
}

interface BuffUI {
  name?: LangMap                          // localized label (UI display)
  desc?: LangMap                          // localized description
  defaultEnabled?: boolean
  maxLevel?: number
}
```

### 6.3 Sample (awakening.json)

```json
{
  "_v": "1",
  "buffs": [
    {
      "id": "awak:Awakening_Boss_Dmg_10",
      "source": {
        "kind": "awakening",
        "group": "PVE",
        "applyType": "AAT_NONE"
      },
      "appliesTo": { "kind": "all", "value": null },
      "effect": { "target": "pool", "amount": 30, "unit": "%" },
      "trigger": { "requires": "boss", "callerSlots": "all" },
      "ui": {
        "name": { "en": "Boss Damage", "jp": "...", "kr": "...", "zh": "..." },
        "defaultEnabled": true,
        "maxLevel": 10
      }
    },
    {
      "id": "awak:MAGE_PASSIVE_3_10",
      "source": { "kind": "awakening", "group": "JOB", "applyType": "AAT_CLASS", "applyValue": 4 },
      "appliesTo": { "kind": "class", "value": "Mage" },
      "effect": { "target": "pool", "amount": 12, "unit": "%" },
      "trigger": { "requires": "always", "callerSlots": "all" },
      "ui": {
        "name": { "en": "Mage Class Damage", "...": "..." },
        "defaultEnabled": true
      }
    },
    {
      "id": "awak:Awakening_Element_Dmg_Dark_Light_10",
      "source": { "kind": "awakening", "group": "ELEMENTAL", "applyType": "AAT_ELEMENTAL", "applyValue": 3 },
      "appliesTo": { "kind": "element", "value": "Light" },
      "effect": { "target": "pool", "amount": 30, "unit": "%" },
      "trigger": { "requires": "always", "callerSlots": "all" }
    }
  ]
}
```

### 6.4 Sample (`buffs/2000022.json` — Noa)

```json
{
  "_v": "1",
  "charId": "2000022",
  "buffs": [
    {
      "id": "char:2000022:S2:2000022_2_2",
      "source": { "kind": "char_skill", "charId": "2000022" },
      "appliesTo": { "kind": "all", "value": null },
      "effect": {
        "target": "scaling_target_stat",
        "statKey": "ST_HP",
        "amount": 30,
        "unit": "permille"
      },
      "trigger": { "requires": "always", "callerSlots": ["S2"] }
    }
  ]
}
```

### 6.5 The split

- **`awakening.json`** — char-agnostic. Loaded once at app boot. ~80 KB
  (compressed ~12 KB). Contains every awakening + class-passive buff
  entry; runtime filters by `appliesTo` (element / class / subclass).
- **`buffs/{charId}.json`** — per-char. Loaded on char pick alongside
  the char detail file. ~5-15 KB each. Contains only `char_skill` and
  `ee` buffs whose `source.charId` matches.
- **CF chars** load their own char-skill buffs PLUS the **base char's
  EE** buffs (since CF chars wear the base's EE in-game). The bake's
  `buffs/{cfCharId}.json` includes both sets.

### 6.6 Loading flow

```ts
// On app boot:
const awakening = await getDamageCalcAwakeningBuffs()  // single fetch

// On char pick:
const charDetail = await getDamageCalcCharDetail(charId)
const charBuffs  = await getDamageCalcCharBuffs(charId)

// Compose:
const allBuffs = [...awakening.buffs, ...charBuffs.buffs]

// Pass to recompute:
const result = recompute(ctx, allBuffs)
```

The reducer (`applyBuffs`) further filters by `BuffContext` (the
runtime trigger states).

---

## 7. `transcend.json`

**Path.** `public/damage-calc/transcend.json`.
**Type.** `DamageCalcTranscendFile`.

### 7.1 Schema

```ts
export interface DamageCalcTranscendTier {
  transStar: number
  /** Per-mille (templet `RewardHPRate`). 100 → +10%. */
  hpRate: number
  atkRate: number
  defRate: number
  /** True when this tier unlocks Burst Lv 2 / 3 on the char's S3. */
  burst2: boolean
  burst3: boolean
}

export interface DamageCalcTranscendTeamBonus {
  /** Stat key per data/stats.json (e.g. 'ATK', 'SPD', 'DMG UP%'). */
  stat: string
  /** Magnitude in display units. */
  value: number
  /** 'rate' = % bonus on dealer ATK/DEF/HP. 'add' = additive (flat or
   *  percentage-points depending on the stat). */
  apply: 'rate' | 'add'
  /** TransStar at which this version activates (cumulative — runtime
   *  picks max `fromTransStar` ≤ user's transStar). */
  fromTransStar: number
}

export interface DamageCalcTranscendCharEntry {
  basicStar: number                        // 1, 2, or 3
  tiers: DamageCalcTranscendTier[]
  /** Stat keys this char grants to allies via transcend. */
  teamBonuses?: string[]
  teamBonusesByTier?: DamageCalcTranscendTeamBonus[]
}

export interface DamageCalcTranscendFile {
  _v: string
  byChar: Record<string, DamageCalcTranscendCharEntry>
}
```

### 7.2 Sample

```json
{
  "_v": "1",
  "byChar": {
    "2000028": {
      "basicStar": 3,
      "tiers": [
        { "transStar": 4, "hpRate": 50, "atkRate": 50, "defRate": 50, "burst2": false, "burst3": false },
        { "transStar": 5, "hpRate": 75, "atkRate": 75, "defRate": 75, "burst2": false, "burst3": false },
        { "transStar": 6, "hpRate": 100, "atkRate": 100, "defRate": 100, "burst2": true, "burst3": false },
        { "transStar": 7, "hpRate": 130, "atkRate": 130, "defRate": 130, "burst2": true, "burst3": false },
        { "transStar": 8, "hpRate": 160, "atkRate": 160, "defRate": 160, "burst2": true, "burst3": false },
        { "transStar": 9, "hpRate": 200, "atkRate": 200, "defRate": 200, "burst2": true, "burst3": true }
      ],
      "teamBonuses": ["ATK", "CHC"],
      "teamBonusesByTier": [
        { "stat": "ATK", "value": 5,  "apply": "rate", "fromTransStar": 4 },
        { "stat": "ATK", "value": 10, "apply": "rate", "fromTransStar": 6 },
        { "stat": "CHC", "value": 5,  "apply": "add",  "fromTransStar": 6 }
      ]
    }
  }
}
```

### 7.3 Field semantics

- `basicStar` — char's base rarity. Tiers run from `basicStar + 1` up
  to 9 (the max). 3-star chars get tiers 4..9; 2-star chars get 5..9
  (after their initial 4-star upgrade); etc.
- `tiers[].atkRate` / `hpRate` / `defRate` — per-mille values added at
  this tier (cumulative — the runtime sums tiers up to the user's
  selected `transStar`).
- `burst2` / `burst3` — flags driving B1/B2/B3 skill availability.
- `teamBonuses` — flat list of stat keys (display strings). For tier
  list / filter UI; the calc itself uses `teamBonusesByTier`.
- `teamBonusesByTier` — per-stat upgrade ladder. Multiple entries per
  stat when the buff scales with tier (e.g., ATK +5% at T4 → +10% at
  T6 → +20% at T9). Runtime picks max `fromTransStar ≤ transStar` per
  stat.

### 7.4 Cumulative vs incremental

`tiers[].atkRate` is **cumulative** in the bake — at T6, the full
+10% (100 per-mille) is in the row, not the +25 step from T5 to T6.
The runtime reads the **single** row matching `transStar` and applies
its rates directly.

---

## 8. `equipment.json`

**Path.** `public/damage-calc/equipment.json`.
**Type.** `DamageCalcEquipmentFile`.

### 8.1 Schema

```ts
export interface DamageCalcBuffEntry {
  buffId: string
  type: string                            // BuffTemplet.Type (BT_DMG, BT_DMG_TARGET_STAT, ...)
  values: number[]                        // per-level scaling (idx 0 = lv 1, idx N-1 = max)
  statType?: string
  applyingType?: string
  targetType?: string
  buffCreateType?: string
  buffConditionType?: string
  buffConditionValue?: string
  callerSkillType?: string
  targetSkillType?: string
  turnDuration?: number
}

export interface DamageCalcEffectGroup {
  name?: LangMap                          // localized passive label
  iconName?: string                       // /images/ui/effect/{iconName}.webp
  /** EE main stats: target element (Earth/Water/Fire/Light/Dark). Absent otherwise. */
  targetElement?: string
  buffs: DamageCalcBuffEntry[]
}

export interface DamageCalcEquipmentItem {
  id: string                              // ItemTemplet ID of 6★ variant (5★ if no 6★)
  name: LangMap
  iconName?: string
  classLimit?: string                     // CCT_ATTACKER, CCT_DEFENDER, ... when restricted
  effect: DamageCalcEffectGroup | null
}

export interface DamageCalcEquipmentSet {
  id: string                              // GroupID from ItemSpecialOptionTemplet
  name: LangMap
  iconName?: string
  bonus2: DamageCalcEffectGroup | null
  bonus4: DamageCalcEffectGroup | null
}

export interface DamageCalcEquipmentEE {
  charId: string
  name: LangMap
  iconName?: string                       // /images/characters/ee/{charId}.webp
  /** Element-conditional main stat (e.g. -DMG vs Earth). 11 enchant levels (0..10). */
  mainStat: DamageCalcEffectGroup | null
  /** Baseline passive (always active). */
  passiveLv0: DamageCalcEffectGroup | null
  /** Additional passive unlocked at EE level 10. */
  passiveLv10: DamageCalcEffectGroup | null
}

export interface DamageCalcTalismanMainStat {
  stat: string                            // 'ATK%' / 'CHC' / etc. per data/stats.json
  apply: 'rate' | 'add'
  /** Per-rarity values per enchant level. */
  byRarity: { '4': number[]; '5': number[]; '6': number[] }
}

export interface DamageCalcEquipmentFile {
  _v: string
  weapons: DamageCalcEquipmentItem[]
  accessories: DamageCalcEquipmentItem[]
  talismans: DamageCalcEquipmentItem[]
  sets: DamageCalcEquipmentSet[]
  ees: Record<string, DamageCalcEquipmentEE>          // keyed by charId
  talismanMainStats: DamageCalcTalismanMainStat[]
}
```

### 8.2 Sample (Maxwell EE, abridged)

```json
{
  "ees": {
    "2000028": {
      "charId": "2000028",
      "name": { "en": "Maxwell's Eternal Reverie", "...": "..." },
      "iconName": "EE_2000028",
      "mainStat": {
        "name": { "en": "DMG taken from Earth ↓", "...": "..." },
        "iconName": "EE_MainStat_DamageReduce_Earth",
        "targetElement": "Earth",
        "buffs": [{
          "buffId": "EE_MainStat_DMGRed_Earth",
          "type": "BT_DMG_REDUCE",
          "values": [0, 5, 8, 10, 12, 15, 18, 20, 22, 25, 30],
          "buffConditionType": "TARGET_ELEMENT",
          "buffConditionValue": "0"
        }]
      },
      "passiveLv0": {
        "name": { "en": "Eternal Slumber", "...": "..." },
        "iconName": "EE_Passive_Eternal",
        "buffs": [{
          "buffId": "...",
          "type": "BT_DMG",
          "values": [10],
          "buffConditionType": "TARGET_HPRATE_UNDER",
          "buffConditionValue": "30"
        }]
      },
      "passiveLv10": {
        "name": { "en": "Awakened Slumber", "...": "..." },
        "buffs": [{ /* extra +X% pool at Lv 10 */ }]
      }
    }
  }
}
```

### 8.3 EE buff resolution

- `mainStat.buffs[N].values` — array of length 11 (Lv 0..10). Runtime
  picks `values[eeLevel]` for the contribution amount.
- `passiveLv0.buffs[N].values` — usually length 1 (single value, no
  enchant). Always-on at any EE level ≥ 0.
- `passiveLv10.buffs[N].values` — usually length 1. Only fires when
  `eeLevel === 10`.

The reducer's `eeLevel` field gates passive Lv 10 and selects the
mainstat per-level value.

### 8.4 Stat sets

Sets that contribute ONLY to gear stat aggregation (not buffs) are
**filtered out** at bake time — their effect is already in the user's
typed stat block. The bake keeps only buff-bearing sets (e.g.,
"Counter Attack" sets that fire `BT_DMG`).

---

## 9. `mechanics/_index.json` + `mechanics/{monsterId}.json`

**Paths.** `public/damage-calc/mechanics/_index.json`,
`public/damage-calc/mechanics/{monsterId}.json`.
**Types.** `DamageCalcMechanicsIndex`, `DamageCalcMechanicsFile`.

### 9.1 Schemas

```ts
export interface DamageCalcMechanicsIndex {
  _v: string
  monsterIds: string[]                    // monsters with non-empty mechanics
}

// MonsterMechanics is defined in `src/lib/damage/v2/extract-monster.ts`:
export interface MonsterMechanics {
  monsterId: string
  passives: BossPassive[]
}

export interface BossPassive {
  skillId: string                         // boss passive skill id
  name: LangMap
  iconName?: string
  description: LangMap
  defaultActive: boolean
  /** Buffs the passive emits when active — fed into the reducer as
   *  defender BT_DMG_REDUCE / final_reduce. */
  buffs: ApplicableBuff[]
}

export interface DamageCalcMechanicsFile {
  _v: string
  data: MonsterMechanics
}
```

### 9.2 Sample

```json
{
  "_v": "1",
  "data": {
    "monsterId": "...",
    "passives": [
      {
        "skillId": "132408",
        "name": { "en": "Prelude of the Waning Crescent", "...": "..." },
        "iconName": "Mechanic_Amadeus_Prelude",
        "description": {
          "en": "Decreases damage taken from Fire/Water/Earth, increases from Light/Dark.",
          "...": "..."
        },
        "defaultActive": true,
        "buffs": [
          {
            "id": "boss-mech:132408:5_2",
            "source": { "kind": "char_skill" },
            "appliesTo": { "kind": "all", "value": null },
            "effect": { "target": "dmg_red", "amount": 50, "unit": "%" },
            "trigger": { "requires": "always", "callerSlots": "all" }
          }
        ]
      },
      {
        "skillId": "enrage",
        "name": { "en": "Enrage (HP < 30%)", "...": "..." },
        "defaultActive": false,
        "buffs": [
          { /* Reduced Damage Taken when enraged */ }
        ]
      }
    ]
  }
}
```

### 9.3 Lazy loading

- `_index.json` lists every `monsterId` with at least one passive.
  Loaded once on app boot (~1 KB).
- Per-monster file fetched only when the user picks a target whose
  `monsterId` is in the index. Avoids per-row 404 probes.
- The picker shows a "boss mechanics available" badge on monsters in
  the index.

### 9.4 Built-in default mechanics

The bake currently knows about Amadeus Prelude (per-stage variants).
Other bosses are added on demand as they get observed and calibrated.

---

## 10. Versioning

Every file has `_v: string`. When the bake schema changes:

1. **Bump `_v` everywhere it lives.** All bakers must agree on a
   compatible version.
2. **Reader logs a console warning** when the `_v` doesn't match the
   compile-time expectation. Doesn't crash.
3. **Browsers caching the stale file** auto-refresh on the next
   service-worker turnover (~24h). A breaking schema change should be
   accompanied by a Service Worker cache version bump.
4. **`localStorage` form state** is independent. Use a separate `vN`
   suffix on the storage key — see `05-ui-contract.md` §8.

### 10.1 Migration policy

**No live migration.** When `_v` mismatches:
- The reader returns the parsed file as-is (typed at compile time).
- Code that expects newer fields uses `??` defaults / optional chaining.
- The pipeline must keep emitting both shapes during a transition
  period if rolling out incrementally.

If a breaking-only change is unavoidable, ship the new bake with a
version bump + a forced bake re-build before merging.

---

## 11. Pipeline structure

The pipeline lives at `pipeline/steps/damage-calc/` and exposes a
single `index.ts` orchestrator:

```ts
// pipeline/steps/damage-calc/index.ts
import { buildChars }    from './build-chars'
import { buildMonsters } from './build-monsters'
import { buildBuffs }    from './build-buffs'
import { buildTranscend } from './build-transcend'
import { buildEquipment } from './build-equipment'
import { buildMechanics } from './build-mechanics'

const _v = '1'

export async function buildDamageCalc(): Promise<void> {
  const raw = await loadAllRawTemplets()         // memoized lazy loader

  await Promise.all([
    buildChars(raw, _v),                          // → manifest.json + chars/{id}.json
    buildMonsters(raw, _v),                       // → monsters.json
    buildBuffs(raw, _v),                          // → buffs/awakening.json + buffs/{id}.json
    buildTranscend(raw, _v),                      // → transcend.json
    buildEquipment(raw, _v),                      // → equipment.json
    buildMechanics(raw, _v),                      // → mechanics/*
  ])
}
```

### 11.1 Cadence

The pipeline is offline (Node script). Triggered:

- Manually after a game patch (typical cadence: every 1-3 weeks).
- In CI on `data/admin/json2/` PR changes.

The output is committed to git (`public/damage-calc/`). It is NOT
generated at `next build` time — `next build` would be much slower.

### 11.2 Idempotency

Each builder is a pure function `(raw, _v) → JsonOutput`. Re-running
on the same inputs produces byte-identical files. CI sanity-checks
this — any non-deterministic ordering (e.g., `Object.entries` on a
Map without sort) is rejected.

### 11.3 Bake size budget

| File | Approx size (gzipped) | Cold-load impact |
|---|---|---|
| `manifest.json` | ~25 KB | Fetched at app boot |
| `monsters.json` | ~110 KB | Fetched at app boot |
| `buffs/awakening.json` | ~12 KB | Fetched at app boot |
| `transcend.json` | ~15 KB | Fetched at app boot |
| `equipment.json` | ~50 KB | Fetched at app boot |
| `mechanics/_index.json` | ~1 KB | Fetched at app boot |
| `chars/{id}.json` | ~5-8 KB each | Lazy on char pick |
| `buffs/{id}.json` | ~2-5 KB each | Lazy on char pick |
| `mechanics/{id}.json` | ~3 KB each | Lazy on boss-with-mech pick |

**Total cold-load**: ~210 KB gzipped. Budget cap: 300 KB (see
`00-overview.md` §6.7).

---

## 12. CDN / SW caching

The bake files are served as static assets by Next.js. Recommended
cache-control:

- `manifest.json` / `monsters.json` / `buffs/awakening.json` /
  `transcend.json` / `equipment.json`: `public, max-age=300, stale-while-revalidate=86400`
  (5-min cache, day SWR — bake updates propagate within 5 min).
- `chars/{id}.json` / `buffs/{id}.json` / `mechanics/{id}.json`:
  `public, max-age=86400, stale-while-revalidate=604800` (more
  cacheable since they change rarely beyond major char additions).

The site's service worker (`/sw.js`) precaches `manifest.json` and
`monsters.json` on install. Other files are runtime-cached as
needed. SW cache name is bumped on every deploy via
`scripts/set-version.js` — see CLAUDE.md.

---

## 13. Data integrity invariants

Hard invariants the bake MUST maintain:

1. **Every char in `manifest.chars[]`** has a corresponding
   `chars/{charId}.json` file. The reverse is also true.
2. **Every CF char in `manifest.chars[]`** with `baseCharId` set MUST
   have its base char also in the manifest, and the base char MUST
   have `coreFusionId` pointing back.
3. **Every char in `transcend.json.byChar`** is a key in the
   manifest. (Some chars may have `null` transcend tiers — no
   transcend yet — but the entry exists with empty `tiers: []`.)
4. **Every mode in `monsters.json.modes[]`** has a non-empty `stages[]`.
   Empty modes are filtered out of the bake.
5. **AL stage IDs** match `^\d+@al\d+$` regex.
6. **`monsters[].faceIconId`** corresponds to an existing portrait
   under `public/images/characters/boss/portrait/`.
7. **`chars[].iconUrl`** corresponds to an existing icon under
   `public/images/characters/atb/`.
8. **Every buff in `awakening.json.buffs[]`** has a matching `BuffTemplet`
   row at bake time (no orphan IDs).
9. **All localized fields** have at least the `en` variant (other
   langs may be empty strings, but never undefined/null).

CI runs an integrity test that asserts each invariant on every PR.

---

End of bake contract. Continue to `04-runtime-model.md`.
