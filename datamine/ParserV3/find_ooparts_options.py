"""Find OOPARTS option values in ItemOptionTemplet"""
import sys
sys.stdout.reconfigure(encoding='utf-8')
from pathlib import Path
import json
from cache_manager import CacheManager

BASE_PATH = Path(__file__).parent.parent
bytes_folder = BASE_PATH / "extracted_astudio" / "assets" / "editor" / "resources" / "templetbinary"
cache = CacheManager(bytes_folder)

print("Loading ItemOptionTemplet...")
option_data = cache.get_data("ItemOptionTemplet.bytes")

# Look for options with ID starting with 102 (talisman IDs are 102XX)
print("Options with ID starting with 10 (showing first 20):")
talisman_options = [opt for opt in option_data if opt.get("ID", "").startswith("10")][:20]

for opt in talisman_options:
    print(f"\nID {opt.get('ID')}:")
    for key, value in opt.items():
        if value and value not in ["False", "0", ""]:
            print(f"  {key}: {value}")

# Also check GroupID patterns around 10000-10100
print("\n" + "="*80)
print("Options with GroupID 10000-10020:")
print("="*80)

group_options = [opt for opt in option_data if opt.get("GroupID", "").isdigit() and 10000 <= int(opt.get("GroupID", "0")) <= 10020]
unique_groups = set(opt.get("GroupID") for opt in group_options)

print(f"Found {len(group_options)} options in {len(unique_groups)} groups")
print(f"Groups: {sorted(unique_groups)}")

# Show first option from each group
for group_id in sorted(unique_groups)[:5]:
    first = next(opt for opt in group_options if opt.get("GroupID") == group_id)
    print(f"\nGroupID {group_id} (first entry):")
    for key, value in first.items():
        if value and value not in ["False", "0", ""]:
            print(f"  {key}: {value}")
