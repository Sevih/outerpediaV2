"""
Batch Extract All - Extracts all characters + EE + profiles + assets, exactly like the GUI.

For each character:
1. CharacterExtractor.extract() -> full extraction from game files
2. Merge manual fields from existing JSON (rank, rank_pvp, role, skill_priority, video)
3. Filter ignored effects via ExportManager
4. Reorder JSON fields
5. Save to data/character/{id}.json
6. Copy assets (portrait, ATB, skills, full art, EE) + WebP conversion

For EE:
1. EEManager.extract_ee() for each character
2. Preserve manual fields (rank, buff, debuff) from existing ee.json
3. Save to data/equipment/ee.json

For profiles:
1. ProfileManager.extract_and_update() for each character

Usage:
    python batch_extract_all.py
"""

import json
import logging
import sys
import io
import copy
from pathlib import Path
from collections import OrderedDict

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

from config import CHAR_DATA, EE_FILE
from character_extractor import CharacterExtractor
from ee_manager import EEManager
from export_manager import ExportManager
from profile_manager import ProfileManager
from asset_manager import AssetManager
from extract_character_stats import run_extract_stats

logging.basicConfig(
    level=logging.WARNING,
    format="%(name)s - %(levelname)s - %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger(__name__)

# Manual fields preserved from existing files
CHAR_MANUAL_FIELDS = {"rank", "rank_pvp", "role", "skill_priority", "video"}
EE_MANUAL_FIELDS = {"rank", "buff", "debuff"}

OUTPUT_FILE = Path(__file__).parent / "export" / "batch_extract_report.json"


def reorder_char_json(data: dict) -> dict:
    """Reorder JSON fields for readability (mirrors gui_qt._reorder_json)"""
    ordered = {}

    field_order = [
        'ID',
        'Fullname', 'Fullname_jp', 'Fullname_kr', 'Fullname_zh',
        'Rarity',
        'Element',
        'Class',
        'SubClass',
        'rank',
        'rank_pvp',
        'role',
        'tags',
        'skill_priority',
        'Chain_Type',
        'gift',
        'video',
        'VoiceActor', 'VoiceActor_jp', 'VoiceActor_kr', 'VoiceActor_zh',
    ]

    for field in field_order:
        if field in data:
            ordered[field] = data[field]

    # Transcend object
    if 'transcend' in data:
        ordered['transcend'] = data['transcend']

    # Legacy transcend fields
    transcend_keys = sorted([k for k in data.keys() if k.startswith('Transcend_')])
    for key in transcend_keys:
        ordered[key] = data[key]

    # Skills in order
    skill_order = ['SKT_FIRST', 'SKT_SECOND', 'SKT_ULTIMATE', 'SKT_PASSIVE', 'SKT_CHAIN_PASSIVE']
    skill_field_order = [
        'name', 'name_jp', 'name_kr', 'name_zh',
        'true_desc', 'true_desc_jp', 'true_desc_kr', 'true_desc_zh',
        'true_desc_levels',
        'cd',
        'wgr',
        'classification',
        'range',
        'buff',
        'dual_buff',
        'debuff',
        'dual_debuff',
        'burneffect',
        'enhancement', 'enhancement_jp', 'enhancement_kr', 'enhancement_zh',
    ]

    for skill_key in skill_order:
        if skill_key in data:
            skill_data = data[skill_key]
            ordered_skill = {}

            for field in skill_field_order:
                if field in skill_data:
                    ordered_skill[field] = skill_data[field]

            # Remaining fields
            for field in skill_data:
                if field not in ordered_skill:
                    ordered_skill[field] = skill_data[field]

            ordered[skill_key] = ordered_skill

    # effectsBySource
    if 'effectsBySource' in data:
        ordered['effectsBySource'] = data['effectsBySource']

    # Remaining
    for key in data:
        if key not in ordered:
            ordered[key] = data[key]

    return ordered


def merge_manual_fields(extracted: dict, existing: dict) -> dict:
    """Merge manual fields from existing file into extracted data"""
    for field in CHAR_MANUAL_FIELDS:
        if field in existing and existing[field] is not None:
            if field == 'skill_priority':
                # Normalize old format
                old_prio = existing[field]
                normalized = {}
                for skill in ['First', 'Second', 'Ultimate']:
                    if skill in old_prio:
                        val = old_prio[skill]
                        if isinstance(val, dict):
                            normalized[skill] = {"prio": val.get('prio', 1)}
                        else:
                            normalized[skill] = {"prio": val}
                    else:
                        normalized[skill] = {"prio": 0}
                extracted[field] = normalized
            elif field == 'video' and not existing[field]:
                continue  # Skip empty video
            elif field == 'role' and not existing[field]:
                continue  # Skip empty role
            else:
                extracted[field] = existing[field]

    return extracted


def run_batch_characters():
    """Extract all characters and save to data/character/"""
    char_files = sorted(CHAR_DATA.glob("*.json"))
    total = len(char_files)
    print(f"Characters: {total} files found\n")

    export_mgr = ExportManager()

    stats = {
        "total": total,
        "saved": 0,
        "unchanged": 0,
        "failed": [],
        "missing_effects": [],
    }

    for i, char_file in enumerate(char_files, 1):
        char_id = char_file.stem

        # Load existing
        with open(char_file, "r", encoding="utf-8") as f:
            existing = json.load(f)

        name = existing.get("Fullname", char_id)
        print(f"  [{i}/{total}] {name} ({char_id})...", end=" ")

        try:
            # 1. Extract
            extractor = CharacterExtractor(char_id)
            extracted = extractor.extract()

            # 2. Merge manual fields
            extracted = merge_manual_fields(extracted, existing)

            # 3. Reorder
            ordered = reorder_char_json(extracted)

            # 4. Filter ignored effects
            filtered = export_mgr._filter_ignored_effects(ordered, *export_mgr._collect_effects(ordered))

            # 5. Check for missing effects
            all_buffs, all_debuffs = export_mgr._collect_effects(ordered)
            missing_b = [b for b in all_buffs if b not in export_mgr.buff_names and b not in export_mgr.ignored_names]
            missing_d = [d for d in all_debuffs if d not in export_mgr.debuff_names and d not in export_mgr.ignored_names]
            if missing_b or missing_d:
                stats["missing_effects"].append({
                    "id": char_id,
                    "name": name,
                    "missing_buffs": missing_b,
                    "missing_debuffs": missing_d,
                })

            # 6. Check if different
            if filtered == existing:
                print("unchanged")
                stats["unchanged"] += 1
            else:
                # Save
                with open(char_file, "w", encoding="utf-8") as f:
                    json.dump(filtered, f, indent=2, ensure_ascii=False)
                print("SAVED")
                stats["saved"] += 1

        except Exception as e:
            print(f"FAILED: {e}")
            stats["failed"].append({"id": char_id, "name": name, "error": str(e)})

    print(f"\nCharacters done: {stats['saved']} saved, {stats['unchanged']} unchanged, {len(stats['failed'])} failed")
    if stats["missing_effects"]:
        print(f"  {len(stats['missing_effects'])} characters have missing effects (not in buffs/debuffs.json)")
        for me in stats["missing_effects"][:5]:
            print(f"    {me['name']}: buffs={me['missing_buffs']}, debuffs={me['missing_debuffs']}")
    return stats


def run_batch_ee():
    """Extract all EE and save to ee.json"""
    char_files = sorted(CHAR_DATA.glob("*.json"))

    # Load chars
    chars = {}
    for cf in char_files:
        with open(cf, "r", encoding="utf-8") as f:
            data = json.load(f)
        chars[cf.stem] = data.get("Fullname", "")

    ee_mgr = EEManager()
    original_ee = copy.deepcopy(ee_mgr.ee_data)

    total = len(chars)
    print(f"\nEE: {total} characters, {len(ee_mgr.ee_data)} existing EE entries\n")

    stats = {
        "total": total,
        "updated": 0,
        "unchanged": 0,
        "new": 0,
        "no_ee": 0,
        "failed": [],
    }

    for i, (char_id, fullname) in enumerate(sorted(chars.items()), 1):
        print(f"  [{i}/{total}] {fullname} ({char_id})...", end=" ")

        try:
            extracted = ee_mgr.extract_ee(char_id, fullname)

            if extracted is None:
                print("no EE")
                stats["no_ee"] += 1
                continue

            # Preserve manual fields from existing
            existing = ee_mgr.ee_data.get(char_id, {})
            for field in EE_MANUAL_FIELDS:
                if field in existing:
                    extracted[field] = existing[field]

            # Check if different
            if existing == extracted:
                print("unchanged")
                stats["unchanged"] += 1
            else:
                if char_id in ee_mgr.ee_data:
                    print("UPDATED")
                    stats["updated"] += 1
                else:
                    print("NEW")
                    stats["new"] += 1
                ee_mgr.ee_data[char_id] = extracted

        except Exception as e:
            print(f"FAILED: {e}")
            stats["failed"].append({"id": char_id, "name": fullname, "error": str(e)})

    # Save ee.json if changed
    if ee_mgr.ee_data != original_ee:
        ee_mgr._save_ee_data()
        print(f"\nEE saved to {EE_FILE}")
    else:
        print(f"\nEE unchanged, no save needed")

    print(f"EE done: {stats['updated']} updated, {stats['new']} new, {stats['unchanged']} unchanged, {stats['no_ee']} no EE, {len(stats['failed'])} failed")
    return stats


def run_batch_profiles():
    """Extract and update all character profiles"""
    char_files = sorted(CHAR_DATA.glob("*.json"))
    total = len(char_files)
    print(f"\nProfiles: {total} characters\n")

    profile_mgr = ProfileManager()

    stats = {
        "total": total,
        "updated": 0,
        "unchanged": 0,
        "no_profile": 0,
        "failed": [],
    }

    for i, char_file in enumerate(char_files, 1):
        char_id = char_file.stem

        with open(char_file, "r", encoding="utf-8") as f:
            data = json.load(f)

        fullname = data.get("Fullname", "")
        fullname_jp = data.get("Fullname_jp", "")
        fullname_kr = data.get("Fullname_kr", "")
        fullname_zh = data.get("Fullname_zh", "")

        print(f"  [{i}/{total}] {fullname} ({char_id})...", end=" ")

        try:
            profile = profile_mgr.extract_profile(char_id, fullname, fullname_jp, fullname_kr, fullname_zh)

            if not profile:
                print("no profile data")
                stats["no_profile"] += 1
                continue

            existing = profile_mgr.profiles.get(char_id)
            if existing == profile:
                print("unchanged")
                stats["unchanged"] += 1
            else:
                profile_mgr.profiles[char_id] = profile
                print("UPDATED")
                stats["updated"] += 1

        except Exception as e:
            print(f"FAILED: {e}")
            stats["failed"].append({"id": char_id, "name": fullname, "error": str(e)})

    # Save if changed
    if stats["updated"] > 0:
        profile_mgr._save_profiles()
        print(f"\nProfiles saved")
    else:
        print(f"\nProfiles unchanged")

    print(f"Profiles done: {stats['updated']} updated, {stats['unchanged']} unchanged, {stats['no_profile']} no data, {len(stats['failed'])} failed")
    return stats


def run_batch_assets():
    """Copy all character assets (portrait, ATB, skills, full, EE) + WebP conversion"""
    char_files = sorted(CHAR_DATA.glob("*.json"))
    total = len(char_files)
    print(f"\nAssets: {total} characters\n")

    asset_mgr = AssetManager(convert_to_webp=True)

    stats = {
        "total": total,
        "total_copied": 0,
        "total_skipped": 0,
        "total_missing": 0,
        "total_webp_converted": 0,
        "total_webp_skipped": 0,
        "failed": [],
    }

    for i, char_file in enumerate(char_files, 1):
        char_id = char_file.stem

        with open(char_file, "r", encoding="utf-8") as f:
            data = json.load(f)

        fullname = data.get("Fullname", "")
        print(f"  [{i}/{total}] {fullname} ({char_id})...", end=" ")

        try:
            result = asset_mgr.copy_character_assets(char_id, fullname)

            copied = len(result["copied"])
            skipped = len(result["skipped"])
            missing = len(result["missing"])
            webp_c = result.get("webp_converted", 0)
            webp_s = result.get("webp_skipped", 0)

            stats["total_copied"] += copied
            stats["total_skipped"] += skipped
            stats["total_missing"] += missing
            stats["total_webp_converted"] += webp_c
            stats["total_webp_skipped"] += webp_s

            parts = []
            if copied:
                parts.append(f"{copied} copied")
            if webp_c:
                parts.append(f"{webp_c} webp")
            if missing:
                parts.append(f"{missing} missing")
            if not parts:
                parts.append("all exist")
            print(", ".join(parts))

        except Exception as e:
            print(f"FAILED: {e}")
            stats["failed"].append({"id": char_id, "name": fullname, "error": str(e)})

    print(f"\nAssets done: {stats['total_copied']} copied, {stats['total_skipped']} already existed, {stats['total_missing']} missing")
    print(f"  WebP: {stats['total_webp_converted']} converted, {stats['total_webp_skipped']} skipped")
    if stats["failed"]:
        print(f"  {len(stats['failed'])} failed")
    return stats


def main():
    print("=" * 60)
    print("  BATCH EXTRACT ALL (Characters + EE + Profiles + Assets)")
    print("=" * 60)

    # 1. Characters
    print("\n--- Characters ---")
    char_stats = run_batch_characters()

    # 2. EE
    print("\n--- Exclusive Equipment ---")
    ee_stats = run_batch_ee()

    # 3. Profiles
    print("\n--- Character Profiles ---")
    profile_stats = run_batch_profiles()

    # 4. Assets
    print("\n--- Character Assets ---")
    asset_stats = run_batch_assets()

    # 5. Character Stats (base stats at each evo step + premium)
    print("\n--- Character Stats ---")
    stats_result = run_extract_stats()

    # Write report
    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    report = {
        "characters": char_stats,
        "ee": ee_stats,
        "profiles": profile_stats,
        "assets": asset_stats,
        "character_stats": stats_result,
    }
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)

    print(f"\n{'=' * 60}")
    print(f"  DONE - Report: {OUTPUT_FILE}")
    print(f"{'=' * 60}")


if __name__ == "__main__":
    main()
