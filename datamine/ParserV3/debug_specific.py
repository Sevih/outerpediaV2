"""
Debug specific extraction issues:
1. Ember BT_MARKING classification
2. Hanbyul Lee / Bleu wgr
3. Snow/Noa dual_buff backup_buff_id
"""

import json
import sys
import io
from config import BYTES_FOLDER
from cache_manager import CacheManager
from buff_extractor import BuffExtractor

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

cache = CacheManager(BYTES_FOLDER)
buff_extractor = BuffExtractor()

all_levels = cache.get_data("CharacterSkillLevelTemplet.bytes")
all_buffs = cache.get_data("BuffTemplet.bytes")
all_skills = cache.get_data("CharacterSkillTemplet.bytes")

# Index
buff_by_id = {}
for b in all_buffs:
    bid = b.get("BuffID", "")
    if bid:
        buff_by_id.setdefault(bid, []).append(b)

skill_index = {s.get('NameIDSymbol'): s for s in all_skills if s.get('NameIDSymbol')}


def find_backup_buff_id(char_id):
    """Find backup (dual) buff ID for a character"""
    for level in all_levels:
        for key, value in level.items():
            if isinstance(value, str) and f"{char_id}_backup" in value:
                return value.split(',')[0].strip()
    return None


# ============================================================
# 1. EMBER BT_MARKING
# ============================================================
print("=" * 60)
print("1. EMBER (2000107) dual_buff BT_MARKING investigation")
print("=" * 60)

ember_backup = find_backup_buff_id("2000107")
print(f"  Backup BuffID: {ember_backup}")

if ember_backup:
    result = buff_extractor.extract_from_buff_ids(ember_backup)
    print(f"  Extraction result: {result}")

    # Check the raw buff data
    entries = buff_by_id.get(ember_backup, [])
    for entry in entries:
        print(f"  Raw buff entry:")
        print(f"    Type: {entry.get('Type')}")
        print(f"    BuffDebuffType: {entry.get('BuffDebuffType')}")
        print(f"    TargetType: {entry.get('TargetType')}")
        print(f"    IconName: {entry.get('IconName')}")


# ============================================================
# 2. HANBYUL LEE (2000069) wgr
# ============================================================
print("\n" + "=" * 60)
print("2. HANBYUL LEE (2000069) SKT_SECOND wgr investigation")
print("=" * 60)

# Find Hanbyul Lee's S2 skill
char_data = cache.get_data("CharacterTemplet.bytes")
hanbyul = next((c for c in char_data if str(c.get("ID")) == "2000069"), None)
if hanbyul:
    s2_id = hanbyul.get("Skill2IDSymbol") or hanbyul.get("SkillIDSymbol_2")
    # Try to find the skill ID for S2
    all_char_skills = [s for s in all_skills if s.get('CharacterID') == '2000069' or s.get('CharacterID') == 2000069]
    print(f"  Character skills: {[s.get('NameIDSymbol') for s in all_char_skills]}")

    for skill in all_char_skills:
        name_id = skill.get('NameIDSymbol')
        stype = skill.get('SkillType')
        approach = skill.get('ApproachType', '')
        print(f"  Skill {name_id} ({stype}): ApproachType={approach}")

        if stype == 'SKT_SECOND':
            # Check skill level data
            levels = [l for l in all_levels if l.get('SkillID') == name_id]
            for l in levels[:3]:
                wg = l.get('WGReduce')
                desc_id = l.get('DescID')
                gain_cp = l.get('GainCP')
                print(f"    Level (DescID={desc_id}, GainCP={gain_cp}): WGReduce={wg}")

            # Check for fallback fields
            for key, value in skill.items():
                if 'fallback' in key.lower():
                    print(f"    Fallback: {key}={value}")


# ============================================================
# 3. BLEU (2000111) wgr
# ============================================================
print("\n" + "=" * 60)
print("3. BLEU (2000111) SKT_SECOND wgr investigation")
print("=" * 60)

bleu_skills = [s for s in all_skills if str(s.get('CharacterID')) == '2000111']
print(f"  Character skills: {[s.get('NameIDSymbol') for s in bleu_skills]}")

for skill in bleu_skills:
    name_id = skill.get('NameIDSymbol')
    stype = skill.get('SkillType')
    approach = skill.get('ApproachType', '')
    target = skill.get('TargetTeam', '')
    range_type = skill.get('RangeType', '')
    print(f"  Skill {name_id} ({stype}): ApproachType={approach}, TargetTeam={target}, Range={range_type}")

    if stype == 'SKT_SECOND':
        levels = [l for l in all_levels if l.get('SkillID') == name_id]
        for l in levels[:3]:
            wg = l.get('WGReduce')
            desc_id = l.get('DescID')
            gain_cp = l.get('GainCP')
            dmg_factor = l.get('DamageFactor')
            print(f"    Level (DescID={desc_id}, GainCP={gain_cp}, DmgFactor={dmg_factor}): WGReduce={wg}")

        for key, value in skill.items():
            if 'fallback' in key.lower():
                print(f"    Fallback: {key}={value}")


# ============================================================
# 4. SNOW (2000003) and NOA (2000037) dual_buff
# ============================================================
print("\n" + "=" * 60)
print("4. SNOW (2000003) and NOA (2000037) dual_buff investigation")
print("=" * 60)

for char_id, name in [("2000003", "Snow"), ("2000037", "Noa")]:
    backup = find_backup_buff_id(char_id)
    print(f"\n  {name} ({char_id}): backup_buff_id = {backup}")
    if backup:
        result = buff_extractor.extract_from_buff_ids(backup)
        print(f"    Extraction result: {result}")
        entries = buff_by_id.get(backup, [])
        for entry in entries:
            print(f"    Raw: Type={entry.get('Type')}, BuffDebuffType={entry.get('BuffDebuffType')}, Target={entry.get('TargetType')}, Icon={entry.get('IconName')}")
    else:
        print(f"    No backup buff found - dual_buff should be absent or empty")
