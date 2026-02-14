"""Find talisman effect values using ItemEnchantCostRate"""
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

# Get first talisman
talismans = [
    item for item in item_data
    if item.get("ItemType") == "IT_EQUIP"
    and item.get("ItemSubType") == "ITS_EQUIP_OOPARTS"
    and item.get("ItemGrade") == "IG_UNIQUE"
    and item.get("BasicStar") == "6"
]

talisman = talismans[0]
print(f"First talisman: {talisman.get('DescIDSymbol')}")
print(f"ItemEnchantCostRate: {talisman.get('ItemEnchantCostRate')}")

# Split the ItemEnchantCostRate
enchant_cost_rate = talisman.get("ItemEnchantCostRate", "")
if enchant_cost_rate:
    rate_ids = [r.strip() for r in enchant_cost_rate.split(",")]
    print(f"Rate IDs: {rate_ids}")

    # Look for these IDs in ItemSpecialOptionTemplet
    for rate_id in rate_ids:
        print(f"\n--- Looking for ID {rate_id} in ItemSpecialOptionTemplet ---")
        option = next((opt for opt in special_option_data if opt.get("ID") == rate_id), None)

        if option:
            print(f"Found!")
            print(json.dumps(option, indent=2, ensure_ascii=False))
        else:
            print(f"Not found")

# Show all fields in special options to understand structure
print("\n" + "="*80)
print("Sample ItemSpecialOptionTemplet entries:")
print("="*80)
for opt in special_option_data[:3]:
    print(json.dumps(opt, indent=2, ensure_ascii=False))
    print()
