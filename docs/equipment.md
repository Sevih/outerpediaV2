# Equipment — Data Format

## Overview

Equipment data covers five distinct item categories from Outerplane: weapons, amulets (accessories), talismans, armor sets, and exclusive equipment (EE). Each category has its own JSON file in `data/equipment/` and its own TypeScript type in `src/types/equipment.ts`.

```
data/equipment/
├── weapon.json       # Weapons (Weapon[])
├── accessory.json    # Amulets (Amulet[])
├── talisman.json     # Talismans (Talisman[])
├── sets.json         # Armor sets (ArmorSet[])
└── ee.json           # Exclusive Equipment (Record<string, ExclusiveEquipment>)
```

Data access layer: `src/lib/data/equipment.ts`

---

## Common patterns

### Localization

All equipment uses the **suffix fields** pattern — a base English field plus `_jp`, `_kr`, `_zh` variants:

```json
{
  "name": "Surefire Greatsword",
  "name_jp": "アブソートグレートソード",
  "name_kr": "필중의 대검",
  "name_zh": "必中大剑"
}
```

This is expressed via the `WithLocalizedFields<T, K>` generic from `src/types/common.ts`.

### Item rarity

All equipment uses `ItemRarity` (from `src/lib/theme.ts`):

| Value | Meaning |
|-------|---------|
| `"normal"` | Grey |
| `"superior"` | Green |
| `"epic"` | Blue |
| `"legendary"` | Orange |

### Effect descriptions

Weapons, amulets, and talismans have two levels of effect description:
- `effect_desc1` — effect at enhancement level 1
- `effect_desc4` — effect at enhancement level 4 (max)

Both are localized (`effect_desc1_jp`, `effect_desc1_kr`, etc.).

---

## 1. Weapons (`weapon.json`)

**Format:** JSON array of `Weapon` objects.
**Access:** `getWeapons(): Promise<Weapon[]>`

### Schema

| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| `name` | `string` | no | English name (+ `_jp`, `_kr`, `_zh`) |
| `type` | `string` | no | Always `"weapon"` |
| `rarity` | `ItemRarity` | no | `"epic"` or `"legendary"` |
| `image` | `string` | no | Image asset ID (e.g. `"TI_Equipment_Weapon_06"`) |
| `effect_name` | `string \| null` | yes | Effect name (+ localized). `null` for epic items with no special effect |
| `effect_desc1` | `string \| null` | yes | Effect at +1 (+ localized) |
| `effect_desc4` | `string \| null` | yes | Effect at +4 (+ localized) |
| `effect_icon` | `string \| null` | yes | Effect icon asset ID |
| `class` | `ClassType \| null` | yes | Class restriction (`"Striker"`, `"Defender"`, etc.). `null` = all classes |
| `mainStats` | `string[] \| null` | yes | Available main stats. Usually absent or `null` for weapons |
| `source` | `string` | no* | Drop source (e.g. `"Special Request"`) |
| `boss` | `string` | no* | Boss that drops this item |
| `mode` | `string \| null` | yes | Game mode restriction |
| `level` | `number` | no | Equipment tier/level (e.g. `6`) |

*`source` and `boss` are optional in the type but present on most legendary items.

### Example

```json
{
  "name": "Surefire Greatsword",
  "name_jp": "アブソートグレートソード",
  "name_kr": "필중의 대검",
  "name_zh": "必中大剑",
  "type": "weapon",
  "rarity": "legendary",
  "image": "TI_Equipment_Weapon_06",
  "effect_name": "Destruction",
  "effect_name_jp": "破滅",
  "effect_name_kr": "파멸",
  "effect_name_zh": "破灭",
  "effect_desc1": "Increases damage dealt by 1% of the target's Max Health when attacking a single target",
  "effect_desc4": "Increases damage dealt by 2% of the target's Max Health when attacking a single target",
  "effect_icon": "TI_Icon_UO_Weapon_11",
  "class": "Striker",
  "source": "Special Request",
  "boss": "Blazing Knight Meteos",
  "mode": null,
  "level": 6
}
```

### Notes

- Epic-rarity weapons have all effect fields set to `null` (no special effect).
- The `image` field may include a class suffix (e.g. `"TI_Equipment_Weapon_06_Defender"`) for class-specific weapons.
- `mainStats` is rarely populated for weapons (typically `null` or absent).

---

## 2. Amulets (`accessory.json`)

**Format:** JSON array of `Amulet` objects.
**Access:** `getAmulets(): Promise<Amulet[]>`

The `Amulet` type is identical to `Weapon` (`export type Amulet = Weapon`). The key difference is in the data:

| Difference | Weapons | Amulets |
|-----------|---------|---------|
| `type` field | `"weapon"` | `"amulet"` |
| `mainStats` | Usually `null` | Consistently populated for legendary items |
| `image` prefix | `TI_Equipment_Weapon_*` | `TI_Equipment_Accessary_*` |
| `effect_icon` prefix | `TI_Icon_UO_Weapon_*` | `TI_Icon_UO_Accessary_*` |

### mainStats

For amulets, `mainStats` is an array of stat abbreviations representing the selectable main stats for that item:

```json
"mainStats": ["EFF", "CHD", "PEN%", "HP%"]
```

These use the same stat keys as gear recommendations (ATK, DEF, HP, ATK%, DEF%, HP%, EFF, RES, SPD, CHC, CHD, PEN%, LS, etc.).

### Example

```json
{
  "name": "Death's Hold",
  "name_jp": "チョークスリーパー",
  "name_kr": "초크 슬리퍼",
  "name_zh": "绝命扣押",
  "type": "amulet",
  "rarity": "legendary",
  "image": "TI_Equipment_Accessary_06",
  "effect_name": "Revenge",
  "effect_desc1": "Increases Penetration by 1.5% when hit (max 7 stacks)",
  "effect_desc4": "Increases Penetration by 3% when hit (max 7 stacks)",
  "effect_icon": "TI_Icon_UO_Accessary_01",
  "class": "Striker",
  "mainStats": ["EFF", "CHD", "PEN%", "HP%"],
  "source": "Special Request",
  "boss": "Blazing Knight Meteos",
  "mode": null,
  "level": 6
}
```

---

## 3. Talismans (`talisman.json`)

**Format:** JSON array of `Talisman` objects.
**Access:** `getTalismans(): Promise<Talisman[]>`

Talismans differ structurally from weapons/amulets in several ways:
- All effect fields are **required** (never `null`).
- `level` is a **string** (not a number).
- No `mainStats` field.
- No `class` field.

### Schema

| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| `name` | `string` | no | English name (+ `_jp`, `_kr`, `_zh`) |
| `type` | `string` | no | Talisman category: `"CP"` or `"AP"` |
| `rarity` | `ItemRarity` | no | Always `"legendary"` in current data |
| `image` | `string` | no | Image asset ID (e.g. `"TI_Equipment_Talisman_01"`) |
| `effect_name` | `string` | no | Effect name (+ localized) |
| `effect_desc1` | `string` | no | Effect at +1 (+ localized) |
| `effect_desc4` | `string` | no | Effect at +4 (+ localized) |
| `effect_icon` | `string` | no | Effect icon asset ID |
| `level` | `string` | no | Equipment level as string (e.g. `"6"`) |
| `source` | `string \| null` | yes | Drop source |
| `boss` | `string \| null` | yes | Boss source |
| `mode` | `string \| null` | yes | Game mode |

### Talisman types

| `type` value | Meaning |
|-------------|---------|
| `"CP"` | Chain Point talisman — generates/modifies Chain Points |
| `"AP"` | Action Point talisman — generates/modifies Action Points |

### Example

```json
{
  "name": "Executioner's Charm",
  "name_jp": "処刑人のタリスマン",
  "name_kr": "처형인의 탈리스만",
  "name_zh": "刽子手的护身符",
  "type": "CP",
  "rarity": "legendary",
  "image": "TI_Equipment_Talisman_01",
  "effect_name": "Chain Point Generation: Enraged Targets",
  "effect_desc1": "Generates 12 Chain Points when attacking a target that has Enraged",
  "effect_desc4": "Recovers 50 Action Points when attacking an Enraged target",
  "effect_icon": "TI_Icon_UO_Talisman_01",
  "level": "6",
  "source": null,
  "boss": null,
  "mode": null
}
```

### Notes

- The +1 and +4 effects can be completely different abilities (not just scaled numbers).
- `source` and `boss` are `null` for most talismans (they come from various sources).

---

## 4. Armor Sets (`sets.json`)

**Format:** JSON array of `ArmorSet` objects.
**Access:** `getArmorSets(): Promise<ArmorSet[]>`

Armor sets represent 2-piece and 4-piece set bonuses. The naming convention for effects uses a `{pieces}_{level}` pattern.

### Schema

| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| `name` | `string` | no | English name (+ `_jp`, `_kr`, `_zh`) |
| `rarity` | `ItemRarity` | no | Set rarity |
| `set_icon` | `string` | no | Set icon asset ID (e.g. `"TI_Icon_Set_Enchant_01"`) |
| `effect_2_1` | `string` | no | 2-piece bonus at +1 (+ localized) |
| `effect_4_1` | `string` | no | 4-piece bonus at +1 (+ localized) |
| `effect_2_4` | `string` | no | 2-piece bonus at +4 (+ localized) |
| `effect_4_4` | `string` | no | 4-piece bonus at +4 (+ localized) |
| `class` | `ClassType \| null` | yes | Class restriction. `null` = all classes |
| `source` | `string` | no | Drop source |
| `boss` | `string` | no | Boss that drops this set |
| `mode` | `string \| null` | yes | Game mode |
| `image_prefix` | `string` | no | Prefix for armor piece images (e.g. `"06"`) |

### Effect naming convention

The effect fields follow the pattern `effect_{pieces}_{level}`:

| Field | Pieces | Enhancement level |
|-------|--------|------------------|
| `effect_2_1` | 2-piece bonus | +1 |
| `effect_4_1` | 4-piece bonus | +1 |
| `effect_2_4` | 2-piece bonus | +4 |
| `effect_4_4` | 4-piece bonus | +4 |

### Example

```json
{
  "name": "Attack Set",
  "name_jp": "攻撃セット",
  "name_kr": "공격 세트",
  "name_zh": "攻击套装",
  "rarity": "legendary",
  "set_icon": "TI_Icon_Set_Enchant_01",
  "effect_2_1": "Attack +30%",
  "effect_4_1": "Attack +20%",
  "effect_2_4": "Attack +35%",
  "effect_4_4": "Attack +25%",
  "class": null,
  "source": "Special Request",
  "boss": "Masterless Guardian",
  "mode": null,
  "image_prefix": "06"
}
```

### Notes

- Set names in reco files use the **short form** without " Set" suffix: `"Attack"`, not `"Attack Set"`.
- The 4-piece bonus stacks with the 2-piece bonus (it is an additional effect, not a replacement).

---

## 5. Exclusive Equipment (`ee.json`)

**Format:** JSON object keyed by **character ID** (e.g. `"2000001"`). Values are `ExclusiveEquipment` objects.
**Access:** `getExclusiveEquipment(): Promise<Record<string, ExclusiveEquipment>>`

Unlike all other equipment files (arrays), EE uses a record keyed by character ID because each EE is unique to a specific character.

### Schema

| Field | Type | Description |
|-------|------|-------------|
| `name` | `string` | EE name (+ `_jp`, `_kr`, `_zh`) |
| `mainStat` | `string` | Main stat bonus description (+ localized) |
| `effect` | `string` | Effect at base level (+ localized) |
| `effect10` | `string` | Effect at +10 (+ localized) |
| `icon_effect` | `string` | Effect icon asset ID |
| `rank` | `string` | EE rank: `"S"`, `"A"`, `"B"`, `"C"`, or `"D"` |
| `buff` | `string[]` | List of buffs applied (internal IDs, e.g. `"BT_STAT\|ST_ATK"`) |
| `debuff` | `string[]` | List of debuffs applied (internal IDs, e.g. `"BT_FREEZE"`) |

### Effect text format

EE effect descriptions use `<color=#28d9ed>SkillName</color>` tags for inline skill name highlighting. These tags are preserved as-is in the data and rendered by components.

### Buff/debuff IDs

The `buff` and `debuff` arrays use internal game identifiers:

| Pattern | Example | Meaning |
|---------|---------|---------|
| `BT_STAT\|ST_ATK` | Stat buff | Attack increase |
| `BT_STAT\|ST_DEF` | Stat buff | Defense increase |
| `BT_FREEZE` | Debuff | Frozen |
| `BT_REMOVE_BUFF` | Debuff | Buff removal |

### Example

```json
{
  "2000001": {
    "name": "Monomolecular Blade",
    "name_jp": "単分子ブレード",
    "name_kr": "단분자 블레이드",
    "name_zh": "单分子剑",
    "mainStat": "Reduces Earth Damage Taken",
    "mainStat_jp": "地属性の対象の受ける ダメージDOWN",
    "mainStat_kr": "지속성 대상 받는 피해 감소",
    "mainStat_zh": "土属性所受伤害降低",
    "effect": "When using Sliding Uppercut, has a 100% chance to remove 1 buff(s) from the target",
    "effect10": "When using Sliding Uppercut, has a 100% chance to remove 2 buff(s) from the target",
    "icon_effect": "TI_Icon_UO_Accessary_07",
    "rank": "C",
    "buff": [],
    "debuff": ["BT_REMOVE_BUFF"]
  }
}
```

---

## Data access layer

All functions live in `src/lib/data/equipment.ts`:

```typescript
import { getWeapons } from '@/lib/data/equipment'
import { getAmulets } from '@/lib/data/equipment'
import { getTalismans } from '@/lib/data/equipment'
import { getArmorSets } from '@/lib/data/equipment'
import { getExclusiveEquipment } from '@/lib/data/equipment'
```

| Function | Returns | Source file |
|----------|---------|-------------|
| `getWeapons()` | `Promise<Weapon[]>` | `weapon.json` |
| `getAmulets()` | `Promise<Amulet[]>` | `accessory.json` |
| `getTalismans()` | `Promise<Talisman[]>` | `talisman.json` |
| `getArmorSets()` | `Promise<ArmorSet[]>` | `sets.json` |
| `getExclusiveEquipment()` | `Promise<Record<string, ExclusiveEquipment>>` | `ee.json` |

---

## TypeScript types

All types are in `src/types/equipment.ts`:

```
BaseEquipGear          Base fields for weapons/amulets (not exported)
Weapon                 BaseEquipGear + localized name, effect_name, effect_desc1, effect_desc4
Amulet                 Alias for Weapon (identical type)

BaseTalisman           Base fields for talismans (not exported)
Talisman               BaseTalisman + localized name, effect_name, effect_desc1, effect_desc4

BaseArmorSet           Base fields for armor sets (not exported)
ArmorSet               BaseArmorSet + localized name and all 4 effect fields

BaseExclusiveEquipment Base fields for EE (not exported)
ExclusiveEquipment     BaseExclusiveEquipment + localized name, mainStat, effect, effect10
```

### Key type differences

| | Weapon/Amulet | Talisman | ArmorSet | EE |
|--|--------------|----------|----------|-----|
| Effect fields nullable | Yes | No | No | No |
| `level` type | `number` | `string` | *(none)* | *(none)* |
| `class` field | Yes (`null` = all) | No | Yes (`null` = all) | No |
| `mainStats` field | Yes | No | No | `mainStat` (single string) |
| Data structure | Array | Array | Array | Record by character ID |
| `source`/`boss` | Optional | Nullable | Required | *(none)* |

---

## Related documentation

- [Gear Recommendations](./gear-reco.md) — reco builds referencing equipment by name