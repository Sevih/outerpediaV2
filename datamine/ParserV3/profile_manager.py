"""
Profile Manager - Extract and manage character profiles

Extracts profile data (birthday, height, weight, story) for a single character
and updates character-profiles.json

Author: ParserV3
Date: 2025-10
"""

from pathlib import Path
import json
import logging
import html
import unicodedata
from bytes_parser import Bytes_parser
from cache_manager import CacheManager

logger = logging.getLogger(__name__)

from config import BYTES_FOLDER, DATA_ROOT

PROFILES_PATH = DATA_ROOT / "character-profiles.json"

# Surnames that should be included in fullname
INCLUDE_SURNAME = [
    "gnosis", "monad", "demiurge",
    "Kitsune of Eternity", "Poolside Trickster",
    "Holy Night's Blessing", "Omega", "Summer Knight's Dream"
]


class ProfileManager:
    """Manage character profile extraction and updates"""

    def __init__(self):
        """Initialize profile manager"""
        self.cache = CacheManager(BYTES_FOLDER)
        self.profiles = self._load_profiles()
        self.surnames_cf = {self._fix_text(s).casefold() for s in INCLUDE_SURNAME}

    def _fix_text(self, s: str) -> str:
        """Fix encoding issues and clean text"""
        if not isinstance(s, str):
            return s
        try:
            s = s.encode("latin1").decode("utf-8")
        except (UnicodeEncodeError, UnicodeDecodeError):
            pass
        s = html.unescape(s)
        s = unicodedata.normalize("NFKC", s).replace("\u2019", "'")
        return " ".join(s.split())

    def _format_birthday(self, date_str: str) -> str:
        """Format birthday from YYYYMMDD to MM/DD"""
        if len(date_str) == 8:
            return f"{date_str[4:6]}/{date_str[6:8]}"
        return ""

    def _load_profiles(self) -> dict:
        """Load existing character-profiles.json"""
        if not PROFILES_PATH.exists():
            logger.warning(f"Profiles file not found: {PROFILES_PATH}")
            return {}

        try:
            with open(PROFILES_PATH, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            logger.error(f"Error loading profiles: {e}")
            return {}

    def _save_profiles(self):
        """Save character-profiles.json"""
        try:
            with open(PROFILES_PATH, 'w', encoding='utf-8') as f:
                json.dump(self.profiles, f, ensure_ascii=False, indent=2)
            logger.info(f"Profiles saved: {PROFILES_PATH}")
        except Exception as e:
            logger.error(f"Error saving profiles: {e}")

    def extract_profile(self, character_id: str, fullname: str, fullname_jp: str = "", fullname_kr: str = "", fullname_zh: str = "") -> dict:
        """
        Extract profile data for a single character

        Args:
            character_id: Character ID (e.g., "2000066")
            fullname: English fullname
            fullname_jp: Japanese fullname (optional)
            fullname_kr: Korean fullname (optional)
            fullname_zh: Chinese simplified fullname (optional)

        Returns:
            Profile dict or None if not found
        """
        try:
            char_id_int = int(character_id)
        except ValueError:
            logger.error(f"Invalid character ID: {character_id}")
            return None

        # Load necessary data
        archive_profile_data = self.cache.get_data("ArchiveCharacterProfileTemplet.bytes")
        text_system_data = self.cache.get_data("TextSystem.bytes")

        # Build text system lookup
        text_system_lookup = {
            row["IDSymbol"]: {
                "en": self._fix_text(row.get("English", "")),
                "jp": self._fix_text(row.get("Japanese", "")),
                "kr": self._fix_text(row.get("Korean", "")),
                "zh": self._fix_text(row.get("China_Simplified", "")),
            }
            for row in text_system_data if "IDSymbol" in row
        }

        # Find profile data for this character
        profile_info = None
        for row in archive_profile_data:
            if "CharacterID" in row and int(row["CharacterID"]) == char_id_int:
                profile_info = {
                    "birthday": self._format_birthday(str(row.get("Birthday", ""))),
                    "height": f'{row["Height"]} cm' if "Height" in row else None,
                    "weight": f'{row["Weight"]} kg' if "Weight" in row else None,
                    "scenario": row.get("ScenarioIDSymbol", None)
                }
                break

        if not profile_info:
            logger.warning(f"No profile data found for character {character_id}")
            return None

        # Get story from scenario ID
        scenario_id = profile_info.get("scenario", "")
        story = text_system_lookup.get(scenario_id, {"en": "", "jp": "", "kr": "", "zh": ""})

        # Build profile dict
        profile = {
            "fullname": {
                "en": fullname,
                "jp": fullname_jp or fullname,
                "kr": fullname_kr or fullname,
                "zh": fullname_zh or fullname
            },
            "birthday": profile_info.get("birthday"),
            "height": profile_info.get("height"),
            "weight": profile_info.get("weight"),
            "story": story
        }

        return profile

    def update_profile(self, character_id: str, profile_data: dict) -> bool:
        """
        Update or add a profile in character-profiles.json

        Args:
            character_id: Character ID (used as key in JSON)
            profile_data: Profile dict to add/update

        Returns:
            True if updated/added, False if no change
        """
        existing = self.profiles.get(character_id)

        # Check if profile is different
        if existing == profile_data:
            logger.info(f"Profile for {character_id} is already up to date")
            return False

        # Update profile
        self.profiles[character_id] = profile_data
        self._save_profiles()

        if existing:
            logger.info(f"Updated profile for {character_id}")
        else:
            logger.info(f"Added new profile for {character_id}")

        return True

    def extract_and_update(self, character_id: str, fullname: str, fullname_jp: str = "", fullname_kr: str = "", fullname_zh: str = "") -> bool:
        """
        Extract profile and update character-profiles.json if different

        Args:
            character_id: Character ID
            fullname: English fullname
            fullname_jp: Japanese fullname (optional)
            fullname_kr: Korean fullname (optional)
            fullname_zh: Chinese simplified fullname (optional)

        Returns:
            True if profile was updated, False otherwise
        """
        profile = self.extract_profile(character_id, fullname, fullname_jp, fullname_kr, fullname_zh)

        if not profile:
            return False

        return self.update_profile(character_id, profile)
