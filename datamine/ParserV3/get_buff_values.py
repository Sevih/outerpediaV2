"""Get actual values from BuffTemplet using BuffID"""
import sys
sys.stdout.reconfigure(encoding='utf-8')
from pathlib import Path
import json
from cache_manager import CacheManager

from config import BYTES_FOLDER

cache = CacheManager(BYTES_FOLDER)

print("Loading data files...")
buff_data = cache.get_data("BuffTemplet.bytes")

# Look for the BuffIDs we found in ItemSpecialOptionTemplet
# BID_OOPART_CP_6_01 (level 1)
# BID_OOPART_CP_6_01_lv10 (level 10)

test_buff_ids = [
    "BID_OOPART_CP_6_01",
    "BID_OOPART_CP_6_01_lv10",
    "BID_OOPART_CP_6_02",
    "BID_OOPART_CP_6_02_lv10",
]

print("Searching for talisman BuffIDs:")
for buff_id in test_buff_ids:
    buff = next((b for b in buff_data if b.get("BuffID") == buff_id), None)
    if buff:
        print(f"\n{'='*80}")
        print(f"BuffID: {buff_id}")
        print(f"{'='*80}")
        print(json.dumps(buff, indent=2, ensure_ascii=False))
    else:
        print(f"\n{buff_id}: NOT FOUND")

# Also search for any OOPART buffs
print("\n" + "="*80)
print("All OOPART-related buffs:")
print("="*80)
oopart_buffs = [b for b in buff_data if "OOPART" in b.get("BuffID", "").upper()]
print(f"Found {len(oopart_buffs)} OOPART buffs")

if oopart_buffs:
    print("\nFirst 3 OOPART buffs:")
    for buff in oopart_buffs[:3]:
        buff_id = buff.get("BuffID", "")
        name = buff.get("NameIDSymbol", "")
        print(f"\n{buff_id}:")
        for key, value in buff.items():
            if value and value not in ["False", "0", "", "ST_NONE", "OAT_NONE"]:
                print(f"  {key}: {value}")
