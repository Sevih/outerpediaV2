# Partners (Synergies) — Data Format

## Overview

Synergy / partner recommendations are stored in a single file: `data/partners.json`.
Each key is a **character slug** (matching `data/character/*.json` filenames), and the value describes which heroes synergize well with that character and why.

Displayed on each character's detail page in the "Synergies" section.

---

## File structure

`data/partners.json` is a flat JSON object keyed by character slug:

```json
{
  "character-slug": {
    "partner": [
      {
        "hero": ["partner-slug-1", "partner-slug-2"],
        "reason": {
          "en": "English reason",
          "kr": "Korean reason",
          "jp": "Japanese reason",
          "zh": "Chinese reason"
        }
      }
    ]
  }
}
```

---

## Fields

### `partner` (required)

Array of **partner groups**. Each group bundles one or more heroes that share the same synergy reason.

### `hero` (required)

Array of character slugs (kebab-case). Each slug must correspond to a file in `data/character/`.

A hero entry can also be an **inline tag** instead of a slug — used when the partner is a class rather than a specific character:

```json
"hero": ["{C/Mage}"]
```

When the entry starts with `{`, the component renders it as parsed inline text (class icon + label) instead of a character link.

### `reason` (required)

A `LangMap` object providing the synergy explanation in all 4 languages (`en`, `kr`, `jp`, `zh`). English is used as fallback.

Reasons support **inline tags** for buffs, debuffs, classes, items, etc.:

| Tag | Usage |
|-----|-------|
| `{B/name}` | Buff |
| `{D/name}` | Debuff |
| `{C/ClassName}` | Class with icon |
| `{I-W/WeaponName}` | Weapon reference |

Tags must be **identical across all 4 languages** — only the surrounding text is translated.

---

## Examples

### Simple synergy (one partner, one reason)

```json
{
  "fatal": {
    "partner": [
      {
        "hero": ["gnosis-beth"],
        "reason": {
          "en": "Provides {B/BT_STEALTHED}",
          "kr": "{B/BT_STEALTHED} 제공",
          "jp": "{B/BT_STEALTHED}を付与",
          "zh": "提供{B/BT_STEALTHED}"
        }
      }
    ]
  }
}
```

### Multiple partners sharing a reason

```json
{
  "ember": {
    "partner": [
      {
        "hero": ["vlada", "maxie", "bell-cranel"],
        "reason": {
          "en": "{D/BT_DOT_BURN} team",
          "kr": "{D/BT_DOT_BURN} 팀",
          "jp": "{D/BT_DOT_BURN}チーム",
          "zh": "{D/BT_DOT_BURN}队伍"
        }
      }
    ]
  }
}
```

### Multiple synergy groups for one character

```json
{
  "maxie": {
    "partner": [
      {
        "hero": ["roxie", "notia"],
        "reason": {
          "en": "The twins will activate each other's skills and apply debuffs to launch great combo attacks",
          "kr": "...",
          "jp": "...",
          "zh": "..."
        }
      },
      {
        "hero": ["vlada", "ember", "bell-cranel"],
        "reason": {
          "en": "{D/BT_DOT_BURN} team",
          "kr": "...",
          "jp": "...",
          "zh": "..."
        }
      }
    ]
  }
}
```

### Class tag instead of specific character

```json
{
  "core-fusion-lisha": {
    "partner": [
      {
        "hero": ["{C/Mage}"],
        "reason": {
          "en": "Benefits from her EE and charges her EE+10 {B/BT_STAT|ST_ATK}",
          "kr": "...",
          "jp": "...",
          "zh": "..."
        }
      }
    ]
  }
}
```

---

## Architecture

```
data/partners.json                   Raw partner data (single file, all characters)
        │
        ▼
src/lib/data/characters.ts           getCharacterPartners(slug) → CharacterSynergies | null
        │                            Reads the full file, returns data for the given slug
        ▼
page.tsx (server)                    Passes partner data to the client component
        │
        ▼
SynergiesSection.tsx                 Renders partner groups with portraits, names, and reasons
```

### Types (`src/types/character.ts`)

```typescript
/** A synergy partner group (shared reason for 1+ heroes) */
type CharacterPartner = {
  hero: string[];       // Character slugs or inline tags
  reason: LangMap;      // Localized explanation
};

/** Synergy / partner data for a character */
type CharacterSynergies = {
  partner: CharacterPartner[];
};
```

---

## Rendering behavior

The `SynergiesSection` component handles each `hero` entry differently:

| Entry type | Detection | Rendering |
|------------|-----------|-----------|
| Character slug | Does NOT start with `{` | Portrait + localized name + link to character page |
| Inline tag | Starts with `{` | Parsed text (e.g. class icon + label) |
| Unknown slug | Slug not found in `characters-slug-to-id.json` | Red fallback text |

Reasons are rendered via `parseText()` which expands inline tags (`{B/...}`, `{D/...}`, etc.) into styled components with icons.

---

## Adding a new partner entry

1. Open `data/partners.json`
2. Find the character slug (or add a new key if the character has no partners yet)
3. Add a new object to the `partner` array with `hero` and `reason`
4. Provide all 4 language translations in `reason` — keep inline tags identical across languages
5. Verify that all hero slugs exist in `data/character/`
