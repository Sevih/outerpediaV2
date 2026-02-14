"""Extract talismans with template placeholders for values"""
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
text_item_data = cache.get_data("TextItem.bytes")
text_skill_data = cache.get_data("TextSkill.bytes")

print("Building indexes...")
text_item_index = {t.get("IDSymbol", ""): t for t in text_item_data if t.get("IDSymbol")}
text_skill_index = {t.get("IDSymbol", ""): t for t in text_skill_data if t.get("IDSymbol")}

# Filter talismans
talismans = [
    item for item in item_data
    if item.get("ItemType") == "IT_EQUIP"
    and item.get("ItemSubType") == "ITS_EQUIP_OOPARTS"
    and item.get("ItemGrade") == "IG_UNIQUE"
    and item.get("BasicStar") == "6"
]

print(f"Found {len(talismans)} talismans\n")

# Extract talismans
extracted_talismans = []

for t in talismans:
    talisman_id = t.get("ID", "")
    desc_sym = t.get("DescIDSymbol", "")
    icon = t.get("IconName", "")

    # Extract number from talisman ID (e.g., 10201 -> 01)
    if talisman_id.startswith("102"):
        effect_num = talisman_id[3:5]

        # Get name
        name_en = text_item_index.get(desc_sym, {}).get("English", "")
        name_jp = text_item_index.get(desc_sym, {}).get("Japanese", "")
        name_kr = text_item_index.get(desc_sym, {}).get("Korean", "")
        name_zh = text_item_index.get(desc_sym, {}).get("China_Simplified", "")

        # Get effect name and desc
        effect_name_sym = f"UO_OOPARTS_{effect_num}_NAME"
        effect_desc_sym = f"UO_OOPARTS_{effect_num}_DESC"

        effect_name_en = text_skill_index.get(effect_name_sym, {}).get("English", "")
        effect_name_jp = text_skill_index.get(effect_name_sym, {}).get("Japanese", "")
        effect_name_kr = text_skill_index.get(effect_name_sym, {}).get("Korean", "")
        effect_name_zh = text_skill_index.get(effect_name_sym, {}).get("China_Simplified", "")

        effect_desc_en = text_skill_index.get(effect_desc_sym, {}).get("English", "")
        effect_desc_jp = text_skill_index.get(effect_desc_sym, {}).get("Japanese", "")
        effect_desc_kr = text_skill_index.get(effect_desc_sym, {}).get("Korean", "")
        effect_desc_zh = text_skill_index.get(effect_desc_sym, {}).get("China_Simplified", "")

        # Determine type based on effect name (CP if chain point, AP if Action Point)
        talisman_type = None
        if effect_name_en:
            if "Chain Point" in effect_name_en:
                talisman_type = "CP"
            elif "Action Point" in effect_name_en:
                talisman_type = "AP"

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
            "effect_desc1": effect_desc_en,  # TODO: Replace [Value] with actual lv1 value
            "effect_desc1_jp": effect_desc_jp,
            "effect_desc1_kr": effect_desc_kr,
            "effect_desc1_zh": effect_desc_zh,
            "effect_desc4": effect_desc_en,  # TODO: Replace [Value] with actual lv10 value
            "effect_desc4_jp": effect_desc_jp,
            "effect_desc4_kr": effect_desc_kr,
            "effect_desc4_zh": effect_desc_zh,
            "effect_icon": f"TI_Talisman{effect_num}",  # Guessing icon pattern
            "level": "6",
            "source": None,
            "boss": None,
            "mode": None
        }

        extracted_talismans.append(talisman_entry)

print(f"Extracted {len(extracted_talismans)} talismans\n")
print(json.dumps(extracted_talismans, indent=2, ensure_ascii=False))

# Save to file
output_file = BASE_PATH / "extracted_talismans_template.json"
with open(output_file, "w", encoding="utf-8") as f:
    json.dump(extracted_talismans, f, indent=2, ensure_ascii=False)

print(f"\nSaved to {output_file}")
print("\nNOTE: effect_desc1 and effect_desc4 contain [Value] placeholders.")
print("You need to manually replace these with actual lv1 and lv10 values.")
