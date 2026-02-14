"""
WebP Converter - Convert PNG/JPG assets to WebP format

This module handles the conversion of character assets from PNG/JPG to WebP format
for better web performance. Uses cwebp.exe for high-quality conversion.

Features:
- Batch conversion of all character assets
- Skip already converted files
- Quality setting (default: 85)
- Progress reporting

Author: ParserV3
Date: 2025-10
"""

from pathlib import Path
import subprocess
import logging
from typing import List, Tuple

logger = logging.getLogger(__name__)

# Paths
BASE_PATH = Path(__file__).parent.parent  # datamine folder
PROJECT_ROOT = Path(__file__).parent.parent.parent  # outerpedia-clean folder
CWEBP_PATH = BASE_PATH / "pngTowebp" / "bin" / "cwebp.exe"
PUBLIC_BASE = PROJECT_ROOT / "public" / "images" / "characters"


class WebPConverter:
    """Convert character assets to WebP format"""

    def __init__(self, quality: int = 85):
        """
        Initialize WebP converter

        Args:
            quality: WebP quality setting (0-100), default 85
        """
        self.quality = quality
        self._validate_cwebp()

    def _validate_cwebp(self):
        """Check if cwebp.exe exists"""
        if not CWEBP_PATH.exists():
            raise FileNotFoundError(
                f"cwebp.exe not found at {CWEBP_PATH}\n"
                "Please ensure the cwebp binary is available."
            )

    def convert_file(self, source_path: Path) -> bool:
        """
        Convert a single image file to WebP

        Args:
            source_path: Path to source image (PNG/JPG)

        Returns:
            True if converted successfully, False if skipped or failed
        """
        if not source_path.exists():
            logger.warning(f"Source file not found: {source_path}")
            return False

        # Check if it's a valid image format
        if source_path.suffix.lower() not in ['.png', '.jpg', '.jpeg', '.gif']:
            logger.debug(f"Skipping non-image file: {source_path}")
            return False

        # Output path (same name, .webp extension)
        output_path = source_path.with_suffix('.webp')

        # Skip if WebP already exists
        if output_path.exists():
            logger.debug(f"WebP already exists, skipping: {output_path}")
            return False

        try:
            # Run cwebp conversion
            cmd = [
                str(CWEBP_PATH),
                '-q', str(self.quality),
                str(source_path),
                '-o', str(output_path)
            ]

            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=30
            )

            if result.returncode == 0:
                logger.info(f"Converted to WebP: {source_path.name}")
                return True
            else:
                logger.error(f"Conversion failed for {source_path.name}: {result.stderr}")
                return False

        except subprocess.TimeoutExpired:
            logger.error(f"Conversion timeout for {source_path.name}")
            return False
        except Exception as e:
            logger.error(f"Error converting {source_path.name}: {e}")
            return False

    def convert_character_assets(self, character_id: str, fullname: str = None) -> Tuple[int, int]:
        """
        Convert all assets for a specific character to WebP

        Args:
            character_id: Character ID
            fullname: Character full name (for EX equipment path)

        Returns:
            Tuple of (converted_count, skipped_count)
        """
        from text_utils import to_kebab_case

        converted = 0
        skipped = 0

        # Build list of asset paths to convert
        asset_paths = []

        # Portrait
        asset_paths.append(PUBLIC_BASE / "portrait" / f"CT_{character_id}.png")

        # ATB
        asset_paths.append(PUBLIC_BASE / "atb" / f"IG_Turn_{character_id}.png")
        asset_paths.append(PUBLIC_BASE / "atb" / f"IG_Turn_{character_id}_E.png")

        # Skills
        asset_paths.append(PUBLIC_BASE / "skills" / f"Skill_First_{character_id}.png")
        asset_paths.append(PUBLIC_BASE / "skills" / f"Skill_Second_{character_id}.png")
        asset_paths.append(PUBLIC_BASE / "skills" / f"Skill_Ultimate_{character_id}.png")

        # Full Art
        asset_paths.append(PUBLIC_BASE / "full" / f"IMG_{character_id}.png")

        # EX Equipment (requires fullname)
        if fullname:
            kebab_name = to_kebab_case(fullname)
            asset_paths.append(PUBLIC_BASE / "ex" / f"{kebab_name}.png")

        # Convert each asset
        for asset_path in asset_paths:
            if not asset_path.exists():
                logger.debug(f"Asset not found, skipping WebP conversion: {asset_path}")
                continue

            # Check if WebP already exists
            webp_path = asset_path.with_suffix('.webp')
            if webp_path.exists():
                skipped += 1
                continue

            # Convert
            if self.convert_file(asset_path):
                converted += 1
            else:
                skipped += 1

        return (converted, skipped)

    def convert_all_character_assets(self) -> Tuple[int, int]:
        """
        Convert all character assets in public/images/characters/ to WebP

        Returns:
            Tuple of (converted_count, skipped_count)
        """
        converted = 0
        skipped = 0

        # Process all subdirectories
        for subdir in ["portrait", "atb", "skills", "full", "ex"]:
            dir_path = PUBLIC_BASE / subdir
            if not dir_path.exists():
                logger.warning(f"Directory not found: {dir_path}")
                continue

            # Find all PNG/JPG files
            for image_path in dir_path.glob('*.png'):
                if self.convert_file(image_path):
                    converted += 1
                else:
                    skipped += 1

            for image_path in dir_path.glob('*.jpg'):
                if self.convert_file(image_path):
                    converted += 1
                else:
                    skipped += 1

        return (converted, skipped)


# CLI usage
if __name__ == "__main__":
    import sys

    converter = WebPConverter(quality=85)

    if len(sys.argv) > 1:
        # Convert specific character
        char_id = sys.argv[1]
        fullname = sys.argv[2] if len(sys.argv) > 2 else None
        converted, skipped = converter.convert_character_assets(char_id, fullname)
        print(f"Character {char_id}: {converted} converted, {skipped} skipped")
    else:
        # Convert all
        print("Converting all character assets to WebP...")
        converted, skipped = converter.convert_all_character_assets()
        print(f"Done! {converted} converted, {skipped} skipped")
