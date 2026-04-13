# Equipment Extractor — Armor Sets & Talismans Implementation Guide

This document provides everything needed to implement the API routes for **Armor Sets** and **Talismans** extractors. The UI pages already exist and expect specific API contracts.

## Table of Contents

1. [Project Context & Rules](#project-context--rules)
2. [Architecture Overview](#architecture-overview)
3. [Existing Reference: Accessory Extractor](#existing-reference-accessory-extractor)
4. [Armor Sets Extractor](#armor-sets-extractor)
5. [Talisman Extractor](#talisman-extractor)
6. [Shared Utilities Reference](#shared-utilities-reference)
7. [API Contract (common to all extractors)](#api-contract)
8. [Critical Implementation Rules](#critical-implementation-rules)

---

## Project Context & Rules

- **Game**: Outerplane
- **Framework**: Next.js 16.1.7 with Turbopack, App Router
- **NEVER run `npm run build`** — kills the dev server
- Code and comments in **English**, responses in **French**
- **NEVER hardcode** values that can be found in game data (use TextSystem lookups, resolveEnum, etc.)
- **NEVER assume data mappings** without verifying in actual game data files
- All game data: `data/admin/json2/` (parsed JSON from binary game assets)
- Output data: `data/equipment/` (the JSON files the website uses)
- Placeholder values must be wrapped in `<color=#28d9ed>value</color>` tags
- Keep `\n` in descriptions as-is
- **No page reload on save** — the UI handles re-fetching via silent compare

---

## Architecture Overview

```
data/admin/json2/          ← Raw game data templets (read-only)
  ItemTemplet.json        ← Master item database
  ItemSpecialOptionTemplet.json  ← Equipment effects (weapons, accessories, sets, talismans)
  BuffTemplet.json        ← Buff values, durations, rates
  TextItem.json           ← Localized item names
  TextSkill.json          ← Localized effect names/descriptions
  TextSystem.json         ← System enums (classes, elements, grades, etc.)
  DungeonTemplet.json     ← Dungeon definitions
  RewardTemplet.json      ← Dungeon rewards
  RewardGroupTemplet.json ← Reward → item mapping
  DungeonSpawnTemplet.json ← Dungeon → boss mapping
  ItemCraftRewardTemplet.json ← Crafting recipes (for source detection)
  ProductTemplet.json     ← Shop products (for source detection)
  ItemOptionTemplet.json  ← Stat options (for mainStats)

data/equipment/           ← Output JSON (website data)
  sets.json               ← Array of armor set objects (NOT keyed object)
  talisman.json           ← Array of talisman objects (NOT keyed object)
  weapon.json             ← Keyed object (numeric keys)
  accessory.json          ← Keyed object (numeric keys)

src/app/api/admin/extractor/
  lib/equip-extractor.ts  ← Shared extraction logic (weapons & accessories)
  accessory/route.ts      ← Reference implementation using shared module
  weapon/route.ts         ← Standalone implementation
  ee/route.ts             ← Standalone EE implementation
  armor/route.ts          ← TO CREATE
  talisman/route.ts       ← TO CREATE

src/app/admin/extractor/equipment/
  armors/page.tsx          ← UI (already exists, expects /api/admin/extractor/armor)
  talismans/page.tsx       ← UI (already exists, expects /api/admin/extractor/talisman)

src/app/admin/lib/text-v2.ts ← Shared text utilities
src/app/admin/components/
  extractor-ui.tsx         ← Shared UI components (LangRow, Section, DiffEntry types)
  diff-highlight.tsx       ← Word-level diff with color tag rendering
```

---

## Existing Reference: Accessory Extractor

The accessory extractor (`src/app/api/admin/extractor/accessory/route.ts`) is the cleanest reference implementation. It uses the shared `equip-extractor.ts` module. Study it for:

- How `EquipExtractorConfig` is structured
- How `buildBossMap` works (DM_RAID_1 Stage 13 + irregular boss mapping)
- How `detectSource` works (ItemCraftRewardTemplet → ProductTemplet, with sibling detection)
- How the GET handler returns `list` and `compare` actions
- How the POST handler saves with `orderKeys`, `detectEol`, and proper CRLF handling
- How compare includes image file existence checks

**Key file**: `src/app/api/admin/extractor/accessory/route.ts` (299 lines)

---

## Armor Sets Extractor

### Data Source

Armor sets are **NOT** in ItemTemplet like weapons/accessories. They are in `ItemSpecialOptionTemplet.json` with `NameIDSymbol` starting with `ST_Set_`.

### Game Data Structure

Each armor set has **2 entries** in ItemSpecialOptionTemplet, grouped by `GroupID`:

```
Level=1 (BreakLimitCount: "0,1,2,3") → Tier 0 (base)
Level=2 (BreakLimitCount: "4")       → Tier 4 (upgraded)
```

**Example — Attack Set (GroupID=1):**

```json
// Level 1 (Tier 0)
{
  "ID": "1",
  "GroupID": "1",
  "Level": "1",
  "BreakLimitCount": "0,1,2,3",
  "NameIDSymbol": "ST_Set_01_NAME",        // → TextItem for name
  "DescID": "ST_Set_01_DESC",              // → TextItem for general description
  "BuffLevel_4P": "TI_Icon_Set_Enchant_01", // set_icon

  // 2-piece effect:
  "OptionType_2P": "IOT_STAT",             // or "IOT_BUFF"
  "StatType_2P": "ST_ATK",                 // stat type (when IOT_STAT)
  "ApplyingType_2P": "OAT_RATE",           // rate = permille
  "BuffLevel_2P": "300",                   // value (300 = 30%)
  // OR for buff-based: "BuffLevel_2P": "BID_ITEM_UO_SET_23_GROUP_1"

  // 4-piece effect:
  "OptionType_4P": "IOT_STAT",             // or "IOT_BUFF"
  "StatType_4P": "ST_ATK",
  "ApplyingType_4P": "OAT_RATE",
  "OptionType_4P_fallback1": "200"          // value for 4P (confusing field name!)
  // OR for buff-based: "BuffID": "BID_ITEM_UO_SET_16"
}
```

### Effect Description Resolution

There are **TWO types** of set effects:

#### 1. Stat-based sets (IOT_STAT)

The effect is a simple stat bonus. The description must be **composed** from the stat data:
- `StatType_2P` / `StatType_4P` → stat name via TextSystem (e.g., `ST_ATK` → `SYS_STAT_ATK` or similar)
- `ApplyingType_*P` → if `OAT_RATE`, value is permille (÷10 + %)
- `BuffLevel_2P` / `OptionType_4P_fallback1` → raw value

**Look at the existing `sets.json` to see how the descriptions are formatted.** Example:
```
"effect_2_1": "Attack +30%"    ← 2-piece, tier 0 (BuffLevel_2P=300, OAT_RATE → 30%)
"effect_4_1": "Attack +20%"    ← 4-piece, tier 0 (OptionType_4P_fallback1=200 → 20%)
"effect_2_4": "Attack +35%"    ← 2-piece, tier 4 (from Level=2 entry)
"effect_4_4": "Attack +25%"    ← 4-piece, tier 4
```

**IMPORTANT**: Check TextSystem for stat label resolution. The existing `sets.json` uses English stat names like "Attack", "Defense", "Health", "Speed", "Critical Hit Chance", etc. These should come from TextSystem, NOT be hardcoded. Verify how each `ST_*` maps to a display name.

#### 2. Buff-based sets (IOT_BUFF)

For the 2-piece when `OptionType_2P` = `IOT_BUFF`:
- `BuffLevel_2P` contains a BuffID (e.g., `BID_ITEM_UO_SET_23_GROUP_1`)
- The description text comes from `DescID` → TextSkill lookup
- Placeholders in the description are resolved via BuffTemplet

For the 4-piece when `OptionType_4P` = `IOT_BUFF`:
- `BuffID` field contains the 4-piece BuffID
- Same placeholder resolution pattern

**The existing data for buff-based sets has full text descriptions with resolved placeholders + `<color>` tags. Study sets like "Will of the Tribe" (ST_Set_23) in `sets.json` to see the format.**

### Boss / Source Mapping

Armor sets drop from bosses. The boss mapping follows a similar pattern to weapons/accessories but through a different chain:
- Armor pieces (ITS_EQUIP_ARMOR, ITS_EQUIP_HELMET, etc.) drop from dungeons
- The set is identified by the armor piece's set association
- **For simplicity**, existing `sets.json` has a `boss` field (single boss ID string) and optional `source` field

You'll need to figure out how armor sets link to bosses. One approach: find armor pieces with matching set icons/names in ItemTemplet, then trace their rewards through DungeonTemplet → RewardTemplet → RewardGroupTemplet.

### Output JSON Format (`data/equipment/sets.json`)

**IMPORTANT**: `sets.json` is an **array** (not a keyed object like weapon.json/accessory.json).

```json
[
  {
    "name": "Attack Set",
    "name_jp": "攻撃セット",
    "name_kr": "공격 세트",
    "name_zh": "攻击套装",
    "rarity": "legendary",
    "set_icon": "TI_Icon_Set_Enchant_01",
    "effect_2_1": "Attack +30%",
    "effect_2_1_jp": "攻撃力 +30%",
    "effect_2_1_kr": "공격력 +30%",
    "effect_2_1_zh": "攻击力 +30%",
    "effect_4_1": "Attack +20%",
    "effect_4_1_jp": "攻撃力 +20%",
    "effect_4_1_kr": "공격력 +20%",
    "effect_4_1_zh": "攻击力 +20%",
    "effect_2_4": "Attack +35%",
    "effect_2_4_jp": "攻撃力 +35%",
    "effect_2_4_kr": "공격력 +35%",
    "effect_2_4_zh": "攻击力 +35%",
    "effect_4_4": "Attack +25%",
    "effect_4_4_jp": "攻撃力 +25%",
    "effect_4_4_kr": "공격력 +25%",
    "effect_4_4_zh": "攻击力 +25%",
    "class": null,
    "boss": "404400162",
    "image_prefix": "06"
  }
]
```

Key order: `name(4), rarity, set_icon, effect_2_1(4), effect_4_1(4), effect_2_4(4), effect_4_4(4), class, source, boss, image_prefix`

### Fields to Extract

| Field | Source |
|-------|--------|
| `name` (4 langs) | `NameIDSymbol` → TextItem |
| `rarity` | All sets are legendary (verify via game data, don't hardcode) |
| `set_icon` | `BuffLevel_4P` field |
| `effect_2_1` (4 langs) | 2-piece effect at Level=1 |
| `effect_4_1` (4 langs) | 4-piece effect at Level=1 |
| `effect_2_4` (4 langs) | 2-piece effect at Level=2 |
| `effect_4_4` (4 langs) | 4-piece effect at Level=2 |
| `class` | `null` for most sets; some newer sets may be class-locked |
| `boss` | Boss ID (needs investigation) |
| `source` | `null` or `"Event Shop"` etc. |
| `image_prefix` | Derived from armor piece icon names (e.g., "06") |

### UI Page Reference

The armor UI (`src/app/admin/extractor/equipment/armors/page.tsx`) expects:
- `GET /api/admin/extractor/armor?action=list` → `{ total, existing, new, entries: ArmorSetEntry[] }`
- `GET /api/admin/extractor/armor?action=compare` → `{ total, withDiffs, ok, results: CompareResult[] }`
- `POST /api/admin/extractor/armor` → `{ id } or { ids }` → `{ ok, saved, total }`

The entry type includes: `id, name(4), rarity, set_icon, effect_2_1(4), effect_4_1(4), effect_2_4(4), effect_4_4(4), class, image_prefix, existsInJson`

### 21 Armor Sets in Game Data

All 21 sets are identified by `ST_Set_XX_NAME` in ItemSpecialOptionTemplet with GroupIDs 1-21.

---

## Talisman Extractor

### Data Source

Talismans are in `ItemTemplet.json` with `ItemSubType = 'ITS_EQUIP_OOPARTS'`.

### Game Data Structure

- 37 talisman items total (11 base names × 3 star tiers: 4★, 5★, 6★ + 4 special ones)
- Talismans have **no** `MainOptionGroupID` (unlike weapons/accessories)
- Effect link: `ItemEnchantCostRate` field contains comma-separated ItemSpecialOptionTemplet IDs

**Example — Executioner's Charm (6★, ID=10201):**

```json
// ItemTemplet entry
{
  "ID": "10201",
  "DescIDSymbol": "ITEM_TALISMAN_U_01_NAME",
  "IconName": "TI_Equipment_Talisman_01",
  "ItemSubType": "ITS_EQUIP_OOPARTS",
  "ItemGrade": "IG_UNIQUE",
  "BasicStar": "6",
  "TrustLevelLimit": "CCT_NONE",           // No class lock
  "SubOptionGroupID": "10002",
  "ItemEnchantCostRate": "3023, 3123"       // ← EFFECT LINK!
}
```

The `ItemEnchantCostRate` field maps to ItemSpecialOptionTemplet:
- `3023` → base effect (Level=1): `UO_OOPARTS_01_NAME`, BuffID=`BID_OOPART_CP_6_01`
- `3123` → upgraded effect (Level=10): `UO_OOPARTS_01_LV10_DESC`, BuffID=`BID_OOPART_CP_6_01_lv10`

**ItemSpecialOptionTemplet entries:**

```json
// Base effect (ID=3023)
{
  "ID": "3023",
  "GroupID": "3023",
  "Level": "1",
  "NameIDSymbol": "UO_OOPARTS_01_NAME",          // → TextSkill for effect name
  "CustomCraftDescIDSymbol": "UO_OOPARTS_01_DESC", // → TextSkill for base description
  "BuffLevel_4P": "TI_Icon_UO_Talisman_01",       // effect_icon
  "BuffID": "BID_OOPART_CP_6_01"                   // → BuffTemplet for values
}

// Upgraded effect (ID=3123)
{
  "ID": "3123",
  "GroupID": "3023",
  "Level": "10",
  "IsAdd": "True",
  "NameIDSymbol": "UO_OOPARTS_01_NAME",
  "CustomCraftDescIDSymbol": "UO_OOPARTS_01_LV10_DESC", // Different desc at max level!
  "BuffLevel_4P": "TI_Icon_UO_Talisman_01",
  "BuffID": "BID_OOPART_CP_6_01_lv10"              // Different buff at max level!
}
```

### Effect Description Resolution

1. Get base desc from `UO_OOPARTS_XX_DESC` in TextSkill (4 langs)
2. Resolve `[Value]` placeholder using BuffTemplet (`BID_OOPART_*` → Value field)
3. Wrap resolved values in `<color=#28d9ed>value</color>` tags

For upgraded (tier 4) description:
1. Get desc from `UO_OOPARTS_XX_LV10_DESC` in TextSkill — **note: the upgraded desc is often completely different, not just different values!**
2. Resolve using the `_lv10` buff variant

**Example resolution:**
```
Template: "Generates [Value] Chain Points when attacking a target that has Enraged"
Buff BID_OOPART_CP_6_01, Value=12
→ "Generates <color=#28d9ed>12</color> Chain Points when attacking a target that has Enraged"

Template (lv10): "Recovers [Value] Action Points when attacking an Enraged target"
Buff BID_OOPART_CP_6_01_lv10, Value=50
→ "Recovers <color=#28d9ed>50</color> Action Points when attacking an Enraged target"
```

### Placeholder Patterns

Talisman descriptions use the same placeholders as weapons/accessories:
- `[Value]`, `[+Value]`, `[-Value]` → buff Value field
- `[Rate]`, `[RATE]` → buff CreateRate field (÷10 + %)
- `[Turn]`, `[+Turn]` → buff TurnDuration field

Use `resolveEquipPlaceholders()` from `equip-extractor.ts` or implement equivalent logic.

### Deduplication

Same talisman name appears at 4★, 5★, and 6★. Only keep the **highest star** version (6★ when available). Match by `DescIDSymbol` (name) since talismans have no class.

Special talismans (IDs 10996-10999) have unique names and should all be included.

### Type Field (CP vs AP)

The `type` field in existing `talisman.json` is either `"CP"` or `"AP"`. This comes from the effect BuffID pattern:
- `BID_OOPART_CP_*` → type `"CP"`
- `BID_OOPART_AP_*` → type `"AP"`

### Output JSON Format (`data/equipment/talisman.json`)

**IMPORTANT**: `talisman.json` is an **array** (not a keyed object).

```json
[
  {
    "name": "Executioner's Charm",
    "name_jp": "処刑人のタリスマン",
    "name_kr": "처형인의 탈리스만",
    "name_zh": "刽子手的护身符",
    "type": "CP",
    "rarity": "legendary",
    "image": "TI_Equipment_Talisman_01",
    "effect_name": "Chain Point Generation: Enraged Targets",
    "effect_name_jp": "CP獲得 - 狂暴対象攻撃",
    "effect_name_kr": "CP회복 - 광폭 대상 공격",
    "effect_name_zh": "CP恢复-攻击狂暴目标",
    "effect_desc1": "Generates <color=#28d9ed>12</color> Chain Points when attacking a target that has Enraged",
    "effect_desc1_jp": "狂暴化した対象を攻撃した場合、CPを<color=#28d9ed>12</color>獲得する。",
    "effect_desc1_kr": "광폭화 대상을 공격한 경우 CP <color=#28d9ed>12</color> 회복",
    "effect_desc1_zh": "攻击狂暴化目标时,CP恢复<color=#28d9ed>12</color>",
    "effect_desc4": "Recovers <color=#28d9ed>50</color> Action Points when attacking an Enraged target",
    "effect_desc4_jp": "狂暴化した対象を攻撃時、APを<color=#28d9ed>50</color>獲得する。",
    "effect_desc4_kr": "광폭화 대상 공격 시 AP <color=#28d9ed>50</color> 회복",
    "effect_desc4_zh": "攻击处于狂暴化的目标时,AP恢复<color=#28d9ed>50</color>",
    "effect_icon": "TI_Icon_UO_Talisman_01",
    "level": "6",
    "source": null,
    "boss": null,
    "mode": null
  }
]
```

Key order: `name(4), type, rarity, image, effect_name(4), effect_desc1(4), effect_desc4(4), effect_icon, level, source, boss, mode`

### Fields to Extract

| Field | Source |
|-------|--------|
| `name` (4 langs) | `DescIDSymbol` → TextItem |
| `type` | `"CP"` or `"AP"` from BuffID pattern |
| `rarity` | Use `resolveEnum(textSystemMap, row.ItemGrade, 'IG_', 'SYS_ITEM_GRADE_').toLowerCase()` |
| `image` | `IconName` from ItemTemplet |
| `effect_name` (4 langs) | `NameIDSymbol` → TextSkill |
| `effect_desc1` (4 langs) | Base desc (`CustomCraftDescIDSymbol`) with resolved placeholders |
| `effect_desc4` (4 langs) | Upgraded desc (`_LV10_DESC`) with resolved placeholders |
| `effect_icon` | `BuffLevel_4P` from ItemSpecialOptionTemplet |
| `level` | `BasicStar` from ItemTemplet |
| `source` | Same detection as accessories (Event Shop, Adventure License) |
| `boss` | Same boss mapping logic |
| `mode` | `null` in existing data (may need investigation) |

### UI Page Reference

The talisman UI (`src/app/admin/extractor/equipment/talismans/page.tsx`) expects:
- `GET /api/admin/extractor/talisman?action=list` → `{ total, existing, new, entries: TalismanEntry[] }`
- `GET /api/admin/extractor/talisman?action=compare` → `{ total, withDiffs, ok, results: CompareResult[] }`
- `POST /api/admin/extractor/talisman` → `{ id } or { ids }` → `{ ok, saved, total }`

### Key Differences from Weapons/Accessories

1. **Cannot use shared `equip-extractor.ts`** directly — talismans don't have `MainOptionGroupID`
2. Effect link is via `ItemEnchantCostRate` (comma-separated special option IDs)
3. Upgraded effect has a **completely different description** (not just different values)
4. Output is an **array**, not a keyed object
5. No `class` field (all talismans are class-agnostic)
6. Has `type` field (`"CP"` or `"AP"`) and `mode` field

---

## Shared Utilities Reference

### `src/app/admin/lib/text-v2.ts`

```typescript
readTemplet(name: string)        // Read data/admin/json2/{name}.json
buildTextMap(data)               // IDSymbol → { en, jp, kr, zh }
expandLang(field, texts)         // → { field: en, field_jp, field_kr, field_zh }
resolveEnum(textSys, raw, prefix, sysPrefix) // Game enum → display name
resolveClass(textSys, raw)       // CCT_* → class name
```

### `src/app/api/admin/extractor/lib/equip-extractor.ts`

```typescript
loadEquipGameData()              // Loads all 13 game data templets
loadExistingJson(path)           // Read existing output JSON
extractEquipFromGameData(config) // Main extraction pipeline (weapons/accessories)
resolveEquipPlaceholders(text, buffData, buffIdStr, level) // [Value], [Rate], [Turn] etc.
copyEquipImages(image, effectIcon) // Copy from datamine to public/
checkImageExists(dir, name)      // Check if image file exists
orderKeys(obj, keyOrder)         // Reorder JSON keys for consistent output
detectEol(raw)                   // Detect CRLF vs LF for consistent line endings
classFromRow(row, textSystemMap) // TrustLevelLimit → class name
extractMainStats(itemOptionData, subOptionGroupId) // SubOptionGroupID → stat keys
getMaxBuffLevel(buffData, buffIdStr) // Find max level for a buff
```

### `src/app/admin/components/extractor-ui.tsx`

```typescript
type DiffEntry = { field: string; existing: string; extracted: string }
type CompareResponse = { total: number; withDiffs: number; ok: number; results: CompareResult[] }
type ListResponse = { total: number; existing: number; new: number; entries: any[] }
```

---

## API Contract

All equipment extractors follow the same API pattern:

### GET `?action=list`

Returns all extracted items with a flag indicating if they exist in the output JSON.

```json
{
  "total": 21,
  "existing": 21,
  "new": 0,
  "entries": [
    {
      "id": "1",
      "name": "Attack Set",
      "name_jp": "攻撃セット",
      // ... all fields
      "existsInJson": true
    }
  ]
}
```

### GET `?action=compare`

Compares extracted data against existing JSON, returning only items with differences.

```json
{
  "total": 21,
  "withDiffs": 3,
  "ok": 18,
  "results": [
    {
      "id": "1",
      "name": "Attack Set",
      "diffs": [
        {
          "field": "effect_2_1",
          "existing": "Attack +30%",
          "extracted": "Attack +35%"
        }
      ]
    }
  ]
}
```

**Compare fields**: All text fields (names, descriptions), icon, class, rarity, etc.
Also check image file existence and include `image (file)` diffs if missing.

### POST (save)

```json
// Request
{ "id": "1" }
// or
{ "ids": ["1", "2", "3"] }

// Response
{ "ok": true, "saved": 1, "total": 21 }
```

Save must:
1. Detect existing EOL style (`\r\n` vs `\n`) and preserve it
2. Order keys according to the defined KEY_ORDER
3. Copy images from datamine to public/ if missing
4. **NOT reload the page** (return JSON response, UI handles re-fetching)

### Array vs Object JSON

- `weapon.json` and `accessory.json` use **keyed objects** (`{ "0": {...}, "1": {...} }`)
- `sets.json` and `talisman.json` use **arrays** (`[{...}, {...}]`)

The save handler must match existing format. For arrays, match entries by name (+ class if applicable).

---

## Critical Implementation Rules

1. **Guard with `devOnly()`** — all routes must check `NODE_ENV === 'development'`
2. **Use `readTemplet()`** from `src/app/admin/lib/text-v2.ts` to load game data
3. **Use `buildTextMap()`** for text lookups, `expandLang()` for multilingual output
4. **Use `resolveEnum()`** for rarity — never hardcode `"legendary"`/`"epic"`
5. **Wrap placeholder values** in `<color=#28d9ed>value</color>` tags
6. **Preserve `\n`** in descriptions
7. **Detect and preserve EOL** style when saving (use `detectEol()`)
8. **Order keys** consistently using `orderKeys()`
9. **Copy images** on save using `copyIfMissing()` or `copyEquipImages()`
10. **Match by name** (not by array index) when finding existing entries in array-based JSON
11. Image source directory: `datamine/extracted_astudio/assets/editor/resources/sprite/at_thumbnailitemruntime/`
12. Equipment image destination: `public/images/equipment/`
13. Effect icon destination: `public/images/ui/effect/`
14. **Use `pngPath()` pattern** to avoid Turbopack broad-pattern warnings (don't use `path.join(dir, name + '.png')`)

### Turbopack Warning Avoidance

```typescript
// BAD — triggers Turbopack broad file matching (18455 files)
path.join(dir, name + '.png')

// GOOD — avoids the warning
[dir, name].join(path.sep) + '.png'
```

### Known Pitfalls

- `OptionType_4P_fallback1` is the 4-piece **value**, not a fallback field
- `BuffLevel_2P` can be either a numeric value (for stat-based) or a BuffID string (for buff-based)
- `BuffID` field in set entries is the 4-piece buff (confusingly not in a `_4P` suffix)
- Some sets have `OptionType_2P: "IOT_STAT"` with `BuffLevel_2P: "OAT_NONE"` — this means the 2-piece has no effect at tier 0 but gains one at tier 4
- Talisman tier 4 effect can be **completely different** from tier 0 (different description template, different buff)
- For talismans, `ItemEnchantCostRate` can have 1 or 2 comma-separated IDs. With 1 ID, there's no upgraded version.
- 4★ and 5★ talismans may only have base effects (no Level=10 entry in ItemSpecialOptionTemplet)
