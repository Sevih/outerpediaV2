"""
Item Extractor - Extract all non-equipment items from game data

Parses ItemTemplet.bytes, TextItem.bytes, TextSystem.bytes,
CostumeTemplet.bytes, and TextCharacter.bytes to produce data/items.json
with full i18n support (EN, JP, KR, ZH).

Item types extracted:
- IT_MATERIAL: crafting/evolution/enchant materials
- IT_PRESENT: gifts for heroes
- IT_BOX: chests, selection boxes
- IT_GEM: gems/jewels
- Tickets: recruit and sweep tickets
- Currencies: gold, ether, stamina, etc. (from TextSystem)
- Costumes: character skins (from CostumeTemplet)

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

# ── Currency definitions ──
# Currencies have no structured .bytes table; names/descs are in TextSystem.bytes.
# Map: name_symbol → (desc_symbol, icon, subtype)
# desc_symbol can be None if no description exists.
CURRENCY_DEFS = {
    # Core currencies
    "SYS_ASSET_GOLD":           ("SYS_DISC_ASSET_GOLD",          "CM_Goods_Gold",                              "gold"),
    "SYS_ASSET_CRISTAL":        ("SYS_DISC_ASSET_CRISTAL",       "TI_Item_Cristal",                            "ether"),
    "SYS_ASSET_FREE_CRYSTAL":   ("SYS_DISC_ASSET_CRISTAL",       "TI_Item_Cristal",                            "ether"),
    "SYS_ASSET_CASH_CRYSTAL":   ("SYS_DISC_ASSET_CRISTAL",       "TI_Item_Cristal_Cash",                       "ether"),
    "SYS_STAMINA":              (None,                            "TI_Item_Stamina",                            "stamina"),
    "SYS_ASSET_DEMIURGE":       ("SYS_DISC_ASSET_DEMIURGE",      "TI_Item_Recruit_Special_001",                "demiurge"),
    "SYS_ASSET_DEMIURGE_FREE":  ("SYS_DISC_ASSET_DEMIURGE_FREE", "TI_Item_Recruit_Special_001_NonMileage",     "demiurge"),
    "SYS_EARLY_CLAER_CREDIT":   ("SYS_DISC_KILL_GOLDMASK_CREDIT","GD_Item_GoldMask",                           "gold_bar"),
    # Social / progression
    "SYS_ASSET_FRIENDSHIP":     ("SYS_DISC_ASSET_FRIENDSHIP",    "TI_Item_FriendPoint",                        "friendship"),
    "SYS_ASSET_FACILITY":       ("SYS_DISC_ASSET_FACILITY",      "TI_Item_Facility",                           "antimatter"),
    "SYS_ASSET_MEMORY_STAR":    ("SYS_DISC_ASSET_MEMORY_STAR",   "TI_Item_Memory_Of_Star",                     "star_memory"),
    "SYS_ASSET_ACC_EXP":        (None,                            "TI_Item_Event_User_Exp",                     "exp"),
    "SYS_ASSET_CHAR_EXP":       (None,                            "TI_Item_Event_Char_Exp",                     "exp"),
    # Guild
    "SYS_ASSET_GUILD_COIN":     (None,                            "TI_Item_Guild_Coin",                         "guild"),
    "SYS_ASSET_GUILD_MEDAL":    (None,                            "TI_Item_Guild_Medal",                        "guild"),
    # PvP / Arena
    "SYS_ASSET_PVP_POINT":      (None,                            "TI_Item_PVP_Medal",                          "pvp"),
    "SYS_ASSET_PVP_LEAGUE_MEDAL": ("SYS_DISC_ASSET_PVP_LEAGUE_MEDAL", "",                                      "pvp"),
    "SYS_ASSET_PVP_LEAGUE_POINT": ("SYS_DISC_ASSET_PVP_LEAGUE_POINT", "TI_Item_PVP_Point",                     "pvp"),
    "SYS_ASSET_TICKET_PVP":     (None,                            "TI_Item_Ticket_PVP",                         "ticket"),
    # Tickets
    "SYS_ASSET_TICKET_GOLD":    (None,                            "TI_Item_Ticket_Gold",                        "ticket"),
    "SYS_ASSET_TICKET_EXP":     (None,                            "TI_Item_Ticket_Exp",                         "ticket"),
    "SYS_ASSET_TICKET_WEEK":    (None,                            "TI_Item_Ticket_Week",                        "ticket"),
    "SYS_ASSET_TICKET_GUILD_DUNGEON": (None,                      "TI_Item_Ticket_Guild_Dungeon",               "ticket"),
    "SYS_ASSET_TICKET_GUILD_RAID":    (None,                      "TI_Item_Ticket_Guild_Raid",                  "ticket"),
    "SYS_ASSET_TICKET_TOWER_VERY_HARD": (None,                    "",                                           "ticket"),
    "SYS_ASSET_TICKET_IRREGULAR_CHASE": (None,                    "TI_Item_Irregular_Stamina",                  "ticket"),
    # Mileage
    "SYS_ASSET_MILEAGE":               ("SYS_DISC_ASSET_MILEAGE",              "TI_Item_Mileage",              "mileage"),
    "SYS_ASSET_MILEAGE_DEMIURGE":      (None,                                   "",                             "mileage"),
    "SYS_ASSET_MILEAGE_ELEMENT":       ("SYS_DISC_ASSET_MILEAGE_ELEMENT",       "TI_Item_Mileage_Element",     "mileage"),
    "SYS_ASSET_MILEAGE_SEASONAL":      ("SYS_DISC_ASSET_SEASONAL_MILEAGE",      "TI_Item_Mileage_Seasonal",    "mileage"),
    "SYS_ASSET_MILEAGE_OUTER_FES":     ("SYS_DISC_ASSET_OUTER_FES_MILEAGE",     "TI_Item_Mileage_Seasonal",    "mileage"),
    "SYS_ASSET_MILEAGE_CUSTOM_PICKUP": ("SYS_DISC_ASSET_CUSTOM_MILEAGE",        "",                             "mileage"),
    # Special content
    "SYS_ASSET_RESEARCH":       ("SYS_DISC_ASSET_RESEARCH",       "TI_Item_Research_Point",                    "survey"),
    "SYS_ASSET_EFFECTION":      ("SYS_DISC_ASSET_EFFECTION",      "",                                          "effectium"),
    "SYS_ASSET_REMAINS":        ("SYS_DISC_ASSET_REMAINS",        "TI_Item_Remains",                           "remains"),
    "SYS_ASSET_WORLD_BOSS_COIN":  (None,                           "TI_Item_World_Boss",                        "world_boss"),
    "SYS_ASSET_TOWER_COIN":       (None,                           "TI_Item_Tower_Coin_01",                     "tower"),
    "SYS_ASSET_ADVENTURE_LICENSE": ("SYS_DISC_ASSET_ADVENTURE_LICENSE", "",                                     "license"),
    "SYS_ASSET_MONAD_GATE_ARTIFACT_ASSET_1": (None,                "TI_Item_Monad_Cube",                        "monad"),
    "SYS_ASSET_MONAD_GATE_ENHANCE_ASSET_1":  (None,                "TI_Item_Monad_Piece",                       "monad"),
    # Event coins (permanent events)
    "SYS_ASSET_ALWAYS_EVENT_COIN_1": (None,                        "TI_Item_AlwaysEvent_Coin_01",               "event_coin"),
    "SYS_ASSET_ALWAYS_EVENT_COIN_2": (None,                        "TI_Item_AlwaysEvent_Coin_02",               "event_coin"),
    "SYS_ASSET_ALWAYS_EVENT_COIN_3": (None,                        "TI_Item_AlwaysEvent_Coin_03",               "event_coin"),
    "SYS_ASSET_ALWAYS_EVENT_COIN_4": (None,                        "TI_Item_AlwaysEvent_Coin_04",               "event_coin"),
    "SYS_ASSET_EVENT_COIN_NORMAL":   (None,                        "TI_Item_Event_Asset_01",                    "event_coin"),
    "SYS_ASSET_EVENT_BOSS_COIN":     (None,                        "TI_Item_Event_Boss_Reward_000",             "event_coin"),
    "SYS_ASSET_EVENT_BINGO":         (None,                        "",                                          "event_coin"),
    # Event coins (rotating)
    "SYS_ASSET_EVENT_COIN_1":   (None,                             "TI_Item_Event_Coin_01",                     "event_coin"),
    "SYS_ASSET_EVENT_COIN_2":   (None,                             "TI_Item_Event_Coin_02",                     "event_coin"),
    "SYS_ASSET_EVENT_COIN_3":   (None,                             "TI_Item_Event_Coin_03",                     "event_coin"),
    "SYS_ASSET_EVENT_COIN_4":   (None,                             "TI_Item_Event_Coin_04",                     "event_coin"),
    "SYS_ASSET_EVENT_COIN_5":   (None,                             "TI_Item_Event_Coin_05",                     "event_coin"),
    "SYS_ASSET_EVENT_COIN_6":   (None,                             "TI_Item_Event_Coin_06",                     "event_coin"),
    # Irregular chase
    "SYS_ASSET_IRREGULAR_CHASE_1":     (None,                      "TI_Item_Irregular_01",                      "irregular"),
    "SYS_ASSET_IRREGULAR_CHASE_2":     (None,                      "TI_Item_Irregular_02",                      "irregular"),
    "SYS_ASSET_IRREGULAR_CHASE_3":     (None,                      "TI_Item_Irregular_03",                      "irregular"),
    "SYS_ASSET_IRREGULAR_CHASE_4":     (None,                      "TI_Item_Irregular_04",                      "irregular"),
    "SYS_ASSET_IRREGULAR_INFILTRATE":  (None,                      "",                                          "irregular"),
}

# Synthetic ID base for currencies (8_000_001+)
CURRENCY_ID_BASE = 8_000_001

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


def build_text_system_map(cm: CacheManager) -> dict:
    """Build lookup from IDSymbol to text entry for TextSystem"""
    texts = cm.get_data("TextSystem.bytes")
    text_map = {}
    for t in texts:
        text_map[t["IDSymbol"]] = t
    return text_map


def build_text_char_map(cm: CacheManager) -> dict:
    """Build lookup from IDSymbol to text entry for TextCharacter"""
    texts = cm.get_data("TextCharacter.bytes")
    text_map = {}
    for t in texts:
        text_map[t["IDSymbol"]] = t
    return text_map


def extract_currencies(cm: CacheManager) -> list:
    """Extract currencies from TextSystem.bytes using CURRENCY_DEFS"""
    sys_map = build_text_system_map(cm)

    result = []
    for i, (name_sym, (desc_sym, icon, subtype)) in enumerate(CURRENCY_DEFS.items()):
        name = get_localized_text(sys_map, name_sym)
        if not name["en"]:
            print(f"  Warning: no English name for currency {name_sym}, skipping")
            continue

        desc = get_localized_text(sys_map, desc_sym) if desc_sym else {"en": "", "jp": "", "kr": "", "zh": ""}

        entry = {
            "id": str(CURRENCY_ID_BASE + i),
            "name": name["en"],
            "name_jp": name["jp"],
            "name_kr": name["kr"],
            "name_zh": name["zh"],
            "rarity": "normal",
            "description": desc["en"],
            "description_jp": desc["jp"],
            "description_kr": desc["kr"],
            "description_zh": desc["zh"],
            "icon": icon,
            "type": "currency",
            "subtype": subtype,
        }
        result.append(entry)

    return result


def extract_costumes(cm: CacheManager) -> list:
    """Extract costumes from CostumeTemplet.bytes + TextCharacter.bytes"""
    costumes = cm.get_data("CostumeTemplet.bytes")
    char_map = build_text_char_map(cm)
    sys_map = build_text_system_map(cm)

    result = []
    for costume in costumes:
        costume_id = costume.get("ID", "")
        name_sym = costume.get("CostumeNameIDSymbol", "")
        icon = costume.get("SpriteCostumeIcon", "")
        grade = costume.get("ItemGrade", "")
        desc_sym = costume.get("Key", "")

        # Name from TextCharacter
        name = get_localized_text(char_map, name_sym)
        if not name["en"]:
            continue

        # Description from TextSystem (Key field like SYS_2000019_DES)
        desc = get_localized_text(sys_map, desc_sym) if desc_sym else {"en": "", "jp": "", "kr": "", "zh": ""}

        rarity = GRADE_MAP.get(grade, "normal")

        entry = {
            "id": f"costume_{costume_id}",
            "name": name["en"],
            "name_jp": name["jp"],
            "name_kr": name["kr"],
            "name_zh": name["zh"],
            "rarity": rarity,
            "description": desc["en"],
            "description_jp": desc["jp"],
            "description_kr": desc["kr"],
            "description_zh": desc["zh"],
            "icon": icon,
            "type": "costume",
            "subtype": "costume",
        }
        result.append(entry)

    return result


def copy_item_images(items: list):
    """Copy item icon PNGs from datamine to public/images/items/"""
    sprite_dir = EXTRACTED_ASSETS / "assets" / "editor" / "resources" / "sprite"
    ui_dir = EXTRACTED_ASSETS / "assets" / "art" / "ui" / "outgame" / "common"
    dest_dir = PUBLIC_IMAGES / "items"
    dest_dir.mkdir(parents=True, exist_ok=True)

    icons = set(item["icon"] for item in items if item["icon"])

    copied = 0
    not_found = []
    for icon in sorted(icons):
        dst = dest_dir / f"{icon}.png"
        if dst.exists():
            continue

        # Try sprite dir first, then UI dir (for CM_Goods_* currency icons)
        found = False
        for search_dir in [sprite_dir, ui_dir]:
            matches = list(search_dir.rglob(f"{icon}.png"))
            if matches:
                shutil.copy2(matches[0], dst)
                copied += 1
                found = True
                break

        if not found:
            not_found.append(icon)

    print(f"\nImages: copied {copied}, already existed {len(icons) - copied - len(not_found)}, not found {len(not_found)}")
    if not_found:
        print(f"  Missing: {', '.join(not_found[:10])}")


def main():
    print("Extracting items from game data...")
    cm = CacheManager(BYTES_FOLDER)

    items, skipped = extract_items()
    print(f"  Items from ItemTemplet: {len(items)} (skipped {skipped})")

    # Extract currencies
    currencies = extract_currencies(cm)
    print(f"  Currencies from TextSystem: {len(currencies)}")

    # Extract costumes
    costumes = extract_costumes(cm)
    print(f"  Costumes from CostumeTemplet: {len(costumes)}")

    # Merge all
    all_items = items + currencies + costumes

    # Output JSON
    output_path = DATA_ROOT / "items.json"
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(all_items, f, ensure_ascii=False, indent=2)

    print(f"\nTotal: {len(all_items)} items -> {output_path}")

    # Stats by type
    type_counts = {}
    for item in all_items:
        t = item["type"]
        type_counts[t] = type_counts.get(t, 0) + 1

    print("\nBy type:")
    for t, count in sorted(type_counts.items()):
        print(f"  {t}: {count}")

    # Copy images
    copy_item_images(all_items)


if __name__ == "__main__":
    main()
