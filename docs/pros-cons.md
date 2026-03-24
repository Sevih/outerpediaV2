# Pros & Cons — Data Format

## Overview

Each character's pros and cons are stored in a single shared file: `data/pros-cons.json`.
Entries are keyed by **character slug** (kebab-case, matching `data/character/*.json` filenames).

There is no pipeline validation step for this data — manual review is required.

```
data/
└── pros-cons.json      # All characters' pros & cons
```

---

## File structure

`pros-cons.json` is a JSON object where each key is a **character slug** and each value contains `pros` and `cons` arrays:

```json
{
  "valentine": {
    "pros": [
      { "en": "easy to build", "jp": "育成が簡単", "kr": "육성이 쉬움", "zh": "容易培养" },
      ...
    ],
    "cons": [
      { "en": "RNG reliant for her EE to activate", "jp": "...", "kr": "...", "zh": "..." },
      ...
    ]
  },
  "tamara": { ... }
}
```

---

## Fields

### pros / cons

Each is an array of **LangMap** objects — one object per bullet point.

```typescript
type LangMap = Partial<Record<Lang, string>>
// Lang = 'en' | 'jp' | 'kr' | 'zh'
```

| Key | Language | Required |
|-----|----------|----------|
| `en` | English | Yes (used as fallback) |
| `jp` | Japanese | No |
| `kr` | Korean | No |
| `zh` | Chinese | No |

The `en` key should always be present. Other languages fall back to English via `lRec()`.

### Empty state

When a character has no meaningful cons (or pros), use a single entry with `"-"`:

```json
"cons": [
  { "en": "-" }
]
```

---

## Inline tags

Text can contain inline tags for rich rendering. Tags stay **identical across all languages**.

| Tag | Type | Example |
|-----|------|---------|
| `{B/EffectName}` | Buff | `{B/BT_STAT\|ST_CRITICAL_RATE}` |
| `{D/EffectName}` | Debuff | `{D/BT_DOT_BURN}` |
| `{E/Element}` | Element with icon | `{E/Earth}` |
| `{C/ClassName}` | Class | `{C/Striker}` |
| `{P/CharacterName}` | Character link | `{P/Valentine}` |
| `{S/StatName}` | Stat | `{S/ATK}` |
| `{EE/Name}` | Exclusive Equipment | `{EE/...}` |
| `{SK/CharName\|SkillType}` | Skill reference | `{SK/Vlada\|S3}` |

### Common buff/debuff IDs used

| ID | Meaning |
|----|---------|
| `BT_STAT\|ST_CRITICAL_RATE` | Crit Rate buff/debuff |
| `BT_STAT\|ST_CRITICAL_DMG_RATE` | Crit Damage buff/debuff |
| `BT_STAT\|ST_ATK` | ATK buff/debuff |
| `BT_STAT\|ST_DEF` | DEF buff/debuff |
| `BT_STAT\|ST_SPEED` | Speed buff/debuff |
| `BT_STAT\|ST_COUNTER_RATE` | Counter Rate |
| `BT_STAT\|ST_PIERCE_POWER_RATE` | Penetration |
| `BT_STAT\|ST_BUFF_RESIST` | Buff Resistance |
| `BT_STAT\|ST_BUFF_CHANCE` | Buff Chance |
| `BT_CALL_BACKUP` | Dual Attack |
| `BT_INVINCIBLE` | Invincibility |
| `BT_IMMUNE` | Immunity |
| `BT_REVIVAL` | Revival |
| `BT_RESURRECTION` | Resurrection |
| `BT_AP_CHARGE` | AP Charge |
| `BT_SHIELD_BASED_CASTER` | Shield |
| `BT_ADDITIVE_TURN` | Extra Turn |
| `BT_COOL_CHARGE` | Cooldown Reduction |
| `BT_RUN_PASSIVE_SKILL_ON_TURN_END_DEFENDER_NO_CHECK` | End-of-turn passive |
| `SYS_BUFF_REVENGE` | Revenge |
| `BT_DOT_BURN` | Burn DoT |
| `BT_DOT_BLEED` | Bleed DoT |
| `BT_DOT_LIGHTNING` | Lightning DoT |
| `BT_FREEZE` | Freeze |
| `BT_STUN` | Stun |
| `BT_STONE` | Petrify |
| `BT_SEALED` | Sealed |
| `BT_SILENCE` | Silence |
| `BT_MARKING` | Marking |
| `BT_REMOVE_BUFF` | Buff Strip |
| `BT_STEAL_BUFF` | Buff Steal |

---

## TypeScript types

Defined in `src/types/character.ts`:

```typescript
export type CharacterProsCons = {
  pros: LangMap[];
  cons: LangMap[];
};
```

Where `LangMap` is from `src/types/common.ts`:

```typescript
type LangMap = Partial<Record<Lang, string>>
```

---

## Data access

Function in `src/lib/data/characters.ts`:

```typescript
export async function getCharacterProsCons(slug: string): Promise<CharacterProsCons | null>
```

- Reads `data/pros-cons.json`
- Returns the entry for the given slug, or `null` if not found
- Lookup is by **slug** (e.g. `"valentine"`, `"monad-eva"`, `"ais-wallenstein"`)

---

## Rendering

**Component**: `src/app/components/character/ProsConsSection.tsx`

- Two-column responsive grid (`md:grid-cols-2`)
- **Pros**: emerald theme (border, background, `+` prefix in emerald-400)
- **Cons**: red theme (border, background, `−` prefix in red-400)
- Each entry is localized via `lRec(entry, lang)` with English fallback
- Inline tags are parsed via `parseText()` into interactive components
- If both arrays are empty, the section is not rendered
- If one array is empty, it shows `—`

---

## Examples

### Minimal entry

```json
{
  "ame": {
    "pros": [
      { "en": "deal increased damage against bosses" },
      { "en": "has innate critical chance" }
    ],
    "cons": [
      { "en": "-" }
    ]
  }
}
```

### Full multilingual entry with inline tags

```json
{
  "vlada": {
    "pros": [
      {
        "en": "{SK/Vlada|S3} resets every time an enemy unit dies, perfect for wave clearing",
        "jp": "{SK/Vlada|S3}は敵が倒れるたびにリセットされ、ウェーブ殲滅に最適",
        "kr": "{SK/Vlada|S3}는 적이 죽을 때마다 초기화되어 웨이브 클리어에 최적",
        "zh": "{SK/Vlada|S3}在敌方死亡时重置，非常适合清波"
      },
      {
        "en": "{SK/Vlada|S2} detonates {D/BT_DOT_BURN} with increase damage(50%)",
        "jp": "{SK/Vlada|S2}は{D/BT_DOT_BURN}を起爆しダメージ50%増加",
        "kr": "{SK/Vlada|S2}는 {D/BT_DOT_BURN}을 폭발시켜 피해 50% 증가",
        "zh": "{SK/Vlada|S2}引爆{D/BT_DOT_BURN}并增加50%伤害"
      }
    ],
    "cons": [
      {
        "en": "dependent solely on attack stat",
        "jp": "攻撃力のみに依存",
        "kr": "공격력 스탯에만 의존",
        "zh": "完全依赖攻击属性"
      }
    ]
  }
}
```

---

## Architecture

```
data/pros-cons.json              Editorial pros/cons data (LangMap per entry)
        |
        v
src/lib/data/characters.ts       getCharacterProsCons(slug) -> CharacterProsCons | null
        |
        v
page.tsx (server)                Fetches data, passes to client component
        |
        v
ProsConsSection.tsx (client)     Renders two-column pros/cons with inline tag parsing
```

---

## Writing guidelines

- Keep entries concise (1-2 lines max)
- Start with lowercase (unless starting with a proper noun or tag)
- Use inline tags for buffs/debuffs/skills — don't write them as plain text
- Use `{SK/CharName|S1}`, `{SK/CharName|S2}`, `{SK/CharName|S3}` for skill references
- Use `"-"` as the only entry when a character truly has no pros or cons
- Always provide at least the `en` translation
- Prefer providing all 4 languages when possible
