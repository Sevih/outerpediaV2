"""
Buff/Debuff Extractor - Extract and categorize buffs/debuffs from OUTERPLANE BuffTemplet

This module extracts buff and debuff identifiers from BuffID strings found in skill data.
It handles complex buff structures including:
- Multiple comma-separated BuffIDs
- Chained buffs (multiple identifiers per BuffID)
- Category-based classification (buff vs debuff)
- Caching for performance optimization

Buff Structure in BuffTemplet:
- BuffID: Unique identifier (e.g., "BT_STAT|ST_ATK")
- BuffCategory: Classification (e.g., "BC_GOOD", "BC_BAD")
- Level: Buff level (1-5 typically)
- ApplyingType: Effect type (e.g., "OAT_RATE", "OAT_ADD")

Classification Rules:
- Buffs (positive effects): BC_GOOD, BC_NEUTRAL
- Debuffs (negative effects): BC_BAD, BC_DEBUFF

Usage:
    from buff_extractor import BuffExtractor

    extractor = BuffExtractor()
    result = extractor.extract_from_buff_ids("BT_STAT|ST_ATK,BT_DMG")
    # Returns: {'buff': ['BT_STAT|ST_ATK', 'BT_DMG'], 'debuff': []}

Performance:
- BuffTemplet loaded once on initialization
- O(1) cache lookups for repeated BuffIDs
- Efficient for bulk character extraction

Author: ParserV3
Date: 2025-10
"""
from bytes_parser import Bytes_parser
from config import BYTES_FOLDER, EXPORT_FOLDER
import json

class BuffExtractor:
    """Extract buffs and debuffs from BuffTemplet data"""

    def __init__(self):
        # Load BuffTemplet once
        buff_parser = Bytes_parser(str(BYTES_FOLDER / "BuffTemplet.bytes"))
        self.all_buffs = buff_parser.get_data()

        # Load ignored effects list
        self.ignored_effects = self._load_ignored_effects()

        # Cache for BuffID lookups
        self._buff_cache = {}

    def _load_ignored_effects(self) -> set:
        """Load the list of ignored effects from JSON file"""
        ignored_file = EXPORT_FOLDER / "ignored_effects.json"
        if ignored_file.exists():
            try:
                with open(ignored_file, 'r', encoding='utf-8') as f:
                    return set(json.load(f))
            except Exception:
                return set()
        return set()

    def find_conditional_buffs(self, char_id: str, skill_num: str) -> list:
        """
        Find conditional buffs for a specific character skill.
        These are buffs with BuffCreateType like ON_SPAWN, SKILL_FINISH, etc.
        that are not directly referenced in skill BuffIDs.

        Args:
            char_id: Character ID (e.g., "2000067")
            skill_num: Skill number (e.g., "2" for SKT_SECOND)

        Returns:
            List of BuffIDs (e.g., ["2000067_2_5", "2000067_2_7"])
        """
        # Pattern: {char_id}_{skill_num}_*
        # Exclude: {char_id}_u_* (enemy versions)
        prefix = f"{char_id}_{skill_num}_"
        exclude_prefix = f"{char_id}_u_"

        conditional_buffs = []

        # BuffCreateType values that indicate conditional/automatic buffs
        conditional_types = ['ON_SPAWN', 'SKILL_FINISH', 'AVOID', 'ON_HIT', 'COUNTER_ATTACK']

        for buff in self.all_buffs:
            buff_id = buff.get('BuffID', '')

            # Skip if not matching pattern or is enemy version
            if not buff_id.startswith(prefix):
                continue
            if buff_id.startswith(exclude_prefix):
                continue

            # Check if it has a conditional BuffCreateType
            buff_create_type = buff.get('BuffCreateType', '')
            if buff_create_type in conditional_types:
                # Add only once (avoid duplicates from different levels)
                if buff_id not in conditional_buffs:
                    conditional_buffs.append(buff_id)

        return conditional_buffs

    def extract_from_buff_ids(self, buff_id_str: str) -> dict:
        """
        Extract buff/debuff lists from BuffID string (can be comma-separated)

        Returns:
            {
                'buff': [list of buff identifiers],
                'debuff': [list of debuff identifiers],
                'tags': [list of special tags like 'ignore-defense']
            }
        """
        if not buff_id_str or buff_id_str == '0':
            return {'buff': [], 'debuff': [], 'tags': []}

        # Split multiple BuffIDs
        buff_ids = [bid.strip() for bid in buff_id_str.split(',') if bid.strip()]

        buffs = []
        debuffs = []
        tags = []

        for buff_id in buff_ids:
            # Special case: HEAVY_STRIKE (already converted from "87" in character_extractor)
            if buff_id == 'HEAVY_STRIKE':
                if 'HEAVY_STRIKE' not in buffs:
                    buffs.append('HEAVY_STRIKE')
                continue

            # Get buff data (with caching)
            buff_entries = self._get_buff_entries(buff_id)

            if not buff_entries:
                continue

            # Use first entry (usually level 1)
            buff_data = buff_entries[0]

            # Extract identifiers and categories (can be multiple per buff)
            results_list = self._process_buff_data(buff_data)

            for result in results_list:
                if len(result) == 2:
                    # Normal buff/debuff: (identifier, is_buff)
                    identifier, is_buff = result
                    if identifier:
                        if is_buff:
                            if identifier not in buffs:
                                buffs.append(identifier)
                        else:
                            if identifier not in debuffs:
                                debuffs.append(identifier)
                elif len(result) == 3:
                    # Special tag: (identifier, is_buff, tag)
                    identifier, is_buff, tag = result
                    if tag and tag not in tags:
                        tags.append(tag)

        # Filter out ignored effects
        filtered_buffs = [b for b in buffs if b not in self.ignored_effects]
        filtered_debuffs = [d for d in debuffs if d not in self.ignored_effects]

        return {'buff': filtered_buffs, 'debuff': filtered_debuffs, 'tags': tags}

    def _get_buff_entries(self, buff_id: str) -> list:
        """Get all buff entries for a BuffID (with caching)"""
        if buff_id in self._buff_cache:
            return self._buff_cache[buff_id]

        entries = [b for b in self.all_buffs if b.get('BuffID') == buff_id]
        self._buff_cache[buff_id] = entries
        return entries

    def _process_buff_data(self, buff_data: dict) -> list:
        """
        Process a single buff entry and return list of (identifier, is_buff) tuples
        Can return multiple effects from a single buff entry

        Returns:
            [(identifier: str, is_buff: bool), ...] or [] if should be ignored
        """
        results = []
        buff_type = buff_data.get('Type', '')
        stat_type = buff_data.get('StatType', 'ST_NONE')
        buff_debuff_type = buff_data.get('BuffDebuffType', '').upper()
        target_type = buff_data.get('TargetType', '').upper()
        icon_name = buff_data.get('IconName', '')
        remove_effect = buff_data.get('RemoveEffect', '')
        buff_remove_type = buff_data.get('BuffRemoveType', '').upper()

        # RULE 0: Special case for inherent penetration (ST_PIERCE_POWER_RATE without icon)
        # This is a skill property, not a visible buff, so we convert it to a tag
        if (not icon_name and buff_remove_type == 'ON_SKILL_FINISH' and
            buff_type == 'BT_STAT' and stat_type == 'ST_PIERCE_POWER_RATE'):
            return [(None, True, 'ignore-defense')]

        # Note: Other effects without icon are allowed to pass through normally
        # We only special-case ST_PIERCE_POWER_RATE for now

        # RULE 1: Interruption buffs (irremovable) - use IconName
        if 'Interruption' in icon_name and icon_name.startswith('IG_'):
            # _Interruption_D suffix = debuff (negative effect with "D" marker)
            # _Interruption suffix (no _D) = buff (positive effect)
            is_buff = not icon_name.endswith('_D')
            results.append((icon_name, is_buff))

        # RULE 2: BT_STAT - combine with StatType
        if buff_type == 'BT_STAT' and stat_type != 'ST_NONE':
            identifier = f"{buff_type}|{stat_type}"

            # Determine if buff or debuff based on target
            # Allies (MY_TEAM, ME) = buff, Enemies (ENEMY) = debuff
            if target_type.startswith('MY_TEAM') or target_type.startswith('ME'):
                results.append((identifier, True))
            elif target_type.startswith('ENEMY'):
                results.append((identifier, False))
            else:
                # Fallback to BuffDebuffType
                is_buff = 'BUFF' in buff_debuff_type and 'DEBUFF' not in buff_debuff_type
                results.append((identifier, is_buff))

        # RULE 3: Check RemoveEffect for additional identifier (only for specific types)
        # Some buffs like BT_DMG_REDUCE use RemoveEffect as the actual identifier
        # But most of the time RemoveEffect is just a display label
        if remove_effect and remove_effect.startswith('SYS_BUFF_'):
            # Only use RemoveEffect for certain Type values where it's meaningful
            use_remove_effect_types = ['BT_DMG_REDUCE', 'BT_DMG_INCREASE', 'BT_HEAL_BASED_TARGET']

            if buff_type in use_remove_effect_types:
                # Remove SYS_BUFF_ prefix to get clean identifier
                alt_identifier = remove_effect.replace('SYS_BUFF_', '')

                # Special case: TURN_HEAL should be converted to BT_CONTINU_HEAL
                if alt_identifier == 'TURN_HEAL':
                    alt_identifier = 'BT_CONTINU_HEAL'

                # Determine if buff or debuff
                is_debuff = target_type.startswith('ENEMY') or 'DEBUFF' in buff_debuff_type
                results.append((alt_identifier, not is_debuff))

        # RULE 4: If no results yet, use Type directly
        if not results and buff_type:
            identifier = buff_type

            # Determine if buff or debuff
            # Priority: TargetType > BuffDebuffType
            # Exception: when TargetType=ME but BuffDebuffType says DEBUFF (e.g. BT_MARKING)
            if target_type:
                if target_type.startswith('MY_TEAM') or target_type.startswith('ME'):
                    # Check if BuffDebuffType overrides (e.g. DEBUFF_IGNORE_RESIST on ME)
                    if 'DEBUFF' in buff_debuff_type:
                        results.append((identifier, False))
                    else:
                        results.append((identifier, True))
                elif target_type.startswith('ENEMY'):
                    results.append((identifier, False))
                else:
                    # Unknown TargetType (e.g., NEXT_CHAIN_STRIKER) - fallback to BuffDebuffType
                    if 'BUFF' in buff_debuff_type and 'DEBUFF' not in buff_debuff_type:
                        results.append((identifier, True))
                    elif 'DEBUFF' in buff_debuff_type:
                        results.append((identifier, False))
            else:
                # No TargetType - fallback to BuffDebuffType
                if 'BUFF' in buff_debuff_type and 'DEBUFF' not in buff_debuff_type:
                    results.append((identifier, True))
                elif 'DEBUFF' in buff_debuff_type:
                    results.append((identifier, False))

        return results


if __name__ == "__main__":
    """Self-test using Alice's skills as validation"""
    import sys
    import io

    if hasattr(sys.stdout, 'buffer'):
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

    extractor = BuffExtractor()
    skill_level_parser = Bytes_parser(str(BYTES_FOLDER / "CharacterSkillLevelTemplet.bytes"))
    all_levels = skill_level_parser.get_data()

    # Alice test data (known-good extraction)
    # Format: (skill_id, expected_buffs, expected_debuffs, expected_tags)
    test_cases = [
        ('2001', ['BT_STAT|ST_AVOID'], [], []),
        ('2002', ['BT_ACTION_GAUGE'], ['BT_REMOVE_BUFF', 'BT_STAT|ST_BUFF_CHANCE', 'BT_STAT|ST_SPEED'], []),
        ('2003', [], ['BT_SEALED', 'IG_Buff_2000020_Interruption_D', 'DMG_REDUCE_RATE_DOWN'], []),
    ]

    print('BuffExtractor self-test (Alice)')
    all_pass = True

    for skill_id, exp_buffs, exp_debuffs, exp_tags in test_cases:
        levels = [l for l in all_levels if l.get('SkillID') == skill_id]
        if not levels:
            continue

        buff_id_str = levels[0].get('BuffID', '')
        result = extractor.extract_from_buff_ids(buff_id_str)

        match = (set(result['buff']) == set(exp_buffs) and
                 set(result['debuff']) == set(exp_debuffs) and
                 set(result.get('tags', [])) == set(exp_tags))
        status = '✅' if match else '❌'
        print(f'{status} Skill {skill_id}: {result}')

        if not match:
            all_pass = False

    sys.exit(0 if all_pass else 1)
