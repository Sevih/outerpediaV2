# Core Fusion Extractor - Guide

## Overview

Core Fusion is a permanent transformation system in OUTERPLANE that unlocks a character's full potential in a new form. This extractor handles the automatic extraction of Core Fusion character data.

## Features

- ✅ Extracts complete character data using `CharacterExtractor`
- ✅ Adds Core Fusion specific metadata (requirements, levels, original character link)
- ✅ Automatically prefixes character name with "Core Fusion"
- ✅ Links bidirectionally to original character
- ✅ Extracts all 5 fusion levels with skill upgrade information

## Core Fusion Mechanics

### Requirements
- **Transcendence:** 5★ required
- **Material:** 300x Fusion-Type Core (ItemID: 60001)
- **Warning:** ⚠️ Transformation is **PERMANENT** and **IRREVERSIBLE**

### What Changes
- ✅ **All skills** change to new versions
- ✅ New skill names and effects
- ✅ New buffs/debuffs
- ❌ Level, evolution, transcendence are **maintained**

## Usage

### Extract Core Fusion Character

```bash
cd datamine/ParserV3
python fusion_extractor.py <fusion_character_id>
```

### Example: Core Fusion Veronica

```bash
python fusion_extractor.py 2700037
```

This will:
1. Extract character data for ID 2700037
2. Add Core Fusion metadata
3. Link to original character (2000037)
4. Save to `export/core-fusion-2700037.json`

### Output Structure

```json
{
  "ID": "2700037",
  "Fullname": "Core Fusion Veronica",
  "originalCharacter": "2000037",
  "fusionType": "core-fusion",
  "isPermanent": true,
  "fusionRequirements": {
    "transcendence": 5,
    "material": {
      "id": "60001",
      "quantity": 300
    }
  },
  "fusionLevels": [
    {
      "level": 1,
      "name": "",
      "description": "",
      "requireItemID": "60001",
      "skillUpgrades": {
        "skill_1": {"value": "300", "level": "1"},
        "skill_2": {"value": "1", "level": "1"},
        // ...
      }
    },
    // ... levels 2-5
  ],
  "skills": {
    // All new skills (completely different from original)
  }
}
```

## Integration with Website

### File Structure

```
src/data/char/
├── veronica.json                    # Original character
└── core-fusion-veronica.json        # Core Fusion form
```

### Original Character Link

Add to original character JSON (e.g., `veronica.json`):

```json
{
  "ID": "2000037",
  "Fullname": "Veronica",
  "hasCoreFusion": true,
  "coreFusionId": "2700037",
  // ... rest of data
}
```

### Display on Website

**Recommended UI:**

1. **On original character page** (e.g., Veronica):
   ```
   ⚠️ Core Fusion Available!
   This character can undergo Core Fusion at 5★ Transcendence.
   Note: This transformation is PERMANENT.
   [View Core Fusion Veronica →]
   ```

2. **On Core Fusion page** (e.g., Core Fusion Veronica):
   ```
   🔄 Core Fusion Form
   Original Character: [Veronica]

   Requirements:
   - 5★ Transcendence
   - 300x Fusion-Type Core

   ⚠️ Warning: This transformation is permanent and cannot be reversed.
   ```

## Data Files Used

| File | Purpose |
|------|---------|
| `CharacterFusionTemplet.bytes` | Maps original → fused character |
| `CharacterFusionLevelTemplet.bytes` | 5 fusion levels with skill upgrades |
| `CharacterTemplet.bytes` | Character base data |
| All other character templets | Skills, stats, etc. (via CharacterExtractor) |

## Currently Available Core Fusions

### Veronica → Core Fusion Veronica
- **Original ID:** 2000037
- **Fusion ID:** 2700037
- **Class:** Defender (Sweeper)
- **Element:** Water
- **Skills:** Completely new skill set
  - **First:** Battlefield Commander → **Resolute Command**
  - **Second:** Commander's Resolve → **Sword Destroyer**
  - **Ultimate:** Endurance Cannon → **Guardian Sword of the Kingdom**

## Adding New Core Fusion Characters

When new Core Fusion characters are added to the game:

1. **Extract game data** using AssetStudioModCLI
2. **Find the Fusion ID** in `CharacterFusionTemplet.bytes`
3. **Run extractor:**
   ```bash
   python fusion_extractor.py <fusion_id>
   ```
4. **Copy to website:**
   ```bash
   cp export/core-fusion-<id>.json ../../../src/data/char/core-fusion-<name>.json
   ```
5. **Update original character** JSON with `hasCoreFusion` and `coreFusionId`

## Technical Details

### Fusion Levels

Each fusion has 5 levels that unlock progressively. The data structure shows:

- **RequireItemID:** Material needed (60001 = Fusion-Type Core)
- **Skill upgrades:** Values for skills 1, 2, 3, 4, and 23
  - Currently, name/description fields are empty (not in TextSystem.bytes yet)
  - Skill upgrade values appear to be cooldown reduction or level increases

### Character ID Format

- **Original characters:** 2000XXX (e.g., 2000037 = Veronica)
- **Core Fusion characters:** 2700XXX (e.g., 2700037 = Core Fusion Veronica)

## Troubleshooting

### Issue: Fusion data not found

**Error:** `No Core Fusion data found for character ID XXXX`

**Solution:**
- Verify the character ID is correct
- Check if `CharacterFusionTemplet.bytes` contains the entry
- Ensure game assets are extracted and up to date

### Issue: Missing text for fusion levels

**Symptom:** Fusion level names/descriptions are empty

**Explanation:** This is expected behavior. The text IDs may not be in `TextSystem.bytes` yet. The system will still work, and text will appear when added to game files.

### Issue: Skills not different from original

**Solution:** Verify you're using the correct fusion character ID (2700XXX), not the original (2000XXX).

## Future Enhancements

Potential improvements for the extractor:

- [ ] Automatic detection of all Core Fusion characters in game files
- [ ] GUI integration with PyQt6 interface
- [ ] Batch extraction of all Core Fusion characters
- [ ] Diff comparison between original and fusion skills
- [ ] Material requirement extraction from game data (instead of hardcoded 300)

---

**Author:** ParserV3
**Date:** November 2025
**Version:** 1.0
