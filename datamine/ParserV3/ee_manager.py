"""
EE Manager - Extract and manage Exclusive Equipment data

Extracts EE data (name, mainStat, effect, effect10) for a single character
and updates ee.json

Based on ee_entry.py logic but adapted for single character updates

Author: ParserV3
Date: 2025-10
"""

from pathlib import Path
import json
import logging
import re
import html
import unicodedata
from typing import Dict, Any, Optional, List
from bytes_parser import Bytes_parser
from cache_manager import CacheManager

logger = logging.getLogger(__name__)

from config import BYTES_FOLDER, EE_FILE as EE_PATH

# Element constants
ELEMENT_RE = re.compile(r"^(?:C[ET]T[_\- ]?)([A-Z]+)$")
ELEMENTS = {"EARTH", "WATER", "FIRE", "LIGHT", "DARK"}
OPPOSITE: Dict[str, str] = {
    "EARTH": "WATER",
    "WATER": "FIRE",
    "FIRE":  "EARTH",
    "LIGHT": "DARK",
    "DARK":  "LIGHT",
}


class EEManager:
    """Manage Exclusive Equipment extraction and updates"""

    def __init__(self):
        """Initialize EE manager"""
        self.cache = CacheManager(BYTES_FOLDER)
        self.ee_data = self._load_ee_data()

    def _load_ee_data(self) -> dict:
        """Load existing ee.json"""
        if not EE_PATH.exists():
            logger.warning(f"EE file not found: {EE_PATH}")
            return {}

        try:
            with open(EE_PATH, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            logger.error(f"Error loading ee.json: {e}")
            return {}

    def _save_ee_data(self):
        """Save ee.json"""
        try:
            with open(EE_PATH, 'w', encoding='utf-8') as f:
                json.dump(self.ee_data, f, ensure_ascii=False, indent=2)
            logger.info(f"EE data saved: {EE_PATH}")
        except Exception as e:
            logger.error(f"Error saving ee.json: {e}")

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
        """Get {en, jp, kr} for a key"""
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
        raw = name.strip("[]")
        # Preserve +/- prefix from placeholder (e.g. [+value] → "+100%")
        prefix = ""
        if raw.startswith("+"):
            prefix = "+"
            raw = raw[1:]
        elif raw.startswith("-"):
            prefix = "-"
            raw = raw[1:]
        key = raw.lower()

        if key == "value":
            return prefix + value_str

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

    # Words that indicate the preceding value is a probability (rate ÷10 → %)
    _RATE_CONTEXT_WORDS = ('chance', '확률', '確率', '几率', '機率')

    def _apply_placeholders(self, text: str, buff_row: Dict[str, Any], value_str: str) -> str:
        """Replace all placeholders in text"""
        if not text:
            return ""

        def repl(m: re.Match) -> str:
            name = m.group(1)
            suffix = m.group(2) or ""
            val = self._resolve_placeholder(name, buff_row, value_str)

            # If value is a raw number followed by a probability word → format as rate
            if "%" not in val and name.strip("+-").lower() == "value":
                after = text[m.end():m.end() + 20]
                if any(w in after for w in self._RATE_CONTEXT_WORDS):
                    try:
                        iv = int(float(val))
                        result = iv / 10
                        val = f"{int(result)}%" if result == int(result) else f"{result}%"
                    except (ValueError, TypeError):
                        pass

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

        if t.startswith("BT_DMG"):
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

    def extract_ee(self, character_id: str, fullname: str) -> Optional[dict]:
        """
        Extract EE data for a character

        Args:
            character_id: Character ID (e.g., "2000066")
            fullname: Character fullname (used as key in ee.json)

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

            # Keys
            key_name = f"ITEM_C_EQUIP_{character_id}_NAME"
            key_desc = f"UO_CEQUIP_{character_id}_DESC"
            key_desc10 = f"UO_CEQUIP_{character_id}_UPGRADE_DESC"

            # Get texts
            name_obj = self._get_langs_for_key(item_idx, key_name)
            effect_obj = self._get_langs_for_key(skill_idx, key_desc)
            effect10_obj = self._get_langs_for_key(skill_idx, key_desc10)

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
            logger.error(f"Error extracting EE for {character_id}: {e}", exc_info=True)
            return None

    def _option_row_matches_hero(self, row: Dict[str, Any], hero_id: str) -> bool:
        """Check if ItemOption row matches hero"""
        raw = row.get("OptionMaxValue")
        if raw is None:
            return False
        s = str(raw)
        if s == hero_id:
            return True
        return re.search(rf"\b{re.escape(hero_id)}\b", s) is not None

    def update_ee(self, character_id: str, ee_dict: dict) -> bool:
        """
        Update or add EE in ee.json

        Args:
            character_id: Character ID (used as key in ee.json)
            ee_dict: EE data

        Returns:
            True if updated/added, False if no change
        """
        existing = self.ee_data.get(character_id)

        # Check if different
        if existing == ee_dict:
            logger.info(f"EE for {character_id} is already up to date")
            return False

        # Update
        self.ee_data[character_id] = ee_dict
        self._save_ee_data()

        if existing:
            logger.info(f"Updated EE for {character_id}")
        else:
            logger.info(f"Added new EE for {character_id}")

        return True

    def extract_and_update(self, character_id: str, fullname: str) -> bool:
        """
        Extract EE and update ee.json if different

        Args:
            character_id: Character ID
            fullname: Character fullname

        Returns:
            True if EE was updated, False otherwise
        """
        ee_dict = self.extract_ee(character_id, fullname)

        if not ee_dict:
            return False

        return self.update_ee(character_id, ee_dict)
