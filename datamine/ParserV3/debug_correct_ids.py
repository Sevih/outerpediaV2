"""
Debug with CORRECT character IDs
"""

import json
import sys
import io
from config import BYTES_FOLDER, CHAR_DATA
from cache_manager import CacheManager
from character_extractor import CharacterExtractor
from buff_extractor import BuffExtractor

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

cache = CacheManager(BYTES_FOLDER)
all_levels = cache.get_data("CharacterSkillLevelTemplet.bytes")
all_buffs = cache.get_data("BuffTemplet.bytes")

buff_by_id = {}
for b in all_buffs:
    bid = b.get("BuffID", "")
    if bid:
        buff_by_id.setdefault(bid, []).append(b)


def find_backup_buff_id(char_id):
    for level in all_levels:
        for key, value in level.items():
            if isinstance(value, str) and f"{char_id}_backup" in value:
                return value.split(',')[0].strip()
    return None


# ============================================================
# 1. EMBER (2000094) BT_MARKING classification
# ============================================================
print("=" * 60)
print("1. EMBER (2000094)")
print("=" * 60)

ember_backup = find_backup_buff_id("2000094")
print(f"  Backup BuffID: {ember_backup}")

if ember_backup:
    extractor = BuffExtractor()
    result = extractor.extract_from_buff_ids(ember_backup)
    print(f"  Extraction result: {result}")

    entries = buff_by_id.get(ember_backup, [])
    for entry in entries:
        print(f"  Raw: Type={entry.get('Type')}, BuffDebuffType={entry.get('BuffDebuffType')}, Target={entry.get('TargetType')}, Icon={entry.get('IconName')}")

# Full extraction
ext = CharacterExtractor("2000094")
data = ext.extract()
chain = data.get("skills", {}).get("SKT_CHAIN_PASSIVE", {})
print(f"\n  Full extraction:")
print(f"    dual_buff: {chain.get('dual_buff')}")
print(f"    dual_debuff: {chain.get('dual_debuff')}")

# V1 data
with open(CHAR_DATA / "2000094.json", "r", encoding="utf-8") as f:
    v1 = json.load(f)
v1_chain = v1.get("skills", {}).get("SKT_CHAIN_PASSIVE", {})
print(f"  V1 data:")
print(f"    dual_buff: {v1_chain.get('dual_buff')}")
print(f"    dual_debuff: {v1_chain.get('dual_debuff')}")


# ============================================================
# 2. HANBYUL LEE (2000021) wgr
# ============================================================
print("\n" + "=" * 60)
print("2. HANBYUL LEE (2000021)")
print("=" * 60)

ext2 = CharacterExtractor("2000021")
data2 = ext2.extract()
s2 = data2.get("skills", {}).get("SKT_SECOND", {})
print(f"  S2 name: {s2.get('name')}")
print(f"  S2 wgr: {s2.get('wgr')}")
print(f"  S2 cd: {s2.get('cd')}")

name_id = s2.get("NameIDSymbol")
print(f"  S2 NameIDSymbol: {name_id}")
if name_id:
    skill_info = ext2.skill_index.get(name_id)
    if skill_info:
        print(f"  ApproachType: {skill_info.get('ApproachType')}")
        print(f"  TargetTeam: {skill_info.get('TargetTeam')}")
        for k, v in skill_info.items():
            if 'fallback' in k.lower():
                print(f"  {k}: {v}")

    levels = ext2.skill_level_by_skill.get(name_id, [])
    for l in levels[:3]:
        print(f"  Level: DescID={l.get('DescID')}, WGReduce={l.get('WGReduce')}, DmgFactor={l.get('DamageFactor')}")

with open(CHAR_DATA / "2000021.json", "r", encoding="utf-8") as f:
    v1_2 = json.load(f)
print(f"  V1 S2 wgr: {v1_2.get('skills', {}).get('SKT_SECOND', {}).get('wgr')}")


# ============================================================
# 3. BLEU (2000045) wgr
# ============================================================
print("\n" + "=" * 60)
print("3. BLEU (2000045)")
print("=" * 60)

ext3 = CharacterExtractor("2000045")
data3 = ext3.extract()
s2_b = data3.get("skills", {}).get("SKT_SECOND", {})
print(f"  S2 name: {s2_b.get('name')}")
print(f"  S2 wgr: {s2_b.get('wgr')}")
print(f"  S2 cd: {s2_b.get('cd')}")

name_id_b = s2_b.get("NameIDSymbol")
print(f"  S2 NameIDSymbol: {name_id_b}")
if name_id_b:
    skill_info_b = ext3.skill_index.get(name_id_b)
    if skill_info_b:
        print(f"  ApproachType: {skill_info_b.get('ApproachType')}")
        print(f"  TargetTeam: {skill_info_b.get('TargetTeam')}")
        for k, v in skill_info_b.items():
            if 'fallback' in k.lower():
                print(f"  {k}: {v}")

    levels_b = ext3.skill_level_by_skill.get(name_id_b, [])
    for l in levels_b[:3]:
        print(f"  Level: DescID={l.get('DescID')}, WGReduce={l.get('WGReduce')}, DmgFactor={l.get('DamageFactor')}")

with open(CHAR_DATA / "2000045.json", "r", encoding="utf-8") as f:
    v1_3 = json.load(f)
print(f"  V1 S2 wgr: {v1_3.get('skills', {}).get('SKT_SECOND', {}).get('wgr')}")
