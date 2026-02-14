# ParserV3 - Technical Module Documentation

This document provides in-depth technical documentation for all modules in ParserV3.

---

## Table of Contents

- [Core Parsing](#core-parsing)
  - [bytes_parser.py](#bytes_parserpy)
  - [lang.py](#langpy)
- [Extractors](#extractors)
  - [character_extractor.py](#character_extractorpy)
  - [buff_extractor.py](#buff_extractorpy)
  - [buff_metadata_extractor.py](#buff_metadata_extractorpy)
  - [profile_manager.py](#profile_managerpy)
  - [ee_manager.py](#ee_managerpy)
- [Export & Validation](#export--validation)
  - [export_manager.py](#export_managerpy)
  - [asset_manager.py](#asset_managerpy)
  - [webp_converter.py](#webp_converterpy)
  - [buff_validator.py](#buff_validatorpy)
  - [json_comparator.py](#json_comparatorpy)
- [GUI](#gui)
  - [gui_qt.py](#gui_qtpy)
  - [export_dialogs_qt.py](#export_dialogs_qtpy)
  - [ee_dialog.py](#ee_dialogpy)
- [Utilities](#utilities)
  - [cache_manager.py](#cache_managerpy)
  - [mapping_loader.py](#mapping_loaderpy)
  - [text_utils.py](#text_utilspy)
  - [youtube_search.py](#youtube_searchpy)

---

## Core Parsing

### bytes_parser.py

**Purpose**: Parse OUTERPLANE's proprietary `.bytes` binary format into structured Python dictionaries.

#### File Format

OUTERPLANE uses a custom binary format for templet data:

```
[HEADER]<SEPARATOR_LINE>[ENTRY_1]<SEPARATOR_LINE>[ENTRY_2]<SEPARATOR_LINE>...
```

**Separators**:
- `SEPARATOR_LINE`: `b"\x00\x00\x00\x00\x00\x00\x00"` (7 null bytes) - separates entries
- `SEPARATOR_FIELD`: `b"\x00\x00\x00"` (3 null bytes) - separates fields within entry
- `SEPARATOR_MINI`: `b"\x00\x00"` (2 null bytes) - used in compact headers

#### Header Structure

```
[1 byte: class_name_length][class_name_bytes]<SEPARATOR_FIELD>
[little-endian int: column_count]<SEPARATOR_FIELD>
[column_names: [1 byte: length][name_bytes]...]
```

**Example**:
```
[14]BuffTemplet[0x00 0x00 0x00][0x0A 0x00][0x00 0x00 0x00][6]BuffID[8]Type...
```

#### Entry Structure

Each entry contains multiple fields:

```
[VLQ: payload_length][payload_bytes][VLQ: column_index]<SEPARATOR_FIELD>...
```

**VLQ (Variable-Length Quantity) Encoding**:
- 7 bits of data per byte
- MSB (bit 7) = continuation flag (1 = more bytes follow, 0 = last byte)
- Little-endian bit order

**Example**:
```
Value: 127 → 0x7F (single byte)
Value: 128 → 0x80 0x01 (two bytes: 0x80 & 0x7F = 0, continue; 0x01 & 0x7F = 1)
Value: 300 → 0xAC 0x02 (two bytes: 0xAC & 0x7F = 44, continue; 0x02 & 0x7F = 2)
```

#### Class: Bytes_parser

**Constructor**:
```python
Bytes_parser(file_path: str)
```
- Reads and parses `.bytes` file immediately
- Stores parsed data in `self.data`

**Key Methods**:

1. **`get_data() -> List[Dict[str, str]]`**
   - Returns list of parsed rows as dictionaries
   - Keys = column names, Values = decoded strings

2. **`get_columns() -> Dict[int, str]`**
   - Returns column definitions
   - Format: `{1: 'BuffID', 2: 'Type', ...}`

3. **`split_head_body(file_path: str) -> None`**
   - Reads binary file
   - Splits into header and body entries using `SEPARATOR_LINE`

4. **`defineHead() -> None`**
   - Parses header to extract:
     - Class name (e.g., "BuffTemplet")
     - Column count
     - Column names (indexed from 1)

5. **`parse_body() -> None`**
   - Iterates over body entries
   - For each field:
     - Reads VLQ payload length
     - Extracts payload bytes
     - Reads VLQ column index
     - Decodes payload using `lang.decode_with_lang_prior()`
   - Handles missing column indices (reuse last valid)
   - Handles duplicate keys (adds `_fallback1`, `_fallback2`, etc.)

**Performance Optimizations**:

1. **Zero-Copy Parsing**:
   ```python
   mv = memoryview(entry)  # No copy, direct view into bytes
   blob_view = mv[start:end]  # Slice without allocation
   raw_bytes = blob_view.tobytes()  # Only copy when decoding
   ```

2. **VLQ without Allocations**:
   ```python
   def _read_vlq_view(self, mv: memoryview, start: int) -> tuple[int | None, int]:
       # Direct byte access: mv[i] (no intermediate buffers)
   ```

3. **Iterator-Based Field Splitting**:
   ```python
   def _iter_fields_view(self, mv: memoryview, sep: bytes) -> Iterator[tuple[int, int]]:
       # Yields (start, end) indices without calling .split()
   ```

**Example Usage**:
```python
from bytes_parser import Bytes_parser

parser = Bytes_parser("BuffTemplet.bytes")

# Get all data
data = parser.get_data()
# [{'BuffID': 'BT_STAT|ST_ATK', 'Type': 'BT_STAT', ...}, ...]

# Get columns
columns = parser.get_columns()
# {1: 'BuffID', 2: 'Type', 3: 'StatType', ...}

# Access specific row
first_buff = data[0]
print(first_buff['BuffID'])  # 'BT_STAT|ST_ATK'
```

---

### lang.py

**Purpose**: Multi-language text decoding with automatic encoding detection and language-aware scoring.

#### Problem

OUTERPLANE game files contain text in multiple encodings:
- Korean: CP949 (Windows-949) or UTF-8
- Japanese: Shift-JIS or UTF-8
- English: ASCII or UTF-8
- Chinese: GB18030 or UTF-8

**Challenges**:
1. No explicit encoding markers in `.bytes` files
2. Same byte sequence can decode differently in different encodings
3. Mojibake (garbled text) detection needed
4. Need to pick "best" decoding among multiple valid options

#### Solution: Language-Aware Scoring

1. **Detect field language** from field name hints:
   - "Korean" / "ko" → Korean text expected
   - "Japanese" / "jp" / "ja" → Japanese text expected
   - "English" / "en" → English text expected

2. **Generate candidate decodings** for multiple encodings:
   - UTF-8 (universal)
   - CP949 (Korean)
   - Shift-JIS (Japanese)
   - EUC-KR (Korean alternate)
   - GB18030 (Chinese)

3. **Score each candidate** using:
   - **Script detection**: Count Hangul, Kana, CJK, Latin characters
   - **Language priors**: Bonus for matching expected language
   - **Encoding origin bonus**: UTF-8 preferred over legacy encodings
   - **Mojibake penalty**: Detect common garbled patterns (â€™, ã‚©, etc.)
   - **Replacement character penalty**: Detect `�` (U+FFFD)

4. **Select highest-scoring candidate**

5. **Apply NFKC normalization** (Unicode compatibility normalization)

#### Key Functions

**1. `decode_with_lang_prior(field_name: Optional[str], raw: Optional[Union[str, bytes]]) -> str`**

Main API entry point.

**Parameters**:
- `field_name`: Column name (e.g., "Korean", "English_JP", "ko") for language hint
- `raw`: Bytes or string to decode

**Returns**: Decoded and normalized string

**Process**:
```python
# 1. Extract language hint from field_name
prior = _LANG_PRIORS.get(_canonical_lang_key(field_name or ""), {})
# Example: "Korean" → {'cp949': 50, 'utf-8': 30, 'euc-kr': 20}

# 2. Generate candidates
cands = _candidates_with_origin(raw)
# [('decoded_text_1', 'bytes:utf-8'), ('decoded_text_2', 'bytes:cp949'), ...]

# 3. Score each candidate
for txt, origin in cands:
    if prior:
        sc = _score_with_prior_and_origin(txt, prior, origin)
    else:
        sc = _score_overall(txt) + (20 if origin.startswith('bytes:utf-8') else 0)

# 4. Return best
return _normalize_post(best)
```

**Example**:
```python
# Korean text (CP949 encoded)
raw_bytes = b'\xc5\xd7\xbd\xba\xc6\xae'  # "테스트" in CP949
result = decode_with_lang_prior("Korean", raw_bytes)
print(result)  # '테스트'

# Auto-detect (no language hint)
result = decode_with_lang_prior(None, raw_bytes)
print(result)  # '테스트' (correct via scoring)
```

**2. `_score_overall(txt: str) -> float`**

Calculates overall quality score for a decoded string.

**Scoring Formula**:
```python
score = (
    _score_hangul(txt) * 1.5      # Korean characters (weighted)
  + _score_kana(txt) * 1.5        # Japanese characters (weighted)
  + _score_cjk(txt) * 1.0         # Chinese/CJK characters
  + _score_latin(txt) * 0.5       # Latin characters (lower weight)
  - _penalty_replacement(txt) * 100  # Heavy penalty for �
  - _mojibake_markers(txt) * 50      # Heavy penalty for mojibake
)
```

**Weights Rationale**:
- Hangul/Kana weighted higher (1.5x) because they're definitive language indicators
- CJK weighted 1x (can appear in Korean/Japanese/Chinese)
- Latin weighted 0.5x (common in all languages, less informative)

**3. `_score_with_prior_and_origin(txt: str, prior: dict, origin: str) -> float`**

Calculates score with language-specific encoding preferences.

**Formula**:
```python
score = _score_overall(txt) + encoding_bonus

# Encoding bonus from prior dict
# Example for Korean field:
# prior = {'cp949': 50, 'utf-8': 30, 'euc-kr': 20}
# If origin = 'bytes:cp949' → bonus = 50
```

**4. `_candidates_with_origin(raw: Union[str, bytes]) -> List[Tuple[str, str]]`**

Generates all possible decodings.

**Returns**: List of `(decoded_text, origin_label)` tuples

**Logic**:
```python
if isinstance(raw, bytes):
    # Try multiple encodings
    for enc in ['utf-8', 'cp949', 'shift-jis', 'euc-kr', 'gb18030']:
        try:
            decoded = raw.decode(enc)
            candidates.append((decoded, f'bytes:{enc}'))
        except:
            pass  # Skip invalid decodings
else:
    # Already a string, but might be double-encoded
    # Try encode(latin1) → decode(utf-8) fix
    candidates.append((raw, 'str:pass'))
    try:
        fixed = raw.encode('latin1').decode('utf-8')
        candidates.append((fixed, 'str:fix'))
    except:
        pass
```

**5. Helper Functions**

- **`_score_hangul(s: str) -> int`**: Count Korean Hangul characters (U+AC00-U+D7A3)
- **`_score_kana(s: str) -> int`**: Count Japanese Hiragana + Katakana (U+3040-U+30FF)
- **`_score_cjk(s: str) -> int`**: Count CJK Unified Ideographs (U+4E00-U+9FFF)
- **`_score_latin(s: str) -> int`**: Count ASCII Latin characters (a-z, A-Z)
- **`_penalty_replacement(s: str) -> int`**: Count replacement characters (�, U+FFFD)
- **`_mojibake_markers(s: str) -> int`**: Count common mojibake patterns
  - Examples: "â€™" (should be "'"), "â€œ" (should be opening quote), "ãƒ", "ã‚©", "窶"

**6. `_normalize_post(s: str) -> str`**

Applies Unicode NFKC normalization.

**Purpose**: Convert compatibility characters to canonical forms
- Example: Full-width "Ａ" → Normal "A"
- Example: "ﬁ" (ligature) → "fi"

```python
import unicodedata
return unicodedata.normalize('NFKC', s)
```

#### Language Priors Configuration

```python
_LANG_PRIORS = {
    "korean": {"cp949": 50, "utf-8": 30, "euc-kr": 20},
    "japanese": {"shift-jis": 50, "utf-8": 30},
    "english": {"utf-8": 50, "ascii": 30},
    "chinese": {"gb18030": 50, "utf-8": 30},
}
```

**To add a new language**:
```python
_LANG_PRIORS["thai"] = {"tis-620": 50, "utf-8": 30}
```

#### Edge Cases Handled

1. **Empty/None input**: Returns `""` (empty string)
2. **Already a string**: Still attempts encoding fix (latin1→utf8)
3. **All decodings fail**: Returns best-effort latin-1 with replacement
4. **Duplicate candidates**: Keeps all, scored independently
5. **Mixed-language text**: Scores based on dominant script

---

## Extractors

### character_extractor.py

**Purpose**: Extract complete character data from multiple templet files and aggregate into a single JSON structure.

#### Data Sources (10+ templet files)

| File | Data Extracted |
|------|----------------|
| `CharacterTemplet.bytes` | Name, Rarity, Element, Class, SubClass, Release Date, GroupNum |
| `CharacterSkillTemplet.bytes` | Skill names (EN/JP/KR) |
| `CharacterSkillLevelTemplet.bytes` | Skill damage, cooldown, BuffIDs, targeting, burn effects |
| `TrustTemplet.bytes` | Gift preferences (Like/Dislike items) |
| `TrustLevelTemplet.bytes` | Trust level transcendence descriptions |
| `CVTemplet.bytes` | Voice actors (EN/JP/KR with regional variants) |
| `BuffTemplet.bytes` | Buff/debuff data (via BuffExtractor) |
| `EquipmentTemplet.bytes` | Exclusive Equipment references |
| `TextSystem.bytes` | Localized text for enums (via mapping_loader) |

#### Class: CharacterExtractor

**Constructor**:
```python
CharacterExtractor(character_id: str, enable_youtube: bool = False)
```

**Parameters**:
- `character_id`: Character ID (e.g., "2000066" for Charlotte)
- `enable_youtube`: Whether to search for YouTube video (costs API quota)

**Key Methods**:

**1. `extract() -> dict`**

Main extraction method. Returns complete character JSON.

**Process**:
```python
def extract(self) -> dict:
    # 1. Initialize parsers (cached)
    self._init_parsers()

    # 2. Extract basic info (name, rarity, element, class)
    basic_info = self._extract_basic_info()

    # 3. Extract voice actors
    voice_actors = self._extract_voice_actors()

    # 4. Extract gift preferences
    gifts = self._extract_gift_preferences()

    # 5. Extract transcendence data
    transcend = self._extract_transcendence()

    # 6. Extract skills (main work)
    skills = self._extract_skills()

    # 7. Search YouTube video (optional)
    if self.enable_youtube:
        video_url = search_character_video(basic_info['Fullname'])

    # 8. Combine into final structure
    return {**basic_info, **voice_actors, **gifts, **transcend, "skills": skills, ...}
```

**2. `_extract_skills() -> dict`**

Extracts all skill types (s1, s2, s3, chain, dual).

**Skill Structure**:
```json
{
  "SKT_FIRST": {
    "name": "...",
    "name_jp": "...",
    "name_kr": "...",
    "label": "...",  // skill type label
    "label_jp": "...",
    "label_kr": "...",
    "type": "SKT_FIRST",
    "data": [
      {
        "level": 1,
        "damage": "123",
        "cooldown": "3",
        "buff": ["BT_STAT|ST_ATK"],
        "debuff": ["BT_SEALED"],
        "tags": ["ignore-defense"],
        "target": "ENEMY_SINGLE",
        "burn": "34"
      },
      // ... levels 2-10
    ],
    "enhance": [
      {"level": 1, "description": "...", "description_jp": "...", "description_kr": "..."},
      // ... enhancements
    ]
  },
  "SKT_SECOND": {...},
  "SKT_ULTIMATE": {...},
  "SKT_CHAIN_PASSIVE": {...},  // If exists
  "SKT_DUAL": {...}  // If exists
}
```

**Process**:
```python
def _extract_skills(self) -> dict:
    skills_out = {}

    for skill_type in ['SKT_FIRST', 'SKT_SECOND', 'SKT_ULTIMATE', 'SKT_CHAIN_PASSIVE', 'SKT_DUAL']:
        # 1. Find SkillID for this character + skill type
        skill_id = self._find_skill_id(char_id, skill_type)
        if not skill_id:
            continue

        # 2. Get skill name (EN/JP/KR)
        skill_data = self.skill_index.get(skill_id)

        # 3. Extract 10 levels of data
        levels = []
        for level in range(1, 11):
            level_data = self._extract_skill_level(skill_id, level)
            levels.append(level_data)

        # 4. Extract enhancements (skill-up descriptions)
        enhancements = self._extract_enhancements(skill_id)

        # 5. Find conditional buffs (ON_SPAWN, SKILL_FINISH, etc.)
        conditional_buffs = self.buff_extractor.find_conditional_buffs(char_id, skill_num)

        skills_out[skill_type] = {
            "name": skill_data['English'],
            "data": levels,
            "enhance": enhancements,
            # ...
        }

    return skills_out
```

**3. `_extract_skill_level(skill_id: str, level: int) -> dict`**

Extracts data for a single skill level.

**Returns**:
```json
{
  "level": 1,
  "damage": "123",
  "cooldown": "3",
  "buff": ["BT_STAT|ST_ATK"],
  "dual_buff": ["BT_ACTION_GAUGE"],  // For dual skills
  "debuff": ["BT_SEALED"],
  "dual_debuff": [],
  "tags": ["ignore-defense"],
  "target": "ENEMY_SINGLE",
  "burn": "34"
}
```

**Buff Extraction Logic**:
```python
# 1. Get BuffID string from CharacterSkillLevelTemplet
buff_id_str = level_data.get('BuffID', '')  # e.g., "BT_STAT|ST_ATK,BT_ACTION_GAUGE"

# 2. Extract using BuffExtractor
result = self.buff_extractor.extract_from_buff_ids(buff_id_str)
# Returns: {'buff': [...], 'debuff': [...], 'tags': [...]}

# 3. Separate regular and dual buffs (for dual skills)
if skill_type == 'SKT_DUAL':
    # Parse DualPassive field for dual-specific buffs
    dual_result = self.buff_extractor.extract_from_buff_ids(level_data.get('DualPassive', ''))
```

**4. `_extract_transcendence() -> dict`**

Extracts trust level descriptions (1-10 stars).

**Returns**:
```json
{
  "transcend": [
    {
      "level": 1,
      "description": "...",
      "description_jp": "...",
      "description_kr": "..."
    },
    // ... levels 2-10
  ]
}
```

**5. `_extract_voice_actors() -> dict`**

Extracts voice actor information with regional variants.

**Returns**:
```json
{
  "voice_actors": {
    "en": "Voice Actor Name (US)",
    "jp": "日本語声優",
    "kr": "한국어성우"
  }
}
```

**Special Handling**:
- Korean VA: Checks multiple CVID variants (base, +5000, +6000, +10000)
- English VA: Checks EN_US and EN_GB separately
- Falls back to "N/A" if not found

#### Performance Optimizations

**1. Class-Level Parser Cache**:
```python
class CharacterExtractor:
    _parsers_cache = None  # Shared across all instances

    @classmethod
    def _init_parsers(cls):
        if cls._parsers_cache is None:
            cls._parsers_cache = {
                'character': cache.get_data("CharacterTemplet.bytes"),
                'skills': cache.get_data("CharacterSkillTemplet.bytes"),
                # ... load all templets once
            }
```

**Benefit**: First extraction loads all data (~2s), subsequent extractions reuse (~0.5s)

**2. Index-Based Lookups**:
```python
# Build O(1) lookup tables
self.char_index = {c['CharacterID']: c for c in all_characters}
self.skill_index = {s['SkillID']: s for s in all_skills}
self.buff_index = {b['BuffID']: b for b in all_buffs}

# Fast lookup
char_data = self.char_index[character_id]  # O(1) instead of O(n) linear search
```

**3. Buff Extractor Caching**:
```python
class BuffExtractor:
    def __init__(self):
        self._buff_cache = {}  # Cache BuffID lookups

    def _get_buff_entries(self, buff_id: str) -> list:
        if buff_id in self._buff_cache:
            return self._buff_cache[buff_id]
        # ...
```

#### Special Character Handling

**1. Limited Characters**:
```python
# Detected by GroupNum field
if group_num in [1, 2, 3]:  # Seasonal, Collab, Festival
    data['limited'] = True
    data['tags'] = ['limited']
```

**2. Surname Handling**:
```python
# Special surnames that should be kept in fullname
INCLUDE_SURNAME = ["gnosis", "monad", "demiurge", "Kitsune of Eternity", ...]

if any(surname.casefold() in full_name.casefold() for surname in INCLUDE_SURNAME):
    # Keep full name with surname
    fullname = f"{surname} {firstname}"
else:
    # Use firstname only
    fullname = firstname
```

**3. Dual Skill Detection**:
```python
# Check if character has dual skill type
dual_skill_exists = any(
    skill.get('SkillType') == 'SKT_DUAL'
    for skill in all_skills
    if skill.get('CharacterID') == character_id
)
```

#### Placeholder Replacement

Skill descriptions contain placeholders like `[Buff_C_2000066_1_3]` that reference buff values.

**Format**:
- `[Buff_C_xxx]`: Current level buff value
- `[Buff_T_xxx]`: Target stat for buff
- `[Buff_V_xxx]`: Buff value at specific level

**Handled by**: `_process_description()` method with regex matching

---

### buff_extractor.py

**Purpose**: Extract and categorize buff/debuff identifiers from BuffID strings in skill data.

#### Problem

Skills reference buffs via comma-separated BuffID strings:
```
"BuffID": "BT_STAT|ST_ATK,BT_ACTION_GAUGE,BT_REMOVE_BUFF"
```

**Challenges**:
1. Multiple BuffIDs per skill (comma-separated)
2. Buffs can chain (multiple effects from one BuffID)
3. Need to classify as buff vs debuff
4. Some effects should be ignored (internal-only)
5. Conditional buffs not in BuffID field (ON_SPAWN, SKILL_FINISH)

#### Class: BuffExtractor

**Constructor**:
```python
BuffExtractor()
```
- Loads `BuffTemplet.bytes` once
- Loads `ignored_effects.json`
- Creates buff cache for O(1) lookups

**Key Methods**:

**1. `extract_from_buff_ids(buff_id_str: str) -> dict`**

Main extraction method.

**Parameters**:
- `buff_id_str`: Comma-separated BuffIDs (e.g., "BT_STAT|ST_ATK,BT_ACTION_GAUGE")

**Returns**:
```json
{
  "buff": ["BT_STAT|ST_ATK", "BT_ACTION_GAUGE"],
  "debuff": ["BT_SEALED"],
  "tags": ["ignore-defense"]
}
```

**Process**:
```python
def extract_from_buff_ids(self, buff_id_str: str) -> dict:
    # 1. Split by comma
    buff_ids = [bid.strip() for bid in buff_id_str.split(',')]

    buffs, debuffs, tags = [], [], []

    for buff_id in buff_ids:
        # 2. Special case: HEAVY_STRIKE
        if buff_id == 'HEAVY_STRIKE':
            buffs.append('HEAVY_STRIKE')
            continue

        # 3. Get buff entries from BuffTemplet (cached)
        buff_entries = self._get_buff_entries(buff_id)
        if not buff_entries:
            continue

        # 4. Process first entry (level 1)
        buff_data = buff_entries[0]
        results = self._process_buff_data(buff_data)

        # 5. results can be:
        #    - (identifier, is_buff) for normal buffs
        #    - (identifier, is_buff, tag) for special tags
        for result in results:
            if len(result) == 2:
                identifier, is_buff = result
                if is_buff:
                    buffs.append(identifier)
                else:
                    debuffs.append(identifier)
            elif len(result) == 3:
                _, _, tag = result
                tags.append(tag)

    # 6. Filter out ignored effects
    buffs = [b for b in buffs if b not in self.ignored_effects]
    debuffs = [d for d in debuffs if d not in self.ignored_effects]

    return {'buff': buffs, 'debuff': debuffs, 'tags': tags}
```

**2. `_process_buff_data(buff_data: dict) -> list`**

Processes a single buff entry and returns list of `(identifier, is_buff)` or `(identifier, is_buff, tag)` tuples.

**Classification Rules** (in order):

**RULE 0: Inherent Penetration (Special Tag)**
```python
if (not icon_name and
    buff_remove_type == 'ON_SKILL_FINISH' and
    buff_type == 'BT_STAT' and
    stat_type == 'ST_PIERCE_POWER_RATE'):
    return [(None, True, 'ignore-defense')]  # Tag instead of buff
```

**RULE 1: Interruption Buffs (Use IconName)**
```python
if 'Interruption' in icon_name and icon_name.startswith('IG_'):
    is_buff = not icon_name.endswith('_D')  # _D suffix = debuff
    return [(icon_name, is_buff)]
```

**RULE 2: BT_STAT (Combine with StatType)**
```python
if buff_type == 'BT_STAT' and stat_type != 'ST_NONE':
    identifier = f"{buff_type}|{stat_type}"  # e.g., "BT_STAT|ST_ATK"

    # Determine buff vs debuff by target
    if target_type.startswith('MY_TEAM') or target_type.startswith('ME'):
        is_buff = True  # Affects allies → buff
    elif target_type.startswith('ENEMY'):
        is_buff = False  # Affects enemies → debuff
    else:
        # Fallback to BuffDebuffType
        is_buff = 'BUFF' in buff_debuff_type and 'DEBUFF' not in buff_debuff_type

    return [(identifier, is_buff)]
```

**RULE 3: RemoveEffect as Identifier (for specific types)**
```python
if remove_effect and remove_effect.startswith('SYS_BUFF_'):
    # Only for certain buff types where RemoveEffect is meaningful
    if buff_type in ['BT_DMG_REDUCE', 'BT_DMG_INCREASE', 'BT_HEAL_BASED_TARGET']:
        identifier = remove_effect.replace('SYS_BUFF_', '')

        # Special case: TURN_HEAL → BT_CONTINU_HEAL
        if identifier == 'TURN_HEAL':
            identifier = 'BT_CONTINU_HEAL'

        is_debuff = target_type.startswith('ENEMY') or 'DEBUFF' in buff_debuff_type
        return [(identifier, not is_debuff)]
```

**RULE 4: Use Type Directly (fallback)**
```python
identifier = buff_type  # e.g., "BT_SEALED"

# Determine buff vs debuff by target
if target_type.startswith('MY_TEAM') or target_type.startswith('ME'):
    is_buff = True
elif target_type.startswith('ENEMY'):
    is_buff = False
else:
    # Fallback to BuffDebuffType
    is_buff = 'BUFF' in buff_debuff_type and 'DEBUFF' not in buff_debuff_type

return [(identifier, is_buff)]
```

**Multiple Results**:
Some buffs can produce multiple identifiers (e.g., Interruption + stat buff).

**3. `find_conditional_buffs(char_id: str, skill_num: str) -> list`**

Finds buffs with conditional activation (not in BuffID field).

**Conditional Types**:
- `ON_SPAWN`: Applied when character spawns
- `SKILL_FINISH`: Applied when skill ends
- `AVOID`: Triggered on dodge
- `ON_HIT`: Triggered when hit
- `COUNTER_ATTACK`: Triggered on counter

**Pattern**:
```
BuffID format: {char_id}_{skill_num}_{variant}
Example: "2000066_2_5" (Charlotte, skill 2, variant 5)
```

**Returns**: List of BuffIDs matching pattern and conditional types

**Example**:
```python
extractor = BuffExtractor()
conditional = extractor.find_conditional_buffs("2000066", "2")
# ['2000066_2_5', '2000066_2_7']  (Charlotte S2 conditional buffs)
```

#### Ignored Effects

Some effects are internal-only and should be skipped:
```json
// export/ignored_effects.json
[
  "BT_SOME_DEBUG_EFFECT",
  "BT_INTERNAL_MARKER"
]
```

**Usage**:
```python
# In extract_from_buff_ids()
filtered_buffs = [b for b in buffs if b not in self.ignored_effects]
```

#### Edge Cases

**1. Heavy Strike (Special BuffID = "87")**
```python
# character_extractor converts "87" → "HEAVY_STRIKE" before passing to BuffExtractor
if buff_id == 'HEAVY_STRIKE':
    buffs.append('HEAVY_STRIKE')
```

**2. Chained Buffs (Multiple Effects from One BuffID)**
```python
# _process_buff_data returns list of tuples
results = [
    ('IG_Buff_2000020_Interruption_D', False),  # Interruption debuff
    ('BT_STAT|ST_SPEED', False)  # Speed debuff
]
```

**3. Empty BuffID**
```python
if not buff_id_str or buff_id_str == '0':
    return {'buff': [], 'debuff': [], 'tags': []}
```

---

### buff_metadata_extractor.py

**Purpose**: Extract complete metadata (labels, descriptions, icons) for buff/debuff identifiers.

#### Data Sources

| File | Purpose |
|------|---------|
| `BuffTemplet.bytes` | Buff definitions (Type, StatType, IconName, RemoveEffect) |
| `BuffToolTipTemplet.bytes` | Tooltip mappings (NameIDSymbol → DescIDSymbol, DescID) |
| `TextSystem.bytes` | Localized text (SYS_BUFF_xxx → EN/JP/KR text) |

#### Class: BuffMetadataExtractor

**Constructor**:
```python
BuffMetadataExtractor()
```
- Loads all required templet files
- Builds O(1) lookup indices

**Key Methods**:

**1. `get_metadata(identifier: str, is_buff: bool) -> dict`**

Main API entry point.

**Parameters**:
- `identifier`: Buff identifier (e.g., "BT_STAT|ST_ATK", "IG_Buff_2000020_Interruption_D")
- `is_buff`: True if buff, False if debuff

**Returns**:
```json
{
  "name": "BT_STAT|ST_ATK",
  "label": "Attack Up",
  "label_jp": "攻撃力アップ",
  "label_kr": "공격력 증가",
  "description": "Increases Attack.",
  "description_jp": "攻撃力が増加します。",
  "description_kr": "공격력이 증가합니다.",
  "icon": null  // Must be filled manually
}
```

**Note**: `icon` is always `null` and must be filled by user via GUI dialog.

**Process**:
```python
def get_metadata(self, identifier: str, is_buff: bool) -> dict:
    # Initialize empty metadata
    metadata = {
        'name': identifier,
        'label': None,
        'label_jp': None,
        'label_kr': None,
        'description': None,
        'description_jp': None,
        'description_kr': None,
        'icon': None
    }

    # Route to specialized extractors
    if identifier == 'HEAVY_STRIKE':
        return self._extract_tooltip_id_metadata('87', metadata)
    elif identifier == 'BT_AGGRO':
        return self._extract_tooltip_id_metadata('32', metadata)
    elif identifier.startswith('IG_'):
        return self._extract_interruption_metadata(identifier, metadata)
    else:
        return self._extract_regular_metadata(identifier, metadata, is_buff)
```

**2. `_extract_regular_metadata(identifier: str, metadata: dict, is_buff: bool) -> dict`**

Extracts metadata for regular buffs (BT_XXX or BT_STAT|ST_XXX).

**Special Cases Handled**:

**A. BT_ACTION_GAUGE (Buff vs Debuff use different keys)**
```python
if identifier == 'BT_ACTION_GAUGE':
    text_key = 'SYS_BUFF_ACTION_GAUGE_UP' if is_buff else 'SYS_BUFF_ACTION_GAUGE_DOWN'
    # ...
```

**B. BT_REVERSE_HEAL_BASED_TARGET (True Damage)**
```python
if identifier == 'BT_REVERSE_HEAL_BASED_TARGET':
    text_key = 'SYS_BUFF_TRUE_DAMAGE'
    # ...
```

**C. BT_CONTINU_HEAL (Sustained Recovery)**
```python
if identifier == 'BT_CONTINU_HEAL':
    text_key = 'SYS_BUFF_TURN_HEAL'  # Different from identifier
    # ...
```

**D. BT_XX_CHARGE (AP/BP/CP Charge)**
```python
if identifier in ['BT_AP_CHARGE', 'BT_BP_CHARGE', 'BT_CP_CHARGE']:
    charge_type = identifier.replace('BT_', '').replace('_CHARGE', '')  # 'AP', 'BP', 'CP'
    text_key = f'SYS_BUFF_CHARGE_{charge_type}'
    # ...
```

**E. BT_STAT Types (Pattern: SYS_BUFF_{STAT}_UP/DOWN)**
```python
if buff_type == 'BT_STAT' and stat_type:
    stat_name = stat_type.replace('ST_', '')  # e.g., ST_ATK → ATK

    # Stat name mappings (game uses different names in TextSystem)
    stat_mapping = {
        'ATK': 'ATTACK',
        'DEF': 'DEFENCE',  # British spelling!
        'CRITICAL_DMG_RATE': 'CRITICAL_DAMAGE',
        'CRITICAL_RATE': 'CRITICAL_RATE',
        'SPEED': 'ACTION_SPEED',
        'BUFF_CHANCE': 'RATE_CHANCE',
        'BUFF_RESIST': 'RATE_RESIST',
    }
    stat_name = stat_mapping.get(stat_name, stat_name)

    suffix = '_UP' if is_buff else '_DOWN'
    text_key = f'SYS_BUFF_{stat_name}{suffix}'
```

**General Process**:
```python
# 1. Find buff entries in BuffTemplet
buff_entries = [
    b for b in self.all_buffs
    if b.get('Type') == buff_type and b.get('StatType') == stat_type
]

# 2. Prioritize entries with valid SYS_ keys
def buff_priority(buff):
    has_sys_key = 'SYS_' in (buff.get('RemoveEffect', '') or buff.get('ActivateText', ''))
    target = buff.get('TargetType', '')
    has_condition = buff.get('BuffConditionType', 'NONE') != 'NONE'

    score = 0
    if not has_sys_key: score += 100
    if target.startswith('MY_TEAM'): score += 0
    elif target.startswith('ME'): score += 1
    else: score += 2
    if has_condition: score += 10

    return score

buff_entries.sort(key=buff_priority)
buff_data = buff_entries[0]  # Best match

# 3. Try RemoveEffect first
remove_effect = buff_data.get('RemoveEffect', '')
if remove_effect and remove_effect.startswith('SYS_'):
    text_key = remove_effect

# 4. Fallback to ActivateText
if not text_key:
    activate_text = buff_data.get('ActivateText', '')
    if activate_text and activate_text.startswith('SYS_'):
        text_key = activate_text

# 5. Fallback to constructed key
if not text_key:
    constructed = f"SYS_BUFF_{buff_type.replace('BT_', '')}"
    if constructed in self._text_sys_index:
        text_key = constructed

# 6. Extract label from TextSystem
if text_key:
    label_data = self._text_sys_index.get(text_key)
    if label_data:
        metadata['label'] = label_data.get('English')
        metadata['label_jp'] = label_data.get('Japanese')
        metadata['label_kr'] = label_data.get('Korean')

    # 7. Extract description (SYS_BUFF_xxx → SYS_DESC_xxx)
    if text_key.startswith('SYS_BUFF_'):
        desc_key = text_key.replace('SYS_BUFF_', 'SYS_DESC_')
        desc_data = self._text_sys_index.get(desc_key)
        if desc_data:
            metadata['description'] = desc_data.get('English')
            metadata['description_jp'] = desc_data.get('Japanese')
            metadata['description_kr'] = desc_data.get('Korean')
```

**3. `_extract_interruption_metadata(identifier: str, metadata: dict) -> dict`**

Extracts metadata for Interruption buffs (IG_xxx).

**Process**:
```python
# 1. Lookup by NameIDSymbol in BuffToolTipTemplet
tooltip_data = self._tooltip_index.get(identifier)  # identifier = IG_xxx

# 2. Get label from DescIDSymbol
label_key = tooltip_data.get('DescIDSymbol', '')  # e.g., 'SYS_BUFF_NAME_2000119'
label_data = self._text_sys_index.get(label_key)
metadata['label'] = label_data.get('English')

# 3. Get description from DescID
desc_key = tooltip_data.get('DescID', '')  # e.g., 'SYS_BUFF_DESC_2000119'
desc_data = self._text_sys_index.get(desc_key)
metadata['description'] = desc_data.get('English')
```

**4. `_extract_tooltip_id_metadata(tooltip_id: str, metadata: dict) -> dict`**

Extracts metadata using BuffToolTipTemplet ID (for special effects like Heavy Strike).

**Process**:
```python
# 1. Lookup by ID in BuffToolTipTemplet
tooltip_data = self._tooltip_id_index.get(tooltip_id)  # tooltip_id = '87'

# 2. Same as _extract_interruption_metadata
# Get label from DescIDSymbol
# Get description from DescID
```

#### Text System Key Patterns

**Pattern**: `SYS_BUFF_{EFFECT}` for label, `SYS_DESC_{EFFECT}` for description

**Examples**:
| Identifier | Label Key | Description Key |
|------------|-----------|-----------------|
| BT_STAT\|ST_ATK | SYS_BUFF_ATTACK_UP | SYS_DESC_ATTACK_UP |
| BT_SEALED | SYS_BUFF_SEALED | SYS_DESC_SEALED |
| BT_ACTION_GAUGE | SYS_BUFF_ACTION_GAUGE_UP | SYS_DESC_ACTION_GAUGE_UP |

**Special Mappings**:
- ST_ATK → ATTACK (not ATK)
- ST_DEF → DEFENCE (not DEFENSE - British spelling!)
- ST_SPEED → ACTION_SPEED
- ST_BUFF_CHANCE → RATE_CHANCE

---

### profile_manager.py

**Purpose**: Extract and manage character profile data (birthday, height, weight, story).

#### Data Sources

| File | Data |
|------|------|
| `CharacterTemplet.bytes` | Character name, GroupNum |
| `TrustTemplet.bytes` | Birthday, Height, Weight, Story (EN/JP/KR) |

#### Class: ProfileManager

**Constructor**:
```python
ProfileManager()
```
- Initializes cache
- Loads existing profiles from `src/data/character-profiles.json`

**Key Methods**:

**1. `extract_profile(character_id: str) -> Optional[dict]`**

Extracts profile for a single character.

**Returns**:
```json
{
  "fullname": "Charlotte",
  "birthday": "March 15",
  "height": "165cm",
  "weight": "52kg",
  "story": "Charlotte is a cheerful knight...",
  "story_jp": "シャーロットは明るい騎士...",
  "story_kr": "샬롯은 쾌활한 기사..."
}
```

**Process**:
```python
def extract_profile(self, character_id: str) -> Optional[dict]:
    # 1. Load CharacterTemplet to get name
    char_data = self.char_index.get(character_id)

    # 2. Handle surnames (gnosis, monad, etc.)
    fullname = self._build_fullname(char_data)

    # 3. Load TrustTemplet by CharacterID
    trust_data = self.trust_index.get(character_id)
    if not trust_data:
        return None

    # 4. Extract fields
    profile = {
        'fullname': fullname,
        'birthday': self._fix_text(trust_data.get('Birthday', '')),
        'height': self._fix_text(trust_data.get('Height', '')),
        'weight': self._fix_text(trust_data.get('Weight', '')),
        'story': self._fix_text(trust_data.get('Story_English', '')),
        'story_jp': self._fix_text(trust_data.get('Story_Japanese', '')),
        'story_kr': self._fix_text(trust_data.get('Story_Korean', ''))
    }

    return profile
```

**2. `update_profile(character_id: str) -> dict`**

Extracts profile and saves to `character-profiles.json`.

**Process**:
```python
def update_profile(self, character_id: str) -> dict:
    # 1. Extract profile
    profile = self.extract_profile(character_id)

    # 2. Update profiles dict (keyed by fullname)
    self.profiles[profile['fullname']] = profile

    # 3. Save to JSON (alphabetically sorted)
    self._save_profiles()

    return {
        'success': True,
        'profile': profile
    }
```

**3. `_build_fullname(char_data: dict) -> str`**

Handles surname logic (gnosis, monad, seasonal variants).

**Surnames to Include**:
```python
INCLUDE_SURNAME = [
    "gnosis", "monad", "demiurge",
    "Kitsune of Eternity", "Poolside Trickster",
    "Holy Night's Blessing", "Omega", "Summer Knight's Dream"
]
```

**Process**:
```python
def _build_fullname(self, char_data: dict) -> str:
    surname = char_data.get('SurName', '')
    firstname = char_data.get('FirstName', '')

    # Check if surname should be included
    for special_surname in INCLUDE_SURNAME:
        if special_surname.casefold() in f"{surname} {firstname}".casefold():
            return f"{surname} {firstname}".strip()

    # Default: use firstname only
    return firstname
```

**4. `_fix_text(s: str) -> str`**

Fixes encoding issues in text (double-encoded UTF-8).

**Problem**: Some text is UTF-8 bytes interpreted as Latin-1 strings.

**Solution**:
```python
def _fix_text(self, s: str) -> str:
    try:
        # Try to re-encode as Latin-1 and decode as UTF-8
        return s.encode('latin1').decode('utf-8')
    except (UnicodeEncodeError, UnicodeDecodeError):
        # If that fails, return as-is
        return s
```

**Example**:
```python
# Input: "Ã©" (Latin-1 interpretation of UTF-8 bytes for "é")
# Output: "é" (correct UTF-8)
```

#### Storage Format

**File**: `src/data/character-profiles.json`

**Structure**:
```json
{
  "Charlotte": {
    "fullname": "Charlotte",
    "birthday": "March 15",
    "height": "165cm",
    "weight": "52kg",
    "story": "...",
    "story_jp": "...",
    "story_kr": "..."
  },
  "Gnosis Beth": {
    "fullname": "Gnosis Beth",
    "birthday": "July 22",
    ...
  }
}
```

**Key**: Character fullname (with surname if applicable)
**Sorted**: Alphabetically by key

---

### ee_manager.py

**Purpose**: Extract and manage Exclusive Equipment data for characters.

#### Data Sources

| File | Data |
|------|------|
| `CharacterTemplet.bytes` | Character name, element, GroupNum |
| `EquipmentTemplet.bytes` | EE name, mainStat, effect descriptions |
| `TextSystem.bytes` | Stat name labels |

#### Class: EEManager

**Constructor**:
```python
EEManager()
```
- Initializes cache
- Loads existing EE data from `src/data/ee.json`

**Key Methods**:

**1. `extract_ee(character_id: str) -> Optional[dict]`**

Extracts EE data for a single character.

**Returns**:
```json
{
  "name": "Charlotte's Holy Sword",
  "name_jp": "シャーロットの聖剣",
  "name_kr": "샬롯의 성검",
  "mainStat": "ATK",
  "effect": "When attacking enemies...",
  "effect_jp": "敵を攻撃する時...",
  "effect_kr": "적을 공격할 때...",
  "effect10": "Enhanced: When attacking enemies...",
  "effect10_jp": "強化: 敵を攻撃する時...",
  "effect10_kr": "강화: 적을 공격할 때..."
}
```

**Process**:
```python
def extract_ee(self, character_id: str) -> Optional[dict]:
    # 1. Load CharacterTemplet to get name
    char_data = self.char_index.get(character_id)
    fullname = char_data.get('FirstName', '')

    # 2. Find EquipmentTemplet entry by CharacterID
    eq_entries = [
        eq for eq in self.equipment_data
        if eq.get('CharacterID') == character_id
    ]

    if not eq_entries:
        return None

    eq_data = eq_entries[0]

    # 3. Extract mainStat (with element substitution)
    main_stat_raw = eq_data.get('MainType', '')
    main_stat = self._process_main_stat(main_stat_raw, char_data)

    # 4. Clean effect descriptions (remove HTML, normalize Unicode)
    effect = self._clean_text(eq_data.get('Description_English', ''))
    effect_jp = self._clean_text(eq_data.get('Description_Japanese', ''))
    effect_kr = self._clean_text(eq_data.get('Description_Korean', ''))

    effect10 = self._clean_text(eq_data.get('Description_Level10_English', ''))
    effect10_jp = self._clean_text(eq_data.get('Description_Level10_Japanese', ''))
    effect10_kr = self._clean_text(eq_data.get('Description_Level10_Korean', ''))

    return {
        'name': eq_data.get('Name_English', ''),
        'name_jp': eq_data.get('Name_Japanese', ''),
        'name_kr': eq_data.get('Name_Korean', ''),
        'mainStat': main_stat,
        'effect': effect,
        'effect_jp': effect_jp,
        'effect_kr': effect_kr,
        'effect10': effect10,
        'effect10_jp': effect10_jp,
        'effect10_kr': effect10_kr
    }
```

**2. `update_ee(character_id: str, buffs: list, debuffs: list, rank: str) -> dict`**

Updates EE data with buffs/debuffs and rank, then saves to `ee.json`.

**Parameters**:
- `character_id`: Character ID
- `buffs`: List of buff identifiers (e.g., `['BT_STAT|ST_ATK']`)
- `debuffs`: List of debuff identifiers
- `rank`: EE rank ('E', 'D', 'C', 'B', 'A', 'S', 'SS', 'SSS')

**Process**:
```python
def update_ee(self, character_id: str, buffs: list, debuffs: list, rank: str) -> dict:
    # 1. Extract base EE data
    ee_data = self.extract_ee(character_id)

    # 2. Add buffs/debuffs/rank
    ee_data['buff'] = buffs
    ee_data['debuff'] = debuffs
    ee_data['rank'] = rank

    # 3. Get character fullname for key
    char_data = self.char_index.get(character_id)
    fullname = self._build_fullname(char_data)

    # 4. Update ee_data dict
    self.ee_data[fullname] = ee_data

    # 5. Save to JSON (alphabetically sorted)
    self._save_ee_data()

    return {
        'success': True,
        'ee': ee_data
    }
```

**3. `_process_main_stat(main_stat_raw: str, char_data: dict) -> str`**

Handles element-based stat substitution.

**Problem**: Some EE stats use placeholder "CTT_{ELEMENT}" that should be replaced with character's element.

**Process**:
```python
def _process_main_stat(self, main_stat_raw: str, char_data: dict) -> str:
    # 1. Check if stat uses element pattern (CTT_FIRE, CTT_WATER, etc.)
    match = ELEMENT_RE.match(main_stat_raw)  # Pattern: ^(?:C[ET]T[_\- ]?)([A-Z]+)$

    if not match:
        return main_stat_raw  # Not element-based

    stat_element = match.group(1)

    # 2. If stat is for opposite element, get opposite of character's element
    if stat_element in ELEMENTS:
        char_element = char_data.get('Element', '')
        if char_element in OPPOSITE:
            # Replace with opposite element
            opposite_element = OPPOSITE[char_element]
            return main_stat_raw.replace(stat_element, opposite_element)

    # 3. If stat is for character's own element, use as-is
    return main_stat_raw
```

**Example**:
```python
# Character: Charlotte (LIGHT element)
# Main stat: "CTT_DARK" (Dark Resistance)
# Result: "CTT_DARK" (opposite of LIGHT)

# Character: Beth (DARK element)
# Main stat: "CTT_DARK" (Dark Resistance)
# Result: "CTT_LIGHT" (opposite of DARK)
```

**4. `_clean_text(s: str) -> str`**

Cleans effect descriptions.

**Steps**:
1. Unescape HTML entities (`&lt;` → `<`)
2. Normalize Unicode (NFKC)
3. Strip whitespace

```python
def _clean_text(self, s: str) -> str:
    if not s:
        return ''

    # Unescape HTML
    s = html.unescape(s)

    # Normalize Unicode
    s = unicodedata.normalize('NFKC', s)

    return s.strip()
```

#### Storage Format

**File**: `src/data/ee.json`

**Structure**:
```json
{
  "Charlotte": {
    "name": "Charlotte's Holy Sword",
    "name_jp": "...",
    "name_kr": "...",
    "mainStat": "ATK",
    "effect": "...",
    "effect_jp": "...",
    "effect_kr": "...",
    "effect10": "...",
    "effect10_jp": "...",
    "effect10_kr": "...",
    "buff": ["BT_STAT|ST_ATK"],
    "debuff": [],
    "rank": "S"
  }
}
```

**Key**: Character fullname
**Sorted**: Alphabetically by key

---

## Export & Validation

### export_manager.py

**Purpose**: Handle character JSON export and buff/debuff validation.

#### Responsibilities

1. Export character JSON to `src/data/char/{character-name}.json`
2. Validate all buffs/debuffs exist in `buffs.json`/`debuffs.json`
3. Extract metadata for missing effects (using BuffMetadataExtractor)
4. Manage ignored effects list

#### Class: ExportManager

**Constructor**:
```python
ExportManager()
```
- Loads `buffs.json`, `debuffs.json`, `ignored_effects.json`
- Creates export directories if needed

**Key Methods**:

**1. `export_character(char_data: dict) -> list`**

Exports character JSON and validates effects.

**Parameters**:
- `char_data`: Character data dictionary (from CharacterExtractor)

**Returns**: List of missing effects that need metadata input

**Process**:
```python
def export_character(self, char_data: dict) -> list:
    # 1. Extract character name
    fullname = char_data.get('Fullname', 'unknown')
    filename = to_kebab_case(fullname) + '.json'

    # 2. Collect all buffs/debuffs from character data
    all_buffs, all_debuffs = self._collect_effects(char_data)

    # 3. Check which are missing
    missing_buffs = [b for b in all_buffs if b not in self.buffs]
    missing_debuffs = [d for d in all_debuffs if d not in self.debuffs]

    # 4. Extract metadata for missing effects
    missing_effects = []
    for buff in missing_buffs:
        if buff not in self.ignored:
            metadata = self.metadata_extractor.get_metadata(buff, is_buff=True)
            missing_effects.append({'type': 'buff', 'data': metadata})

    for debuff in missing_debuffs:
        if debuff not in self.ignored:
            metadata = self.metadata_extractor.get_metadata(debuff, is_buff=False)
            missing_effects.append({'type': 'debuff', 'data': metadata})

    # 5. If no missing effects, export directly
    if not missing_effects:
        self._write_character_json(filename, char_data)
        return []

    # 6. Otherwise, return missing effects for user input
    return missing_effects
```

**2. `_collect_effects(char_data: dict) -> Tuple[set, set]`**

Collects all buff/debuff identifiers from character data.

**Returns**: `(all_buffs_set, all_debuffs_set)`

**Process**:
```python
def _collect_effects(self, char_data: dict) -> Tuple[set, set]:
    buffs = set()
    debuffs = set()

    # Collect from skills
    if 'skills' in char_data:
        for skill_type, skill_data in char_data['skills'].items():
            # Regular buffs
            if 'data' in skill_data:
                for level_data in skill_data['data']:
                    buffs.update(level_data.get('buff', []))
                    buffs.update(level_data.get('dual_buff', []))
                    debuffs.update(level_data.get('debuff', []))
                    debuffs.update(level_data.get('dual_debuff', []))

    return buffs, debuffs
```

**3. `add_effect(effect_data: dict, is_buff: bool)`**

Adds a new effect to `buffs.json` or `debuffs.json`.

**Parameters**:
- `effect_data`: Metadata dict with name, label, description, icon
- `is_buff`: True for buff, False for debuff

**Process**:
```python
def add_effect(self, effect_data: dict, is_buff: bool):
    # 1. Add to appropriate list
    if is_buff:
        self.buffs.append(effect_data)
        self.buffs.sort(key=lambda x: x['name'])
    else:
        self.debuffs.append(effect_data)
        self.debuffs.sort(key=lambda x: x['name'])

    # 2. Save to JSON
    if is_buff:
        self._save_json(self.buffs_path, self.buffs)
    else:
        self._save_json(self.debuffs_path, self.debuffs)
```

**4. `add_ignored_effect(effect_name: str)`**

Adds an effect to the ignored list.

**Process**:
```python
def add_ignored_effect(self, effect_name: str):
    if effect_name not in self.ignored:
        self.ignored.append(effect_name)
        self.ignored.sort()
        self._save_json(self.ignored_path, self.ignored)
```

**5. `_write_character_json(filename: str, char_data: dict)`**

Writes character data to JSON file.

**Process**:
```python
def _write_character_json(self, filename: str, char_data: dict):
    filepath = self.char_export_path / filename

    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(char_data, f, indent=2, ensure_ascii=False)
        f.write('\n')  # Add newline at end of file
```

#### Effect Metadata Structure

**Buffs** (`src/data/buffs.json`):
```json
[
  {
    "name": "BT_STAT|ST_ATK",
    "label": "Attack Up",
    "label_jp": "攻撃力アップ",
    "label_kr": "공격력 증가",
    "description": "Increases Attack.",
    "description_jp": "攻撃力が増加します。",
    "description_kr": "공격력이 증가합니다.",
    "icon": "attackup",
    "category": "stats"
  }
]
```

**Debuffs** (`src/data/debuffs.json`):
Same structure as buffs.

**Ignored** (`export/ignored_effects.json`):
```json
[
  "BT_INTERNAL_EFFECT",
  "BT_DEBUG_BUFF"
]
```

---

### asset_manager.py

**Purpose**: Copy character image assets from extracted game files to public directory.

#### Asset Types

| Type | Source Pattern | Destination | Notes |
|------|---------------|-------------|-------|
| Portrait | `CT_{id}.png` | `public/images/characters/portrait/` | Character icon |
| ATB Mini | `IG_Turn_{id}.png` | `public/images/characters/atb/` | Action bar icon |
| ATB Enhanced | `IG_Turn_{id}_E.png` | `public/images/characters/atb/` | Enhanced ATB icon |
| Skill 1 | `Skill_First_{id}.png` | `public/images/characters/skills/` | First skill icon |
| Skill 2 | `Skill_Second_{id}.png` | `public/images/characters/skills/` | Second skill icon |
| Skill 3 | `Skill_Ultimate_{id}.png` | `public/images/characters/skills/` | Ultimate skill icon |
| Full Art | `IMG_{id}.png` | `public/images/characters/full/` | Full character art |
| EX Equipment | `TI_Equipment_EX_{id}.png` | `public/images/characters/ex/` | EX equipment icon |

#### Source Directories

- **Sprites**: `extracted_astudio/assets/editor/resources/sprite/`
- **Illustrations**: `extracted_astudio/assets/editor/resources/prefabs/ui/illust/`

#### Class: AssetManager

**Constructor**:
```python
AssetManager(convert_to_webp: bool = True)
```
- Creates destination directories if needed
- Initializes WebP converter if enabled

**Key Methods**:

**1. `copy_character_assets(character_id: str, fullname: str) -> dict`**

Copies all assets for a character.

**Parameters**:
- `character_id`: Character ID (e.g., "2000066")
- `fullname`: Character fullname (for EX equipment naming)

**Returns**:
```json
{
  "copied": ["Portrait (CT_2000066.png)", "ATB Mini (IG_Turn_2000066.png)", ...],
  "skipped": ["Skill First (Skill_First_2000066.png)"],  # Already exists
  "missing": ["Full Art (IMG_2000066.png)"],  # Not found in source
  "webp_converted": 5,
  "webp_skipped": 2
}
```

**Process**:
```python
def copy_character_assets(self, character_id: str, fullname: str) -> dict:
    copied, skipped, missing = [], [], []

    # 1. Portrait
    status = self._copy_asset(
        SPRITE_SOURCE / f"CT_{character_id}.png",
        PORTRAIT_DEST / f"CT_{character_id}.png",
        f"Portrait (CT_{character_id}.png)"
    )
    # ... add to copied/skipped/missing based on status

    # 2. ATB Mini (normal + enhanced)
    for suffix in ["", "_E"]:
        # ... same pattern

    # 3. Skills (First, Second, Ultimate)
    for skill_type in ["First", "Second", "Ultimate"]:
        # ... same pattern

    # 4. Full Art
    # ... same pattern

    # 5. EX Equipment (rename to kebab-case fullname)
    ex_source_name = f"TI_Equipment_EX_{character_id}.png"
    ex_dest_name = f"{to_kebab_case(fullname)}.png"
    status = self._copy_asset(
        SPRITE_SOURCE / ex_source_name,
        EX_DEST / ex_dest_name,
        f"EX Equipment ({ex_source_name} -> {ex_dest_name})"
    )

    # 6. Convert to WebP if enabled
    if self.convert_to_webp and len(copied) > 0:
        webp_converted, webp_skipped = _webp_converter.convert_character_assets(
            character_id, fullname
        )

    return {
        'copied': copied,
        'skipped': skipped,
        'missing': missing,
        'webp_converted': webp_converted,
        'webp_skipped': webp_skipped
    }
```

**2. `_copy_asset(source: Path, destination: Path, description: str) -> str`**

Copies a single asset file.

**Returns**: `"copied"`, `"skipped"`, or `None`

**Process**:
```python
def _copy_asset(self, source: Path, destination: Path, description: str) -> str:
    # 1. Check if destination already exists
    if destination.exists():
        logger.debug(f"Asset already exists, skipping: {destination}")
        return "skipped"

    # 2. Check if source exists
    if not source.exists():
        logger.debug(f"Asset not found: {source}")
        return None

    # 3. Copy file
    try:
        shutil.copy2(source, destination)
        logger.info(f"Copied: {description}")
        return "copied"
    except Exception as e:
        logger.error(f"Failed to copy {description}: {e}")
        return None
```

**3. `check_assets_exist(character_id: str) -> dict`**

Checks which assets exist without copying.

**Returns**:
```json
{
  "portrait": true,
  "atb_normal": true,
  "atb_enhance": false,
  "skill_first": true,
  "skill_second": true,
  "skill_ultimate": true,
  "full_art": false,
  "ex_equipment": true
}
```

**4. `get_asset_summary(character_id: str) -> Tuple[int, int]`**

Gets summary count of found vs total assets.

**Returns**: `(found_count, total_count)`

**Example**: `(6, 8)` means 6 out of 8 assets found

---

### webp_converter.py

**Purpose**: Convert PNG/JPG character assets to WebP format for better web performance.

#### Dependencies

- **cwebp.exe**: Google's WebP encoder
- **Location**: `datamine/pngTowebp/bin/cwebp.exe`

#### Class: WebPConverter

**Constructor**:
```python
WebPConverter(quality: int = 85)
```
- Validates cwebp.exe exists
- Sets quality level (0-100)

**Key Methods**:

**1. `convert_character_assets(character_id: str, fullname: str) -> Tuple[int, int]`**

Converts all PNG assets for a character to WebP.

**Parameters**:
- `character_id`: Character ID
- `fullname`: Character fullname (for EX equipment)

**Returns**: `(converted_count, skipped_count)`

**Process**:
```python
def convert_character_assets(self, character_id: str, fullname: str) -> Tuple[int, int]:
    converted = 0
    skipped = 0

    # 1. Portrait
    status = self._convert_file(PORTRAIT_DEST / f"CT_{character_id}.png")
    if status == 'converted': converted += 1
    elif status == 'skipped': skipped += 1

    # 2. ATB Mini (normal + enhanced)
    for suffix in ["", "_E"]:
        status = self._convert_file(ATB_DEST / f"IG_Turn_{character_id}{suffix}.png")
        # ... count

    # 3. Skills
    for skill_type in ["First", "Second", "Ultimate"]:
        status = self._convert_file(SKILLS_DEST / f"Skill_{skill_type}_{character_id}.png")
        # ... count

    # 4. Full Art
    status = self._convert_file(FULL_DEST / f"IMG_{character_id}.png")
    # ... count

    # 5. EX Equipment
    ex_dest_name = f"{to_kebab_case(fullname)}.png"
    status = self._convert_file(EX_DEST / ex_dest_name)
    # ... count

    return (converted, skipped)
```

**2. `_convert_file(png_path: Path) -> str`**

Converts a single PNG file to WebP.

**Returns**: `"converted"`, `"skipped"`, or `"error"`

**Process**:
```python
def _convert_file(self, png_path: Path) -> str:
    # 1. Check if PNG exists
    if not png_path.exists():
        return "error"

    # 2. Check if WebP already exists
    webp_path = png_path.with_suffix('.webp')
    if webp_path.exists():
        return "skipped"

    # 3. Run cwebp.exe
    cmd = [
        str(CWEBP_PATH),
        '-q', str(self.quality),  # Quality (0-100)
        str(png_path),            # Input PNG
        '-o', str(webp_path)      # Output WebP
    ]

    try:
        result = subprocess.run(cmd, capture_output=True, check=True)
        logger.info(f"Converted to WebP: {webp_path.name}")
        return "converted"
    except subprocess.CalledProcessError as e:
        logger.error(f"Failed to convert {png_path.name}: {e}")
        return "error"
```

#### WebP Quality Settings

| Quality | File Size | Visual Quality | Use Case |
|---------|-----------|----------------|----------|
| 75 | Smallest | Good | Mobile-first, bandwidth-limited |
| 85 | Medium | Very Good | **Default** - balanced |
| 95 | Large | Excellent | High-fidelity, desktop |
| 100 | Largest | Lossless | Archival, no quality loss |

**Typical Savings**: 50-70% smaller than PNG with quality=85

---

### buff_validator.py

**Purpose**: Validate buff/debuff usage across all character files.

#### Validation Checks

1. **Undefined Effects**: Effects used in characters but not defined in `buffs.json`/`debuffs.json`
2. **Unused Effects**: Effects defined but not used anywhere
3. **Consistency**: Ensure all references are valid

#### Scan Locations

- `src/data/char/*.json` (character files)
- `src/data/ee.json` (exclusive equipment)
- `src/app/guides/_contents/*.tsx` (guide content)
- `src/data/guides/guild-raid/*.json` (guild raid guides)

#### Class: BuffValidator

**Constructor**:
```python
BuffValidator()
```

**Key Methods**:

**1. `load_definitions()`**

Loads buff/debuff definitions from JSON files.

```python
def load_definitions(self):
    with open(BUFFS_FILE, 'r', encoding='utf-8') as f:
        self.buffs_data = json.load(f)
        self.defined_buffs = {buff['name'] for buff in self.buffs_data}

    with open(DEBUFFS_FILE, 'r', encoding='utf-8') as f:
        self.debuffs_data = json.load(f)
        self.defined_debuffs = {debuff['name'] for debuff in self.debuffs_data}
```

**2. `scan_character_files() -> dict`**

Scans all character files and returns validation results.

**Returns**:
```json
{
  "used_buffs": [...],  // Set of all buffs used
  "used_debuffs": [...],  // Set of all debuffs used
  "unused_buffs": [...],  // Defined but not used
  "unused_debuffs": [...],  // Defined but not used
  "undefined_buffs": [...],  // Used but not defined
  "undefined_debuffs": [...],  // Used but not defined
  "undefined_buffs_details": [  // Detailed list with character/skill info
    {
      "character": "Charlotte",
      "skill": "s1",
      "buff": "BT_NEW_BUFF",
      "file": "charlotte.json",
      "source": "character"
    }
  ],
  "total_char_files": 120,
  "total_defined_buffs": 150,
  "total_defined_debuffs": 80,
  "total_used_buffs": 145,
  "total_used_debuffs": 75
}
```

**Process**:
```python
def scan_character_files(self) -> dict:
    used_buffs = set()
    used_debuffs = set()
    undefined_buffs_details = []
    undefined_debuffs_details = []

    # 1. Scan character files
    for char_file in CHAR_DATA_FOLDER.glob("*.json"):
        char_data = json.load(open(char_file))
        char_buffs, char_debuffs = self.extract_buffs_from_character(char_data, char_file.stem)

        # Check buffs
        for skill_name, buffs in char_buffs.items():
            for buff in buffs:
                used_buffs.add(buff)
                if buff not in self.defined_buffs:
                    undefined_buffs_details.append({
                        'character': char_data.get('Fullname', char_file.stem),
                        'skill': skill_name,
                        'buff': buff,
                        'file': char_file.name,
                        'source': 'character'
                    })

        # Check debuffs (same process)
        # ...

    # 2. Scan EE file
    ee_data = json.load(open(EE_FILE))
    ee_buffs, ee_debuffs = self.extract_buffs_from_ee(ee_data)
    # ... same validation

    # 3. Scan guide files
    guide_buffs, guide_debuffs = self.scan_guide_files()
    used_buffs.update(guide_buffs)
    used_debuffs.update(guide_debuffs)

    # 4. Calculate unused effects
    unused_buffs = self.defined_buffs - used_buffs
    unused_debuffs = self.defined_debuffs - used_debuffs

    return {
        'used_buffs': used_buffs,
        'used_debuffs': used_debuffs,
        'unused_buffs': sorted(unused_buffs),
        'unused_debuffs': sorted(unused_debuffs),
        'undefined_buffs_details': undefined_buffs_details,
        'undefined_debuffs_details': undefined_debuffs_details,
        'total_char_files': len(char_files),
        # ...
    }
```

**3. `scan_guide_files() -> Tuple[Set[str], Set[str]]`**

Scans guide files for buff/debuff references.

**Syntax Patterns**:
- `{B/BT_STAT|ST_ATK}` (buff reference)
- `{D/BT_SEALED}` (debuff reference)
- `<EffectInlineTag name="BT_STAT|ST_ATK" type="buff" />` (JSX component)

**Returns**: `(buffs_set, debuffs_set)`

**Process**:
```python
def scan_guide_files(self) -> Tuple[Set[str], Set[str]]:
    guide_buffs = set()
    guide_debuffs = set()

    # Regex patterns
    buff_pattern1 = re.compile(r'\{B/([A-Z0-9_|]+)\}')
    debuff_pattern1 = re.compile(r'\{D/([A-Z0-9_|]+)\}')
    buff_pattern2 = re.compile(r'name="([A-Z0-9_|]+)"\s+type="buff"')
    debuff_pattern2 = re.compile(r'name="([A-Z0-9_|]+)"\s+type="debuff"')

    # Scan TSX files
    for tsx_file in GUIDES_CONTENTS_FOLDER.rglob("*.tsx"):
        content = tsx_file.read_text(encoding='utf-8')

        for match in buff_pattern1.finditer(content):
            guide_buffs.add(match.group(1))
        for match in buff_pattern2.finditer(content):
            guide_buffs.add(match.group(1))

        # ... same for debuffs

    # Scan JSON files (guild raid)
    for json_file in GUILD_RAID_FOLDER.glob("*.json"):
        content = json_file.read_text(encoding='utf-8')
        # ... same pattern matching

    return guide_buffs, guide_debuffs
```

**4. `remove_buff_from_files(buff_name: str, is_debuff: bool) -> dict`**

Removes a buff/debuff from all character and EE files.

**Returns**:
```json
{
  "buff_name": "BT_UNUSED_BUFF",
  "is_debuff": false,
  "removed_from": ["charlotte.json", "beth.json"],
  "locations": [
    {"file": "charlotte.json", "character": "Charlotte", "skill": "s1", "field": "buff"},
    {"file": "beth.json", "character": "Beth", "skill": "s2", "field": "buff"}
  ],
  "errors": [],
  "total_removals": 2
}
```

**5. `sort_buffs_debuffs_files() -> dict`**

Sorts `buffs.json` and `debuffs.json` alphabetically by name.

**Returns**:
```json
{
  "success": true,
  "message": "Successfully sorted 150 buffs and 80 debuffs by name",
  "buffs_count": 150,
  "debuffs_count": 80
}
```

**6. `format_results_text(results: dict) -> str`**

Formats validation results as readable text report.

**Example Output**:
```
================================================================================
BUFF/DEBUFF VALIDATION REPORT
================================================================================

SUMMARY:
  Total character files scanned: 120
  Defined buffs: 150
  Defined debuffs: 80
  Used buffs: 145
  Used debuffs: 75
  Unused buffs: 5
  Unused debuffs: 5
  Undefined buffs: 2
  Undefined debuffs: 1

================================================================================
UNDEFINED BUFFS (3 occurrences):
================================================================================
From Character Skills:
  [Charlotte] s1: BT_NEW_BUFF
  [Beth] s2: BT_NEW_BUFF
  [Alice] ee: BT_ANOTHER_BUFF

================================================================================
UNUSED BUFFS (5):
================================================================================
These buffs are defined in buffs.json but not used anywhere:
(Scanned: characters, EE, guides/_contents, guild-raid)
  - BT_OLD_BUFF_1
  - BT_OLD_BUFF_2
  - BT_OLD_BUFF_3
  - BT_OLD_BUFF_4
  - BT_OLD_BUFF_5
```

---

### json_comparator.py

**Purpose**: Deep comparison between extracted and existing character JSONs.

#### Use Case

When extracting a character that already exists in `src/data/char/`, we need to:
1. Identify what changed
2. Show user the diff
3. Let user decide whether to overwrite

#### Class: JSONComparator

**Constructor**:
```python
JSONComparator(extracted_data: dict, existing_data: dict)
```

**Key Methods**:

**1. `get_diff() -> dict`**

Performs deep comparison and returns structured diff.

**Returns**:
```json
{
  "added": {
    "skills.SKT_FIRST.data[0].tags": ["ignore-defense"]
  },
  "removed": {
    "old_field": "old_value"
  },
  "modified": {
    "skills.SKT_FIRST.name": {
      "old": "Old Name",
      "new": "New Name"
    },
    "skills.SKT_FIRST.data[0].damage": {
      "old": "100",
      "new": "120"
    }
  },
  "unchanged": {
    "Fullname": "Charlotte",
    "Rarity": "5"
  }
}
```

**Process**:
```python
def get_diff(self) -> dict:
    added = {}
    removed = {}
    modified = {}
    unchanged = {}

    # Compare recursively
    self._compare_recursive(
        self.extracted_data,
        self.existing_data,
        path="",
        added=added,
        removed=removed,
        modified=modified,
        unchanged=unchanged
    )

    return {
        'added': added,
        'removed': removed,
        'modified': modified,
        'unchanged': unchanged
    }
```

**2. `_compare_recursive(extracted: Any, existing: Any, path: str, ...)`**

Recursively compares nested structures.

**Process**:
```python
def _compare_recursive(self, extracted, existing, path, added, removed, modified, unchanged):
    # Handle different types
    if type(extracted) != type(existing):
        modified[path] = {'old': existing, 'new': extracted}
        return

    if isinstance(extracted, dict):
        # Compare dictionaries
        all_keys = set(extracted.keys()) | set(existing.keys())

        for key in all_keys:
            # Skip ignored keys
            if key in self.IGNORED_KEYS:
                continue

            new_path = f"{path}.{key}" if path else key

            if key in extracted and key in existing:
                # Key exists in both - recurse
                self._compare_recursive(
                    extracted[key],
                    existing[key],
                    new_path,
                    added, removed, modified, unchanged
                )
            elif key in extracted:
                # Key only in extracted - added
                added[new_path] = extracted[key]
            else:
                # Key only in existing - removed
                removed[new_path] = existing[key]

    elif isinstance(extracted, list):
        # Compare lists
        for i in range(max(len(extracted), len(existing))):
            new_path = f"{path}[{i}]"

            if i < len(extracted) and i < len(existing):
                # Both have element at index i - recurse
                self._compare_recursive(
                    extracted[i],
                    existing[i],
                    new_path,
                    added, removed, modified, unchanged
                )
            elif i < len(extracted):
                # Only extracted has element - added
                added[new_path] = extracted[i]
            else:
                # Only existing has element - removed
                removed[new_path] = existing[i]

    else:
        # Scalar values (str, int, float, bool, None)
        if extracted == existing:
            unchanged[path] = extracted
        else:
            modified[path] = {'old': existing, 'new': extracted}
```

**3. Ignored Keys**

Some keys are technical/internal and should be ignored during comparison:

```python
IGNORED_KEYS = {
    'DescID',
    'RangeType',
    'TargetTeamType',
    'description',  # Raw descriptions from templets
    'ApproachType',
    'ApproachZ',
    'ApproachTime',
    'SkillSubType',
    'SkillType',
    'IconName',
    'NameIDSymbol',
    # ... more internal fields
}
```

**Example Usage**:
```python
from json_comparator import JSONComparator

# Load existing
with open('src/data/char/charlotte.json') as f:
    existing = json.load(f)

# Extract new
extractor = CharacterExtractor("2000066")
extracted = extractor.extract()

# Compare
comparator = JSONComparator(extracted, existing)
diff = comparator.get_diff()

# Check if anything changed
if diff['added'] or diff['removed'] or diff['modified']:
    print("Changes detected!")
    print(f"Added: {len(diff['added'])} fields")
    print(f"Removed: {len(diff['removed'])} fields")
    print(f"Modified: {len(diff['modified'])} fields")
else:
    print("No changes detected")
```

---

## GUI

### gui_qt.py

**Purpose**: Main PyQt6 GUI for ParserV3.

#### Features

1. **Character Extraction Tab**:
   - Character ID input with autocomplete
   - Extract button
   - JSON comparison viewer
   - Export button

2. **Binary Explorer Tab**:
   - File tree browser for `.bytes` files
   - Table view of parsed data
   - Column filtering
   - Export to CSV

3. **Tools Menu**:
   - Update Profile
   - Update EE
   - Scan Buffs/Debuffs
   - Sort Buffs/Debuffs
   - Batch Extract

4. **Status Bar**:
   - Progress indicator
   - Current operation status

#### Class: MainWindow

**Constructor**:
```python
MainWindow()
```
- Sets up UI layout
- Initializes extractors
- Creates menu bar

**Key Methods**:

**1. `_extract_character()`**

Extracts character data when Extract button is clicked.

**Process**:
```python
def _extract_character(self):
    # 1. Get character ID
    char_id = self.char_id_input.text().strip()

    # 2. Validate ID
    if not char_id:
        QMessageBox.warning(self, "Error", "Please enter a character ID")
        return

    # 3. Extract
    try:
        extractor = CharacterExtractor(char_id, enable_youtube=True)
        self.extracted_data = extractor.extract()
    except Exception as e:
        QMessageBox.critical(self, "Extraction Error", str(e))
        return

    # 4. Load existing (if present)
    fullname = self.extracted_data.get('Fullname', '')
    filename = to_kebab_case(fullname) + '.json'
    existing_path = CHAR_EXPORT_PATH / filename

    if existing_path.exists():
        with open(existing_path) as f:
            self.existing_data = json.load(f)
    else:
        self.existing_data = None

    # 5. Compare
    if self.existing_data:
        comparator = JSONComparator(self.extracted_data, self.existing_data)
        diff = comparator.get_diff()

        # Display diff
        self._display_diff(diff)
    else:
        # New character
        self._display_json(self.extracted_data)

    # 6. Enable export button
    self.export_btn.setEnabled(True)
```

**2. `_export_character()`**

Exports character JSON after validation.

**Process**:
```python
def _export_character(self):
    # 1. Validate effects
    missing_effects = self.export_manager.export_character(self.extracted_data)

    # 2. If missing effects, show dialogs
    if missing_effects:
        for effect_info in missing_effects:
            dialog = MetadataInputDialog(
                self,
                effect_info['data']['name'],
                effect_info['type'] == 'buff',
                effect_info['data']
            )

            result = dialog.exec()

            if result == QDialog.DialogCode.Accepted:
                # User filled metadata
                metadata = dialog.result
                self.export_manager.add_effect(metadata, effect_info['type'] == 'buff')
            else:
                # User chose to ignore
                self.export_manager.add_ignored_effect(effect_info['data']['name'])

        # Retry export after adding metadata
        missing_effects = self.export_manager.export_character(self.extracted_data)

    # 3. Copy assets
    asset_manager = AssetManager(convert_to_webp=True)
    asset_results = asset_manager.copy_character_assets(
        self.extracted_data['CharacterID'],
        self.extracted_data['Fullname']
    )

    # 4. Show success message
    QMessageBox.information(
        self,
        "Export Complete",
        f"Character exported successfully!\n\n"
        f"Assets copied: {len(asset_results['copied'])}\n"
        f"Assets skipped: {len(asset_results['skipped'])}\n"
        f"WebP converted: {asset_results['webp_converted']}"
    )
```

**3. `_open_ee_dialog()`**

Opens EE update dialog.

**Process**:
```python
def _open_ee_dialog(self):
    # 1. Prompt for character ID
    char_id, ok = QInputDialog.getText(self, "Update EE", "Enter Character ID:")
    if not ok:
        return

    # 2. Extract EE data
    ee_manager = EEManager()
    ee_data = ee_manager.extract_ee(char_id)

    if not ee_data:
        QMessageBox.warning(self, "Error", "No EE found for this character")
        return

    # 3. Load existing buffs/debuffs/rank
    existing_buffs = ee_data.get('buff', [])
    existing_debuffs = ee_data.get('debuff', [])
    existing_rank = ee_data.get('rank', '')

    # 4. Show EE dialog
    dialog = EEBuffDebuffDialog(
        self,
        ee_data['name'],
        existing_buffs,
        existing_debuffs,
        existing_rank,
        ee_data.get('effect', ''),
        ee_data.get('effect10', '')
    )

    result = dialog.exec()

    if result == QDialog.DialogCode.Accepted:
        # 5. Save to ee.json
        selected = dialog.result
        ee_manager.update_ee(
            char_id,
            selected['buffs'],
            selected['debuffs'],
            selected['rank']
        )

        QMessageBox.information(self, "Success", "EE updated successfully!")
```

**4. `_scan_buffs_debuffs()`**

Scans for undefined/unused buffs/debuffs.

**Process**:
```python
def _scan_buffs_debuffs(self):
    # Show progress dialog
    progress = QProgressDialog("Scanning buffs/debuffs...", None, 0, 0, self)
    progress.setWindowModality(Qt.WindowModality.WindowModal)
    progress.show()

    # Run validation
    validator = BuffValidator()
    validator.load_definitions()
    results = validator.scan_character_files()

    progress.close()

    # Format and display results
    report = validator.format_results_text(results)

    # Show in dialog
    dialog = QDialog(self)
    dialog.setWindowTitle("Buff/Debuff Validation Report")
    dialog.resize(800, 600)

    layout = QVBoxLayout(dialog)
    text_browser = QTextBrowser()
    text_browser.setPlainText(report)
    layout.addWidget(text_browser)

    dialog.exec()
```

#### Binary Explorer Tab

**Features**:
- File tree on left (shows `.bytes` files)
- Table view on right (shows parsed data)
- Double-click file to parse and display
- Export to CSV button

**Implementation**:
```python
def _setup_binary_explorer_tab(self):
    # File tree
    file_model = QFileSystemModel()
    file_model.setRootPath(str(BYTES_FOLDER))
    file_model.setNameFilters(["*.bytes"])

    self.file_tree = QTreeView()
    self.file_tree.setModel(file_model)
    self.file_tree.setRootIndex(file_model.index(str(BYTES_FOLDER)))
    self.file_tree.doubleClicked.connect(self._load_bytes_file)

    # Table view
    self.bytes_table = QTableWidget()

    # Layout
    splitter = QSplitter(Qt.Orientation.Horizontal)
    splitter.addWidget(self.file_tree)
    splitter.addWidget(self.bytes_table)

def _load_bytes_file(self, index):
    # Get file path
    file_path = self.file_model.filePath(index)

    # Parse file
    parser = Bytes_parser(file_path)
    data = parser.get_data()
    columns = parser.get_columns()

    # Populate table
    self.bytes_table.setRowCount(len(data))
    self.bytes_table.setColumnCount(len(columns))
    self.bytes_table.setHorizontalHeaderLabels(columns.values())

    for row_idx, row_data in enumerate(data):
        for col_idx, col_name in columns.items():
            value = row_data.get(col_name, '')
            self.bytes_table.setItem(row_idx, col_idx - 1, QTableWidgetItem(value))
```

---

### export_dialogs_qt.py

**Purpose**: Metadata input dialogs for missing buffs/debuffs.

#### Class: MetadataInputDialog

**Constructor**:
```python
MetadataInputDialog(parent, effect_name: str, is_buff: bool, metadata: dict)
```

**UI Elements**:
- Effect name (label, read-only)
- Label (EN) - QLineEdit (auto-filled from metadata)
- Label (JP) - QLineEdit (auto-filled)
- Label (KR) - QLineEdit (auto-filled)
- Description (EN) - QTextEdit (auto-filled)
- Description (JP) - QTextEdit (auto-filled)
- Description (KR) - QTextEdit (auto-filled)
- Icon - QLineEdit (manual input required) + Browse button
- Category - QComboBox (stats, control, utility, etc.)
- Buttons: Save, Ignore, Cancel

**Key Methods**:

**1. `_setup_ui()`**

Creates form layout with all fields.

```python
def _setup_ui(self):
    layout = QVBoxLayout(self)

    # Effect name (read-only)
    form_layout = QFormLayout()
    name_label = QLabel(self.effect_name)
    name_label.setStyleSheet("font-weight: bold;")
    form_layout.addRow("Effect:", name_label)

    # Labels
    self.label_en = QLineEdit(self.metadata.get('label', ''))
    form_layout.addRow("Label (EN):", self.label_en)

    self.label_jp = QLineEdit(self.metadata.get('label_jp', ''))
    form_layout.addRow("Label (JP):", self.label_jp)

    self.label_kr = QLineEdit(self.metadata.get('label_kr', ''))
    form_layout.addRow("Label (KR):", self.label_kr)

    # Descriptions
    self.desc_en = QTextEdit()
    self.desc_en.setPlainText(self.metadata.get('description', ''))
    self.desc_en.setMaximumHeight(80)
    form_layout.addRow("Description (EN):", self.desc_en)

    # ... same for JP, KR

    # Icon
    icon_layout = QHBoxLayout()
    self.icon_input = QLineEdit(self.metadata.get('icon', ''))
    icon_layout.addWidget(self.icon_input)
    browse_btn = QPushButton("Browse...")
    browse_btn.clicked.connect(self._browse_icon)
    icon_layout.addWidget(browse_btn)
    form_layout.addRow("Icon:", icon_layout)

    # Category
    self.category_combo = QComboBox()
    self.category_combo.addItems([
        "stats",
        "control",
        "utility",
        "damage",
        "healing",
        "defense",
        "special"
    ])
    form_layout.addRow("Category:", self.category_combo)

    layout.addLayout(form_layout)

    # Buttons
    btn_layout = QHBoxLayout()
    save_btn = QPushButton("Save")
    save_btn.clicked.connect(self._save)
    ignore_btn = QPushButton("Ignore")
    ignore_btn.clicked.connect(self._ignore)
    cancel_btn = QPushButton("Cancel")
    cancel_btn.clicked.connect(self.reject)

    btn_layout.addWidget(save_btn)
    btn_layout.addWidget(ignore_btn)
    btn_layout.addWidget(cancel_btn)

    layout.addLayout(btn_layout)
```

**2. `_save()`**

Validates and saves metadata.

```python
def _save(self):
    # Validate required fields
    if not self.label_en.text().strip():
        QMessageBox.warning(self, "Validation Error", "English label is required")
        return

    if not self.icon_input.text().strip():
        QMessageBox.warning(self, "Validation Error", "Icon is required")
        return

    # Build result
    self.result = {
        'name': self.effect_name,
        'label': self.label_en.text().strip(),
        'label_jp': self.label_jp.text().strip(),
        'label_kr': self.label_kr.text().strip(),
        'description': self.desc_en.toPlainText().strip(),
        'description_jp': self.desc_jp.toPlainText().strip(),
        'description_kr': self.desc_kr.toPlainText().strip(),
        'icon': self.icon_input.text().strip(),
        'category': self.category_combo.currentText()
    }

    self.accept()
```

**3. `_browse_icon()`**

Opens icon file picker.

```python
def _browse_icon(self):
    # Icon directory
    icon_dir = PROJECT_ROOT / "public" / "images" / "ui" / "effect"

    # Open file dialog
    file_path, _ = QFileDialog.getOpenFileName(
        self,
        "Select Icon",
        str(icon_dir),
        "Images (*.png *.webp)"
    )

    if file_path:
        # Extract filename without extension
        icon_name = Path(file_path).stem
        self.icon_input.setText(icon_name)
```

---

### ee_dialog.py

**Purpose**: Dialog for selecting buffs/debuffs for Exclusive Equipment.

#### Class: EEBuffDebuffDialog

**Constructor**:
```python
EEBuffDebuffDialog(
    parent,
    character_name: str,
    existing_buffs: list = None,
    existing_debuffs: list = None,
    existing_rank: str = None,
    ee_effect: str = None,
    ee_effect10: str = None
)
```

**UI Elements**:
- Character name (label)
- EE effect preview (text browser, read-only)
- EE effect10 preview (text browser, read-only)
- Buffs section (scrollable checkboxes)
- Debuffs section (scrollable checkboxes)
- Rank selector (dropdown: E/D/C/B/A/S/SS/SSS)
- Buttons: Save, Cancel

**Key Methods**:

**1. `_setup_ui()`**

Creates dialog layout.

```python
def _setup_ui(self):
    layout = QVBoxLayout(self)

    # Character name
    name_label = QLabel(f"<h2>{self.character_name}</h2>")
    layout.addWidget(name_label)

    # EE effect preview
    effect_group = QGroupBox("EE Effect")
    effect_layout = QVBoxLayout()

    effect_browser = QTextBrowser()
    effect_browser.setPlainText(self.ee_effect)
    effect_browser.setMaximumHeight(100)
    effect_layout.addWidget(QLabel("Base Effect:"))
    effect_layout.addWidget(effect_browser)

    effect10_browser = QTextBrowser()
    effect10_browser.setPlainText(self.ee_effect10)
    effect10_browser.setMaximumHeight(100)
    effect_layout.addWidget(QLabel("Enhanced Effect (Level 10):"))
    effect_layout.addWidget(effect10_browser)

    effect_group.setLayout(effect_layout)
    layout.addWidget(effect_group)

    # Buffs section
    buff_group = QGroupBox("Buffs")
    buff_layout = QVBoxLayout()
    buff_scroll = QScrollArea()
    buff_widget = QWidget()
    buff_grid = QVBoxLayout(buff_widget)

    for buff in self.all_buffs:
        checkbox = QCheckBox(f"{buff['name']} - {buff['label']}")
        checkbox.setChecked(buff['name'] in self.existing_buffs)
        self.buff_checkboxes[buff['name']] = checkbox
        buff_grid.addWidget(checkbox)

    buff_scroll.setWidget(buff_widget)
    buff_layout.addWidget(buff_scroll)
    buff_group.setLayout(buff_layout)
    layout.addWidget(buff_group)

    # Debuffs section (same as buffs)
    # ...

    # Rank selector
    rank_layout = QHBoxLayout()
    rank_layout.addWidget(QLabel("Rank:"))
    self.rank_combo = QComboBox()
    self.rank_combo.addItems(['E', 'D', 'C', 'B', 'A', 'S', 'SS', 'SSS'])
    if self.existing_rank:
        self.rank_combo.setCurrentText(self.existing_rank)
    rank_layout.addWidget(self.rank_combo)
    layout.addLayout(rank_layout)

    # Buttons
    btn_layout = QHBoxLayout()
    save_btn = QPushButton("Save")
    save_btn.clicked.connect(self._save)
    cancel_btn = QPushButton("Cancel")
    cancel_btn.clicked.connect(self.reject)
    btn_layout.addWidget(save_btn)
    btn_layout.addWidget(cancel_btn)
    layout.addLayout(btn_layout)
```

**2. `_save()`**

Collects selected buffs/debuffs and rank.

```python
def _save(self):
    # Collect checked buffs
    selected_buffs = [
        name for name, checkbox in self.buff_checkboxes.items()
        if checkbox.isChecked()
    ]

    # Collect checked debuffs
    selected_debuffs = [
        name for name, checkbox in self.debuff_checkboxes.items()
        if checkbox.isChecked()
    ]

    # Get rank
    rank = self.rank_combo.currentText()

    # Build result
    self.result = {
        'buffs': selected_buffs,
        'debuffs': selected_debuffs,
        'rank': rank
    }

    self.accept()
```

---

## Utilities

### cache_manager.py

**Purpose**: Pre-decode `.bytes` files to JSON for fast loading.

#### Cache Structure

```
cache/
├── CharacterTemplet.json         # Parsed from CharacterTemplet.bytes
├── CharacterTemplet.checksum     # MD5 checksum of source .bytes file
├── BuffTemplet.json
├── BuffTemplet.checksum
└── ...
```

#### Class: CacheManager

**Constructor**:
```python
CacheManager(bytes_folder: Path, cache_folder: Path = None)
```
- `bytes_folder`: Source directory with `.bytes` files
- `cache_folder`: Cache directory (default: `ParserV3/cache/`)

**Key Methods**:

**1. `get_data(bytes_filename: str) -> list`**

Gets parsed data, using cache if valid.

**Process**:
```python
def get_data(self, bytes_filename: str) -> list:
    bytes_file = self.bytes_folder / bytes_filename
    cache_file = self._get_cache_path(bytes_filename)
    checksum_file = self._get_checksum_path(bytes_filename)

    # 1. Check if cache is valid
    if cache_file.exists() and self._is_cache_valid(bytes_file, checksum_file):
        # Use cache
        with open(cache_file, 'r', encoding='utf-8') as f:
            return json.load(f)

    # 2. Cache miss or invalid - parse from .bytes
    parser = Bytes_parser(str(bytes_file))
    data = parser.get_data()

    # 3. Save to cache
    with open(cache_file, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

    # 4. Save checksum
    checksum = self._get_file_checksum(bytes_file)
    with open(checksum_file, 'w') as f:
        f.write(checksum)

    return data
```

**2. `_is_cache_valid(bytes_file: Path, checksum_file: Path) -> bool`**

Validates cache by comparing checksums.

```python
def _is_cache_valid(self, bytes_file: Path, checksum_file: Path) -> bool:
    if not checksum_file.exists():
        return False

    # Read stored checksum
    with open(checksum_file, 'r') as f:
        stored_checksum = f.read().strip()

    # Calculate current checksum
    current_checksum = self._get_file_checksum(bytes_file)

    return stored_checksum == current_checksum
```

**3. `_get_file_checksum(file_path: Path) -> str`**

Calculates MD5 checksum of file.

```python
def _get_file_checksum(self, file_path: Path) -> str:
    md5 = hashlib.md5()
    with open(file_path, 'rb') as f:
        for chunk in iter(lambda: f.read(8192), b''):
            md5.update(chunk)
    return md5.hexdigest()
```

**Performance**:
- First load: ~2 seconds (parse .bytes + cache)
- Subsequent loads: ~50ms (read JSON)
- **40x speedup** for repeated access

---

### mapping_loader.py

**Purpose**: Dynamically load enum-to-text mappings from TextSystem.bytes.

#### Mappings

**1. Elements**:
```python
{
    'CET_FIRE': 'Fire',
    'CET_WATER': 'Water',
    'CET_EARTH': 'Earth',
    'CET_LIGHT': 'Light',
    'CET_DARK': 'Dark'
}
```

**2. Classes**:
```python
{
    'CCT_DEFENDER': 'Defender',
    'CCT_STRIKER': 'Striker',  # Unified (old: Attacker)
    'CCT_RANGER': 'Ranger',
    'CCT_HEALER': 'Healer',    # Unified (old: Priest)
    'CCT_MAGE': 'Mage'
}
```

**3. SubClasses**:
```python
{
    'CSCT_NONE': 'None',
    'CSCT_CHAOS': 'Chaos',
    'CSCT_DEMON': 'Demon',
    'CSCT_BEAST': 'Beast',
    'CSCT_SPIRIT': 'Spirit',
    # ... more
}
```

#### Function: load_mappings

**Returns**:
```json
{
  "ELEMENT_MAP": {...},
  "CLASS_MAP": {...},
  "SUBCLASS_MAP": {...}
}
```

**Process**:
```python
def load_mappings() -> dict:
    # 1. Load TextSystem.bytes (cached)
    cache = CacheManager(BYTES_FOLDER)
    text_system_data = cache.get_data("TextSystem.bytes")

    # 2. Build index for O(1) lookup
    text_index = {item.get('IDSymbol'): item for item in text_system_data}

    # 3. Element mappings
    element_map = {}
    element_enums = {
        'CET_FIRE': 'SYS_ELEMENT_FIRE',
        'CET_WATER': 'SYS_ELEMENT_WATER',
        'CET_EARTH': 'SYS_ELEMENT_EARTH',
        'CET_LIGHT': 'SYS_ELEMENT_LIGHT',
        'CET_DARK': 'SYS_ELEMENT_DARK'
    }
    for enum_val, text_id in element_enums.items():
        text_entry = text_index.get(text_id)
        if text_entry:
            element_map[enum_val] = text_entry.get('English', enum_val)

    # 4. Class mappings (same process)
    # ...

    # 5. SubClass mappings (same process)
    # ...

    return {
        'ELEMENT_MAP': element_map,
        'CLASS_MAP': class_map,
        'SUBCLASS_MAP': subclass_map
    }
```

**Usage**:
```python
from mapping_loader import load_mappings

mappings = load_mappings()

# Convert enum to text
element_enum = 'CET_FIRE'
element_text = mappings['ELEMENT_MAP'].get(element_enum, element_enum)
# 'Fire'
```

---

### text_utils.py

**Purpose**: Text formatting utilities.

#### Function: to_kebab_case

**Purpose**: Convert strings to kebab-case for filenames.

**Process**:
```python
def to_kebab_case(s: str) -> str:
    # 1. Replace apostrophes and spaces
    s = s.replace("'", "").replace(" ", "-")

    # 2. Convert to lowercase
    s = s.lower()

    # 3. Remove non-alphanumeric characters (except hyphens)
    s = re.sub(r'[^a-z0-9-]', '', s)

    # 4. Remove consecutive hyphens
    s = re.sub(r'-+', '-', s)

    # 5. Strip leading/trailing hyphens
    s = s.strip('-')

    return s
```

**Examples**:
```python
to_kebab_case("Charlotte")           # "charlotte"
to_kebab_case("Gnosis Beth")         # "gnosis-beth"
to_kebab_case("Holy Night's Blessing Dianne")  # "holy-nights-blessing-dianne"
to_kebab_case("Ω (Omega) Nadja")     # "omega-nadja"
```

---

### youtube_search.py

**Purpose**: Search for character introduction videos on OUTERPLANE's official YouTube channel.

#### API Information

- **API**: YouTube Data API v3
- **Daily Quota**: 10,000 units
- **Cost per search**: 100 units
- **Max searches/day**: ~100

#### Configuration

```python
# Official channel IDs
OFFICIAL_CHANNELS = {
    "Global": "UCj3n-ek2lSiQygcnV37GVTg",  # @OUTERPLANE_OFFICIAL
    # Add more regional channels here
}

# API Key
API_KEY = "your_youtube_api_key_here"
```

#### Function: search_character_video

**Parameters**:
- `character_name`: Character name to search for
- `search_official_only`: If True, only search official channels (default: True)

**Returns**: Video URL or `None` if not found

**Process**:
```python
def search_character_video(character_name: str, search_official_only: bool = True) -> Optional[str]:
    # 1. Build search query
    query = f"{character_name} introduction OUTERPLANE"

    # 2. If official only, search each official channel
    if search_official_only:
        for channel_id in OFFICIAL_CHANNELS.values():
            video_id = _search_in_channel(query, channel_id)
            if video_id:
                return f"https://www.youtube.com/watch?v={video_id}"
    else:
        # 3. Search all YouTube with OUTERPLANE keyword
        video_id = _search_all_youtube(query)
        if video_id:
            return f"https://www.youtube.com/watch?v={video_id}"

    # 4. Fallback: try base name (without surname)
    base_name = character_name.split()[-1]
    query = f"{base_name} introduction OUTERPLANE"

    if search_official_only:
        for channel_id in OFFICIAL_CHANNELS.values():
            video_id = _search_in_channel(query, channel_id)
            if video_id:
                return f"https://www.youtube.com/watch?v={video_id}"

    return None
```

**Helper Functions**:

**1. `_search_in_channel(query: str, channel_id: str) -> Optional[str]`**
```python
def _search_in_channel(query: str, channel_id: str) -> Optional[str]:
    url = "https://www.googleapis.com/youtube/v3/search"
    params = {
        'part': 'snippet',
        'q': query,
        'channelId': channel_id,
        'type': 'video',
        'maxResults': 1,
        'key': API_KEY
    }

    try:
        response = requests.get(url, params=params)
        data = response.json()

        if 'items' in data and len(data['items']) > 0:
            return data['items'][0]['id']['videoId']
    except Exception as e:
        logger.warning(f"YouTube API error: {e}")

    return None
```

**2. `_search_all_youtube(query: str) -> Optional[str]`**
Same as `_search_in_channel` but without `channelId` parameter.

**Usage**:
```python
from youtube_search import search_character_video

# Search official channel only (recommended)
video_url = search_character_video("Charlotte", search_official_only=True)
if video_url:
    print(f"Found: {video_url}")
else:
    print("No video found")

# Search all YouTube (uses more quota)
video_url = search_character_video("Charlotte", search_official_only=False)
```

---

## End of Technical Documentation

For project overview and quick start guide, see [README.md](README.md).

For questions or issues, refer to docstrings in individual modules or use the GUI's Binary Explorer to inspect raw data.
