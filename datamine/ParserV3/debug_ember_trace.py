"""
Trace exactly what _extract_chain_dual_buffs does for Ember
"""

import json
import sys
import io
from config import BYTES_FOLDER
from cache_manager import CacheManager
from buff_extractor import BuffExtractor
from character_extractor import CharacterExtractor

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

# Replicate what _extract_chain_dual_buffs does
extractor = CharacterExtractor("2000107")

all_levels = extractor.skill_level_parser.get_data()

char_id = "2000107"
chain_buff_id = None
backup_buff_id = None

for level in all_levels:
    for key, value in level.items():
        if isinstance(value, str):
            if f"{char_id}_chain" in value:
                chain_buff_id = value.split(',')[0].strip()
            if f"{char_id}_backup" in value:
                backup_buff_id = value.split(',')[0].strip()
    if chain_buff_id and backup_buff_id:
        break

print(f"chain_buff_id: {chain_buff_id}")
print(f"backup_buff_id: {backup_buff_id}")

if backup_buff_id:
    result = extractor.buff_extractor.extract_from_buff_ids(backup_buff_id)
    print(f"backup result: {result}")

    # Trace the buff data
    buff_entries = extractor.buff_extractor._get_buff_entries(backup_buff_id)
    for entry in buff_entries:
        print(f"  Raw: BuffID={entry.get('BuffID')}, Type={entry.get('Type')}, BuffDebuffType={entry.get('BuffDebuffType')}, Target={entry.get('TargetType')}, Icon={entry.get('IconName')}")

# Now run full extraction and check
data = extractor.extract()
chain = data.get("skills", {}).get("SKT_CHAIN_PASSIVE", {})
print(f"\nFull extraction result:")
print(f"  buff: {chain.get('buff')}")
print(f"  debuff: {chain.get('debuff')}")
print(f"  dual_buff: {chain.get('dual_buff')}")
print(f"  dual_debuff: {chain.get('dual_debuff')}")

# Now check: what happens if we run another char first?
print("\n--- Running Lyla THEN Ember ---")
CharacterExtractor._parsers_cache = None  # Reset cache
CharacterExtractor._buff_extractor_cache = None
CharacterExtractor._mappings_cache = None

# Run Lyla first
ext_lyla = CharacterExtractor("2000095")
data_lyla = ext_lyla.extract()
lyla_chain = data_lyla.get("skills", {}).get("SKT_CHAIN_PASSIVE", {})
print(f"Lyla dual_buff: {lyla_chain.get('dual_buff')}")

# Then Ember
ext_ember = CharacterExtractor("2000107")
data_ember = ext_ember.extract()
ember_chain = data_ember.get("skills", {}).get("SKT_CHAIN_PASSIVE", {})
print(f"Ember dual_buff: {ember_chain.get('dual_buff')}")
print(f"Ember dual_debuff: {ember_chain.get('dual_debuff')}")
