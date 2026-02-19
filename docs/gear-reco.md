# Gear Recommendations — Data Format

## Overview

Each character's gear recommendation is stored in `data/reco/{characterId}.json`.
Presets (reusable templates) are defined in `data/reco/_presets.json`.

The pipeline step `validate-reco` checks every reco file against equipment data.

```
data/reco/
├── _presets.json        # Shared presets (talismans, sets, substats)
├── 2000006.json         # One file per character ID
├── 2000008.json
└── ...
```

---

## File structure

A reco file is a JSON object where each key is a **build name** and each value is a `RecoBuild`:

```json
{
  "Build Name": {
    "Weapon": [...],
    "Amulet": [...],
    "Set": [...],
    "Talisman": [...],
    "SubstatPrio": "...",
    "Note": "..."
  },
  "Alt Build": { ... }
}
```

All fields are optional.

---

## Fields

### Weapon / Amulet

Array of equipment entries. `name` must match a name in `data/equipment/weapon.json` or `data/equipment/accessory.json`. `mainStat` is optional; when present it is validated against the item's `mainStats` list. Use `/` to declare multiple acceptable main stats.

```json
"Weapon": [
  { "name": "Snow-white Embrace", "mainStat": "DEF%" },
  { "name": "Gorgon's Wrath [Defender]", "mainStat": "HP%/DEF%" }
]
```

### Set

Array of **set combos**. Each element is either:
- An **inline combo** — array of `{ name, count }` objects
- A **preset key** — plain string referencing `_presets.json`

```json
"Set": [
  "s4",
  [{ "name": "Speed", "count": 2 }, { "name": "Swiftness", "count": 2 }]
]
```

Set names use the **short form** (without " Set" suffix): `"Speed"`, not `"Speed Set"`.

> A preset key is a plain string (no `$` prefix). The resolver distinguishes preset keys from inline combos by type: `string` = preset, `array` = inline.

### Talisman

Either:
- An **inline array** of talisman names
- A **single preset ref** (`"$presetKey"`)
- A **mixed array** of names and `$preset` refs — presets are expanded inline with automatic deduplication

```json
// Inline
"Talisman": ["Vanguard's Charm", "Sage's Charm"]

// Single preset
"Talisman": "$tank"

// Mixed (preset + extra names, deduplicated)
"Talisman": ["$tank", "Rogue's Charm"]
```

Talisman names must match `data/equipment/talisman.json`.

### SubstatPrio

A string of stat abbreviations separated by `>` (priority) or `=` (equal priority).
Can be either:
- An **inline string**: `"ATK>CHC>CHD>SPD"`
- A **preset key** (plain string matching a key in `_presets.json`): `"dps"`
- A **preset ref** with `$` prefix: `"$dps"`

```json
"SubstatPrio": "SPD>HP>DEF=RES"
"SubstatPrio": "dps"
"SubstatPrio": "$dps-pen"
```

Valid stat abbreviations (from `data/stats.json`):

| Key | Stat |
|-----|------|
| ATK | Attack |
| DEF | Defense |
| HP | Health |
| ATK% | Attack % |
| DEF% | Defense % |
| HP% | Health % |
| EFF | Effectiveness |
| RES | Resilience |
| SPD | Speed |
| CHC | Crit Chance |
| CHD | Crit Damage |
| PEN% | Penetration |
| LS | Lifesteal |
| DMG UP% | Damage Increase |
| DMG RED% | Damage Reduction |
| CDMG RED% | Crit Damage Reduction |

### Note

Free-text string. Displayed as-is below the build.

---

## Presets (`_presets.json`)

Three preset categories:

```json
{
  "talismans": {
    "dps": ["Executioner's Charm", "Sage's Charm", "Rogue's Charm"],
    "tank": ["Vanguard's Charm", "Guardian's Charm"]
  },
  "sets": {
    "s4": [{ "name": "Speed", "count": 4 }],
    "a4": [{ "name": "Attack", "count": 4 }],
    "speed2swift2": [{ "name": "Speed", "count": 2 }, { "name": "Swiftness", "count": 2 }]
  },
  "substats": {
    "dps": "ATK>CHC>CHD>SPD",
    "tank": "SPD>HP>DEF>RES"
  }
}
```

### How preset refs work

| Field | Inline | Preset ref | Notes |
|-------|--------|------------|-------|
| Talisman | `["name1", "name2"]` | `"$key"` or `["$key", "extra"]` | `$` prefix, expanded with dedup |
| Set | `[[{ name, count }]]` | `["key"]` | Plain string (no `$`), each string = one combo |
| SubstatPrio | `"ATK>CHC>CHD"` | `"key"` or `"$key"` | Looked up as preset first, falls back to inline |

---

## Examples

### Minimal build (inline only)

```json
{
  "Speed DPS": {
    "Weapon": [
      { "name": "Laevateinn", "mainStat": "ATK%" }
    ],
    "Set": [
      [{ "name": "Speed", "count": 4 }]
    ],
    "SubstatPrio": "ATK>CHC>CHD>SPD",
    "Talisman": ["Executioner's Charm", "Sage's Charm"]
  }
}
```

### With presets

```json
{
  "Speed DPS": {
    "Weapon": [
      { "name": "Laevateinn", "mainStat": "ATK%" }
    ],
    "Set": ["s4"],
    "SubstatPrio": "dps",
    "Talisman": "$dps"
  }
}
```

### Mixed presets + inline

```json
{
  "Tank Hybrid": {
    "Weapon": [
      { "name": "Force Field Generator", "mainStat": "HP%" }
    ],
    "Set": [
      "hp4",
      [{ "name": "Life", "count": 2 }, { "name": "Immunity", "count": 2 }]
    ],
    "SubstatPrio": "$tankDpsHP",
    "Talisman": ["$tank", "Rogue's Charm"]
  }
}
```

### Multiple builds for one character

```json
{
  "Speed": {
    "Set": ["s4"],
    "SubstatPrio": "dps",
    "Talisman": "$dps"
  },
  "Penetration": {
    "Set": ["p4"],
    "SubstatPrio": "dps-pen",
    "Talisman": "$dps"
  },
  "Counter": {
    "Set": ["counter4"],
    "SubstatPrio": "dps",
    "Talisman": "$dps"
  }
}
```

---

## Pipeline validation

Run with:

```bash
npm run pipeline:step validate-reco
```

Checks performed on every `data/reco/*.json` file (except `_presets.json`):

| Check | Details |
|-------|---------|
| Weapon names | Must exist in `data/equipment/weapon.json` |
| Amulet names | Must exist in `data/equipment/accessory.json` |
| Weapon/Amulet mainStat | Each stat (split by `/`) must be in the item's `mainStats` array |
| Set names | Must exist in `data/equipment/sets.json` (short name OK) |
| Set presets | String keys must exist in `_presets.json` |
| Talisman names | Must exist in `data/equipment/talisman.json` |
| Talisman presets | `$key` refs must exist in `_presets.json` |
| SubstatPrio stats | Each stat (split by `>` or `=`) must exist in `data/stats.json` |
| SubstatPrio presets | Preset key / `$key` must exist in `_presets.json` |

---

## Architecture

```
data/reco/{id}.json          Raw reco data (may contain preset refs)
        │
        ▼
src/lib/data/characters.ts   getCharacterReco(slug) → CharacterReco
src/lib/data/characters.ts   getRecoPresets()       → RecoPresets
        │
        ▼
src/lib/data/reco.ts         resolveRecoPresets(reco, presets) → ResolvedCharacterReco
        │                    (expands all preset refs into inline values)
        ▼
page.tsx (server)            Passes resolved data to client
        │
        ▼
GearRecoSection.tsx          Renders build tabs, equipment, sets, stats
```

### Types (`src/types/equipment.ts`)

```
RecoBuild                    Raw — Set can be string[], Talisman can be string
ResolvedRecoBuild            Resolved — Set is always RecoSetEntry[][], Talisman is always string[]
CharacterReco                Record<string, RecoBuild>
ResolvedCharacterReco        Record<string, ResolvedRecoBuild>
RecoPresets                  { talismans, sets, substats }
```

---

## Available presets (current)

### Sets

| Key | Combo |
|-----|-------|
| `s4` | Speed x4 |
| `a4` | Attack x4 |
| `p4` | Penetration x4 |
| `chc4` | Critical Strike x4 |
| `counter4` | Counterattack x4 |
| `r4` | Revenge x4 |
| `hp4` | Life x4 |
| `speed2swift2` | Speed x2 + Swiftness x2 |
| `immu2swift2` | Immunity x2 + Swiftness x2 |

### Substats

| Key | Priority |
|-----|----------|
| `dps` | ATK>CHC>CHD>SPD |
| `dps-pen` | ATK>CHC>CHD>PEN% |
| `dps-speed` | SPD>ATK>CHC>CHD |
| `support-eff` | SPD>EFF>HP>DEF |
| `support-res` | SPD>RES>HP>DEF |
| `tank` | SPD>HP>DEF>RES |
| `tankDef` | SPD>HP>DEF>RES |
| `tankHP` | SPD>HP>DEF>RES |
| `tankDpsDef` | SPD>DEF>CHC>CHD>DMG UP%>HP |
| `tankDpsHP` | SPD>HP>CHC>CHD>DMG UP%>DEF |

### Talismans

| Key | Contents |
|-----|----------|
| `dps` | *(empty — to be filled)* |
| `dps-mage` | *(empty — to be filled)* |
| `dps-assassin` | *(empty — to be filled)* |
| `support` | *(empty — to be filled)* |
| `tank` | *(empty — to be filled)* |
| `CPplusVang` | Vanguard's Charm, Executioner's Charm, Sage's Charm, Rogue's Charm |
