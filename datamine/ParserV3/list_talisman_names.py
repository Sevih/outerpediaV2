"""List all talisman names"""
import sys
sys.stdout.reconfigure(encoding='utf-8')
from pathlib import Path
from cache_manager import CacheManager

from config import BYTES_FOLDER
cache = CacheManager(BYTES_FOLDER)

item_data = cache.get_data("ItemTemplet.bytes")
text_item = cache.get_data("TextItem.bytes")

idx = {t.get("IDSymbol", ""): t for t in text_item if t.get("IDSymbol")}

talismans = [
    i for i in item_data
    if i.get("ItemType") == "IT_EQUIP"
    and i.get("ItemSubType") == "ITS_EQUIP_OOPARTS"
    and i.get("ItemGrade") == "IG_UNIQUE"
    and i.get("BasicStar") == "6"
]

for t in talismans:
    name = idx.get(t.get("DescIDSymbol", ""), {}).get("English", "")
    print(f"{t.get('ID')}: {name}")
