"""Extract talismans with actual effect values"""
import sys
sys.stdout.reconfigure(encoding='utf-8')
from pathlib import Path
import json
from cache_manager import CacheManager

BASE_PATH = Path(__file__).parent.parent
bytes_folder = BASE_PATH / "extracted_astudio" / "assets" / "editor" / "resources" / "templetbinary"
cache = CacheManager(bytes_folder)

print("Loading data files...")
item_data = cache.get_data("ItemTemplet.bytes")
special_option_data = cache.get_data("ItemSpecialOptionTemplet.bytes")
buff_data = cache.get_data("BuffTemplet.bytes")
text_item_data = cache.get_data("TextItem.bytes")
text_skill_data = cache.get_data("TextSkill.bytes")

print("Building indexes...")
text_item_index = {t.get("IDSymbol", ""): t for t in text_item_data if t.get("IDSymbol")}
text_skill_index = {t.get("IDSymbol", ""): t for t in text_skill_data if t.get("IDSymbol")}
buff_index = {b.get("BuffID", ""): b for b in buff_data if b.get("BuffID")}
special_option_index = {o.get("ID", ""): o for o in special_option_data if o.get("ID")}

# Filter talismans
talismans = [
    item for item in item_data
    if item.get("ItemType") == "IT_EQUIP"
    and item.get("ItemSubType") == "ITS_EQUIP_OOPARTS"
    and item.get("ItemGrade") == "IG_UNIQUE"
    and item.get("BasicStar") == "6"
]

print(f"Found {len(talismans)} talismans\n")

def replace_value_placeholder(text, value):
    """Replace [Value] placeholder with actual value"""
    if not text:
        return None
    # Value might be in different formats (percentage, flat number, etc.)
    # For now, just replace with the raw value
    return text.replace("[Value]", str(value)).replace("[Rate]", str(value))

# Extract talismans
extracted_talismans = []

for t in talismans:
    talisman_id = t.get("ID", "")
    desc_sym = t.get("DescIDSymbol", "")
    icon = t.get("IconName", "")
    enchant_cost_rate = t.get("ItemEnchantCostRate", "")

    # Extract number from talisman ID (e.g., 10201 -> 01)
    if not talisman_id.startswith("102"):
        continue

    effect_num = talisman_id[3:5]

    # Get name
    name_en = text_item_index.get(desc_sym, {}).get("English", "")
    name_jp = text_item_index.get(desc_sym, {}).get("Japanese", "")
    name_kr = text_item_index.get(desc_sym, {}).get("Korean", "")
    name_zh = text_item_index.get(desc_sym, {}).get("China_Simplified", "")

    # Get effect name
    effect_name_sym = f"UO_OOPARTS_{effect_num}_NAME"
    effect_name_en = text_skill_index.get(effect_name_sym, {}).get("English", "")
    effect_name_jp = text_skill_index.get(effect_name_sym, {}).get("Japanese", "")
    effect_name_kr = text_skill_index.get(effect_name_sym, {}).get("Korean", "")
    effect_name_zh = text_skill_index.get(effect_name_sym, {}).get("China_Simplified", "")

    # Determine type based on effect name (CP if chain point, AP if Action Point)
    talisman_type = None
    if effect_name_en:
        if "Chain Point" in effect_name_en:
            talisman_type = "CP"
        elif "Action Point" in effect_name_en:
            talisman_type = "AP"

    # Get effect icon and descriptions from ItemSpecialOptionTemplet using ItemEnchantCostRate
    effect_icon = None
    effect_desc1_en = None
    effect_desc1_jp = None
    effect_desc1_kr = None
    effect_desc1_zh = None
    effect_desc4_en = None
    effect_desc4_jp = None
    effect_desc4_kr = None
    effect_desc4_zh = None

    if enchant_cost_rate:
        rate_ids = [r.strip() for r in enchant_cost_rate.split(",")]

        if len(rate_ids) >= 1:
            # Level 1 data
            lv1_id = rate_ids[0]
            lv1_option = special_option_index.get(lv1_id)

            if lv1_option:
                # Get effect icon
                effect_icon = lv1_option.get("BuffLevel_4P", "")

                # Get description symbol and value from buff
                desc1_sym = lv1_option.get("CustomCraftDescIDSymbol", "")
                buff1_id = lv1_option.get("BuffID", "")

                # Get value from buff
                value1 = ""
                if buff1_id and buff1_id in buff_index:
                    value1 = buff_index[buff1_id].get("Value", "")

                # Get description text
                if desc1_sym in text_skill_index:
                    desc1_text = text_skill_index[desc1_sym]
                    effect_desc1_en = replace_value_placeholder(desc1_text.get("English", ""), value1)
                    effect_desc1_jp = replace_value_placeholder(desc1_text.get("Japanese", ""), value1)
                    effect_desc1_kr = replace_value_placeholder(desc1_text.get("Korean", ""), value1)
                    effect_desc1_zh = replace_value_placeholder(desc1_text.get("China_Simplified", ""), value1)

        if len(rate_ids) >= 2:
            # Level 10 data
            lv10_id = rate_ids[1]
            lv10_option = special_option_index.get(lv10_id)

            if lv10_option:
                # Get description symbol and value from buff
                desc10_sym = lv10_option.get("CustomCraftDescIDSymbol", "")
                buff10_id = lv10_option.get("BuffID", "")

                # Get value from buff
                value10 = ""
                if buff10_id and buff10_id in buff_index:
                    value10 = buff_index[buff10_id].get("Value", "")

                # Get description text
                if desc10_sym in text_skill_index:
                    desc10_text = text_skill_index[desc10_sym]
                    effect_desc4_en = replace_value_placeholder(desc10_text.get("English", ""), value10)
                    effect_desc4_jp = replace_value_placeholder(desc10_text.get("Japanese", ""), value10)
                    effect_desc4_kr = replace_value_placeholder(desc10_text.get("Korean", ""), value10)
                    effect_desc4_zh = replace_value_placeholder(desc10_text.get("China_Simplified", ""), value10)

    # Get icon name from IconName field
    icon_name = icon.replace("TI_Equipment_", "") if icon else ""

    talisman_entry = {
        "name": name_en,
        "name_jp": name_jp,
        "name_kr": name_kr,
        "name_zh": name_zh,
        "type": talisman_type,
        "rarity": "legendary",
        "image": icon_name,
        "effect_name": effect_name_en,
        "effect_name_jp": effect_name_jp,
        "effect_name_kr": effect_name_kr,
        "effect_name_zh": effect_name_zh,
        "effect_desc1": effect_desc1_en,
        "effect_desc1_jp": effect_desc1_jp,
        "effect_desc1_kr": effect_desc1_kr,
        "effect_desc1_zh": effect_desc1_zh,
        "effect_desc4": effect_desc4_en,
        "effect_desc4_jp": effect_desc4_jp,
        "effect_desc4_kr": effect_desc4_kr,
        "effect_desc4_zh": effect_desc4_zh,
        "effect_icon": effect_icon,
        "level": "6",
        "source": None,
        "boss": None,
        "mode": None
    }

    extracted_talismans.append(talisman_entry)

print(f"Extracted {len(extracted_talismans)} talismans\n")

# Show first 2 for verification
print("First 2 talismans:")
print(json.dumps(extracted_talismans[:2], indent=2, ensure_ascii=False))

# Save to file
output_file = BASE_PATH / "extracted_talismans_full.json"
with open(output_file, "w", encoding="utf-8") as f:
    json.dump(extracted_talismans, f, indent=2, ensure_ascii=False)

print(f"\n\nSaved all {len(extracted_talismans)} talismans to {output_file}")
