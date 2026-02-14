"""Try to match talismans with their effects"""
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

# Get all OOPARTS effects
ooparts_effects = [t for t in text_skill_data if t.get("IDSymbol", "").startswith("UO_OOPARTS_")]
print(f"Found {len(ooparts_effects)} OOPARTS effect texts\n")

# Extract effect numbers from talisman IDs
print("="*80)
print("Matching talismans to effects by ID pattern:")
print("="*80)

for t in talismans:
    talisman_id = t.get("ID", "")
    desc_sym = t.get("DescIDSymbol", "")
    name = text_item_index.get(desc_sym, {}).get("English", desc_sym)
    icon = t.get("IconName", "")

    # Extract number from talisman ID (e.g., 10201 -> try 01, 02, etc.)
    # Pattern seems to be: 102XX where XX is the effect number
    if talisman_id.startswith("102"):
        effect_num = talisman_id[3:5]  # Get last 2 digits

        # Try to find corresponding effect
        effect_name_sym = f"UO_OOPARTS_{effect_num}_NAME"
        effect_desc_sym = f"UO_OOPARTS_{effect_num}_DESC"

        if effect_name_sym in text_skill_index:
            effect_name = text_skill_index[effect_name_sym].get("English", "")
            effect_desc = text_skill_index.get(effect_desc_sym, {}).get("English", "")

            print(f"\n{name} (ID: {talisman_id})")
            print(f"  Icon: {icon}")
            print(f"  Effect: {effect_name}")
            print(f"  Desc: {effect_desc}")

# Also show all fields for first talisman
print("\n" + "="*80)
print("Full data for first talisman:")
print("="*80)
print(json.dumps(talismans[0], indent=2, ensure_ascii=False))
