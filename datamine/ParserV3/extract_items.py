"""
Item Extractor - Extract all non-equipment items from game data

Parses ItemTemplet.bytes and TextItem.bytes to produce data/items.json
with full i18n support (EN, JP, KR, ZH).

Item types extracted:
- IT_MATERIAL: crafting/evolution/enchant materials
- IT_PRESENT: gifts for heroes
- IT_BOX: chests, selection boxes
- IT_GEM: gems/jewels
- Tickets: recruit and sweep tickets

Usage:
    python extract_items.py
"""

import json
import shutil
from pathlib import Path
from cache_manager import CacheManager
from config import BYTES_FOLDER, DATA_ROOT, EXTRACTED_ASSETS, PUBLIC_IMAGES


# Grade mapping: game enum → display rarity
GRADE_MAP = {
    "IG_NORMAL": "normal",
    "IG_MAGIC": "superior",
    "IG_RARE": "epic",
    "IG_UNIQUE": "legendary",
}

# Type mapping: game enum → clean type
TYPE_MAP = {
    "IT_MATERIAL": "material",
    "IT_PRESENT": "present",
    "IT_BOX": "box",
    "IT_GEM": "gem",
}

# SubType mapping: game enum → clean subtype
SUBTYPE_MAP = {
    # Materials - character
    "ITS_MATERIAL_CHAR_LEVEL": "char_level",
    "ITS_MATERIAL_CHAR_LEVEL_SPECIAL": "char_level_special",
    "ITS_MATERIAL_CHAR_EVO_EARTH": "char_evo",
    "ITS_MATERIAL_CHAR_EVO_FIRE": "char_evo",
    "ITS_MATERIAL_CHAR_EVO_WATER": "char_evo",
    "ITS_MATERIAL_CHAR_EVO_LIGHT": "char_evo",
    "ITS_MATERIAL_CHAR_EVO_DARK": "char_evo",
    "ITS_MATERIAL_CHAR_EVO_SPECIAL": "char_evo_special",
    "ITS_MATERIAL_CHAR_CLASS": "char_class",
    "ITS_MATERIAL_CHAR_CORE_FUSION": "core_fusion",
    "ITS_MATERIAL_CHAR_RECALL": "char_recall",
    # Materials - craft
    "ITS_MATERIAL_CRAFT": "craft",
    "ITS_MATERIAL_CRAFT_ADDTION_1": "craft",
    "ITS_MATERIAL_CRAFT_ADDTION_2": "craft",
    "ITS_MATERIAL_CRAFT_ADDTION_3": "craft",
    "ITS_MATERIAL_CRAFT_GIFT": "craft_gift",
    # Materials - equipment
    "ITS_MATERIAL_EQUIP_BREAKLIMIT": "equip_breaklimit",
    "ITS_MATERIAL_EQUIP_CHANGER": "equip_changer",
    "ITS_MATERIAL_EQUIP_ENCHANT": "equip_enchant",
    "ITS_MATERIAL_EQUIP_TRANSCEND": "equip_transcend",
    "ITS_MATERIAL_GEAR_RECALL": "gear_recall",
    "ITS_MATERIAL_ARMOR_BREAKLIMIT": "armor_breaklimit",
    "ITS_MATERIAL_ADD_MANUFACT": "add_manufact",
    # Presents
    "ITS_PRESENT_01": "present",
    "ITS_PRESENT_02": "present",
    "ITS_PRESENT_03": "present",
    "ITS_PRESENT_04": "present",
    "ITS_PRESENT_05": "present",
    "ITS_PRESENT_MAX": "present_max",
    # Boxes
    "ITS_BOX_TYPE_RANDOM": "box_random",
    "ITS_BOX_TYPE_CHOICE_ITEM": "box_choice_item",
    "ITS_BOX_TYPE_CHOICE_CHAR": "box_choice_char",
    "ITS_BOX_TYPE_CHOICE_CHAR_MAX": "box_choice_char_max",
    # Gems
    "ITS_GEM": "gem",
    # Special
    "ITS_RECRUIT_TICKET": "recruit_ticket",
    "ITS_SWEEP_TICKET": "sweep_ticket",
    "ITS_MONAD_GATE": "monad_gate",
}

# IDs to exclude (test items, internal items)
EXCLUDE_IDS = set()
MIN_TEST_ID = 9900000


def build_text_map(cm: CacheManager) -> dict:
    """Build lookup from IDSymbol to text entry"""
    texts = cm.get_data("TextItem.bytes")
    text_map = {}
    for t in texts:
        text_map[t["IDSymbol"]] = t
    return text_map


def get_name_symbol(desc_symbol: str) -> str:
    """Derive name symbol from description symbol"""
    if "_DESC" in desc_symbol:
        return desc_symbol.replace("_DESC", "_NAME")
    return desc_symbol + "_NAME"


def get_localized_text(text_map: dict, symbol: str) -> dict:
    """Get localized text from text map"""
    entry = text_map.get(symbol, {})
    return {
        "en": entry.get("English", ""),
        "jp": entry.get("Japanese", ""),
        "kr": entry.get("Korean", ""),
        "zh": entry.get("China_Simplified", ""),
    }


def resolve_rarity(item: dict) -> str | None:
    """
    Resolve rarity from ItemGrade or BasicStar fallback.

    - Materials/Presents/Boxes: ItemGrade is empty, use BasicStar
    - Gems: ItemGrade has value, BasicStar is gem stage (1-6)
    """
    grade = item.get("ItemGrade", "")
    if grade and grade in GRADE_MAP:
        return GRADE_MAP[grade]

    # Fallback to BasicStar for materials/presents/boxes
    star = item.get("BasicStar", "")
    if star and star in GRADE_MAP:
        return GRADE_MAP[star]

    return None


def extract_items():
    """Main extraction function"""
    cm = CacheManager(BYTES_FOLDER)
    items = cm.get_data("ItemTemplet.bytes")
    text_map = build_text_map(cm)

    # Filter: exclude equipment and test items
    filtered = [
        item for item in items
        if item.get("ItemType") != "IT_EQUIP"
        and int(item.get("ID", "0")) < MIN_TEST_ID
        and int(item.get("ID", "0")) not in EXCLUDE_IDS
    ]

    result = []
    skipped = 0

    for item in filtered:
        item_id = item.get("ID", "")
        icon = item.get("IconName", "")
        item_type = item.get("ItemType", "")
        item_subtype = item.get("ItemSubType", "")

        # Use NameIDSymbol directly if available, otherwise derive from DescIDSymbol
        name_symbol = item.get("NameIDSymbol", "")
        desc_symbol = item.get("DescIDSymbol", "")
        if not name_symbol:
            name_symbol = get_name_symbol(desc_symbol)

        # Get localized name and description
        name = get_localized_text(text_map, name_symbol)
        desc = get_localized_text(text_map, desc_symbol)

        # Skip items with no English name
        if not name["en"]:
            skipped += 1
            continue

        # Resolve rarity from ItemGrade or BasicStar
        rarity = resolve_rarity(item)

        # Map type and subtype
        clean_type = TYPE_MAP.get(item_type, item_type)
        clean_subtype = SUBTYPE_MAP.get(item_subtype, item_subtype)

        entry = {
            "id": item_id,
            "name": name["en"],
            "name_jp": name["jp"],
            "name_kr": name["kr"],
            "name_zh": name["zh"],
            "rarity": rarity or "normal",
            "description": desc["en"],
            "description_jp": desc["jp"],
            "description_kr": desc["kr"],
            "description_zh": desc["zh"],
            "icon": icon,
            "type": clean_type,
            "subtype": clean_subtype,
        }

        result.append(entry)

    # Sort by ID
    result.sort(key=lambda x: int(x["id"]))

    return result, skipped


def copy_item_images(items: list):
    """Copy item icon PNGs from datamine to public/images/items/"""
    sprite_dir = EXTRACTED_ASSETS / "assets" / "editor" / "resources" / "sprite"
    dest_dir = PUBLIC_IMAGES / "items"
    dest_dir.mkdir(parents=True, exist_ok=True)

    icons = set(item["icon"] for item in items if item["icon"])

    copied = 0
    not_found = []
    for icon in sorted(icons):
        dst = dest_dir / f"{icon}.png"
        if dst.exists():
            continue
        matches = list(sprite_dir.rglob(f"{icon}.png"))
        if matches:
            shutil.copy2(matches[0], dst)
            copied += 1
        else:
            not_found.append(icon)

    print(f"\nImages: copied {copied}, already existed {len(icons) - copied - len(not_found)}, not found {len(not_found)}")
    if not_found:
        print(f"  Missing: {', '.join(not_found[:10])}")


def main():
    print("Extracting items from game data...")
    items, skipped = extract_items()

    # Output JSON
    output_path = DATA_ROOT / "items.json"
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(items, f, ensure_ascii=False, indent=2)

    print(f"Extracted {len(items)} items -> {output_path}")
    if skipped:
        print(f"Skipped {skipped} items (no English name)")

    # Stats by type
    type_counts = {}
    for item in items:
        t = item["type"]
        type_counts[t] = type_counts.get(t, 0) + 1

    print("\nBy type:")
    for t, count in sorted(type_counts.items()):
        print(f"  {t}: {count}")

    # Copy images
    copy_item_images(items)


if __name__ == "__main__":
    main()
