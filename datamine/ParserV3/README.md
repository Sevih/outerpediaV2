# ParserV3 - OUTERPLANE Game Data Extractor

**Version:** 3.0
**Author:** ParserV3
**Date:** October 2025

---

## Overview

ParserV3 is a comprehensive data extraction toolkit for the OUTERPLANE mobile game. It parses proprietary binary `.bytes` files from game assets and extracts structured character, skill, buff/debuff, exclusive equipment, and profile data into JSON format for use in the Outerpedia web application.

### Key Features

- **Binary File Parsing**: Custom parser for OUTERPLANE's `.bytes` templet format with VLQ encoding
- **Multi-Language Support**: Automatic detection and decoding of Korean, Japanese, English, and Chinese text
- **Character Data Extraction**: Complete character profiles including skills, transcendence, voice actors, and stats
- **Buff/Debuff System**: Automated extraction and metadata enrichment for 200+ game effects
- **Asset Management**: Batch copying and WebP conversion of character images
- **GUI Interface**: PyQt6-based GUI with binary explorer, JSON comparison, and export tools
- **Validation Tools**: Automated buff/debuff usage validation across all character files

---

## Architecture

### Data Flow

```
Game Files (.bytes)
       ↓
   Bytes Parser (lang.py for text decoding)
       ↓
   Extractor Modules
       ↓
   Export Manager (validation + metadata enrichment)
       ↓
   JSON Output → Outerpedia Web App
```

### Core Components

1. **Binary Parsing Layer** (`bytes_parser.py`, `lang.py`)
   - VLQ integer decoding
   - Multi-encoding text detection (UTF-8, CP949, Shift-JIS, EUC-KR)
   - Zero-copy parsing with memoryview

2. **Extraction Layer** (`character_extractor.py`, `buff_extractor.py`, etc.)
   - Character data aggregation from 10+ templet files
   - Buff/debuff identification and categorization
   - Conditional/passive buff detection

3. **Metadata Layer** (`buff_metadata_extractor.py`, `profile_manager.py`)
   - Label and description extraction (EN/JP/KR)
   - Icon mapping for effects
   - Profile data (birthday, height, weight, story)

4. **Export Layer** (`export_manager.py`, `asset_manager.py`)
   - JSON export with validation
   - Missing metadata detection
   - Asset copying and WebP conversion

5. **GUI Layer** (`gui_qt.py`, `export_dialogs_qt.py`, `ee_dialog.py`)
   - Interactive character extraction
   - Binary file explorer
   - Manual metadata input dialogs

---

## Installation

### Prerequisites

- **Python 3.10+** (required for modern type hints)
- **PyQt6** (for GUI)
- **cwebp** (for WebP conversion) - located in `datamine/pngTowebp/bin/`

### Setup

1. **Extract game assets** using AssetStudioModCLI:
   ```bash
   # Located in datamine/AssetStudioModCLI_net9_win64/
   # Extract to datamine/extracted_astudio/
   ```

2. **Install Python dependencies**:
   ```bash
   pip install PyQt6 requests
   ```

3. **Launch GUI**:
   ```bash
   cd datamine/ParserV3
   python gui_qt.py
   ```

---

## Quick Start

### Extract a Character (GUI)

1. Launch `gui_qt.py`
2. Enter character ID (e.g., `2000066` for Charlotte)
3. Click "Extract"
4. Review JSON comparison
5. Click "Export to data/character" if satisfied

### Extract a Core Fusion Character (GUI)

1. Launch `gui_qt.py`
2. Go to "Core Fusion" tab
3. Select a Core Fusion character from dropdown (or enter ID manually)
4. Click "Extract Core Fusion"
5. Review JSON preview
6. Click "Save to data/character/" to export

### Extract a Character (CLI)

```python
from character_extractor import CharacterExtractor
import json

# Extract Charlotte (ID: 2000066)
extractor = CharacterExtractor("2000066")
data = extractor.extract()

# Print formatted JSON
print(json.dumps(data, indent=2, ensure_ascii=False))
```

### Parse Any .bytes File

```python
from bytes_parser import Bytes_parser

# Parse BuffTemplet.bytes
parser = Bytes_parser("path/to/BuffTemplet.bytes")
data = parser.get_data()  # List of dicts

# Access columns
columns = parser.get_columns()  # {1: 'BuffID', 2: 'Type', ...}
```

---

## Directory Structure

```
ParserV3/
├── README.md              # This file
├── MODULES.md             # Technical documentation
│
├── Core Parsing
│   ├── bytes_parser.py    # Binary .bytes file parser (VLQ + memoryview)
│   └── lang.py            # Multi-language text decoder
│
├── Extractors
│   ├── character_extractor.py      # Main character data extraction
│   ├── buff_extractor.py           # Buff/debuff identification
│   ├── buff_metadata_extractor.py  # Buff labels/descriptions/icons
│   ├── profile_manager.py          # Character profiles (birthday, story)
│   └── ee_manager.py               # Exclusive Equipment extraction
│
├── Export & Validation
│   ├── export_manager.py           # JSON export + validation
│   ├── asset_manager.py            # Image asset copying
│   ├── webp_converter.py           # PNG → WebP conversion
│   ├── buff_validator.py           # Buff/debuff usage validation
│   └── json_comparator.py          # JSON diff tool
│
├── GUI
│   ├── gui_qt.py                   # Main PyQt6 interface
│   ├── export_dialogs_qt.py        # Metadata input dialogs
│   └── ee_dialog.py                # EE buff/debuff selection
│
├── Utilities
│   ├── cache_manager.py            # .bytes → JSON caching
│   ├── mapping_loader.py           # Enum → text mappings
│   ├── text_utils.py               # Text formatting (kebab-case)
│   └── youtube_search.py           # Video discovery (YouTube API)
│
└── Data
    ├── cache/                      # Cached parsed .bytes files
    └── export/                     # Exported character JSONs
        └── ignored_effects.json    # Effects to skip during extraction
```

---

## Common Tasks

### Add a New Character

1. Get character ID from game files (format: `2000XXX`)
2. Run extraction: `python gui_qt.py` → Enter ID → Extract
3. Review missing buffs/debuffs (dialog will appear)
4. Fill metadata or mark as ignored
5. Export to `data/character/{character-name}.json`
6. Copy assets automatically (portraits, skills, ATB, full art)

### Update Exclusive Equipment

1. `gui_qt.py` → "Tools" menu → "Update EE for Character"
2. Enter character ID
3. Select buffs/debuffs from checkboxes
4. Choose rank (E/D/C/B/A/S/SS/SSS)
5. Save → Updates `src/data/ee.json`

### Validate Buffs/Debuffs

```python
from buff_validator import BuffValidator

validator = BuffValidator()
validator.load_definitions()
results = validator.scan_character_files()

print(validator.format_results_text(results))
# Shows: undefined buffs, unused buffs, missing definitions
```

### Clean Up Unused Effects

1. `gui_qt.py` → "Tools" → "Scan Buffs/Debuffs"
2. Review "Unused Buffs" and "Unused Debuffs" sections
3. Decide which to remove
4. Manually delete from `src/data/buffs.json` / `src/data/debuffs.json`

---

## Configuration

### YouTube API Key

Edit `youtube_search.py`:
```python
API_KEY = "your_youtube_api_key_here"
```

Get a key from: [Google Cloud Console](https://console.cloud.google.com/) → YouTube Data API v3

### Ignored Effects

Add effects to skip during extraction in `export/ignored_effects.json`:
```json
[
  "BT_SOME_INTERNAL_EFFECT",
  "BT_DEBUG_BUFF"
]
```

### WebP Quality

Adjust in `asset_manager.py`:
```python
WebPConverter(quality=85)  # 0-100, default 85
```

---

## Data Sources

ParserV3 reads from these `.bytes` files (located in `extracted_astudio/assets/editor/resources/templetbinary/`):

| File | Purpose |
|------|---------|
| `CharacterTemplet.bytes` | Character basic info (name, rarity, element, class) |
| `CharacterSkillTemplet.bytes` | Skill definitions (name, type, damage) |
| `CharacterSkillLevelTemplet.bytes` | Skill level scaling (damage, cooldown, BuffIDs) |
| `BuffTemplet.bytes` | Buff/debuff definitions (type, category, effects) |
| `BuffToolTipTemplet.bytes` | Buff/debuff tooltips (labels, descriptions) |
| `TextSystem.bytes` | Localized text (EN/JP/KR) |
| `TrustTemplet.bytes` | Character gift preferences |
| `TrustLevelTemplet.bytes` | Trust level descriptions |
| `CVTemplet.bytes` | Voice actor information (EN/JP/KR) |
| `EquipmentTemplet.bytes` | Exclusive Equipment (name, stats, effects) |

---

## Troubleshooting

### Issue: "BuffTemplet.bytes not found"

**Solution**: Extract game assets using AssetStudioModCLI first.

### Issue: Mojibake (garbled text like "ã��ã��ã�¹ã��")

**Solution**: Text decoding happens automatically via `lang.py`. If issues persist:
1. Check if the text is in a non-standard encoding
2. Add language hints to `_LANG_PRIORS` in `lang.py`

### Issue: Missing buff/debuff metadata

**Solution**:
1. Dialog will prompt for manual input
2. Fill English label/description
3. Or add to `ignored_effects.json` if not user-facing

### Issue: Character extraction fails

**Solution**:
1. Check logs in console (detailed error messages)
2. Verify character ID exists in `CharacterTemplet.bytes`
3. Use Binary Explorer tab to inspect raw data

### Issue: WebP conversion fails

**Solution**: Ensure `cwebp.exe` exists at `datamine/pngTowebp/bin/cwebp.exe`

---

## Performance

### Optimization Techniques

1. **Caching**: Parsed `.bytes` files are cached as JSON in `cache/` directory
   - MD5 checksum validation
   - Speeds up repeated extractions by ~10x

2. **Zero-Copy Parsing**: `bytes_parser.py` uses `memoryview` to avoid allocating intermediate buffers

3. **Indexed Lookups**: Character extractor builds O(1) lookup tables for all templets

4. **Lazy Loading**: Modules only import dependencies when needed (e.g., WebP converter)

### Typical Performance

- First character extraction: ~2-3 seconds (includes cache warming)
- Subsequent extractions: ~0.5-1 second
- Full buff/debuff validation scan: ~5-10 seconds (100+ characters)

---

## Contributing

### Code Style

- **Language**: English for all docstrings and comments
- **Format**: Google-style docstrings
- **Type Hints**: Use modern Python 3.10+ type annotations
- **Naming**: `snake_case` for functions/variables, `PascalCase` for classes

### Adding a New Extractor

1. Create module in `ParserV3/` (e.g., `item_extractor.py`)
2. Import `Bytes_parser` and `CacheManager`
3. Follow pattern from `character_extractor.py`:
   ```python
   from bytes_parser import Bytes_parser
   from cache_manager import CacheManager

   class ItemExtractor:
       def __init__(self, item_id: str):
           self.cache = CacheManager(BYTES_FOLDER)
           # ...

       def extract(self) -> dict:
           # Parse templet files
           # Build data structure
           return data
   ```
4. Add to GUI if needed (`gui_qt.py` → new tab)

---

## License

This tool is for educational and data extraction purposes. Game data and assets are property of their respective owners (OUTERPLANE / Smilegate).

---

## Support

For issues or questions:
1. Check `MODULES.md` for technical details
2. Review docstrings in individual modules
3. Use GUI's "Binary Explorer" to inspect raw data
4. Check logs for detailed error messages

---

## Version History

- **v3.0** (October 2025): Complete rewrite with PyQt6 GUI, multi-language support, validation tools
- **v2.x**: Archived (legacy tkinter GUI)
- **v1.x**: Initial CLI-only version
