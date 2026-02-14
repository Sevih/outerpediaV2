"""Search for talisman effect references in text files"""
import sys
sys.stdout.reconfigure(encoding='utf-8')
from pathlib import Path
import json
from cache_manager import CacheManager

BASE_PATH = Path(__file__).parent.parent
bytes_folder = BASE_PATH / "extracted_astudio" / "assets" / "editor" / "resources" / "templetbinary"
cache = CacheManager(bytes_folder)

print("Loading data files...")
text_item_data = cache.get_data("TextItem.bytes")
text_skill_data = cache.get_data("TextSkill.bytes")

# Search for talisman-related entries
print("Searching for TALISMAN entries in TextItem...")
talisman_text_items = [t for t in text_item_data if "TALISMAN" in t.get("IDSymbol", "").upper()]
print(f"Found {len(talisman_text_items)} entries\n")

# Show all talisman entries
for item in talisman_text_items:
    id_sym = item.get("IDSymbol", "")
    english = item.get("English", "")
    print(f"{id_sym}: {english}")

print("\n" + "="*80)
print("Searching for TALISMAN entries in TextSkill...")
talisman_text_skills = [t for t in text_skill_data if "TALISMAN" in t.get("IDSymbol", "").upper()]
print(f"Found {len(talisman_text_skills)} entries\n")

# Show all talisman skill entries
for skill in talisman_text_skills:
    id_sym = skill.get("IDSymbol", "")
    english = skill.get("English", "")
    print(f"{id_sym}: {english}")

# Also search for OOPART
print("\n" + "="*80)
print("Searching for OOPART entries in TextSkill...")
oopart_text_skills = [t for t in text_skill_data if "OOPART" in t.get("IDSymbol", "").upper()]
print(f"Found {len(oopart_text_skills)} entries\n")

for skill in oopart_text_skills[:20]:  # Show first 20
    id_sym = skill.get("IDSymbol", "")
    english = skill.get("English", "")
    print(f"{id_sym}: {english}")
