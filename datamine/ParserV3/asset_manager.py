"""
Asset Manager - Handle copying of character images from extracted game files

This module manages the copying of character assets from the extracted game files
to the public directory for web display:

Asset types:
1. Portrait: CT_{id}.png -> public/images/characters/portrait
2. ATB Mini: IG_Turn_{id}.png and IG_Turn_{id}_E.png -> public/images/characters/atb
3. Skills: Skill_First_{id}.png, Skill_Second_{id}.png, Skill_Ultimate_{id}.png -> public/images/characters/skills
4. Full Art: IMG_{id}.png -> public/images/characters/full
5. Exclusive Equipment: TI_Equipment_EX_{id}.png -> public/images/characters/ex (renamed to {kebab-fullname}.png)

Author: ParserV3
Date: 2025-10
"""

from pathlib import Path
import shutil
import logging
from typing import Dict, List, Tuple
from text_utils import to_kebab_case

logger = logging.getLogger(__name__)

# Lazy import for WebPConverter to avoid circular imports
_webp_converter = None

# Base paths
BASE_PATH = Path(__file__).parent.parent  # datamine folder
PROJECT_ROOT = Path(__file__).parent.parent.parent  # outerpedia-clean folder

# Source paths (extracted game files)
SPRITE_SOURCE = BASE_PATH / "extracted_astudio" / "assets" / "editor" / "resources" / "sprite"
ILLUST_SOURCE = BASE_PATH / "extracted_astudio" / "assets" / "editor" / "resources" / "prefabs" / "ui" / "illust"

# Destination paths (public web assets)
PUBLIC_BASE = PROJECT_ROOT / "public" / "images" / "characters"
PORTRAIT_DEST = PUBLIC_BASE / "portrait"
ATB_DEST = PUBLIC_BASE / "atb"
SKILLS_DEST = PUBLIC_BASE / "skills"
FULL_DEST = PUBLIC_BASE / "full"
EX_DEST = PUBLIC_BASE / "ex"


class AssetManager:
    """Manage character asset copying and validation"""

    def __init__(self, convert_to_webp: bool = True):
        """
        Initialize asset manager and create destination folders if needed

        Args:
            convert_to_webp: If True, automatically convert copied assets to WebP
        """
        self.convert_to_webp = convert_to_webp
        self._ensure_directories()
        self._init_webp_converter()

    def _ensure_directories(self):
        """Create all destination directories if they don't exist"""
        for dest_dir in [PORTRAIT_DEST, ATB_DEST, SKILLS_DEST, FULL_DEST, EX_DEST]:
            dest_dir.mkdir(parents=True, exist_ok=True)
            logger.debug(f"Ensured directory exists: {dest_dir}")

    def _init_webp_converter(self):
        """Initialize WebP converter if enabled"""
        global _webp_converter
        if self.convert_to_webp and _webp_converter is None:
            try:
                from webp_converter import WebPConverter
                _webp_converter = WebPConverter(quality=85)
                logger.info("WebP converter initialized")
            except Exception as e:
                logger.warning(f"WebP converter not available: {e}")
                self.convert_to_webp = False

    def copy_character_assets(self, character_id: str, fullname: str) -> Dict[str, List[str]]:
        """
        Copy all assets for a character from extracted files to public directory
        Skips files that already exist in the destination

        Args:
            character_id: Character ID (e.g., "2000066")
            fullname: Character full name for EX equipment naming

        Returns:
            Dict with 'copied', 'skipped', and 'missing' lists of asset descriptions
        """
        copied = []
        skipped = []
        missing = []

        # 1. Portrait: CT_{id}.png
        portrait_status = self._copy_asset(
            SPRITE_SOURCE / f"CT_{character_id}.png",
            PORTRAIT_DEST / f"CT_{character_id}.png",
            f"Portrait (CT_{character_id}.png)"
        )
        if portrait_status == "copied":
            copied.append(f"Portrait (CT_{character_id}.png)")
        elif portrait_status == "skipped":
            skipped.append(f"Portrait (CT_{character_id}.png)")
        else:
            missing.append(f"Portrait (CT_{character_id}.png)")

        # 2. ATB Mini: IG_Turn_{id}.png and IG_Turn_{id}_E.png
        for suffix in ["", "_E"]:
            atb_filename = f"IG_Turn_{character_id}{suffix}.png"
            atb_status = self._copy_asset(
                SPRITE_SOURCE / atb_filename,
                ATB_DEST / atb_filename,
                f"ATB Mini ({atb_filename})"
            )
            if atb_status == "copied":
                copied.append(f"ATB Mini ({atb_filename})")
            elif atb_status == "skipped":
                skipped.append(f"ATB Mini ({atb_filename})")
            else:
                missing.append(f"ATB Mini ({atb_filename})")

        # 3. Skills: Skill_First_{id}.png, Skill_Second_{id}.png, Skill_Ultimate_{id}.png
        for skill_type in ["First", "Second", "Ultimate"]:
            skill_filename = f"Skill_{skill_type}_{character_id}.png"
            skill_status = self._copy_asset(
                SPRITE_SOURCE / skill_filename,
                SKILLS_DEST / skill_filename,
                f"Skill {skill_type} ({skill_filename})"
            )
            if skill_status == "copied":
                copied.append(f"Skill {skill_type} ({skill_filename})")
            elif skill_status == "skipped":
                skipped.append(f"Skill {skill_type} ({skill_filename})")
            else:
                missing.append(f"Skill {skill_type} ({skill_filename})")

        # 4. Full Art: IMG_{id}.png
        full_status = self._copy_asset(
            ILLUST_SOURCE / f"IMG_{character_id}.png",
            FULL_DEST / f"IMG_{character_id}.png",
            f"Full Art (IMG_{character_id}.png)"
        )
        if full_status == "copied":
            copied.append(f"Full Art (IMG_{character_id}.png)")
        elif full_status == "skipped":
            skipped.append(f"Full Art (IMG_{character_id}.png)")
        else:
            missing.append(f"Full Art (IMG_{character_id}.png)")

        # 5. Exclusive Equipment: TI_Equipment_EX_{id}.png -> {kebab-fullname}.png
        ex_source_name = f"TI_Equipment_EX_{character_id}.png"
        ex_dest_name = f"{to_kebab_case(fullname)}.png"
        ex_status = self._copy_asset(
            SPRITE_SOURCE / ex_source_name,
            EX_DEST / ex_dest_name,
            f"EX Equipment ({ex_source_name} -> {ex_dest_name})"
        )
        if ex_status == "copied":
            copied.append(f"EX Equipment ({ex_source_name} -> {ex_dest_name})")
        elif ex_status == "skipped":
            skipped.append(f"EX Equipment ({ex_source_name})")
        else:
            missing.append(f"EX Equipment ({ex_source_name})")

        # Convert to WebP if enabled
        webp_converted = 0
        webp_skipped = 0
        if self.convert_to_webp and _webp_converter and len(copied) > 0:
            logger.info(f"Converting {len(copied)} assets to WebP...")
            webp_converted, webp_skipped = _webp_converter.convert_character_assets(character_id, fullname)
            logger.info(f"WebP conversion: {webp_converted} converted, {webp_skipped} skipped")

        return {
            "copied": copied,
            "skipped": skipped,
            "missing": missing,
            "webp_converted": webp_converted,
            "webp_skipped": webp_skipped
        }

    def _copy_asset(self, source: Path, destination: Path, description: str) -> str:
        """
        Copy a single asset file if it exists and destination doesn't already exist

        Args:
            source: Source file path
            destination: Destination file path
            description: Human-readable description for logging

        Returns:
            "copied" if file was copied, "skipped" if destination exists, None if source not found
        """
        # First check if destination already exists - if yes, no need to check source
        if destination.exists():
            logger.debug(f"Asset already exists in destination, skipping: {destination}")
            return "skipped"

        # Destination doesn't exist, check if source exists
        if not source.exists():
            logger.debug(f"Asset not found in source: {source}")
            return None

        # Copy from source to destination
        try:
            shutil.copy2(source, destination)
            logger.info(f"Copied: {description}")
            return "copied"
        except Exception as e:
            logger.error(f"Failed to copy {description}: {e}")
            return None

    def check_assets_exist(self, character_id: str) -> Dict[str, bool]:
        """
        Check which assets exist for a character without copying

        Args:
            character_id: Character ID to check

        Returns:
            Dict mapping asset type to existence boolean
        """
        return {
            "portrait": (SPRITE_SOURCE / f"CT_{character_id}.png").exists(),
            "atb_normal": (SPRITE_SOURCE / f"IG_Turn_{character_id}.png").exists(),
            "atb_enhance": (SPRITE_SOURCE / f"IG_Turn_{character_id}_E.png").exists(),
            "skill_first": (SPRITE_SOURCE / f"Skill_First_{character_id}.png").exists(),
            "skill_second": (SPRITE_SOURCE / f"Skill_Second_{character_id}.png").exists(),
            "skill_ultimate": (SPRITE_SOURCE / f"Skill_Ultimate_{character_id}.png").exists(),
            "full_art": (ILLUST_SOURCE / f"IMG_{character_id}.png").exists(),
            "ex_equipment": (SPRITE_SOURCE / f"TI_Equipment_EX_{character_id}.png").exists()
        }

    def get_asset_summary(self, character_id: str) -> Tuple[int, int]:
        """
        Get a summary count of found vs total assets

        Args:
            character_id: Character ID to check

        Returns:
            Tuple of (found_count, total_count)
        """
        asset_status = self.check_assets_exist(character_id)
        found = sum(1 for exists in asset_status.values() if exists)
        total = len(asset_status)
        return (found, total)
