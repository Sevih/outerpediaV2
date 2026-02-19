# Inline Tags — Text Formatting System

## Overview

Inline tags are special markers embedded in text strings that get rendered as interactive React components (icons, tooltips, links). They are used throughout the site in any text field processed by `parseText()`: skill descriptions, synergy reasons, pros/cons, gear recommendations, guides, etc.

Tags follow the format `{TYPE/value}` and are **identical across all languages** — only the surrounding text is translated.

---

## Quick Reference

| Tag | Purpose | Example | Renders |
|-----|---------|---------|---------|
| `{B/name}` | Buff | `{B/BT_STAT\|ST_ATK}` | Icon + colored label + tooltip |
| `{D/name}` | Debuff | `{D/BT_DOT_BURN}` | Icon + colored label + tooltip |
| `{E/element}` | Element | `{E/Fire}` | Element icon + colored label |
| `{C/class}` | Class | `{C/Ranger}` | Class icon + label |
| `{C/class\|subclass}` | Subclass | `{C/Striker\|Attacker}` | Subclass icon + label |
| `{S/stat}` | Stat | `{S/ATK}` | Stat icon + label |
| `{P/name}` | Character link | `{P/Valentine}` | Clickable name + hover portrait |
| `{EE/name}` | Exclusive Equipment | `{EE/Valentine}` | Badge + tooltip with EE details |
| `{AS/setname}` | Armor Set | `{AS/Attack Set}` | Badge + tooltip with set bonuses |
| `{SK/char\|skill}` | Skill reference | `{SK/Valentine\|S3}` | Skill icon + name + tooltip |
| `{I-W/name}` | Weapon | `{I-W/Surefire Greatsword}` | Badge + tooltip |
| `{I-A/name}` | Amulet | `{I-A/Death's Hold}` | Badge + tooltip |
| `{I-T/name}` | Talisman | `{I-T/Executioner's Charm}` | Badge + tooltip |
| `{I-I/name}` | Item | `{I-I/Sandwich}` | Badge + tooltip |

---

## Tag Details

### `{B/name}` — Buff

Renders a buff icon with colored label (`text-buff`) and a tooltip showing the buff description.

**Value:** The buff internal name from `data/effects/buffs.json`.

```
{B/BT_UNDEAD}
{B/BT_COOL_CHARGE}
{B/BT_CALL_BACKUP}
{B/BT_STAT|ST_ATK}
{B/BT_STAT|ST_CRITICAL_RATE}
```

For stat-type buffs, use the `|` separator: `{B/BT_STAT|ST_ATK}` matches the buff whose `name` field is `BT_STAT|ST_ATK`.

---

### `{D/name}` — Debuff

Same as buffs but for debuffs (`text-debuff` color). Data comes from `data/effects/debuffs.json`.

```
{D/BT_DOT_BURN}
{D/BT_DOT_BLEED}
{D/BT_STAT|ST_DEF}
```

---

### `{E/element}` — Element

Renders the element icon + colored label. Uses element-specific colors.

**Value:** One of `Fire`, `Water`, `Earth`, `Light`, `Dark` (case-sensitive).

```
{E/Fire}
{E/Water}
{E/Dark}
```

---

### `{C/class}` and `{C/class|subclass}` — Class

Renders a class icon + label.

**Simple class:**
```
{C/Striker}
{C/Defender}
{C/Ranger}
{C/Healer}
{C/Mage}
```

**With subclass** (pipe-separated):
```
{C/Striker|Attacker}
{C/Mage|Buffer}
```

When a subclass is provided, the subclass icon and name are shown instead of the main class.

---

### `{S/stat}` — Stat

Renders a stat icon + label. Data comes from `data/stats.json`.

**Value:** The stat key as defined in the stats data.

```
{S/ATK}
{S/SPD}
{S/DEF}
{S/HP}
```

---

### `{P/name}` — Character Link

Renders a clickable character name that links to their page. On hover, shows a tooltip with portrait, name, rarity stars, element, and class.

**Value:** The character's English display name (as shown in `data/character/*.json`).

```
{P/Valentine}
{P/Vlada}
{P/Tamamo-no-Mae}
{P/Demiurge Vlada}
{P/Kitsune of Eternity Tamamo-no-Mae}
```

Note: The name is the **display name**, not the slug. The component resolves it to a slug internally.

---

### `{EE/name}` — Exclusive Equipment

Renders a badge with the EE icon. On hover, shows a tooltip with the EE name, owner character, effect description, and +10 enhanced effect.

**Value:** The character's English display name (the component looks up the EE by character ID).

```
{EE/Valentine}
{EE/Vlada}
```

Alternatively, the EE name itself can be used:
```
{EE/The Supreme Witch's Companion}
{EE/Cleaning Brush}
```

---

### `{AS/setname}` — Armor Set

Renders a badge with the set icon. On hover, shows a tooltip with 2-piece and 4-piece set bonuses.

**Value:** The set name. The component supports flexible matching — the following are equivalent:
- `{AS/Attack}`
- `{AS/Attack Set}`

```
{AS/Attack Set}
{AS/Speed Set}
{AS/Critical Set}
```

---

### `{SK/character|skill}` — Skill Reference

Renders the skill icon + skill name. On hover, shows a detailed tooltip with skill description, cooldown, WGR, and character name.

**Value:** Character display name + pipe + skill shorthand.

**Skill shorthands:**
| Shorthand | Meaning |
|-----------|---------|
| `S1` | First skill (basic attack) |
| `S2` | Second skill |
| `S3` | Ultimate skill |
| `Passive` | Passive skill |
| `Chain` | Chain skill |

```
{SK/Valentine|S3}
{SK/Vlada|S2}
{SK/Vlada|S3}
```

---

### `{I-W/name}` — Weapon

Renders a badge with the weapon icon. On hover, shows tooltip with name, class restriction, and effect description.

**Value:** The weapon's English name from `data/equipment/weapon.json`.

```
{I-W/Surefire Greatsword}
{I-W/Noblewoman's Guile}
{I-W/Gorgon's Wrath [Ranger]}
```

---

### `{I-A/name}` — Amulet (Accessory)

Same rendering style as weapons. Data from `data/equipment/accessory.json`.

**Value:** The amulet's English name.

```
{I-A/Death's Hold}
```

---

### `{I-T/name}` — Talisman

Same rendering style as weapons. Data from `data/equipment/talisman.json`.

**Value:** The talisman's English name.

```
{I-T/Executioner's Charm}
```

---

### `{I-I/name}` — Item

Renders a badge with the item icon. On hover, shows tooltip with name and description. Data from `data/items.json`.

**Value:** The item's English name.

```
{I-I/Sandwich}
```

---

## Line Breaks

`parseText()` also handles line breaks. Use `\n` in JSON strings to insert a `<br />` element:

```json
"First line\nSecond line"
```

---

## Rules for Contributors

### Tags are language-neutral

Tags must be **identical across all 4 languages**. Only the surrounding text changes:

```json
{
  "en": "Provides {B/BT_UNDEAD} to the team",
  "kr": "팀에게 {B/BT_UNDEAD} 제공",
  "jp": "チームに{B/BT_UNDEAD}を付与",
  "zh": "为团队提供{B/BT_UNDEAD}"
}
```

### Names must match data files exactly

- **Buffs/Debuffs**: Must match the `name` field in `data/effects/buffs.json` / `debuffs.json`
- **Elements**: Must be exactly `Fire`, `Water`, `Earth`, `Light`, or `Dark`
- **Classes**: Must be exactly `Striker`, `Defender`, `Ranger`, `Healer`, or `Mage`
- **Characters** (`{P/}`, `{EE/}`, `{SK/}`): Must match the character's English display name
- **Equipment** (`{I-W/}`, `{I-A/}`, `{I-T/}`): Must match the `name` field in the corresponding equipment JSON
- **Sets** (`{AS/}`): Must match the set name (flexible matching supported)
- **Stats** (`{S/}`): Must match a key in `data/stats.json`
- **Items** (`{I-I/}`): Must match the `name` field in `data/items.json`

### Error handling

If a tag references a name that doesn't exist in the data, the component renders **red fallback text** to make it easy to spot mistakes during development.

### Tags can be combined freely

Tags can appear anywhere in a text string, mixed with regular text:

```
"Her {SK/Valentine|S3} provides {B/BT_UNDEAD} and pairs well with {P/Vlada}'s {D/BT_DOT_BURN}"
```

### No nesting

Tags cannot be nested inside each other. This is invalid:
```
{B/{D/BT_DOT_BURN}}   ← WRONG
```

---

## Architecture

```
Text with {B/BT_UNDEAD} tags
        │
        ▼
src/lib/parse-text.tsx              parseText() — regex parser
        │                           Splits text on {TYPE/value} patterns
        │                           Dispatches to TAG_MAP factories
        ▼
src/app/components/inline/
├── EffectInline.tsx                {B/...} and {D/...}
├── ElementInline.tsx               {E/...}
├── ClassInline.tsx                 {C/...}
├── StatInline.tsx                  {S/...}
├── CharacterInline.tsx             {P/...}
├── EeInline.tsx                    {EE/...}
├── SetInline.tsx                   {AS/...}
├── SkillInline.tsx                 {SK/...}
├── WeaponInline.tsx                {I-W/...}
├── AmuletInline.tsx                {I-A/...}
├── TalismanInline.tsx              {I-T/...}
├── ItemInline.tsx                  {I-I/...}
├── InlineIcon.tsx                  Base component (icon + label)
└── InlineTooltip.tsx               Hover tooltip wrapper (Radix HoverCard)
```

### Data sources

| Tag | Data file |
|-----|-----------|
| `{B/...}` | `data/effects/buffs.json` |
| `{D/...}` | `data/effects/debuffs.json` |
| `{E/...}` | Hardcoded element list |
| `{C/...}` | Hardcoded class list |
| `{S/...}` | `data/stats.json` |
| `{P/...}` | `data/generated/characters-name-to-id.json` + `data/character/*.json` |
| `{EE/...}` | `data/equipment/ee.json` |
| `{AS/...}` | `data/equipment/sets.json` |
| `{SK/...}` | `data/character/*.json` (dynamic import) |
| `{I-W/...}` | `data/equipment/weapon.json` |
| `{I-A/...}` | `data/equipment/accessory.json` |
| `{I-T/...}` | `data/equipment/talisman.json` |
| `{I-I/...}` | `data/items.json` |

---

## Where tags are used

Tags are used in any field processed by `parseText()`:

- `data/partners.json` — synergy reasons
- `data/pros-cons.json` — pros/cons descriptions
- `data/reco/*.json` — gear recommendation notes
- `src/app/components/home/BeginnerGuides.tsx` — demo text
- Any future editorial content that calls `parseText()`

---

## Adding a new tag type

1. Create a new component in `src/app/components/inline/`
2. Add the tag mapping in `TAG_MAP` in `src/lib/parse-text.tsx`
3. Update the `TAG_REGEX` pattern to include the new tag type
4. Update this documentation
