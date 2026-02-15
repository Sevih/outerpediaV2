"""
Batch Extract & Compare - Extract all characters + EE and compare with existing data.

Compares only automated fields (skips manual fields like rank, role, buff, debuff).
Writes results to export/batch_comparison.json to avoid console encoding issues.
"""

import json
import logging
import sys
import io
from pathlib import Path
from collections import Counter

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

from config import CHAR_DATA, EE_FILE
from character_extractor import CharacterExtractor
from ee_manager import EEManager

logging.basicConfig(
    level=logging.WARNING,
    format="%(name)s - %(levelname)s - %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger(__name__)

# Fields to skip when comparing characters (manual/unstable)
CHAR_SKIP_FIELDS = {"rank", "rank_pvp", "role", "skill_priority", "video"}

# Fields to skip when comparing EE (manual)
EE_SKIP_FIELDS = {"rank", "buff", "debuff"}

OUTPUT_FILE = Path(__file__).parent / "export" / "batch_comparison.json"


def deep_diff(a, b, path=""):
    """Recursively find differences between two objects. Returns list of diff strings."""
    diffs = []

    if type(a) != type(b):
        diffs.append(f"{path}: type {type(a).__name__} vs {type(b).__name__}")
        return diffs

    if isinstance(a, dict):
        all_keys = set(list(a.keys()) + list(b.keys()))
        for k in sorted(all_keys):
            p = f"{path}.{k}" if path else k
            if k not in a:
                diffs.append(f"{p}: <MISSING in extracted>")
            elif k not in b:
                diffs.append(f"{p}: <MISSING in existing>")
            else:
                diffs.extend(deep_diff(a[k], b[k], p))
    elif isinstance(a, list):
        if len(a) != len(b):
            diffs.append(f"{path}: list len {len(a)} vs {len(b)}")
        for i in range(min(len(a), len(b))):
            diffs.extend(deep_diff(a[i], b[i], f"{path}[{i}]"))
    elif a != b:
        a_str = str(a)[:150]
        b_str = str(b)[:150]
        diffs.append(f"{path}: [{a_str}] vs [{b_str}]")

    return diffs


def categorize_diff(diff_str):
    """Categorize a diff string into a pattern."""
    if "VoiceActor_kr" in diff_str and "CV. " in diff_str:
        return "voiceactor_kr_space"
    if "_zh: <MISSING in extracted>" in diff_str:
        return "missing_zh_key_extracted"
    if "1_zh: <MISSING" in diff_str or "2_zh: <MISSING" in diff_str:
        return "transcend_zh_null_key"
    if "classification" in diff_str:
        return "skill_classification"
    if "range" in diff_str and "skills." in diff_str:
        return "skill_range"
    if "effectsBySource" in diff_str:
        return "effectsBySource"
    if "tags" in diff_str or "coreFusion" in diff_str or "hasCoreFusion" in diff_str:
        return "manual_field_missing"
    if "skills." in diff_str:
        return "skill_content"
    if "transcend." in diff_str:
        return "transcend_content"
    return "other"


def run_char_comparison():
    """Extract all characters and compare with existing data."""
    char_files = sorted(CHAR_DATA.glob("*.json"))
    print(f"Characters: {len(char_files)} files found")

    results = {
        "identical": 0,
        "different": [],
        "extract_failed": [],
    }
    pattern_counter = Counter()
    all_diff_samples = {}

    for i, char_file in enumerate(char_files, 1):
        char_id = char_file.stem

        with open(char_file, "r", encoding="utf-8") as f:
            existing = json.load(f)

        try:
            extractor = CharacterExtractor(char_id)
            extracted = extractor.extract()
        except Exception as e:
            results["extract_failed"].append({"id": char_id, "name": existing.get("Fullname", ""), "error": str(e)})
            continue

        # Remove manual/skip fields from both for comparison
        ext_clean = {k: v for k, v in extracted.items() if k not in CHAR_SKIP_FIELDS}
        exi_clean = {k: v for k, v in existing.items() if k not in CHAR_SKIP_FIELDS}

        diffs = deep_diff(ext_clean, exi_clean)

        if not diffs:
            results["identical"] += 1
        else:
            # Categorize diffs
            char_patterns = set()
            for d in diffs:
                cat = categorize_diff(d)
                char_patterns.add(cat)
                pattern_counter[cat] += 1
                if cat not in all_diff_samples:
                    all_diff_samples[cat] = []
                if len(all_diff_samples[cat]) < 3:
                    all_diff_samples[cat].append({"char": existing.get("Fullname", char_id), "diff": d})

            results["different"].append({
                "id": char_id,
                "name": existing.get("Fullname", ""),
                "patterns": sorted(char_patterns),
                "diff_count": len(diffs),
                "diffs": diffs[:10],  # first 10 diffs only
            })

        if i % 20 == 0:
            print(f"  Characters: {i}/{len(char_files)} processed...")

    print(f"  Characters done: {results['identical']} identical, {len(results['different'])} different, {len(results['extract_failed'])} failed")
    print(f"\n  Diff patterns:")
    for pattern, count in pattern_counter.most_common():
        print(f"    {pattern}: {count} occurrences")
        for sample in all_diff_samples.get(pattern, []):
            print(f"      e.g. [{sample['char']}] {sample['diff'][:120]}")

    results["pattern_summary"] = dict(pattern_counter.most_common())
    results["pattern_samples"] = all_diff_samples
    return results


def run_ee_comparison():
    """Extract all EEs and compare with existing data."""
    with open(EE_FILE, "r", encoding="utf-8") as f:
        existing_ee = json.load(f)

    char_files = sorted(CHAR_DATA.glob("*.json"))
    chars = {}
    for cf in char_files:
        with open(cf, "r", encoding="utf-8") as f:
            data = json.load(f)
        chars[cf.stem] = data.get("Fullname", "")

    print(f"EE: {len(existing_ee)} entries in ee.json, {len(chars)} characters to check")

    ee_mgr = EEManager()

    results = {
        "identical": 0,
        "different": [],
        "extract_failed": [],
        "no_existing_ee": [],
        "no_ee_extracted": [],
    }
    pattern_counter = Counter()
    all_diff_samples = {}

    for i, (char_id, fullname) in enumerate(sorted(chars.items()), 1):
        existing = existing_ee.get(char_id)

        try:
            extracted = ee_mgr.extract_ee(char_id, fullname)
        except Exception as e:
            results["extract_failed"].append({"id": char_id, "name": fullname, "error": str(e)})
            continue

        if extracted is None:
            if existing:
                results["no_ee_extracted"].append({"id": char_id, "name": fullname})
            continue

        if existing is None:
            results["no_existing_ee"].append({"id": char_id, "name": fullname})
            continue

        # Remove skip fields
        ext_clean = {k: v for k, v in extracted.items() if k not in EE_SKIP_FIELDS}
        exi_clean = {k: v for k, v in existing.items() if k not in EE_SKIP_FIELDS}

        diffs = deep_diff(ext_clean, exi_clean)

        if not diffs:
            results["identical"] += 1
        else:
            # Categorize EE diffs
            for d in diffs:
                if "effect10" in d and "<color=" in d:
                    cat = "ee_color_tags"
                elif "mainStat" in d:
                    cat = "ee_mainstat"
                elif "effect" in d:
                    cat = "ee_effect_text"
                elif "name" in d:
                    cat = "ee_name"
                elif "icon_effect" in d:
                    cat = "ee_icon"
                else:
                    cat = "ee_other"
                pattern_counter[cat] += 1
                if cat not in all_diff_samples:
                    all_diff_samples[cat] = []
                if len(all_diff_samples[cat]) < 3:
                    all_diff_samples[cat].append({"char": fullname, "diff": d})

            results["different"].append({
                "id": char_id,
                "name": fullname,
                "diff_count": len(diffs),
                "diffs": diffs,
            })

        if i % 20 == 0:
            print(f"  EE: {i}/{len(chars)} processed...")

    print(f"  EE done: {results['identical']} identical, {len(results['different'])} different, {len(results['extract_failed'])} failed")
    print(f"\n  Diff patterns:")
    for pattern, count in pattern_counter.most_common():
        print(f"    {pattern}: {count} occurrences")
        for sample in all_diff_samples.get(pattern, []):
            print(f"      e.g. [{sample['char']}] {sample['diff'][:120]}")

    results["pattern_summary"] = dict(pattern_counter.most_common())
    results["pattern_samples"] = all_diff_samples
    return results


def main():
    print("=== Batch Extract & Compare ===\n")

    print("--- Character Extraction ---")
    char_results = run_char_comparison()

    print("\n--- EE Extraction ---")
    ee_results = run_ee_comparison()

    # Write results
    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    report = {
        "characters": char_results,
        "ee": ee_results,
    }

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)

    print(f"\nFull report: {OUTPUT_FILE}")


if __name__ == "__main__":
    main()
