#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
EE Localization Extractor - Extracts Chinese Simplified texts for Exclusive Equipment

Extracts:
- name_zh (from TextItem)
- mainStat_zh (from TextSystem via BuffTemplet)
- effect_zh (from TextSkill with placeholder replacement)
- effect10_zh (from TextSkill with placeholder replacement)
"""

import logging
import re
from pathlib import Path
from cache_manager import CacheManager

logger = logging.getLogger(__name__)

from config import BYTES_FOLDER

class EELocalizationExtractor:
    """Extract Chinese Simplified localization for Exclusive Equipment"""

    # Class-level cache for parsers (shared across all instances)
    _parser_cache = None

    def __init__(self, ee_id: str, language_config: dict):
        """
        Args:
            ee_id: EE ID (e.g., "2000105")
            language_config: Dict with 'suffix' and 'bytes_field' (e.g., {"suffix": "_zh", "bytes_field": "China_Simplified"})
        """
        self.ee_id = str(ee_id).strip()
        self.suffix = language_config["suffix"]
        self.bytes_field = language_config["bytes_field"]
        self.loc_data = {}

        # Load parsers (cached)
        self._load_parsers()

    def _load_parsers(self):
        """Load and cache all necessary .bytes files"""
        if EELocalizationExtractor._parser_cache is not None:
            # Use cached parsers
            cache = EELocalizationExtractor._parser_cache
            self.item_text_index = cache['item_text_index']
            self.skill_text_index = cache['skill_text_index']
            self.buff_parser = cache['buff_parser']
            self.sys_text_index = cache['sys_text_index']
            self.char_parser = cache['char_parser']
            self.itemopt_parser = cache['itemopt_parser']
            logger.info("Using cached parsers")
            return

        # Load parsers for the first time
        logger.info("Loading .bytes parsers...")
        cache_mgr = CacheManager(BYTES_FOLDER)

        # TextItem (for name)
        item_text_data = cache_mgr.get_data("TextItem.bytes")
        self.item_text_index = {str(row.get('IDSymbol', row.get('ID', ''))): row for row in item_text_data}

        # TextSkill (for effect/effect10)
        skill_text_data = cache_mgr.get_data("TextSkill.bytes")
        self.skill_text_index = {str(row.get('IDSymbol', row.get('ID', ''))): row for row in skill_text_data}

        # BuffTemplet (for buff data and placeholders)
        self.buff_parser = cache_mgr

        # TextSystem (for mainStat)
        sys_text_data = cache_mgr.get_data("TextSystem.bytes")
        self.sys_text_index = {str(row.get('IDSymbol', row.get('ID', ''))): row for row in sys_text_data}

        # CharacterTemplet (for element detection)
        self.char_parser = cache_mgr

        # ItemOptionTemplet (for mainStat BuffID mapping)
        self.itemopt_parser = cache_mgr

        # Cache for future instances
        EELocalizationExtractor._parser_cache = {
            'item_text_index': self.item_text_index,
            'skill_text_index': self.skill_text_index,
            'buff_parser': cache_mgr,
            'sys_text_index': self.sys_text_index,
            'char_parser': cache_mgr,
            'itemopt_parser': cache_mgr,
        }

        logger.info("Parsers loaded and cached")

    def extract(self):
        """Main extraction - returns localization data for EE"""
        logger.info(f"Extracting EE localization for ID {self.ee_id}")

        # Extract name
        self._extract_name()

        # Extract mainStat
        self._extract_mainstat()

        # Extract effect and effect10
        self._extract_effects()

        return self.loc_data

    def _extract_name(self):
        """Extract name_zh from TextItem"""
        key_name = f"ITEM_C_EQUIP_{self.ee_id}_NAME"
        name_row = self.item_text_index.get(key_name, {})

        if name_row:
            name_zh = name_row.get(self.bytes_field, '')
            if name_zh:
                self.loc_data[f'name{self.suffix}'] = name_zh
                logger.info(f"Extracted name{self.suffix}: {name_zh}")

    def _extract_mainstat(self):
        """Extract mainStat_zh from TextSystem via BuffTemplet and ItemOptionTemplet"""
        # Get enemy element (inverse of character element)
        enemy_elem = self._get_element_from_character(self.ee_id, inverse=True)
        if not enemy_elem:
            logger.warning(f"Could not determine element for EE {self.ee_id}")
            return

        # Get ItemOptionTemplet rows for this EE
        itemopt_data = self.itemopt_parser.get_data("ItemOptionTemplet.bytes")
        mainstat_options = [row for row in itemopt_data if self._option_row_matches_hero(row, self.ee_id)]

        # Collect BuffIDs from options
        buff_ids = []
        for row in mainstat_options:
            buff_id = row.get("BuffID") or row.get("OptionBuffID")
            if buff_id:
                buff_ids.append(str(buff_id))

        # Get BuffTemplet rows for these BuffIDs
        buff_data = self.buff_parser.get_data("BuffTemplet.bytes")
        mainstat_buffs = [row for row in buff_data if str(row.get("BuffID", "")) in buff_ids]

        # Compose SYS_* keys
        sys_keys = []
        for buff_row in mainstat_buffs:
            sys_key = self._compose_sys_key(buff_row, enemy_elem)
            if sys_key and sys_key not in sys_keys:
                sys_keys.append(sys_key)

        # Get Chinese text from TextSystem
        if sys_keys:
            sys_key = sys_keys[0]  # Use first key
            sys_row = self.sys_text_index.get(sys_key, {})
            mainstat_zh = sys_row.get(self.bytes_field, '')
            if mainstat_zh:
                self.loc_data[f'mainStat{self.suffix}'] = mainstat_zh
                logger.info(f"Extracted mainStat{self.suffix}: {mainstat_zh}")

    def _extract_effects(self):
        """Extract effect_zh and effect10_zh from TextSkill with placeholder replacement"""
        key_effect = f"UO_CEQUIP_{self.ee_id}_DESC"
        key_effect10 = f"UO_CEQUIP_{self.ee_id}_UPGRADE_DESC"

        effect_row = self.skill_text_index.get(key_effect, {})
        effect10_row = self.skill_text_index.get(key_effect10, {})

        # Get buff data for placeholder replacement
        buff_data = self.buff_parser.get_data("BuffTemplet.bytes")
        buff_key_base = f"BID_CEQUIP_{self.ee_id}"
        buff_key_upgrade = f"{buff_key_base}_CHANGE"

        buff_main = next((r for r in buff_data if str(r.get("BuffID")) == buff_key_base), None)
        buff_upgrade = next((r for r in buff_data if str(r.get("BuffID")) == buff_key_upgrade), None)

        # Fallback to _ADD if _CHANGE not found
        if not buff_upgrade:
            buff_key_upgrade = f"{buff_key_base}_ADD"
            buff_upgrade = next((r for r in buff_data if str(r.get("BuffID")) == buff_key_upgrade), None)

        # Extract and process effect
        if effect_row:
            effect_text = effect_row.get(self.bytes_field, '')
            if effect_text and buff_main:
                effect_text = self._apply_placeholders(effect_text, buff_main)
                self.loc_data[f'effect{self.suffix}'] = effect_text
                logger.info(f"Extracted effect{self.suffix}")

        # Extract and process effect10
        if effect10_row:
            effect10_text = effect10_row.get(self.bytes_field, '')
            buff_to_use = buff_upgrade if buff_upgrade else buff_main
            if effect10_text and buff_to_use:
                effect10_text = self._apply_placeholders(effect10_text, buff_to_use)
                self.loc_data[f'effect10{self.suffix}'] = effect10_text
                logger.info(f"Extracted effect10{self.suffix}")

    def _apply_placeholders(self, text: str, buff_row: dict) -> str:
        """Replace placeholders like [+Value], [Rate], [TurnDuration] with actual values"""
        if not text:
            return ""

        # Format value
        applying_type = str(buff_row.get("ApplyingType", ""))
        value_raw = str(buff_row.get("Value", ""))
        value_str = self._fmt_value(applying_type, value_raw, buff_row)

        def repl(match: re.Match) -> str:
            name = match.group(1)  # Content between brackets
            suffix = match.group(2) or ""  # Optional ' %' after

            # Normalize name (remove [], +, -)
            key = name.strip("[]").lstrip("+").lstrip("-").lower()

            if key == "value":
                val = value_str
            elif key == "rate":
                val = self._fmt_rate(buff_row)
            elif key in ("turn", "turnduration", "duration"):
                val = self._fmt_turns(buff_row)
            elif key == "buffstartcool":
                val = str(buff_row.get("BuffStartCool") or buff_row.get("BuffCool") or buff_row.get("StartCool") or "").strip()
            else:
                return f"[{name}]"  # Unknown placeholder

            # Add suffix if value doesn't already contain '%'
            return val + (suffix if "%" not in val else "")

        # Replace [Placeholder] and [+Placeholder] with optional ' %' suffix
        return re.sub(r"\[([+A-Za-z_]+)\](\s*%)?", repl, text)

    def _fmt_value(self, applying_type: str, value_raw: str, buff_row: dict) -> str:
        """Format value based on ApplyingType and StatType"""
        try:
            v = float(value_raw)
        except Exception:
            return value_raw

        app = (applying_type or "").upper()
        stat = str(buff_row.get("StatType", "")).upper()
        is_rate_stat = stat.endswith("_RATE") or "RATE" in stat or "ST_HP" in stat

        # Handle *_RATE stats as percentages for OAT_ADD and OAT_RATE
        if app in ("OAT_RATE", "OAT_ADD") and is_rate_stat:
            if v < 1000:
                return f"{(v/10.0):g}%"
            if v % 1000 == 0:
                create_type = str(buff_row.get("BuffCreateType", "")).upper()
                turn_dur = str(buff_row.get("TurnDuration", "")).strip()
                is_passive = (create_type == "PASSIVE") or (turn_dur == "-1")
                if is_passive:
                    return f"{int(v/1000)}"  # Stack counter
                return f"{(v/10.0):g}%"
            return f"{(v/10.0):g}%"

        # OAT_RATE fallback
        if app == "OAT_RATE":
            if v < 1000:
                return f"{(v/10.0):g}%"
            if v % 1000 == 0:
                create_type = str(buff_row.get("BuffCreateType", "")).upper()
                turn_dur = str(buff_row.get("TurnDuration", "")).strip()
                is_passive = (create_type == "PASSIVE") or (turn_dur == "-1")
                if is_passive:
                    return f"{int(v/1000)}"
                return f"{(v/10.0):g}%"
            return f"{(v/10.0):g}%"

        # Default: raw value
        return f"{v:g}"

    def _fmt_rate(self, buff_row: dict) -> str:
        """Format CreateRate (0..1000) -> 'xx%'"""
        raw = str(buff_row.get("CreateRate", ""))
        try:
            v = float(raw)
            return f"{(v/10.0):g}%"
        except Exception:
            return ""

    def _fmt_turns(self, buff_row: dict) -> str:
        """Format TurnDuration/Duration -> 'n'"""
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

    def _option_row_matches_hero(self, row: dict, hero_id: str) -> bool:
        """Check if ItemOptionTemplet row matches hero via OptionMaxValue"""
        raw = row.get("OptionMaxValue")
        if raw is None:
            return False
        s = str(raw)
        if s == hero_id:
            return True
        return re.search(rf"\b{re.escape(hero_id)}\b", s) is not None

    def _get_element_from_character(self, hero_id: str, inverse: bool = False) -> str:
        """Get character element from CharacterTemplet, optionally return opposite element"""
        ELEMENTS = {"EARTH", "WATER", "FIRE", "LIGHT", "DARK"}
        OPPOSITE = {
            "EARTH": "WATER",
            "WATER": "FIRE",
            "FIRE": "EARTH",
            "LIGHT": "DARK",
            "DARK": "LIGHT",
        }
        ELEMENT_RE = re.compile(r"^(?:C[ET]T[_\- ]?)([A-Z]+)$")

        char_data = self.char_parser.get_data("CharacterTemplet.bytes")
        elem = None

        for row in char_data:
            if str(row.get("ID")) == hero_id:
                raw = str(row.get("Element", "")).strip().upper()
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

    def _compose_sys_key(self, row: dict, enemy_elem: str) -> str:
        """Compose SYS_* key for mainStat from BuffTemplet row"""
        if not enemy_elem:
            return None

        t = str(row.get("Type", ""))
        st = str(row.get("StatType", ""))
        tt = str(row.get("TargetType", ""))

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
