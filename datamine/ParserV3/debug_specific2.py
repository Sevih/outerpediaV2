"""
Debug specific extraction issues - pass 2
"""

import json
import sys
import io
from config import BYTES_FOLDER, CHAR_DATA
from cache_manager import CacheManager
from character_extractor import CharacterExtractor

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

# ============================================================
# 1. EMBER full extraction - trace dual_buff origin
# ============================================================
print("=" * 60)
print("1. EMBER (2000107) full extraction")
print("=" * 60)

extractor = CharacterExtractor("2000107")
data = extractor.extract()
chain = data.get("skills", {}).get("SKT_CHAIN_PASSIVE", {})
print(f"  buff: {chain.get('buff')}")
print(f"  debuff: {chain.get('debuff')}")
print(f"  dual_buff: {chain.get('dual_buff')}")
print(f"  dual_debuff: {chain.get('dual_debuff')}")

# Check true_desc for Dual Attack Effect section
desc = chain.get("true_desc", "")
if "Dual Attack Effect" in desc:
    dual_section = desc.split("Dual Attack Effect")[1]
    if "Chain Burst Effect" in dual_section:
        dual_section = dual_section.split("Chain Burst Effect")[0]
    print(f"  Dual Attack Effect section: {dual_section[:200]}")

# ============================================================
# 2. HANBYUL LEE (2000069) - find skill via CharacterExtractor
# ============================================================
print("\n" + "=" * 60)
print("2. HANBYUL LEE (2000069) wgr via CharacterExtractor")
print("=" * 60)

ext2 = CharacterExtractor("2000069")
data2 = ext2.extract()
s2 = data2.get("skills", {}).get("SKT_SECOND", {})
print(f"  S2 name: {s2.get('name')}")
print(f"  S2 wgr: {s2.get('wgr')}")
print(f"  S2 cd: {s2.get('cd')}")
print(f"  S2 classification: {s2.get('classification')}")

# Check ApproachType
name_id = s2.get("NameIDSymbol")
print(f"  S2 NameIDSymbol: {name_id}")
if name_id:
    skill_info = ext2.skill_index.get(name_id)
    if skill_info:
        print(f"  ApproachType: {skill_info.get('ApproachType')}")
        print(f"  TargetTeam: {skill_info.get('TargetTeam')}")
        print(f"  RangeType: {skill_info.get('RangeType')}")
        for k, v in skill_info.items():
            if 'fallback' in k.lower():
                print(f"  {k}: {v}")

    # Check skill level data
    levels = ext2.skill_level_by_skill.get(name_id, [])
    for l in levels[:3]:
        print(f"  Level: DescID={l.get('DescID')}, GainCP={l.get('GainCP')}, WGReduce={l.get('WGReduce')}, DamageFactor={l.get('DamageFactor')}")


# ============================================================
# 3. BLEU (2000111) wgr
# ============================================================
print("\n" + "=" * 60)
print("3. BLEU (2000111) wgr via CharacterExtractor")
print("=" * 60)

ext3 = CharacterExtractor("2000111")
data3 = ext3.extract()
s2_bleu = data3.get("skills", {}).get("SKT_SECOND", {})
print(f"  S2 name: {s2_bleu.get('name')}")
print(f"  S2 wgr: {s2_bleu.get('wgr')}")
print(f"  S2 cd: {s2_bleu.get('cd')}")
print(f"  S2 classification: {s2_bleu.get('classification')}")

name_id_b = s2_bleu.get("NameIDSymbol")
print(f"  S2 NameIDSymbol: {name_id_b}")
if name_id_b:
    skill_info_b = ext3.skill_index.get(name_id_b)
    if skill_info_b:
        print(f"  ApproachType: {skill_info_b.get('ApproachType')}")
        print(f"  TargetTeam: {skill_info_b.get('TargetTeam')}")
        print(f"  RangeType: {skill_info_b.get('RangeType')}")
        for k, v in skill_info_b.items():
            if 'fallback' in k.lower():
                print(f"  {k}: {v}")

    levels_b = ext3.skill_level_by_skill.get(name_id_b, [])
    for l in levels_b[:3]:
        print(f"  Level: DescID={l.get('DescID')}, GainCP={l.get('GainCP')}, WGReduce={l.get('WGReduce')}, DamageFactor={l.get('DamageFactor')}")


# ============================================================
# 4. Check v1 data for comparison
# ============================================================
print("\n" + "=" * 60)
print("4. V1 data for these characters")
print("=" * 60)

for char_id, name in [("2000107", "Ember"), ("2000069", "Hanbyul Lee"), ("2000111", "Bleu")]:
    p = CHAR_DATA / f"{char_id}.json"
    with open(p, "r", encoding="utf-8") as f:
        v1 = json.load(f)

    chain_v1 = v1.get("skills", {}).get("SKT_CHAIN_PASSIVE", {})
    s2_v1 = v1.get("skills", {}).get("SKT_SECOND", {})

    print(f"\n  {name} ({char_id}):")
    if char_id == "2000107":
        print(f"    dual_buff: {chain_v1.get('dual_buff')}")
        print(f"    dual_debuff: {chain_v1.get('dual_debuff')}")
    else:
        print(f"    S2 wgr: {s2_v1.get('wgr')}")
        print(f"    S2 name: {s2_v1.get('name')}")
