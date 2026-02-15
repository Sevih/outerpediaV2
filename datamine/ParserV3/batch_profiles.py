"""
Batch Profile Extraction - Extract profiles for all characters in data/char/

Reads each {ID}.json from data/char/, extracts profile data from .bytes files,
and writes the result to data/character-profiles.json.
"""

import json
import logging
import sys
from pathlib import Path

from config import CHAR_DATA
from profile_manager import ProfileManager

logging.basicConfig(
    level=logging.INFO,
    format="%(name)s - %(levelname)s - %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger(__name__)


def main():

    char_files = sorted(CHAR_DATA.glob("*.json"))
    logger.info(f"Found {len(char_files)} character files in {CHAR_DATA}")

    pm = ProfileManager()

    updated = 0
    skipped = 0
    failed = 0

    for char_file in char_files:
        char_id = char_file.stem  # e.g. "2000001"

        try:
            with open(char_file, "r", encoding="utf-8") as f:
                char_data = json.load(f)
        except Exception as e:
            logger.error(f"Failed to read {char_file.name}: {e}")
            failed += 1
            continue

        fullname = char_data.get("Fullname", "")
        fullname_jp = char_data.get("Fullname_jp", "")
        fullname_kr = char_data.get("Fullname_kr", "")
        fullname_zh = char_data.get("Fullname_zh", "")

        if not fullname:
            logger.warning(f"No Fullname in {char_file.name}, skipping")
            skipped += 1
            continue

        result = pm.extract_and_update(
            char_id, fullname, fullname_jp, fullname_kr, fullname_zh
        )

        if result:
            updated += 1
        else:
            skipped += 1

    logger.info(f"Done! Updated: {updated}, Skipped: {skipped}, Failed: {failed}")


if __name__ == "__main__":
    main()
