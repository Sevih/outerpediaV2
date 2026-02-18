"""
Extract base stats for all characters (2000XXX) at each evolution step.

Outputs: data/generated/character-stats.json

Sources:
- CharacterTemplet.bytes        -> base stats (min/max columns)
- CharacterEvolutionStatTemplet -> evo bonuses per level
- CharacterSkillLevelTemplet    -> premium buff chain (Skill_23 -> DescID)
- BuffTemplet.bytes             -> premium buff definitions (BT_STAT_PREMIUM)

Change detection:
- Combines MD5 checksums of all 4 source .bytes files
- Skips re-generation if combined checksum matches the stored one

Formula:
    stat(level) = Min + floor((Max - Min) * (level - 1) / 99) + cumulative_evo_bonus

See memory/stat-formula.md for full documentation.
"""

import json
import hashlib
import math
import logging
from pathlib import Path

from config import BYTES_FOLDER, GENERATED_DATA, EXPORT_FOLDER
from cache_manager import CacheManager

logger = logging.getLogger(__name__)

# .bytes files we depend on
SOURCE_FILES = [
    "CharacterTemplet.bytes",
    "CharacterEvolutionStatTemplet.bytes",
    "CharacterSkillLevelTemplet.bytes",
    "BuffTemplet.bytes",
]

OUTPUT_FILE = GENERATED_DATA / "character-stats.json"
CHECKSUM_FILE = EXPORT_FOLDER / "character-stats.checksum"

# --- Stat column mappings in CharacterTemplet ---
# Column names are misleading (e.g. DMGReduceRate_Max = DEF at Lv100)
STAT_COLUMNS = {
    "ATK": ("Atk_Min", "Atk_Max"),
    "DEF": ("Def_Min", "DMGReduceRate_Max"),
    "HP":  ("HP_Min", "WG_Max"),
    "SPD": ("Speed_Min", "Speed_Max"),
    "EFF": ("BuffChance_Min", "BuffChance_Max"),
    "RES": ("BuffResist_Min", "EnemyCriticalDamageReduce_Max"),
    "CHC": ("CriticalRate_Min", "CriticalRate_Max"),
    "CHD": ("CriticalDMGRate_Min", "CriticalDMGRate_Max"),
}

# Evo stat type -> display name
EVO_STAT_MAP = {
    "ST_ATK": "ATK", "ST_DEF": "DEF", "ST_HP": "HP",
    "ST_SPEED": "SPD", "ST_BUFF_CHANCE": "EFF", "ST_BUFF_RESIST": "RES",
    "ST_DMG_REDUCE_RATE": "DMG_RED", "ST_DMG_BOOST": "DMG_INC",
}

# Premium buff stat type -> display name
PREMIUM_STAT_DISPLAY = {
    "ST_DEF": "DEF",
    "ST_ATK": "ATK",
    "ST_HP": "HP",
    "ST_CRITICAL_RATE": "CHC",
    "ST_SPEED": "SPD",
    "ST_BUFF_CHANCE": "EFF",
    "ST_BUFF_RESIST": "RES",
}

# Evolution steps: (level, evo_count, evo_levels_included)
EVO_STEPS = [
    (1,   0, []),
    (20,  1, [2]),
    (40,  2, [2, 3]),
    (60,  3, [2, 3, 4]),
    (80,  4, [2, 3, 4, 5]),
    (100, 5, [2, 3, 4, 5, 6]),
]

ALL_STATS = ["ATK", "DEF", "HP", "SPD", "EFF", "RES", "CHC", "CHD", "DMG_RED", "DMG_INC"]


def _compute_combined_checksum():
    """Combine MD5 checksums of all source .bytes files into one hash."""
    combined = hashlib.md5()
    for filename in sorted(SOURCE_FILES):
        filepath = BYTES_FOLDER / filename
        if not filepath.exists():
            return None
        md5 = hashlib.md5()
        with open(filepath, "rb") as f:
            for chunk in iter(lambda: f.read(8192), b""):
                md5.update(chunk)
        combined.update(md5.hexdigest().encode())
    return combined.hexdigest()


def _is_up_to_date():
    """Check if output is still valid based on source checksums."""
    if not OUTPUT_FILE.exists() or not CHECKSUM_FILE.exists():
        return False
    stored = CHECKSUM_FILE.read_text().strip()
    current = _compute_combined_checksum()
    return current is not None and stored == current


def _save_checksum(checksum):
    """Save the combined checksum for future runs."""
    CHECKSUM_FILE.parent.mkdir(parents=True, exist_ok=True)
    CHECKSUM_FILE.write_text(checksum)


def _build_buff_lookup(buff_data):
    """Build BuffID -> entry lookup."""
    lookup = {}
    for entry in buff_data:
        bid = entry.get("BuffID", "")
        if bid:
            lookup[bid] = entry
    return lookup


def _build_skill_level_lookup(skill_level_data):
    """Build SkillID -> DescID lookup (first entry per skill)."""
    lookup = {}
    for entry in skill_level_data:
        sid = entry.get("SkillID", "")
        if sid and sid not in lookup:
            desc = entry.get("DescID", "")
            if not desc:
                desc = entry.get("GainAP", "")
            lookup[sid] = desc
    return lookup


def _get_premium_buff(skill_23_val, skill_level_lookup, buff_lookup):
    """Resolve premium buff for a Skill_23 value."""
    desc_str = skill_level_lookup.get(str(skill_23_val), "")
    if not desc_str:
        return None
    buff_ids = [b.strip() for b in desc_str.split(",")]
    for bid in buff_ids:
        buff = buff_lookup.get(bid)
        if buff and buff.get("Type") == "BT_STAT_PREMIUM":
            stat_type = buff.get("StatType", "")
            applying = buff.get("ApplyingType", "")
            value = int(buff.get("Value", "0"))
            return {
                "buffID": bid,
                "stat": PREMIUM_STAT_DISPLAY.get(stat_type, stat_type),
                "applyingType": applying,
                "value": value,
            }
    return None


def _compute_premium_value(premium, base_stat_value):
    """Compute the yellow bonus value at a given base stat."""
    if not premium:
        return None
    if premium["applyingType"] == "OAT_ADD":
        return premium["value"] / 10
    elif premium["applyingType"] == "OAT_RATE":
        return math.floor(base_stat_value * premium["value"] / 1000)
    return None


def _build_evo_lookup(evo_data):
    """Build CharacterID -> {evo_level: {stat: bonus}} lookup."""
    lookup = {}
    for entry in evo_data:
        cid = entry.get("CharacterID", "")
        if not cid:
            continue
        try:
            ev_lv = int(entry.get("EvolutionLevel", "0"))
        except ValueError:
            continue
        bonuses = {}
        for i in range(1, 4):
            stat_type = entry.get(f"RewardStatType_{i}", "")
            value_str = entry.get(f"RewardValue_{i}", "")
            if not value_str:
                value_str = entry.get(f"RewardStatType_{i}_fallback1", "")
            if not value_str:
                value_str = entry.get(f"RewardValue_{i}_fallback1", "")
            if stat_type and value_str:
                stat_name = EVO_STAT_MAP.get(stat_type, stat_type)
                try:
                    bonuses[stat_name] = int(value_str)
                except ValueError:
                    pass
        if cid not in lookup:
            lookup[cid] = {}
        lookup[cid][ev_lv] = bonuses
    return lookup


def extract_all_stats(cache_mgr=None):
    """
    Extract stats for all 2000XXX characters.

    Returns:
        dict: {char_id: {info, premium, steps}} or None if up-to-date
    """
    # Check if regeneration is needed
    if _is_up_to_date():
        logger.info("character-stats.json is up to date, skipping")
        return None

    # Load data via CacheManager
    if cache_mgr is None:
        cache_mgr = CacheManager(BYTES_FOLDER)

    char_data = cache_mgr.get_data("CharacterTemplet.bytes")
    evo_data = cache_mgr.get_data("CharacterEvolutionStatTemplet.bytes")
    skill_level_data = cache_mgr.get_data("CharacterSkillLevelTemplet.bytes")
    buff_data = cache_mgr.get_data("BuffTemplet.bytes")

    # Build lookups
    buff_lookup = _build_buff_lookup(buff_data)
    skill_level_lookup = _build_skill_level_lookup(skill_level_data)
    evo_lookup = _build_evo_lookup(evo_data)

    # Find all 2000XXX characters
    characters = [row for row in char_data if row.get("ID", "").startswith("2000")]

    results = {}

    for char in characters:
        cid = char["ID"]

        # Info
        info = {
            "id": cid,
            "class": char.get("Class", ""),
            "subclass": char.get("SubClass", ""),
            "element": char.get("Element", ""),
            "star": char.get("BasicStar", ""),
        }

        # Base stat ranges
        base = {}
        for stat, (min_col, max_col) in STAT_COLUMNS.items():
            mn = int(char.get(min_col, "0") or "0")
            mx = int(char.get(max_col, "0") or "0")
            if stat == "CHD" and mx == 0:
                mx = mn
            base[stat] = {"min": mn, "max": mx}

        # Evo data
        char_evo = evo_lookup.get(cid, {})

        # Premium buff
        skill_23 = char.get("Skill_23", "")
        premium = _get_premium_buff(skill_23, skill_level_lookup, buff_lookup) if skill_23 else None

        # Compute stats at each evo step
        steps = {}
        for level, evo_count, ev_levels in EVO_STEPS:
            # Cumulative evo bonuses
            cum_evo = {}
            for elv in ev_levels:
                if elv in char_evo:
                    for stat, val in char_evo[elv].items():
                        cum_evo[stat] = cum_evo.get(stat, 0) + val

            step_stats = {}
            for stat in ALL_STATS:
                if stat in ("CHC", "CHD"):
                    step_stats[stat] = base[stat]["min"] / 10
                elif stat in ("DMG_RED", "DMG_INC"):
                    step_stats[stat] = cum_evo.get(stat, 0) / 10
                else:
                    mn = base[stat]["min"]
                    mx = base[stat]["max"]
                    rng = mx - mn
                    growth = rng * (level - 1) // 99 if rng > 0 else 0
                    ev = cum_evo.get(stat, 0)
                    step_stats[stat] = mn + growth + ev

            # Premium value at this step
            if premium:
                target_stat = premium["stat"]
                if target_stat in step_stats:
                    step_stats["premium_value"] = _compute_premium_value(premium, step_stats[target_stat])

            steps[f"lv{level}_ev{evo_count}"] = step_stats

        results[cid] = {
            "info": info,
            "premium": {
                "skill_23": skill_23,
                "buffID": premium["buffID"] if premium else None,
                "stat": premium["stat"] if premium else None,
                "applyingType": premium["applyingType"] if premium else None,
                "rawValue": premium["value"] if premium else None,
            },
            "steps": steps,
        }

    # Save output
    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2, ensure_ascii=False)

    # Save combined checksum
    checksum = _compute_combined_checksum()
    if checksum:
        _save_checksum(checksum)

    return results


def run_extract_stats(cache_mgr=None):
    """Pipeline entry point with logging."""
    print("Extracting character stats...")

    result = extract_all_stats(cache_mgr)

    if result is None:
        print("  character-stats.json is up to date, skipped")
        return {"status": "skipped", "reason": "up_to_date"}

    print(f"  Exported {len(result)} characters -> {OUTPUT_FILE.name}")
    return {"status": "generated", "count": len(result)}


if __name__ == "__main__":
    import sys
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

    logging.basicConfig(level=logging.INFO)
    stats = run_extract_stats()
    print(f"\nResult: {stats}")
