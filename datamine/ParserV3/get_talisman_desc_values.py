"""Get talisman descriptions with actual values"""
import sys
sys.stdout.reconfigure(encoding='utf-8')
from pathlib import Path
import json
from cache_manager import CacheManager

from config import BYTES_FOLDER

cache = CacheManager(BYTES_FOLDER)

print("Loading data files...")
text_skill_data = cache.get_data("TextSkill.bytes")
text_skill_index = {t.get("IDSymbol", ""): t for t in text_skill_data if t.get("IDSymbol")}

# Check for level-specific descriptions
test_keys = [
    "UO_OOPARTS_01_DESC",
    "UO_OOPARTS_01_LV10_DESC",
    "UO_OOPARTS_02_DESC",
    "UO_OOPARTS_02_LV10_DESC",
]

print("Checking for level-specific descriptions:")
for key in test_keys:
    if key in text_skill_index:
        entry = text_skill_index[key]
        print(f"\n{key}:")
        print(f"  EN: {entry.get('English', '')}")
        print(f"  JP: {entry.get('Japanese', '')}")
        print(f"  KR: {entry.get('Korean', '')}")
        print(f"  ZH: {entry.get('China_Simplified', '')}")
    else:
        print(f"\n{key}: NOT FOUND")

# Search for all OOPARTS LV10 entries
print("\n" + "="*80)
print("All OOPARTS LV10 entries:")
print("="*80)
lv10_entries = [t for t in text_skill_data if "OOPARTS" in t.get("IDSymbol", "") and "LV10" in t.get("IDSymbol", "")]
for entry in lv10_entries:
    key = entry.get("IDSymbol", "")
    en = entry.get("English", "")
    print(f"{key}: {en}")
