# Character JSON Format

## Overview

Each character has a dedicated JSON file in `data/character/{id}.json`.
TypeScript types live in `src/types/character.ts`, enums in `src/types/enums.ts`.

Data is accessed via the data layer — never import JSON directly:

```typescript
import { getCharacter } from '@/lib/data/characters'
const alice = await getCharacter('alice')
```

```
data/character/
├── 2000001.json    # K (2★ Defender)
├── 2000053.json    # Demiurge Stella (3★ Striker)
├── 2700037.json    # Core Fusion Veronica (3★ Defender, Core Fusion variant)
└── ...
```

---

## ID conventions

| Prefix | Meaning | Example |
|--------|---------|---------|
| `2000xxx` | Standard characters | `2000001` (K) |
| `2700xxx` | Core Fusion variants | `2700037` (Core Fusion Veronica) |

---

## Top-level fields

```jsonc
{
  // ── Identity ──
  "ID": "2000001",                        // Unique numeric ID (string)
  "Fullname": "K",                        // English name
  "Fullname_jp": "ケイ",                   // Japanese (optional)
  "Fullname_kr": "케이",                   // Korean (optional)
  "Fullname_zh": "凯伊",                   // Chinese (optional)

  // ── Classification ──
  "Rarity": 2,                            // 1 | 2 | 3
  "Element": "Fire",                      // Fire | Water | Earth | Light | Dark
  "Class": "Defender",                    // Striker | Defender | Ranger | Healer | Mage
  "SubClass": "Sweeper",                  // See subclass table below
  "Chain_Type": "Finish",                 // Start | Join | Finish
  "role": "support",                      // dps | support | sustain

  // ── Ratings ──
  "rank": "B",                            // PvE tier (string or null)
  "rank_pvp": "S",                        // PvP tier (string or null, optional)

  // ── Metadata ──
  "gift": "Science",                      // Preferred gift type
  "video": "PueXtFsRHI0",                // YouTube video ID (optional)
  "VoiceActor": "VA. Alejandro Saab",    // English voice actor
  "VoiceActor_jp": "CV. 斉藤壮馬",        // (optional)
  "VoiceActor_kr": "CV. 김영선",           // (optional)
  "VoiceActor_zh": "CV. 齐藤壮马",        // (optional)
  "limited": true,                        // Only present on limited characters (optional)
  "tags": ["free", "ignore-defense"],     // Filterable tags (see tags table)

  // ── Skill upgrade order ──
  "skill_priority": { ... },

  // ── Transcendence ──
  "transcend": { ... },

  // ── Skills ──
  "skills": { ... },

  // ── Core Fusion only (optional) ──
  "fusionType": "core-fusion",
  "originalCharacter": "2000037",
  "isPermanent": true,
  "fusionRequirements": { ... },
  "fusionLevels": [ ... ]
}
```

### Subclass mapping

| Class | Subclass A | Subclass B |
|-------|-----------|-----------|
| Striker | Attacker | Bruiser |
| Defender | Sweeper | Phalanx |
| Ranger | Tactician | Vanguard |
| Healer | Sage | Reliever |
| Mage | Wizard | Enchanter |

### Known tags

| Tag | Meaning |
|-----|---------|
| `free` | Obtainable for free |
| `premium` | Premium/gacha exclusive |
| `limited` | Limited-time banner |
| `ignore-defense` | Has defense-ignoring abilities |
| `core-fusion` | Core Fusion variant |

### Gift types

`Science` | `Luxury` | `Magic Tool` | `Craftwork` | `Natural Object`

---

## `skill_priority`

Recommended skill upgrade order. Each entry has a `prio` number (1 = highest priority, 3 = lowest).

```json
{
  "skill_priority": {
    "First":    { "prio": 3 },
    "Second":   { "prio": 1 },
    "Ultimate": { "prio": 2 }
  }
}
```

---

## `transcend`

Transcendence bonuses unlocked at each level (1 through 6). Structure differs by rarity.

### 1★ and 2★ characters — flat keys

Levels 4, 5, 6 are single entries with localized suffixes:

```json
{
  "transcend": {
    "1": null,
    "2": "ATK DEF HP +5%",
    "3": "ATK DEF HP +10%",
    "4": "ATK DEF HP +16%\nDMG Reduction +2.4%\nChain Passive WG reduction +1",
    "4_jp": "...",
    "4_kr": "...",
    "4_zh": "...",
    "5": "ATK DEF HP +22%\nBurst Level 3 Unlocked",
    "5_jp": "...",
    "5_kr": "...",
    "5_zh": "...",
    "6": "ATK DEF HP +30%\nDMG Reduction +2.4%\nOn entry, AP +25",
    "6_jp": "...",
    "6_kr": "...",
    "6_zh": "..."
  }
}
```

### 3★ characters — split choices at levels 4 and 5

Levels 4 and 5 offer selectable branches (`4_1`/`4_2`, `5_1`/`5_2`/`5_3`):

```json
{
  "transcend": {
    "1": null,
    "2": null,
    "3": "ATK DEF HP +10%",
    "4_1": "ATK DEF HP +16%\n...(branch A description)",
    "4_1_jp": "...",
    "4_1_kr": "...",
    "4_1_zh": "...",
    "4_2": "ATK DEF HP +16%\n...(branch B description)",
    "5_1": "ATK DEF HP +22%\n...(branch A)",
    "5_1_jp": "...",
    "5_1_kr": "...",
    "5_1_zh": "...",
    "5_2": "ATK DEF HP +22%\n...(branch B)",
    "5_3": "ATK DEF HP +22%\n...(branch C)",
    "6": "ATK DEF HP +30%\n...",
    "6_jp": "...",
    "6_kr": "...",
    "6_zh": "..."
  }
}
```

**Key rules:**
- `null` means no specific bonus description (just stat increase from the level itself)
- English is the base key (`"4_1"`), localized versions add `_jp`, `_kr`, `_zh` suffixes
- Levels 1-3 are never localized (generic stat bonuses)
- Multi-line descriptions use `\n`

---

## `skills`

An object keyed by `SkillKey`. Standard characters have 4 skills:

| Key | Skill | Description |
|-----|-------|-------------|
| `SKT_FIRST` | Skill 1 (basic attack) | Always available, no cooldown |
| `SKT_SECOND` | Skill 2 | Usually has cooldown, may have Burst |
| `SKT_ULTIMATE` | Skill 3 (ultimate) | Highest cooldown, strongest |
| `SKT_CHAIN_PASSIVE` | Chain Passive | Chain skill + Dual Attack effects |

### Skill structure

```jsonc
{
  "SKT_FIRST": {
    // ── Internal identifiers ──
    "NameIDSymbol": "101",                    // Datamine symbol ID
    "IconName": "Skill_First_2000001",        // Icon asset name
    "SkillType": "SKT_FIRST",                 // Matches the key

    // ── Localized name ──
    "name": "Shield Rush",
    "name_jp": "シールドラッシュ",
    "name_kr": "실드 러시",
    "name_zh": "护盾突击",

    // ── Descriptions by level (1-5) ──
    "true_desc_levels": {
      "1": "Attacks an enemy and has a <color=#28d9ed>30%</color> chance to...",
      "1_jp": "敵単体にダメージを与え...",
      "1_kr": "적을 공격하고...",
      "1_zh": "攻击敌人...",
      "2": "...",   "2_jp": "...",   "2_kr": "...",   "2_zh": "...",
      "3": "...",   "3_jp": "...",   "3_kr": "...",   "3_zh": "...",
      "4": "...",   "4_jp": "...",   "4_kr": "...",   "4_zh": "...",
      "5": "...",   "5_jp": "...",   "5_kr": "...",   "5_zh": "..."
    },

    // ── Enhancement bonuses per level (2-5) ──
    "enhancement": {
      "2":    ["+10% damage", "+1 Weakness Gauge damage"],
      "2_jp": ["ダメージ+10%", "WGダメージ+1"],
      "2_kr": ["피해량 +10%", "WG 감소량 +1"],
      "2_zh": ["伤害量+10%", "WG降低量+1"],
      "3":    ["+10% effect chance"],
      "3_jp": ["効果発生率+10%"],
      // ... etc for levels 4, 5
    },

    // ── Gameplay data ──
    "wgr": 1,                                 // Weakness Gauge Reduction
    "cd": null,                               // Cooldown in turns (string or null)
    "buff": [],                               // Buff effect IDs applied
    "debuff": ["BT_REMOVE_BUFF"],             // Debuff effect IDs applied
    "offensive": true,                        // Is an offensive skill
    "target": "mono",                         // "mono" (single) | "multi" (AoE)

    // ── Burst Effect (optional) ──
    "burnEffect": { ... }
  }
}
```

### Descriptions — `<color>` tags

Descriptions use Unity-style rich text for highlighting:
- `<color=#28d9ed>value</color>` — cyan, used for scalable values (%, turns, counts)
- `<color=#ffd732>value</color>` — gold, used for special conditions (Irregular Monster, etc.)

Multi-line descriptions use `\\n` (escaped newline in JSON).

### Enhancement — levels 2 to 5

Each level is an array of bonus strings. Level 1 is the base (no enhancement entry). Only English keys (`"2"`, `"3"`, `"4"`, `"5"`) are required; localized variants (`_jp`, `_kr`, `_zh`) follow.

### `burnEffect` (Burst skills) — optional

When a skill has Burst variants (AP-consuming enhanced versions), they appear in `burnEffect`:

```json
{
  "burnEffect": {
    "SKT_BURST_1": {
      "effect": "Changes to Enhanced Attack\\nActivates Dual Attack with 1 ally",
      "effect_jp": "強化攻撃に変更\\n連携1体発生",
      "effect_kr": "강화 공격으로 변경\\n아군 1명 협공 호출",
      "effect_zh": "转化为强化攻击\\n呼叫1名友军发动夹攻",
      "cost": 80,          // AP cost
      "level": 1,          // Burst level (1, 2, or 3)
      "offensive": true,
      "target": "mono"     // "mono" | "multi"
    },
    "SKT_BURST_2": { "cost": 120, "level": 2, ... },
    "SKT_BURST_3": { "cost": 160, "level": 3, ... }
  }
}
```

**Note:** Burst Level 3 is unlocked at Transcendence level 5.

### Chain Passive — extra fields

`SKT_CHAIN_PASSIVE` includes both the Chain skill effect and the Dual Attack effect. It has additional fields:

```jsonc
{
  "SKT_CHAIN_PASSIVE": {
    // ... all standard skill fields ...

    "wgr_dual": 1,                   // WGR for the dual attack portion
    "dual_offensive": true,          // Is the dual attack offensive
    "dual_target": "mono",           // "mono" | "multi"
    "dual_buff": [],                 // Buffs applied by dual attack
    "dual_debuff": ["BT_REMOVE_BUFF"] // Debuffs applied by dual attack
  }
}
```

---

## Core Fusion characters

Characters with IDs starting with `27xxxxx` are Core Fusion variants. They share the same base structure but add fusion-specific fields:

```jsonc
{
  // All standard character fields...

  "fusionType": "core-fusion",           // Always "core-fusion"
  "originalCharacter": "2000037",        // ID of the base character
  "isPermanent": true,                   // Whether fusion is permanent

  "fusionRequirements": {
    "transcendence": 5,                  // Required transcendence level on base character
    "material": {
      "id": "Fusion-Type Core",          // Material name
      "quantity": 300                    // Material quantity needed
    }
  },

  "fusionLevels": [
    {
      "level": 1,
      "requireItemID": "Fusion-Type Core",
      "skillUpgrades": {
        "skill_1": { "value": "300", "level": null },
        "skill_2": { "value": "1",   "level": null },
        "skill_3": { "value": "1",   "level": null },
        "skill_4": { "value": "1",   "level": null },
        "skill_23": { "value": "1",  "level": "1" }
      }
    },
    { "level": 2, ... },
    { "level": 3, ... },
    { "level": 4, ... },
    { "level": 5, ... }
  ]
}
```

`fusionLevels` defines 5 progression levels. Each `skillUpgrades` entry:
- `skill_1` through `skill_4`: correspond to the 4 skills
- `skill_23`: special combined upgrade for skills 2 & 3
- `value`: material cost for that upgrade
- `level`: resulting skill level after upgrade (`null` = no level change)

---

## Effect IDs

The `buff` and `debuff` arrays use effect IDs that reference `data/effects/buffs.json` and `data/effects/debuffs.json`.

Common patterns:
- `BT_STAT|ST_ATK` — stat modifier (pipe-separated: effect type | stat)
- `BT_REMOVE_BUFF` — buff removal
- `BT_AGGRO` — taunt
- `BT_COOL_CHARGE` — cooldown reduction
- `BT_SHIELD_BASED_CASTER` — barrier based on caster stats
- `BT_CALL_BACKUP` — dual attack trigger
- `BT_ACTION_GAUGE` — AP manipulation

---

## Related types (TypeScript)

| Type | File | Purpose |
|------|------|---------|
| `Character` | `src/types/character.ts` | Full character data from JSON |
| `SkillData` | `src/types/character.ts` | Single skill entry |
| `BurnEffect` | `src/types/character.ts` | Single burst effect entry |
| `Transcendence` | `src/types/character.ts` | Transcendence record |
| `SkillPriority` | `src/types/character.ts` | Skill upgrade priority |
| `CharacterIndex` | `src/types/character.ts` | Lightweight entry for lists/search |
| `CharacterStats` | `src/types/character.ts` | Stats from `generated/character-stats.json` |
| `CharacterProfile` | `src/types/character.ts` | Bio data from `character-profiles.json` |
| `CharacterProsCons` | `src/types/character.ts` | Editorial pros/cons |
| `CharacterSynergies` | `src/types/character.ts` | Partner/synergy data |
| `SkillKey` | `src/types/enums.ts` | Skill key enum |
| `ElementType` | `src/types/enums.ts` | Element enum |
| `ClassType` | `src/types/enums.ts` | Class enum |
| `RarityType` | `src/types/enums.ts` | Rarity enum |
| `RoleType` | `src/types/enums.ts` | Role enum |
| `ChainType` | `src/types/enums.ts` | Chain type enum |

---

## Image paths

| Asset | Path pattern |
|-------|-------------|
| Portrait | `/images/characters/portrait/CT_{id}.webp` |
| ATB (turn icon) | `/images/characters/atb/IG_Turn_{id}.webp` |
| Skill icon | `/images/characters/skill/Skill_{type}_{id}.webp` |

Where `{type}` is `First`, `Second`, `Ultimate`, or `ChainPassive_{element}_{chainType}`.

---

## Minimal example (1★ character, abridged)

```json
{
  "ID": "2000045",
  "Fullname": "Bleu",
  "Fullname_jp": "ブルー",
  "Fullname_kr": "블루",
  "Fullname_zh": "布鲁",
  "Rarity": 1,
  "Element": "Water",
  "Class": "Mage",
  "SubClass": "Wizard",
  "rank": "D",
  "role": "dps",
  "skill_priority": {
    "First": { "prio": 2 },
    "Second": { "prio": 3 },
    "Ultimate": { "prio": 1 }
  },
  "tags": [],
  "Chain_Type": "Join",
  "gift": "Magic Tool",
  "VoiceActor": "VA. Todd Haberkorn",
  "VoiceActor_jp": "CV. 大桃陽介",
  "VoiceActor_kr": "CV. 김민주",
  "VoiceActor_zh": "CV. 大桃阳介",
  "transcend": {
    "1": null,
    "2": "ATK DEF HP +5%",
    "3": "ATK DEF HP +10%",
    "4": "ATK DEF HP +16%\n+3% Critical Hit Chance\n+1 Chain Passive Weakness Gauge damage",
    "4_jp": "...", "4_kr": "...", "4_zh": "...",
    "5": "ATK DEF HP +22%\nBurst Level 3 Unlocked",
    "5_jp": "...", "5_kr": "...", "5_zh": "...",
    "6": "ATK DEF HP +30%\n+3% Critical Hit Chance\n+25 AP at battle start",
    "6_jp": "...", "6_kr": "...", "6_zh": "..."
  },
  "skills": {
    "SKT_FIRST": { "name": "...", "wgr": 1, "cd": null, "offensive": true, "target": "mono", ... },
    "SKT_SECOND": { "name": "...", "wgr": 1, "cd": "3", "offensive": true, "target": "mono", ... },
    "SKT_ULTIMATE": { "name": "...", "wgr": 2, "cd": "3", "offensive": true, "target": "multi", ... },
    "SKT_CHAIN_PASSIVE": { "name": "...", "wgr": 2, "wgr_dual": 1, "cd": null, ... }
  }
}
```
