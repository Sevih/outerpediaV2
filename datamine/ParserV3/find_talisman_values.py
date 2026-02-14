"""Find talisman effect values (lv1 and lv10)"""
import sys
sys.stdout.reconfigure(encoding='utf-8')
from pathlib import Path
import json
from cache_manager import CacheManager

BASE_PATH = Path(__file__).parent.parent
bytes_folder = BASE_PATH / "extracted_astudio" / "assets" / "editor" / "resources" / "templetbinary"
cache = CacheManager(bytes_folder)

print("Loading data files...")
# Try to find buff or skill data that might have talisman values
try:
    buff_data = cache.get_data("BuffTemplet.bytes")
    print(f"BuffTemplet: {len(buff_data)} entries")

    # Search for OOPARTS buffs
    ooparts_buffs = [b for b in buff_data if "OOPART" in b.get("NameIDSymbol", "").upper() or "UO_" in b.get("NameIDSymbol", "")]
    print(f"Found {len(ooparts_buffs)} OOPARTS-related buffs\n")

    if ooparts_buffs:
        print("First OOPARTS buff:")
        print(json.dumps(ooparts_buffs[0], indent=2, ensure_ascii=False))
except Exception as e:
    print(f"BuffTemplet error: {e}")

try:
    skill_data = cache.get_data("SkillTemplet.bytes")
    print(f"\nSkillTemplet: {len(skill_data)} entries")

    # Search for OOPARTS skills
    ooparts_skills = [s for s in skill_data if "OOPART" in s.get("NameIDSymbol", "").upper() or "UO_" in s.get("NameIDSymbol", "")]
    print(f"Found {len(ooparts_skills)} OOPARTS-related skills\n")

    if ooparts_skills:
        print("First OOPARTS skill:")
        print(json.dumps(ooparts_skills[0], indent=2, ensure_ascii=False))
except Exception as e:
    print(f"SkillTemplet error: {e}")

# Check if there's value data in TextSkill entries themselves
print("\n" + "="*80)
print("Checking UO_OOPARTS TextSkill entries for value patterns:")
print("="*80)

text_skill_data = cache.get_data("TextSkill.bytes")
text_skill_index = {t.get("IDSymbol", ""): t for t in text_skill_data if t.get("IDSymbol")}

# Check UO_OOPARTS_01 DESC variations
for suffix in ["", "_LV1", "_LV10", "_01", "_10"]:
    key = f"UO_OOPARTS_01_DESC{suffix}"
    if key in text_skill_index:
        print(f"\n{key}:")
        print(f"  EN: {text_skill_index[key].get('English', '')}")
