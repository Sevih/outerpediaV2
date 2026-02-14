"""
Core Fusion Extractor - Extract Core Fusion character data from OUTERPLANE game files

This module extracts Core Fusion character data including:
- Fusion requirements (transcendence level, materials)
- Link to original character
- All fusion levels with skill upgrades
- Complete character data (inherits from CharacterExtractor)

Core Fusion is a permanent transformation system that:
- Requires 5★ Transcendence
- Requires Fusion-Type Cores (300x)
- Cannot be reversed once applied
- Maintains level, evolution, and transcendence
- Changes all skills to new versions

Usage:
    extractor = FusionExtractor("2700037")  # Core Fusion Veronica
    data = extractor.extract()
    print(json.dumps(data, indent=2, ensure_ascii=False))

Author: ParserV3
Date: 2025-11
"""
from character_extractor import CharacterExtractor
from cache_manager import CacheManager
from pathlib import Path
import json
import re
import html
import unicodedata
from typing import Dict, Any, Optional, List

BASE_PATH = Path(__file__).parent.parent
BYTES_FOLDER = BASE_PATH / "extracted_astudio" / "assets" / "editor" / "resources" / "templetbinary"

# Element constants (from ee_manager.py)
ELEMENT_RE = re.compile(r"^(?:C[ET]T[_\- ]?)([A-Z]+)$")
ELEMENTS = {"EARTH", "WATER", "FIRE", "LIGHT", "DARK"}
OPPOSITE: Dict[str, str] = {
    "EARTH": "WATER",
    "WATER": "FIRE",
    "FIRE":  "EARTH",
    "LIGHT": "DARK",
    "DARK":  "LIGHT",
}

class FusionExtractor:
    """Extract Core Fusion character data"""

    def __init__(self, fusion_char_id):
        """
        Initialize fusion extractor

        Args:
            fusion_char_id: Character ID of the fused form (e.g., "2700037" for Core Fusion Veronica)
        """
        self.fusion_char_id = str(fusion_char_id)
        self.cache = CacheManager(BYTES_FOLDER)

    def extract(self):
        """
        Extract complete Core Fusion character data

        Returns:
            dict: Complete character data with fusion information
        """
        # Load fusion data
        fusion_data = self.cache.get_data("CharacterFusionTemplet.bytes")
        fusion_level_data = self.cache.get_data("CharacterFusionLevelTemplet.bytes")

        # Find fusion entry for this character
        fusion_entry = None
        for entry in fusion_data:
            if entry.get('ChangeCharID') == self.fusion_char_id:
                fusion_entry = entry
                break

        if not fusion_entry:
            raise ValueError(f"No Core Fusion data found for character ID {self.fusion_char_id}")

        # Extract base character data using CharacterExtractor
        char_extractor = CharacterExtractor(self.fusion_char_id)
        char_data = char_extractor.extract()

        # Get original character ID
        original_recruit_id = fusion_entry.get('RecruitID')
        fusion_group_id = fusion_entry.get('FusionGroupID')

        # Load original character JSON to get tags
        original_tags = self._get_original_tags(original_recruit_id)

        # Get fusion levels for this group
        fusion_levels = []
        for level in fusion_level_data:
            if level.get('FusionGroupID') == fusion_group_id:
                fusion_levels.append(self._extract_fusion_level(level))

        # Sort fusion levels by level number
        fusion_levels.sort(key=lambda x: x['level'])

        # Clean fusion levels - remove empty text fields
        cleaned_fusion_levels = []
        for level in fusion_levels:
            cleaned_level = {
                'level': level['level'],
                'requireItemID': level['requireItemID'],
                'skillUpgrades': level['skillUpgrades']
            }
            # Only add text fields if they have content
            if level.get('name'):
                cleaned_level['name'] = level['name']
                cleaned_level['name_jp'] = level.get('name_jp', '')
                cleaned_level['name_kr'] = level.get('name_kr', '')
                cleaned_level['name_zh'] = level.get('name_zh', '')
            if level.get('description'):
                cleaned_level['description'] = level['description']
                cleaned_level['description_jp'] = level.get('description_jp', '')
                cleaned_level['description_kr'] = level.get('description_kr', '')
                cleaned_level['description_zh'] = level.get('description_zh', '')
            cleaned_fusion_levels.append(cleaned_level)

        # Add Core Fusion specific data
        char_data['fusionType'] = 'core-fusion'
        char_data['originalCharacter'] = original_recruit_id
        char_data['isPermanent'] = True
        char_data['fusionRequirements'] = {
            'transcendence': 5,
            'material': {
                'id': fusion_levels[0]['requireItemID'] if fusion_levels else None,
                'quantity': 300  # From game screenshot
            }
        }

        # Only add fusion levels if they have meaningful data
        if cleaned_fusion_levels and any(level.get('skillUpgrades') for level in cleaned_fusion_levels):
            char_data['fusionLevels'] = cleaned_fusion_levels

        # Get "Core Fusion" prefix from game data
        fusion_prefix = self._get_fusion_prefix()

        # Modify fullname to indicate Core Fusion
        if 'Fullname' in char_data:
            char_data['Fullname'] = f"{fusion_prefix['en']} {char_data['Fullname']}"
        if 'Fullname_jp' in char_data:
            char_data['Fullname_jp'] = f"{fusion_prefix['jp']} {char_data['Fullname_jp']}"
        if 'Fullname_kr' in char_data:
            char_data['Fullname_kr'] = f"{fusion_prefix['kr']} {char_data['Fullname_kr']}"
        if 'Fullname_zh' in char_data:
            char_data['Fullname_zh'] = f"{fusion_prefix['zh']} {char_data['Fullname_zh']}"

        # Remove inherited fields that are duplicates from original character
        # These can be fetched from the original character on the website
        fields_to_remove = ['gift', 'video']  # Keep VoiceActor, tags as they might differ
        for field in fields_to_remove:
            char_data.pop(field, None)

        # Keep all transcendence levels (no filtering)

        # Copy tags from original character and add "core-fusion"
        char_data['tags'] = original_tags.copy() if original_tags else []
        if 'core-fusion' not in char_data['tags']:
            char_data['tags'].append('core-fusion')

        # Extract EE data for Core Fusion character and save to ee.json
        ee_data = self._extract_ee_data(self.fusion_char_id)
        if ee_data:
            self._save_ee_to_json(char_data.get('Fullname', ''), ee_data)

        # Update original character JSON to add link to Core Fusion
        self._update_original_character_link(original_recruit_id)

        # Copy images automatically
        self._copy_images()

        return char_data

    def _get_fusion_prefix(self):
        """
        Get "Core Fusion" text from game data (SYS_CHARACTER_FUSION_TITLE)

        Returns:
            dict: {en, jp, kr, zh} with "Core Fusion" text in each language
        """
        text_system_data = self.cache.get_data('TextSystem.bytes')

        # Search for SYS_CHARACTER_FUSION_TITLE
        for entry in text_system_data:
            if entry.get('IDSymbol') == 'SYS_CHARACTER_FUSION_TITLE':
                return {
                    'en': entry.get('English', 'Core Fusion'),
                    'jp': entry.get('Japanese', 'コアフュージョン'),
                    'kr': entry.get('Korean', '코어 퓨전'),
                    'zh': entry.get('China_Simplified', '核心融合')
                }

        # Fallback if not found in game data
        return {
            'en': 'Core Fusion',
            'jp': 'コアフュージョン',
            'kr': '코어 퓨전',
            'zh': '核心融合'
        }

    def _extract_fusion_level(self, level_data):
        """
        Extract fusion level data

        Args:
            level_data: Raw fusion level data from CharacterFusionLevelTemplet

        Returns:
            dict: Processed fusion level data
        """
        # Get text data for name and description
        text_data = self.cache.get_data("TextSystem.bytes")
        text_index = {t.get('SystemID'): t for t in text_data if t.get('SystemID')}

        name_id = level_data.get('FusionLevelName')
        desc_id = level_data.get('FusionLevel')  # This is actually the description ID

        name_text = text_index.get(name_id, {})
        desc_text = text_index.get(desc_id, {})

        # Extract skill upgrades
        skill_upgrades = {}
        for i in [1, 2, 3, 4, 23]:  # Skill slots
            skill_key = f'Skill_{i}'
            level_key = f'Skill_{i}_Level'

            if skill_key in level_data:
                skill_value = level_data.get(skill_key)
                level_value = level_data.get(level_key)

                if skill_value or level_value:
                    skill_upgrades[f'skill_{i}'] = {
                        'value': skill_value,
                        'level': level_value
                    }

        return {
            'level': int(level_data.get('ID', 0)),
            'fusionLevel': level_data.get('FusionGroupID'),
            'name': name_text.get('EN', ''),
            'name_jp': name_text.get('JP', ''),
            'name_kr': name_text.get('KR', ''),
            'name_zh': name_text.get('ZH', ''),
            'description': desc_text.get('EN', ''),
            'description_jp': desc_text.get('JP', ''),
            'description_kr': desc_text.get('KR', ''),
            'description_zh': desc_text.get('ZH', ''),
            'requireItemID': level_data.get('RequireItemID'),
            'requireItemValue': level_data.get('RequireItemValue'),
            'skillUpgrades': skill_upgrades
        }

    # ===== EE Extraction Methods (duplicated from ee_manager.py) =====

    def _fix_text(self, s: str) -> str:
        """Fix encoding and clean text"""
        if not isinstance(s, str):
            return ""
        try:
            s = s.encode("latin1").decode("utf-8")
        except (UnicodeEncodeError, UnicodeDecodeError):
            pass
        s = html.unescape(s)
        s = unicodedata.normalize("NFKC", s).replace("\u2019", "'")

        # Clean escape sequences
        s = s.replace("\\n\\n", "\n")
        s = s.replace("\\n", " ")
        s = s.replace("\r\n", "\n")
        s = re.sub(r"[ \t]+", " ", s)
        return s.strip()

    def _pick_langs(self, row: Dict[str, Any]) -> Dict[str, str]:
        """Extract {en, jp, kr, zh} from row"""
        def get_lang(r: Dict[str, Any], keys: List[str]) -> str:
            for k in keys:
                if k in r and r[k] not in (None, ""):
                    return self._fix_text(r[k])
            return ""

        return {
            "en": get_lang(row, ["English", "EN", "en", "Text_EN"]),
            "jp": get_lang(row, ["Japanese", "JP", "jp", "Text_JP"]),
            "kr": get_lang(row, ["Korean", "KR", "kr", "Text_KR"]),
            "zh": get_lang(row, ["China_Simplified", "ZH", "zh", "Text_ZH"]),
        }

    def _index_by_idsymbol(self, rows: List[Dict[str, Any]]) -> Dict[str, Dict[str, Any]]:
        """Index rows by IDSymbol"""
        idx: Dict[str, Dict[str, Any]] = {}
        for r in rows:
            k = r.get("IDSymbol") or r.get("IdSymbol") or r.get("ID") or r.get("Key")
            if not k:
                continue
            idx[str(k)] = r
        return idx

    def _get_langs_for_key(self, idx: Dict[str, Dict[str, Any]], key: str) -> Dict[str, str]:
        """Get {en, jp, kr, zh} for a key"""
        row = idx.get(key, {})
        if not row:
            return {"en": "", "jp": "", "kr": "", "zh": ""}
        return self._pick_langs(row)

    def _get_element(self, character_id: str, inverse: bool = False) -> Optional[str]:
        """Get character element, optionally return opposite element"""
        char_data = self.cache.get_data("CharacterTemplet.bytes")
        elem: Optional[str] = None

        for r in char_data:
            if str(r.get("ID")) == character_id:
                raw = str(r.get("Element") or "").strip().upper()
                if not raw:
                    break
                m = ELEMENT_RE.match(raw)
                if m:
                    elem = m.group(1)
                else:
                    elem = raw.replace("CCT_", "").replace("CET_", "").replace("-", "").replace(" ", "")
                break

        if elem not in ELEMENTS:
            return None

        if not inverse:
            return elem
        return OPPOSITE.get(elem)

    def _fmt_value(self, applying_type: str, value_raw: str, buff_row: Dict[str, Any], lang: str = "en") -> str:
        """Format value with proper display logic (same logic as character descriptions)"""
        type_val = buff_row.get("Type", "")
        stat_type = buff_row.get("StatType", "")

        # Special types that return raw value
        if type_val in ("BT_RESOURCE_USE_SKILL", "BT_REMOVE_BUFF", "BT_REMOVE_DEBUFF"):
            return str(value_raw)

        try:
            iv = int(value_raw)
        except Exception:
            return str(value_raw)

        # Rules based on ApplyingType (same logic as character_extractor.py)
        if applying_type == "OAT_RATE":
            # OAT_RATE: always divide by 10 (250 → 25%)
            result = iv / 10
            # Remove negative sign for English (sentence already says "reduce")
            if lang == "en" and result < 0:
                result = abs(result)
            return f"{int(result)}%" if (result == int(result)) else f"{result}%"
        elif applying_type == "OAT_ADD":
            # OAT_ADD with ST_CRITICAL_RATE: divide by 10
            if stat_type == "ST_CRITICAL_RATE":
                result = iv / 10
                if lang == "en" and result < 0:
                    result = abs(result)
                return f"{int(result)}%" if (result == int(result)) else f"{result}%"
            else:
                # Other OAT_ADD stats: raw value (250 → 250)
                if lang == "en" and iv < 0:
                    return str(abs(iv))
                return str(iv)
        else:
            # Fallback: unknown ApplyingType, raw value
            if lang == "en" and iv < 0:
                return str(abs(iv))
            return str(iv)

    def _resolve_placeholder(self, name: str, buff_row: Dict[str, Any], value_str: str) -> str:
        """Resolve placeholder in text"""
        key = name.strip("[]").lstrip("+").lstrip("-").lower()

        if key == "value":
            return value_str

        if key == "rate":
            raw = str(buff_row.get("CreateRate") or "")
            try:
                v = float(raw)
                return f"{(v/10.0):g}%"
            except Exception:
                return ""

        if key in ("turn", "turnduration", "duration"):
            raw = str(buff_row.get("TurnDuration") or buff_row.get("Duration") or "").strip()
            if not raw:
                return ""
            try:
                n = int(float(raw))
                if n < 0:
                    return ""
                return str(n)
            except Exception:
                return raw

        if key == "buffstartcool":
            return str(buff_row.get("BuffStartCool") or buff_row.get("BuffCool") or buff_row.get("StartCool") or "").strip()

        return f"[{name}]"

    def _apply_placeholders(self, text: str, buff_row: Dict[str, Any], value_str: str) -> str:
        """Replace all placeholders in text"""
        if not text:
            return ""

        def repl(m: re.Match) -> str:
            name = m.group(1)
            suffix = m.group(2) or ""
            val = self._resolve_placeholder(name, buff_row, value_str)
            return val + (suffix if "%" not in val else "")

        return re.sub(r"\[([+A-Za-z_]+)\](\s*%)?", repl, text)

    def _localize_effect_with_buff(self, effect_obj: Dict[str, str], buff_row: Dict[str, Any]) -> Dict[str, str]:
        """Apply value formatting and replace placeholders (with language-specific formatting)"""
        applying_type = str(buff_row.get("ApplyingType") or "")
        value_raw = str(buff_row.get("Value") or "")

        # Format value for each language (English removes negative signs)
        value_str_en = self._fmt_value(applying_type, value_raw, buff_row, lang="en")
        value_str_jp = self._fmt_value(applying_type, value_raw, buff_row, lang="jp")
        value_str_kr = self._fmt_value(applying_type, value_raw, buff_row, lang="kr")
        value_str_zh = self._fmt_value(applying_type, value_raw, buff_row, lang="zh")

        return {
            "en": self._apply_placeholders(effect_obj.get("en", ""), buff_row, value_str_en),
            "jp": self._apply_placeholders(effect_obj.get("jp", ""), buff_row, value_str_jp),
            "kr": self._apply_placeholders(effect_obj.get("kr", ""), buff_row, value_str_kr),
            "zh": self._apply_placeholders(effect_obj.get("zh", ""), buff_row, value_str_zh),
        }

    def _compose_sys_key(self, row: Dict[str, Any], enemy_elem: Optional[str]) -> Optional[str]:
        """Compose SYS_* key for mainstat"""
        if not enemy_elem:
            return None

        t = str(row.get("Type") or "")
        st = str(row.get("StatType") or "")
        tt = str(row.get("TargetType") or "")

        if t.startswith("BT_DMG_REDUCE"):
            base = f"SYS_{t}_"
        elif st.startswith("ST_"):
            base = f"SYS_STAT_{st[3:]}_"
        else:
            return None

        if tt == "ME":
            middle = "TARGET_"
        elif tt == "ENEMY_TEAM":
            middle = "OWNER_"
        else:
            return None

        return f"{base}{middle}{enemy_elem}"

    def _option_row_matches_hero(self, row: Dict[str, Any], hero_id: str) -> bool:
        """Check if ItemOption row matches hero"""
        raw = row.get("OptionMaxValue")
        if raw is None:
            return False
        s = str(raw)
        if s == hero_id:
            return True
        return re.search(rf"\b{re.escape(hero_id)}\b", s) is not None

    def _save_ee_to_json(self, fullname: str, ee_data: dict):
        """
        Save EE data to ee.json

        Args:
            fullname: Core Fusion character fullname (e.g., "Core Fusion Veronica")
            ee_data: EE data dictionary
        """
        try:
            from text_utils import to_kebab_case

            # Get kebab-case key from fullname
            ee_key = to_kebab_case(fullname)

            # Path to ee.json
            ee_json_path = BASE_PATH.parent / "src" / "data" / "ee.json"

            if not ee_json_path.exists():
                print(f"Warning: ee.json not found at {ee_json_path}")
                return

            # Read ee.json
            with open(ee_json_path, 'r', encoding='utf-8') as f:
                ee_json = json.load(f)

            # Add EE data
            ee_json[ee_key] = ee_data

            # Save updated ee.json
            with open(ee_json_path, 'w', encoding='utf-8') as f:
                json.dump(ee_json, f, indent=2, ensure_ascii=False)

            print(f"✓ Added EE data to ee.json with key: {ee_key}")

        except Exception as e:
            print(f"Warning: Could not save EE data to ee.json: {e}")

    def _copy_images(self):
        """
        Copy images from extracted_astudio to public/images/characters/
        Only copies PNG files (no conversion)
        """
        try:
            import shutil

            # Source and destination paths
            source_base = BASE_PATH / "extracted_astudio" / "assets" / "editor" / "resources"
            public_base = BASE_PATH.parent / "public" / "images" / "characters"

            # Create destination directories
            dest_portrait = public_base / "portrait"
            dest_atb = public_base / "atb"
            dest_full = public_base / "full"
            dest_ex = public_base / "ex"
            dest_cutin = public_base / "cutin"
            dest_skills = public_base / "skills"

            for dest in [dest_portrait, dest_atb, dest_full, dest_ex, dest_cutin, dest_skills]:
                dest.mkdir(parents=True, exist_ok=True)

            copied_count = 0

            # Portrait: CT_{id}.png
            portrait_files = list(source_base.rglob(f"CT_{self.fusion_char_id}.png"))
            if portrait_files:
                dest_file = dest_portrait / f"CT_{self.fusion_char_id}.png"
                if not dest_file.exists():
                    shutil.copy2(portrait_files[0], dest_file)
                    print(f"✓ Copied portrait: CT_{self.fusion_char_id}.png")
                    copied_count += 1
                else:
                    print(f"  Skipped portrait (already exists)")
            else:
                print(f"  Warning: Portrait not found: CT_{self.fusion_char_id}.png")

            # ATB icons: IG_Turn_{id}.png and IG_Turn_{id}_E.png
            for atb_suffix in ["", "_E"]:
                atb_pattern = f"IG_Turn_{self.fusion_char_id}{atb_suffix}.png"
                atb_files = list(source_base.rglob(atb_pattern))
                if atb_files:
                    dest_file = dest_atb / atb_pattern
                    if not dest_file.exists():
                        shutil.copy2(atb_files[0], dest_file)
                        print(f"✓ Copied ATB: {atb_pattern}")
                        copied_count += 1
                    else:
                        print(f"  Skipped {atb_pattern} (already exists)")
                else:
                    print(f"  Warning: ATB not found: {atb_pattern}")

            # Full art: IMG_{id}.png
            full_files = list(source_base.rglob(f"IMG_{self.fusion_char_id}.png"))
            if full_files:
                dest_file = dest_full / f"IMG_{self.fusion_char_id}.png"
                if not dest_file.exists():
                    shutil.copy2(full_files[0], dest_file)
                    print(f"✓ Copied full art: IMG_{self.fusion_char_id}.png")
                    copied_count += 1
                else:
                    print(f"  Skipped full art (already exists)")
            else:
                print(f"  Warning: Full art not found: IMG_{self.fusion_char_id}.png")

            # EE/EX: TI_Equipment_EX_{id}.png -> renamed to {fullname-kebab}.png
            ex_files = list(source_base.rglob(f"TI_Equipment_EX_{self.fusion_char_id}.png"))
            if ex_files:
                # Get fullname for kebab-case
                char_extractor = CharacterExtractor(self.fusion_char_id)
                char_data = char_extractor.extract()

                from text_utils import to_kebab_case
                fusion_prefix = self._get_fusion_prefix()
                fullname = f"{fusion_prefix['en']} {char_data.get('Fullname', '')}"
                slug = to_kebab_case(fullname)

                dest_file = dest_ex / f"{slug}.png"
                if not dest_file.exists():
                    shutil.copy2(ex_files[0], dest_file)
                    print(f"✓ Copied EX: TI_Equipment_EX_{self.fusion_char_id}.png -> {slug}.png")
                    copied_count += 1
                else:
                    print(f"  Skipped EX (already exists)")
            else:
                print(f"  Warning: EX not found: TI_Equipment_EX_{self.fusion_char_id}.png")

            # Cut-in: T_CutIn_{id}.png
            cutin_files = list(source_base.rglob(f"T_CutIn_{self.fusion_char_id}.png"))
            if cutin_files:
                dest_file = dest_cutin / f"T_CutIn_{self.fusion_char_id}.png"
                if not dest_file.exists():
                    shutil.copy2(cutin_files[0], dest_file)
                    print(f"✓ Copied cut-in: T_CutIn_{self.fusion_char_id}.png")
                    copied_count += 1
                else:
                    print(f"  Skipped cut-in (already exists)")
            else:
                print(f"  Warning: Cut-in not found: T_CutIn_{self.fusion_char_id}.png")

            # Skills: Skill_*_{id}.png
            skill_files = list(source_base.rglob(f"Skill_*_{self.fusion_char_id}.png"))
            if skill_files:
                for skill_file in skill_files:
                    dest_file = dest_skills / skill_file.name
                    if not dest_file.exists():
                        shutil.copy2(skill_file, dest_file)
                        print(f"✓ Copied skill: {skill_file.name}")
                        copied_count += 1
                    else:
                        print(f"  Skipped {skill_file.name} (already exists)")
            else:
                print(f"  Warning: No skill icons found for {self.fusion_char_id}")

            print(f"✓ Copied {copied_count} images total")

        except Exception as e:
            print(f"Warning: Could not copy images: {e}")

    def _get_original_tags(self, original_char_id: str) -> list:
        """
        Get tags from original character JSON

        Args:
            original_char_id: Original character ID (e.g., "2000037")

        Returns:
            List of tags or empty list
        """
        try:
            # Get character data to find the filename
            char_extractor = CharacterExtractor(original_char_id)
            original_data = char_extractor.extract()

            # Get the slug from Fullname
            from text_utils import to_kebab_case
            slug = to_kebab_case(original_data.get('Fullname', ''))

            # Path to original character JSON
            char_json_path = BASE_PATH.parent / "src" / "data" / "char" / f"{slug}.json"

            if not char_json_path.exists():
                return []

            # Read original character JSON
            with open(char_json_path, 'r', encoding='utf-8') as f:
                original_json = json.load(f)

            return original_json.get('tags', [])

        except Exception as e:
            print(f"Warning: Could not load tags from original character: {e}")
            return []

    def _update_original_character_link(self, original_char_id: str):
        """
        Update the original character JSON to add link to Core Fusion

        Args:
            original_char_id: Original character ID (e.g., "2000037")
        """
        try:
            # Get character data to find the filename
            char_extractor = CharacterExtractor(original_char_id)
            original_data = char_extractor.extract()

            # Get the slug from Fullname
            from text_utils import to_kebab_case
            slug = to_kebab_case(original_data.get('Fullname', ''))

            # Path to original character JSON
            char_json_path = BASE_PATH.parent / "src" / "data" / "char" / f"{slug}.json"

            if not char_json_path.exists():
                print(f"Warning: Original character JSON not found at {char_json_path}")
                return

            # Read original character JSON
            with open(char_json_path, 'r', encoding='utf-8') as f:
                original_json = json.load(f)

            # Add Core Fusion link
            original_json['hasCoreFusion'] = True
            original_json['coreFusionId'] = self.fusion_char_id

            # Save updated JSON
            with open(char_json_path, 'w', encoding='utf-8') as f:
                json.dump(original_json, f, indent=2, ensure_ascii=False)

            print(f"✓ Updated {char_json_path.name} with Core Fusion link")

        except Exception as e:
            print(f"Warning: Could not update original character link: {e}")

    def _extract_ee_data(self, character_id: str) -> Optional[dict]:
        """
        Extract EE data for Core Fusion character (ID starting with 27)

        Args:
            character_id: Core Fusion character ID (e.g., "2700037")

        Returns:
            EE dict or None if not found
        """
        try:
            # Get enemy element (inverse of character element)
            enemy_elem = self._get_element(character_id, inverse=True)

            # Load data
            textitem_rows = self.cache.get_data("TextItem.bytes")
            textskill_rows = self.cache.get_data("TextSkill.bytes")
            buff_rows = self.cache.get_data("BuffTemplet.bytes")
            itemopt_rows = self.cache.get_data("ItemOptionTemplet.bytes")
            sys_rows = self.cache.get_data("TextSystem.bytes")

            # Index
            item_idx = self._index_by_idsymbol(textitem_rows)
            skill_idx = self._index_by_idsymbol(textskill_rows)
            sys_idx = self._index_by_idsymbol(sys_rows)

            # Keys - use Core Fusion character ID (27xxxxx)
            key_name = f"ITEM_C_EQUIP_{character_id}_NAME"
            key_desc = f"UO_CEQUIP_{character_id}_DESC"
            key_desc10 = f"UO_CEQUIP_{character_id}_UPGRADE_DESC"

            # Get texts
            name_obj = self._get_langs_for_key(item_idx, key_name)
            effect_obj = self._get_langs_for_key(skill_idx, key_desc)
            effect10_obj = self._get_langs_for_key(skill_idx, key_desc10)

            # Check if EE exists
            if not name_obj.get("en") and not effect_obj.get("en"):
                return None

            # Get buff rows
            buff_key_base = f"BID_CEQUIP_{character_id}"
            buff_key_upgrade = f"{buff_key_base}_CHANGE"

            buff_match_main = next((r for r in buff_rows if str(r.get("BuffID")) == buff_key_base), None)
            buff_match_upgrade = next((r for r in buff_rows if str(r.get("BuffID")) == buff_key_upgrade), None)

            if buff_match_upgrade is None:
                buff_key_upgrade = f"{buff_key_base}_ADD"
                buff_match_upgrade = next((r for r in buff_rows if str(r.get("BuffID")) == buff_key_upgrade), None)

            # Apply buff values to effect texts
            if buff_match_main:
                effect_obj = self._localize_effect_with_buff(effect_obj, buff_match_main)

            if buff_match_upgrade:
                effect10_obj = self._localize_effect_with_buff(effect10_obj, buff_match_upgrade)
            elif buff_match_main:
                effect10_obj = self._localize_effect_with_buff(effect10_obj, buff_match_main)

            # Main stat resolution
            mainstat_option_rows = [r for r in itemopt_rows if self._option_row_matches_hero(r, character_id)]

            buffids_from_options = []
            for r in mainstat_option_rows:
                b = r.get("BuffID") or r.get("OptionBuffID")
                if b:
                    buffids_from_options.append(str(b))

            # Deduplicate
            seen = set()
            buffids_from_options = [x for x in buffids_from_options if not (x in seen or seen.add(x))]

            # Get buff rows for mainstat
            buff_by_id = {}
            for r in buff_rows:
                bid = str(r.get("BuffID") or "")
                if bid:
                    buff_by_id.setdefault(bid, []).append(r)

            mainstat_buff_rows = []
            for bid in buffids_from_options:
                mainstat_buff_rows.extend(buff_by_id.get(bid, []))

            # Resolve SYS_* keys
            keys = []
            seen_keys = set()
            for br in mainstat_buff_rows:
                k = self._compose_sys_key(br, enemy_elem)
                if k and k not in seen_keys:
                    seen_keys.add(k)
                    keys.append(k)

            # Get mainstat texts
            main_en = ""
            main_jp = ""
            main_kr = ""
            main_zh = ""
            if keys:
                langs = self._get_langs_for_key(sys_idx, keys[0])
                main_en = langs["en"]
                main_jp = langs["jp"]
                main_kr = langs["kr"]
                main_zh = langs["zh"]

            # Build EE dict
            ee_dict = {
                "name": name_obj["en"],
                "name_jp": name_obj["jp"],
                "name_kr": name_obj["kr"],
                "name_zh": name_obj["zh"],
                "mainStat": main_en,
                "mainStat_jp": main_jp,
                "mainStat_kr": main_kr,
                "mainStat_zh": main_zh,
                "effect": effect_obj["en"],
                "effect_jp": effect_obj["jp"],
                "effect_kr": effect_obj["kr"],
                "effect_zh": effect_obj["zh"],
                "effect10": effect10_obj["en"],
                "effect10_jp": effect10_obj["jp"],
                "effect10_kr": effect10_obj["kr"],
                "effect10_zh": effect10_obj["zh"],
                "icon_effect": "TI_Icon_UO_Accessary_07",
                "rank": "",
                "buff": [],
                "debuff": []
            }

            return ee_dict

        except Exception as e:
            print(f"Warning: Could not extract EE data for {character_id}: {e}")
            return None


def main():
    """CLI entry point for testing"""
    import sys
    import io

    # Fix Windows console encoding
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

    if len(sys.argv) < 2:
        print("Usage: python fusion_extractor.py <fusion_character_id>")
        print("Example: python fusion_extractor.py 2700037  # Core Fusion Veronica")
        sys.exit(1)

    fusion_char_id = sys.argv[1]

    try:
        extractor = FusionExtractor(fusion_char_id)
        data = extractor.extract()

        # Save to file first
        output_file = BASE_PATH / "ParserV3" / "export" / f"core-fusion-{fusion_char_id}.json"
        output_file.parent.mkdir(parents=True, exist_ok=True)

        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

        print(f"Data exported to: {output_file}")
        print(f"\nCharacter: {data.get('Fullname', 'Unknown')}")
        print(f"Original Character ID: {data.get('originalCharacter', 'Unknown')}")
        print(f"Fusion Levels: {len(data.get('fusionLevels', []))}")

    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
