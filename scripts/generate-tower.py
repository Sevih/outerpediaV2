"""
Pipeline step: generate tower floor data (boss + minions) from game templets.

Reads DungeonTemplet, DungeonSpawnTemplet, and MonsterTemplet to map each
tower floor to its boss and minion monster IDs.

Usage:
    python scripts/generate-tower.py [--tower normal]
"""

import json
import argparse
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
JSON_DIR = ROOT / "data" / "admin" / "json"
TOWER_DIR = ROOT / "data" / "tower"

BOSS_TYPES = {"CT_BOSS_MONSTER", "CT_AREA_BOSS_MONSTER", "CT_SEASON_BOSS_MONSTER"}

# Tower config: name -> (DungeonMode, optional ID prefix filter)
TOWER_CONFIG = {
    "normal": ("DM_TOWER", None),
    "fire": ("DM_TOWER_ELEMENT", "40202"),
    "water": ("DM_TOWER_ELEMENT", "40212"),
    "earth": ("DM_TOWER_ELEMENT", "40222"),
    "light": ("DM_TOWER_ELEMENT", "40232"),
    "dark": ("DM_TOWER_ELEMENT", "40242"),
}


def load_templet(name: str) -> list[dict]:
    with open(JSON_DIR / f"{name}.json", encoding="utf-8") as f:
        return json.load(f)["data"]


def build_spawn_index(spawns: list[dict], monster_idx: dict) -> dict:
    """Build spawn lookup by HPLineCount and by ID0 (when ID0 is a reference key, not a monster)."""
    index = {}
    for row in spawns:
        hplc = row.get("HPLineCount", "")
        if hplc and hplc != "0":
            index[hplc] = row
        id0 = row.get("ID0", "")
        if id0 and id0 != "0" and id0 not in monster_idx:
            index[id0] = row
    return index


def extract_floor_monsters(floor_row: dict, spawn_idx: dict, monster_idx: dict):
    """Extract boss_id and minion IDs for a single tower floor."""
    all_monsters = []  # (monster_id, monster_type)

    for pos in ("SpawnID_Pos0", "SpawnID_Pos1", "SpawnID_Pos2"):
        val = floor_row.get(pos, "")
        if not val or val in ("0", "False", "FALSE"):
            continue
        for sref in (s.strip() for s in val.split(",")):
            spawn = spawn_idx.get(sref)
            if not spawn:
                continue
            for slot in ("ID0", "ID1", "ID2", "ID3"):
                mid = spawn.get(slot, "")
                if mid and mid != "0" and mid in monster_idx:
                    mtype = monster_idx[mid].get("Type", "")
                    all_monsters.append((mid, mtype))

    boss_id = None
    minions = []
    for mid, mtype in all_monsters:
        if mtype in BOSS_TYPES:
            boss_id = mid
        else:
            if mid not in minions:
                minions.append(mid)

    return boss_id, minions


def load_existing(tower_name: str) -> dict[int, dict]:
    """Load existing tower JSON and index floors by number."""
    path = TOWER_DIR / f"{tower_name}.json"
    if not path.exists():
        return {}
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    return {fl["floor"]: fl for fl in data.get("floors", [])}


# Fields that the script generates (will be overwritten)
GENERATED_FIELDS = {"floor", "boss_id", "minions"}


def generate_tower(tower_name: str) -> dict:
    config = TOWER_CONFIG.get(tower_name)
    if not config:
        raise ValueError(f"Unknown tower: {tower_name}. Valid: {list(TOWER_CONFIG.keys())}")

    dungeon_mode, id_prefix = config

    dungeons = load_templet("DungeonTemplet")
    spawns = load_templet("DungeonSpawnTemplet")
    monsters = load_templet("MonsterTemplet")

    monster_idx = {r["ID"]: r for r in monsters}
    spawn_idx = build_spawn_index(spawns, monster_idx)

    existing_floors = load_existing(tower_name)

    # Filter tower floors
    tower_floors = [
        r for r in dungeons
        if r.get("DungeonMode") == dungeon_mode
        and (id_prefix is None or r.get("FriendSupportUse", "").startswith(id_prefix))
    ]
    tower_floors.sort(key=lambda r: int(r.get("FriendSupportUse", "0")))

    floors = []
    warnings = []
    for i, floor_row in enumerate(tower_floors):
        floor_num = i + 1
        boss_id, minions = extract_floor_monsters(floor_row, spawn_idx, monster_idx)

        if not boss_id:
            warnings.append(f"  Floor {floor_num}: no boss found")

        entry = {"floor": floor_num, "boss_id": boss_id or ""}
        if minions:
            entry["minions"] = minions

        # Merge manually-curated fields from existing data
        existing = existing_floors.get(floor_num, {})
        for key, value in existing.items():
            if key not in GENERATED_FIELDS:
                entry[key] = value

        floors.append(entry)

    if warnings:
        print(f"Warnings for {tower_name}:")
        for w in warnings:
            print(w)

    return {"floors": floors}


def find_missing_monsters(tower_name: str, tower_data: dict) -> list[dict]:
    """Find monster IDs referenced in tower data that have no boss JSON file."""
    boss_dir = ROOT / "data" / "boss"
    missing = []
    seen = set()

    for fl in tower_data["floors"]:
        floor_num = fl["floor"]
        boss_id = fl.get("boss_id", "")
        minion_ids = fl.get("minions", [])

        for mid, role in [(boss_id, "boss")] + [(m, "minion") for m in minion_ids]:
            if not mid or mid in seen:
                continue
            seen.add(mid)
            if not (boss_dir / f"{mid}.json").exists():
                missing.append({"id": mid, "role": role, "tower": tower_name, "floor": floor_num})

    return missing


def main():
    parser = argparse.ArgumentParser(description="Generate tower floor data from game templets")
    parser.add_argument("--tower", default="normal", choices=list(TOWER_CONFIG.keys()),
                        help="Which tower to generate (default: normal)")
    parser.add_argument("--dry-run", action="store_true",
                        help="Print output without writing to file")
    args = parser.parse_args()

    result = generate_tower(args.tower)

    output_path = TOWER_DIR / f"{args.tower}.json"
    output_json = json.dumps(result, indent=2, ensure_ascii=False) + "\n"

    if args.dry_run:
        print(output_json)
    else:
        # Compare with existing
        if output_path.exists():
            existing = output_path.read_text(encoding="utf-8")
            if existing == output_json:
                print(f"{args.tower}: no changes")
            else:
                output_path.parent.mkdir(parents=True, exist_ok=True)
                output_path.write_text(output_json, encoding="utf-8")
                print(f"{args.tower}: wrote {len(result['floors'])} floors to {output_path.relative_to(ROOT)}")
        else:
            output_path.parent.mkdir(parents=True, exist_ok=True)
            output_path.write_text(output_json, encoding="utf-8")
            print(f"{args.tower}: wrote {len(result['floors'])} floors to {output_path.relative_to(ROOT)}")

        # Generate missing monsters file
        missing = find_missing_monsters(args.tower, result)
        missing_path = TOWER_DIR / "missing-monsters.json"

        # Merge with existing missing-monsters.json (other towers)
        existing_missing = []
        if missing_path.exists():
            with open(missing_path, encoding="utf-8") as f:
                existing_missing = json.load(f)
        # Remove old entries for this tower, keep others
        existing_missing = [m for m in existing_missing if m.get("tower") != args.tower]
        all_missing = existing_missing + missing

        missing_json = json.dumps(all_missing, indent=2, ensure_ascii=False) + "\n"
        missing_path.write_text(missing_json, encoding="utf-8")
        print(f"{args.tower}: {len(missing)} missing monster(s)")


if __name__ == "__main__":
    main()
