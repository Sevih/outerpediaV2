"""
BossFinder V2 - Simplified and more direct approach
Search flow:
1. Search TextCharacter for the boss name -> get IDSymbol (e.g., "4004005_Name")
2. Search MonsterTemplet for NameIDSymbol or FirstMeetIDSymbol matching that IDSymbol
3. Return only exact matches (no ModelID grouping)
"""

import logging
import re
from typing import List, Dict, Any, Optional
from cache_manager import CacheManager

logger = logging.getLogger(__name__)


class BossFinderV2:
    """Simplified boss search - exact name matching only"""

    # Language mapping: short codes to full column names
    LANG_MAP = {
        'en': 'English',
        'kr': 'Korean',
        'jp': 'Japanese',
        'zh': 'China_Simplified'
    }

    # Dungeon Mode mapping to text keys
    DUNGEON_MODE_MAP = {
        'DM_ADVENTURE_CHALLENGE': 'SYS_ADVENTURE_CHALLENGE',
        'DM_ADVENTURE_MISSION': 'SYS_ADVENTURE_LICENSE',
        'DM_CHAR_PIECE': 'SYS_PIECE_DUNGEON',
        'DM_DAYOFWEEK': 'SYS_DAYOFWEEK_DUNGEON',
        'DM_EVENT': 'SYS_EVENT',
        'DM_EVENT_BOSS': '',  # No mapping found
        'DM_EVENT_CHALLENGE': 'SYS_EVENT_BOSS_CHALLENGE',
        'DM_EXP': 'SYS_EXP_DUNGEON',
        'DM_EXPLORATION_MAIN_BOSS': 'SYS_RUIN_ISLAND_EXPLORATION',
        'DM_EXPLORATION_NORMAL': 'SYS_RUIN_ISLAND_EXPLORATION',
        'DM_EXPLORATION_SPOT_BOSS': 'SYS_RUIN_ISLAND_EXPLORATION',
        'DM_GOLD': 'SYS_GOLD_DUNGEON',
        'DM_GUILD_DUNGEON': 'SYS_GUILD_DUNGEON_TITLE',
        'DM_GUILD_RAID_MAIN_BOSS': 'SYS_GUILD_RAID_TITLE',
        'DM_GUILD_RAID_SUB_BOSS': 'SYS_GUILD_RAID_TITLE',
        'DM_IRREGULAR_CHASE': 'SYS_GUIDE_IRREGULAR_CHASE_TITLE',
        'DM_IRREGULAR_INFILTRATE': 'SYS_GUIDE_IRREGULAR_INVADE_TITLE',
        'DM_IVANEZ_DUNGEON': 'SYS_IVANEZ_FESTIVAL',
        'DM_MONAD_BATTLE_1': 'SYS_MONAD_GATE',
        'DM_NORMAL': 'SYS_ADVENTURE_NORMAL',  # Dynamic: SYS_ADVENTURE_HARD if area ShortNameIDSymbol contains '_HARD_'
        'DM_RAID_1': 'SYS_RAID_1_TITLE',
        'DM_RAID_2': 'SYS_RAID_2_TITLE',
        'DM_REMAINS': 'SYS_PVE_REMAINS',
        'DM_SIDESTORY': 'SYS_GUIDE_MENU_SIDESTORY',
        'DM_TOWER': 'SYS_PVE_TOWER',
        'DM_TOWER_ELEMENT': 'SYS_PVE_TOWER_ELEMENTAL',
        'DM_TOWER_HARD': 'SYS_CONTENS_LOCK_PVE_TOWER_HARD',
        'DM_TOWER_VERY_HARD': 'SYS_INFINITE_DUNGEON_V_HARD_01',  # TODO: clean floor/number from text
        'DM_TUTORIAL': 'SYS_CONTENS_LOCK_EVA_BATTLE_TUTORIAL',
        'DM_WORLD_BOSS': 'SYS_WORLD_BOSS'
    }

    # Class mapping
    CLASS_MAP = {
        'CCT_ATTACKER': 'Striker',
        'CCT_DEFENDER': 'Defender',
        'CCT_RANGER': 'Ranger',
        'CCT_MAGE': 'Mage',
        'CCT_PRIEST': 'Healer'
    }

    @staticmethod
    def _format_element(element: str) -> str:
        """Format element by removing CET_ prefix and capitalizing

        Args:
            element: Element code (e.g., "CET_FIRE")

        Returns:
            Formatted element (e.g., "Fire")
        """
        if not element:
            return ''
        # Remove CET_ prefix
        if element.startswith('CET_'):
            element = element[4:]
        # Capitalize first letter, lowercase rest
        return element.capitalize()

    def _get_dungeon_mode_text(self, dungeon_mode: str, area_info: Optional[Dict]) -> str:
        """Get the mapped text key for a dungeon mode

        Args:
            dungeon_mode: DungeonMode code (e.g., "DM_NORMAL")
            area_info: Area information dict (can be None)

        Returns:
            Mapped text key (e.g., "SYS_ADVENTURE_HARD")
        """
        # Special case for DM_NORMAL: check area's ShortNameIDSymbol
        if dungeon_mode == 'DM_NORMAL' and area_info:
            short_name_symbol = area_info.get('short_name_symbol', '')
            if '_HARD_' in short_name_symbol:
                return 'SYS_ADVENTURE_HARD'
            else:
                return 'SYS_ADVENTURE_NORMAL'

        # Default mapping
        return self.DUNGEON_MODE_MAP.get(dungeon_mode, dungeon_mode)

    def __init__(self, bytes_folder):
        self.bytes_folder = bytes_folder
        self.cache = CacheManager(bytes_folder)
        self._system_text_cache = None
        self._system_text_index = None
        self._buff_index = None

    def _get_system_text_index(self) -> Dict[str, Dict]:
        """Load and cache system text data (TextSystem.bytes)"""
        if self._system_text_index is None:
            system_text_data = self.cache.get_data("TextSystem.bytes")
            self._system_text_index = {}
            for entry in system_text_data:
                id_symbol = entry.get('IDSymbol', '')
                if id_symbol:
                    self._system_text_index[id_symbol] = entry
        return self._system_text_index

    def _get_localized_text(self, text_key: str, text_index: Dict[str, Dict]) -> Dict[str, str]:
        """Get localized text for a given key

        Args:
            text_key: The text key to look up (e.g., "SYS_ADVENTURE_NORMAL", "SYS_DUNGEON_NAME_130212")
            text_index: The text index to search in

        Returns:
            Dict with all languages {'en': ..., 'kr': ..., 'jp': ..., 'zh': ...}
        """
        if not text_key:
            return {'en': '', 'kr': '', 'jp': '', 'zh': ''}

        text_entry = text_index.get(text_key, {})
        return {
            'en': text_entry.get('English', text_key),
            'kr': text_entry.get('Korean', ''),
            'jp': text_entry.get('Japanese', ''),
            'zh': text_entry.get('China_Simplified', '')
        }

    def _convert_lang_keys(self, lang_dict: Dict[str, str]) -> Dict[str, str]:
        """Convert language dictionary from full names to short codes"""
        result = {}
        for short_code, full_name in self.LANG_MAP.items():
            result[short_code] = lang_dict.get(full_name, '')
        return result

    def _get_buff_index(self) -> Dict[str, Dict]:
        """Load and cache buff data (BuffTemplet.bytes)"""
        if self._buff_index is None:
            buff_data = self.cache.get_data("BuffTemplet.bytes")
            self._buff_index = {b.get('BuffID'): b for b in buff_data if b.get('BuffID')}
        return self._buff_index

    def _replace_skill_placeholders(self, description: str, lang: str = 'en') -> str:
        """Replace skill description placeholders with actual values from BuffTemplet

        Placeholders format: [Buff_{TYPE}_{BuffID}]
        - TYPE: V (Value), C (CreateRate), T (TurnDuration)
        - BuffID: e.g., 4500154_1_1

        Examples:
        - [Buff_V_4500154_1_1] → "30%" (Value=300, ApplyingType=OAT_RATE, divided by 10)
        - [Buff_V_4076006_15_1] → "2" (Value=2, ApplyingType=OAT_ADD, not divided)
        - [Buff_C_4500154_2_1] → "100%" (CreateRate=1000, divided by 10)
        - [Buff_T_4076007_1_3] → "2" (TurnDuration=2, no division)

        Args:
            description: The description text to process
            lang: Language code ('en', 'kr', 'jp', 'zh') - for English, negative values have minus sign removed
        """
        if not description:
            return description

        # Load BuffTemplet data (cached)
        buff_index = self._get_buff_index()

        # Find all placeholders: [Buff_X_YYYY]
        pattern = r'\[Buff_([CVT])_([\w_]+)\]'

        def replace_placeholder(match):
            field_type = match.group(1)  # 'V', 'C', or 'T'
            buff_id = match.group(2)      # e.g., '4500154_1_1'

            # Find buff in BuffTemplet
            buff = buff_index.get(buff_id)
            if not buff:
                return match.group(0)  # Return original if not found

            # Get the appropriate field value based on type
            if field_type == 'V':
                field_name = 'Value'
            elif field_type == 'C':
                field_name = 'CreateRate'
            else:  # field_type == 'T'
                field_name = 'TurnDuration'

            value = buff.get(field_name, '')

            if not value:
                return match.group(0)  # Return original if no value

            # Convert and format value
            try:
                num_value = float(value)

                # For English, use absolute value (remove minus sign)
                if lang == 'en':
                    num_value = abs(num_value)

                # TurnDuration is not divided, others are divided by 10 for percentage
                if field_type == 'T':
                    # Return as integer (no percentage sign)
                    return str(int(num_value))
                elif field_type == 'V':
                    # For Value, check ApplyingType to determine if it's a percentage or absolute value
                    applying_type = buff.get('ApplyingType', '')
                    if applying_type == 'OAT_RATE':
                        # It's a rate/percentage - divide by 10 and add %
                        percentage = num_value / 10
                        if percentage == int(percentage):
                            return f"{int(percentage)}%"
                        else:
                            return f"{percentage}%"
                    else:
                        # It's an absolute value (OAT_ADD or other) - don't divide, no %
                        return str(int(num_value))
                else:
                    # CreateRate (field_type == 'C') - always divide by 10 for percentage
                    percentage = num_value / 10
                    # Format: remove trailing .0 if whole number
                    if percentage == int(percentage):
                        return f"{int(percentage)}%"
                    else:
                        return f"{percentage}%"
            except (ValueError, TypeError):
                return match.group(0)  # Return original if conversion fails

        # Replace all placeholders
        result = re.sub(pattern, replace_placeholder, description)
        return result

    def search_boss_by_name(self, search_name: str) -> List[Dict[str, Any]]:
        """
        Search for bosses by exact name match.

        Flow:
        1. Search TextCharacter for the boss name
        2. Get matching IDSymbols (e.g., "4004005_Name")
        3. Search MonsterTemplet for monsters with matching NameIDSymbol or FirstMeetIDSymbol
        4. Get spawn and dungeon info for each monster

        Args:
            search_name: Boss name to search for (e.g., "Betrayed Deshret")

        Returns:
            List of matching boss results
        """
        logger.info(f"Searching for boss: {search_name}")

        # Load data
        text_char_data = self.cache.get_data("TextCharacter.bytes")
        text_skill_data = self.cache.get_data("TextSkill.bytes")
        monster_data = self.cache.get_data("MonsterTemplet.bytes")
        spawn_data = self.cache.get_data("DungeonSpawnTemplet.bytes")
        dungeon_data = self.cache.get_data("DungeonTemplet.bytes")
        area_data = self.cache.get_data("AreaTemplet.bytes")
        skill_data = self.cache.get_data("MonsterSkillTemplet.bytes")

        # Step 1: Find IDSymbols in TextCharacter that match the search name
        search_name_lower = search_name.lower()
        matching_id_symbols = []

        for text_entry in text_char_data:
            english_text = text_entry.get('English', '').lower()
            if search_name_lower in english_text:
                id_symbol = text_entry.get('IDSymbol', '')
                if id_symbol:
                    matching_id_symbols.append(id_symbol)
                    logger.info(f"Found matching IDSymbol: {id_symbol} -> {text_entry.get('English')}")

        if not matching_id_symbols:
            logger.info("No matching IDSymbols found in TextCharacter")
            return []

        # Build text indexes for multilingual support
        text_index = {t.get('IDSymbol'): t for t in text_char_data if t.get('IDSymbol')}
        text_skill_index = {t.get('IDSymbol'): t for t in text_skill_data if t.get('IDSymbol')}

        # Step 2: Find monsters with matching NameIDSymbol or FirstMeetIDSymbol
        matching_monsters = []
        for monster in monster_data:
            name_id_symbol = monster.get('NameIDSymbol', '')
            first_meet_id_symbol = monster.get('FirstMeetIDSymbol', '')

            if name_id_symbol in matching_id_symbols or first_meet_id_symbol in matching_id_symbols:
                matching_monsters.append(monster)
                logger.info(f"Found matching monster: ID={monster.get('ID')}, NameIDSymbol={name_id_symbol}, FirstMeetIDSymbol={first_meet_id_symbol}")

        if not matching_monsters:
            logger.info("No matching monsters found in MonsterTemplet")
            return []

        # Step 3: Build spawn index
        monster_spawns = self._build_spawn_index(spawn_data)

        # Step 4: Build dungeon mapping
        dungeon_mapping = self._build_dungeon_mapping(dungeon_data)

        # Step 4b: Build World Boss League mapping (HPLineCount -> LeagueName)
        world_boss_league_mapping = self._build_world_boss_league_mapping()

        # Step 5: Build skill index
        skill_index = self._build_skill_index(skill_data, text_skill_index)

        # Step 6: Match monsters with their spawns and dungeons
        results = []
        for monster in matching_monsters:
            monster_id = monster.get('ID', '')
            model_id = monster.get('FaceIconID', '')

            # Get monster names (both English for display and multilingual dicts for JSON)
            name_en, nickname_en, name_dict, nickname_dict = self._get_monster_names(monster, text_index)

            # Get monster skills
            skills = self._get_monster_skills(monster, skill_index)

            # Find spawns for this monster
            found_spawn = False
            for spawn_entry in monster_spawns:
                if spawn_entry['monster_id'] == monster_id:
                    found_spawn = True
                    spawn_id = spawn_entry['spawn_id']
                    dungeon_ref = spawn_entry['dungeon_ref']

                    # Get dungeons for this spawn using the dungeon reference
                    dungeons = []
                    if dungeon_ref:
                        dungeons = dungeon_mapping.get(dungeon_ref, [])

                    # Create result for each dungeon (or one with empty dungeon)
                    if not dungeons:
                        dungeons = [{}]

                    for dungeon_info in dungeons:
                        # Get area info if dungeon has AreaID
                        area_info = None
                        if dungeon_info and dungeon_info.get('AreaID'):
                            area_info = self._get_area_info(dungeon_info.get('AreaID'), area_data)

                        # Get World Boss League name if applicable
                        world_boss_league = None
                        if dungeon_ref and dungeon_ref[0] == 'HPLineCount':
                            hp_line = dungeon_ref[1]
                            world_boss_league = world_boss_league_mapping.get(hp_line)

                        results.append({
                            'monster': monster,
                            'monster_id': monster_id,
                            'model_id': model_id,
                            'name': name_en,
                            'nickname': nickname_en,
                            'name_dict': name_dict,
                            'nickname_dict': nickname_dict,
                            'spawn_id': spawn_id,
                            'spawn_level': spawn_entry['level'],
                            'dungeon_ref': dungeon_ref,
                            'dungeon': dungeon_info,
                            'area': area_info,
                            'skills': skills,
                            'world_boss_league': world_boss_league
                        })

            # If no spawn found, still add the monster
            if not found_spawn:
                results.append({
                    'monster': monster,
                    'monster_id': monster_id,
                    'model_id': model_id,
                    'name': name_en,
                    'nickname': nickname_en,
                    'name_dict': name_dict,
                    'nickname_dict': nickname_dict,
                    'spawn_id': '',
                    'spawn_level': 0,
                    'dungeon_ref': None,
                    'dungeon': {},
                    'area': None,
                    'skills': skills,
                    'world_boss_league': None
                })

        logger.info(f"Found {len(results)} total results")
        return results

    def _get_monster_names(self, monster: Dict, text_index: Dict[str, Dict]) -> tuple:
        """Extract monster name and nickname from text data

        Returns:
            tuple: (name_en, nickname_en, name_dict, nickname_dict)
                - name_en: English name for display
                - nickname_en: English nickname for display
                - name_dict: Dict with all languages {'en': ..., 'kr': ..., 'jp': ..., 'zh': ...}
                - nickname_dict: Dict with all languages or None
        """
        name_id_symbol = monster.get('NameIDSymbol', '')
        first_meet_id_symbol = monster.get('FirstMeetIDSymbol', '')
        monster_id = monster.get('ID', '')

        nickname_en = ''
        name_en = ''
        name_dict = {'en': '', 'kr': '', 'jp': '', 'zh': ''}
        nickname_dict = None

        if name_id_symbol:
            name_text = text_index.get(name_id_symbol, {})
            name_en = name_text.get('English', f'Monster_{monster_id}')
            name_dict = {
                'en': name_text.get('English', f'Monster_{monster_id}'),
                'kr': name_text.get('Korean', ''),
                'jp': name_text.get('Japanese', ''),
                'zh': name_text.get('China_Simplified', '')
            }
            if first_meet_id_symbol:
                nickname_text = text_index.get(first_meet_id_symbol, {})
                nickname_en = nickname_text.get('English', '')
                if nickname_en:  # Only create dict if nickname exists
                    nickname_dict = {
                        'en': nickname_text.get('English', ''),
                        'kr': nickname_text.get('Korean', ''),
                        'jp': nickname_text.get('Japanese', ''),
                        'zh': nickname_text.get('China_Simplified', '')
                    }
        else:
            if first_meet_id_symbol:
                name_text = text_index.get(first_meet_id_symbol, {})
                name_en = name_text.get('English', f'Monster_{monster_id}')
                name_dict = {
                    'en': name_text.get('English', f'Monster_{monster_id}'),
                    'kr': name_text.get('Korean', ''),
                    'jp': name_text.get('Japanese', ''),
                    'zh': name_text.get('China_Simplified', '')
                }

        return name_en, nickname_en, name_dict, nickname_dict

    def _get_area_info(self, area_id: str, area_data: List[Dict]) -> Optional[Dict]:
        """Get area information from AreaID

        Args:
            area_id: AreaID from dungeon (e.g., "42")
            area_data: List of area entries

        Returns:
            Dict with area info or None
        """
        if not area_id:
            return None

        for area in area_data:
            if area.get('SeasonID') == str(area_id):
                return {
                    'season_id': area.get('SeasonID'),
                    'short_name_symbol': area.get('ShortNameIDSymbol'),
                    'name_symbol': area.get('RewardIDList'),  # Actually the area name
                    'episode': area.get('EpisodeNum'),
                    'bg_image': area.get('BGImage')
                }

        return None

    def _get_monster_skills(self, monster: Dict, skill_index: Dict[str, Dict]) -> List[Dict]:
        """Extract skills from monster and get their detailed info

        Args:
            monster: Monster entry
            skill_index: Skill index mapping skill IDs to info

        Returns:
            List of skill info dicts
        """
        skills = []

        # Check all Skill_X fields (Skill_1 to Skill_30)
        for i in range(1, 31):
            skill_id = monster.get(f'Skill_{i}', '')
            if skill_id and skill_id in skill_index:
                skill_info = skill_index[skill_id].copy()
                skill_info['slot'] = f'Skill_{i}'
                skills.append(skill_info)

        # Check UseEntryJIggleBone field
        entry_skill_id = monster.get('UseEntryJIggleBone', '')
        if entry_skill_id and entry_skill_id in skill_index:
            skill_info = skill_index[entry_skill_id].copy()
            skill_info['slot'] = 'UseEntryJIggleBone'
            skills.append(skill_info)

        # Check UseEntryJIggleBone field
        entry_skill_id = monster.get('PushUp', '')
        if entry_skill_id and entry_skill_id in skill_index:
            skill_info = skill_index[entry_skill_id].copy()
            skill_info['slot'] = 'PushUp'
            skills.append(skill_info)

        return skills

    def _build_skill_index(self, skill_data: List[Dict], text_index: Dict[str, Dict]) -> Dict[str, Dict]:
        """Build skill index mapping skill IDs to their info

        Args:
            skill_data: List of skill entries from MonsterSkillTemplet
            text_index: Text index for translations

        Returns:
            Dict mapping skill ID (NameIDSymbol) to skill info
        """
        skill_index = {}

        for skill in skill_data:
            skill_id = skill.get('NameIDSymbol', '')
            if not skill_id:
                continue

            # Get skill name and description from text index
            name_id = skill.get('SkipNameID', '')
            desc_id = skill.get('DescID', '')

            skill_info = {
                'id': skill_id,
                'name_id': name_id,
                'desc_id': desc_id,
                'icon_name': skill.get('IconName', ''),
                'skill_type': skill.get('SkillType', ''),
                'skill_sub_type': skill.get('SkillSubType', ''),
                'target_team': skill.get('TargetTeamType', ''),
                'range_type': skill.get('RangeType', ''),
                'focus_type': skill.get('FocusType', '')
            }

            # Get multilingual name and description
            if name_id:
                name_text = text_index.get(name_id, {})
                skill_info['name'] = {
                    'en': name_text.get('English', ''),
                    'kr': name_text.get('Korean', ''),
                    'jp': name_text.get('Japanese', ''),
                    'zh': name_text.get('China_Simplified', '')
                }
            else:
                skill_info['name'] = {'en': '', 'kr': '', 'jp': '', 'zh': ''}

            if desc_id:
                desc_text = text_index.get(desc_id, {})
                skill_info['description'] = {
                    'en': self._replace_skill_placeholders(desc_text.get('English', ''), 'en'),
                    'kr': self._replace_skill_placeholders(desc_text.get('Korean', ''), 'kr'),
                    'jp': self._replace_skill_placeholders(desc_text.get('Japanese', ''), 'jp'),
                    'zh': self._replace_skill_placeholders(desc_text.get('China_Simplified', ''), 'zh')
                }
            else:
                skill_info['description'] = {'en': '', 'kr': '', 'jp': '', 'zh': ''}

            skill_index[skill_id] = skill_info

        return skill_index

    def _build_spawn_index(self, spawn_data: List[Dict]) -> List[Dict]:
        """Build spawn index mapping monsters to their spawns and levels

        Searches in both Monster0-Monster9 AND ID0-ID9 fields
        Uses smart dungeon ID selection based on which IDs are populated
        """
        monster_spawns = []

        for spawn in spawn_data:
            spawn_id = spawn.get('ID', '')
            hp_line = spawn.get('HPLineCount', '')

            # Get the level for this spawn
            spawn_level = spawn.get('GroupID', spawn.get('Level0', '0'))
            try:
                spawn_level_int = int(spawn_level) if spawn_level else 0
            except (ValueError, TypeError):
                spawn_level_int = 0

            # Smart dungeon ID selection:
            # - If HPLineCount exists, use it
            # - Otherwise, use the lowest populated ID (ID0 > ID1 > ID2)
            # - ID3 is typically the boss itself, not the dungeon reference
            dungeon_ref = None
            if hp_line:
                dungeon_ref = ('HPLineCount', hp_line)
            else:
                # Check ID0, ID1, ID2 in order (lowest first)
                for i in range(3):
                    id_val = spawn.get(f'ID{i}', '')
                    if id_val:
                        dungeon_ref = (f'ID{i}', id_val)
                        break

            # Track which monster IDs we've already added to avoid duplicates
            added_monsters = set()

            # Check Monster0-Monster9 for monster IDs
            for i in range(10):
                monster_id = spawn.get(f'Monster{i}', '')
                if monster_id and monster_id not in added_monsters:
                    monster_spawns.append({
                        'monster_id': monster_id,
                        'spawn_id': spawn_id,
                        'level': spawn_level_int,
                        'dungeon_ref': dungeon_ref,  # (type, value) tuple
                        'spawn_data': spawn  # Keep full spawn for later use
                    })
                    added_monsters.add(monster_id)

            # Also check ID0-ID9 for monster IDs (some bosses are here)
            for i in range(10):
                monster_id = spawn.get(f'ID{i}', '')
                if monster_id and monster_id not in added_monsters:
                    monster_spawns.append({
                        'monster_id': monster_id,
                        'spawn_id': spawn_id,
                        'level': spawn_level_int,
                        'dungeon_ref': dungeon_ref,  # (type, value) tuple
                        'spawn_data': spawn  # Keep full spawn for later use
                    })
                    added_monsters.add(monster_id)

        return monster_spawns

    def _build_world_boss_league_mapping(self) -> Dict[str, str]:
        """Build mapping from HPLineCount (spawn ID) to World Boss League name

        Returns a dict like:
        - '551000021' -> 'SYS_WORLD_BOSS_LEAGUE_NEW_2'
        - '551000032' -> 'SYS_WORLD_BOSS_LEAGUE_NEW_3'

        Note: Prefers NEW_ leagues over old leagues when both exist for same spawn ID
        """
        world_boss_data = self.cache.get_data('WorldBossLeagueTemplet.bytes')

        # Build mapping, preferring NEW_ leagues
        league_mapping = {}

        for wb_entry in world_boss_data:
            change_spawn = wb_entry.get('ChangeSpawnGroupID', '')
            league_name = wb_entry.get('LeagueName', '')

            if not change_spawn or not league_name:
                continue

            # Parse comma-separated spawn IDs
            spawn_ids = [s.strip() for s in str(change_spawn).split(',')]
            for spawn_id in spawn_ids:
                if spawn_id:
                    # Prefer NEW_ leagues over old leagues
                    existing = league_mapping.get(spawn_id, '')
                    if not existing or ('_NEW_' in league_name and '_NEW_' not in existing):
                        league_mapping[spawn_id] = league_name

        return league_mapping

    def _build_dungeon_mapping(self, dungeon_data: List[Dict]) -> Dict[tuple, List[Dict]]:
        """Build dungeon reference mapping

        Returns a dict with keys like:
        - ('HPLineCount', '701010011') -> [dungeon1, ...]
        - ('ID0', '401010011') -> [dungeon1, ...]
        - ('ID1', '10000001') -> [dungeon1, ...]
        - ('ID2', '1302123') -> [dungeon1, ...]

        Also maps HPLineCount values to SpawnID_Pos since sometimes
        what looks like an HPLineCount is actually a SpawnID
        """
        dungeon_mapping = {}

        for dungeon in dungeon_data:
            # Map HPLineCount0-HPLineCount9
            for i in range(10):
                hp_line = dungeon.get(f'HPLineCount{i}', '')
                if hp_line:
                    key = ('HPLineCount', hp_line)
                    if key not in dungeon_mapping:
                        dungeon_mapping[key] = []
                    dungeon_mapping[key].append(dungeon)

            # Map ALL SpawnID_Pos0-Pos9 to ALL ID0-ID2
            # The spawn's ID0/ID1/ID2 can appear in ANY SpawnID_Pos position
            # Example: spawn has ID0=1319053, but dungeon has it in SpawnID_Pos2
            for pos in range(10):  # Check all positions
                spawn_pos = dungeon.get(f'SpawnID_Pos{pos}', '')
                if spawn_pos:
                    # Map to all ID types (ID0, ID1, ID2)
                    for id_type in ['ID0', 'ID1', 'ID2']:
                        key = (id_type, spawn_pos)
                        if key not in dungeon_mapping:
                            dungeon_mapping[key] = []
                        dungeon_mapping[key].append(dungeon)

                    # ALSO map as HPLineCount -> spawn_pos
                    # Because sometimes HPLineCount field contains a SpawnID
                    key_hp = ('HPLineCount', spawn_pos)
                    if key_hp not in dungeon_mapping:
                        dungeon_mapping[key_hp] = []
                    dungeon_mapping[key_hp].append(dungeon)

            # Map SpawnAdvantageRate_Spd (used by DM_IRREGULAR_INFILTRATE)
            # This field can contain spawn IDs (sometimes multiple, comma-separated)
            spawn_adv_spd = dungeon.get('SpawnAdvantageRate_Spd', '')
            if spawn_adv_spd and spawn_adv_spd not in ['False', 'TRUE']:
                # Some dungeons have multiple spawn IDs comma-separated
                spawn_ids = [s.strip() for s in str(spawn_adv_spd).split(',')]
                for spawn_id in spawn_ids:
                    if spawn_id and not spawn_id.startswith('-'):  # Skip negative values (actual speed stats)
                        # Map as HPLineCount -> spawn_id
                        key = ('HPLineCount', spawn_id)
                        if key not in dungeon_mapping:
                            dungeon_mapping[key] = []
                        dungeon_mapping[key].append(dungeon)

            # Map StoryTeamSpawn_fallback1 (used by DM_ADVENTURE_MISSION)
            # This field contains spawn IDs for weekly/challenge dungeons
            story_team_spawn_fb = dungeon.get('StoryTeamSpawn_fallback1', '')
            if story_team_spawn_fb and story_team_spawn_fb not in ['False', 'TRUE', 'FALSE']:
                # Check if it's a spawn ID (7+ digits)
                if len(str(story_team_spawn_fb)) >= 7 and ',' not in str(story_team_spawn_fb):
                    key = ('HPLineCount', story_team_spawn_fb)
                    if key not in dungeon_mapping:
                        dungeon_mapping[key] = []
                    dungeon_mapping[key].append(dungeon)

        # === World Boss League mapping ===
        # Some World Boss levels (e.g., Lv90, Lv110) have their spawn IDs only in
        # WorldBossLeagueTemplet.ChangeSpawnGroupID, not in DungeonTemplet.SpawnID_Pos
        # We need to map these spawn IDs to their corresponding dungeons
        world_boss_data = self.cache.get_data('WorldBossLeagueTemplet.bytes')

        # Build FriendSupportUse -> dungeon mapping for quick lookup
        fsu_to_dungeon = {}
        for dungeon in dungeon_data:
            fsu = dungeon.get('FriendSupportUse', '')
            if fsu and dungeon.get('DungeonMode') == 'DM_WORLD_BOSS':
                fsu_to_dungeon[fsu] = dungeon

        # Map ChangeSpawnGroupID spawn IDs to their dungeons
        for wb_entry in world_boss_data:
            change_spawn = wb_entry.get('ChangeSpawnGroupID', '')
            dungeon_id = wb_entry.get('DungeonID', '')

            if not change_spawn or not dungeon_id:
                continue

            # Find the dungeon by DungeonID (matches FriendSupportUse in DungeonTemplet)
            dungeon = fsu_to_dungeon.get(dungeon_id)
            if not dungeon:
                continue

            # Parse comma-separated spawn IDs
            spawn_ids = [s.strip() for s in str(change_spawn).split(',')]
            for spawn_id in spawn_ids:
                if spawn_id:
                    key = ('HPLineCount', spawn_id)
                    if key not in dungeon_mapping:
                        dungeon_mapping[key] = []
                    # Avoid duplicates
                    if dungeon not in dungeon_mapping[key]:
                        dungeon_mapping[key].append(dungeon)

        return dungeon_mapping

    def format_results_json(self, results: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Format results as JSON for export"""
        if not results:
            return []

        # Load system text for translations
        system_text_index = self._get_system_text_index()

        json_results = []

        for result in results:
            monster = result['monster']
            dungeon = result.get('dungeon', {})
            area = result.get('area')
            skills = result.get('skills', [])
            world_boss_league = result.get('world_boss_league')

            # Build location info
            dungeon_name = dungeon.get('SeasonFullName', '')
            dungeon_mode = dungeon.get('DungeonMode', '')
            dungeon_short_name = dungeon.get('FriendSupportUse', '')

            # For World Boss, use League name instead of SeasonFullName
            if world_boss_league and dungeon_mode == 'DM_WORLD_BOSS':
                dungeon_name_localized = self._get_localized_text(world_boss_league, system_text_index)
            else:
                # Get localized dungeon name
                dungeon_name_localized = self._get_localized_text(dungeon_name, system_text_index)

            # Get localized mode text (with dynamic DM_NORMAL handling)
            mode_text_key = self._get_dungeon_mode_text(dungeon_mode, area)
            mode_localized = self._get_localized_text(mode_text_key, system_text_index)

            # Get localized area_id (Short Name from dungeon if exists, else null)
            area_id_localized = None
            if dungeon_short_name:
                area_id_localized = self._get_localized_text(dungeon_short_name, system_text_index)

            # Format skills for JSON
            skills_json = []
            for skill in skills:
                skill_data = {
                    'name': skill.get('name', {'en': '', 'kr': '', 'jp': '', 'zh': ''}),
                    'type': skill.get('skill_type', ''),
                    'description': skill.get('description', {'en': '', 'kr': '', 'jp': '', 'zh': ''}),
                    'icon': skill.get('icon_name', '')
                }
                skills_json.append(skill_data)

            boss_data = {
                'id': result['monster_id'],
                'Name': result['name_dict'],
                'Surname': result['nickname_dict'],
                'IncludeSurname': False,
                'class': self.CLASS_MAP.get(monster.get('Class', ''), monster.get('Class', '')),
                'element': self._format_element(monster.get('Element', '')),
                'level': result['spawn_level'],
                'icons': result['model_id'],
                'BuffImmune': monster.get('BuffImmune', ''),
                'StatBuffImmune': monster.get('StatBuffImmune', ''),
                'location': {
                    'dungeon': dungeon_name_localized,
                    'mode': mode_localized,
                    'area_id': area_id_localized
                },
                'skills': skills_json
            }

            json_results.append(boss_data)

        return json_results

    def format_results_text(self, results: List[Dict[str, Any]]) -> str:
        """Format results as readable text with ALL collected data"""
        if not results:
            return "No results found"

        # Generate JSON output first
        json_output = self.format_results_json(results)
        import json
        json_str = json.dumps(json_output, indent=2, ensure_ascii=False)

        output = []
        output.append("=== JSON OUTPUT ===")
        output.append(json_str)
        output.append("\n" + "="*80 + "\n")
        output.append(f"=== Found {len(results)} result(s) ===\n")

        for idx, result in enumerate(results, 1):
            monster = result['monster']
            dungeon = result.get('dungeon', {})

            output.append(f"\n{'='*80}")
            output.append(f"RESULT #{idx}")
            output.append(f"{'='*80}\n")

            # === BASIC INFO ===
            output.append("--- BASIC INFO ---")
            output.append(f"Name: {result['name']}")
            if result['nickname']:
                output.append(f"Nickname: {result['nickname']}")
            output.append(f"Monster ID: {result['monster_id']}")
            output.append(f"Model ID: {result['model_id']}")
            output.append(f"Spawn ID: {result['spawn_id']}")
            output.append(f"Spawn Level: {result['spawn_level']}")
            output.append(f"Dungeon Ref: {result['dungeon_ref']}")
            output.append("")

            # === MONSTER STATS ===
            output.append("--- MONSTER STATS ---")
            output.append(f"Class: {self.CLASS_MAP.get(monster.get('Class', ''), monster.get('Class', 'N/A'))}")
            output.append(f"Element: {self._format_element(monster.get('Element', '')) or 'N/A'}")
            output.append(f"Type: {monster.get('Type', 'N/A')}")
            output.append(f"Race: {monster.get('Race', 'N/A')}")
            output.append(f"HP: {monster.get('HP_Min', '?')} - {monster.get('HP_Max', '?')}")
            output.append(f"ATK: {monster.get('Atk_Min', '?')} - {monster.get('Atk_Max', '?')}")
            output.append(f"DEF: {monster.get('Def_Min', '?')} - {monster.get('Def_Max', '?')}")
            output.append(f"Speed: {monster.get('Speed_Min', '?')} - {monster.get('Speed_Max', '?')}")
            output.append(f"Critical Rate: {monster.get('CriticalRate_Min', '?')} - {monster.get('CriticalRate_Max', '?')}")
            output.append(f"Critical DMG: {monster.get('CriticalDMGRate_Min', '?')} - {monster.get('CriticalDMGRate_Max', '?')}")
            output.append(f"Accuracy: {monster.get('Accuracy_Min', '?')} - {monster.get('Accuracy_Max', '?')}")
            output.append(f"Avoid: {monster.get('Avoid_Min', '?')} - {monster.get('Avoid_Max', '?')}")
            output.append("")

            # === IMMUNITIES ===
            buff_immune = monster.get('BuffImmune', '')
            stat_buff_immune = monster.get('StatBuffImmune', '')
            if buff_immune or stat_buff_immune:
                output.append("--- IMMUNITIES ---")
                if buff_immune:
                    output.append(f"BuffImmune: {buff_immune}")
                if stat_buff_immune:
                    output.append(f"StatBuffImmune: {stat_buff_immune}")
                output.append("")

            # === SKILLS ===
            skills = result.get('skills', [])
            if skills:
                output.append("--- SKILLS ---")
                for skill in skills:
                    output.append(f"{skill.get('slot', 'N/A')}: ID={skill.get('id', 'N/A')}")
                    output.append(f"  Name ID: {skill.get('name_id', 'N/A')}")
                    output.append(f"  Desc ID: {skill.get('desc_id', 'N/A')}")
                    output.append(f"  Icon: {skill.get('icon_name', 'N/A')}")
                    output.append(f"  Type: {skill.get('skill_type', 'N/A')} / {skill.get('skill_sub_type', 'N/A')}")
                    output.append(f"  Target: {skill.get('target_team', 'N/A')} / {skill.get('range_type', 'N/A')}")
                    output.append("")

            # === DUNGEON/LOCATION INFO ===
            if dungeon and (dungeon.get('ID') or dungeon.get('SeasonFullName')):
                output.append("--- DUNGEON INFO ---")
                output.append(f"Dungeon ID: {dungeon.get('ID', 'N/A')}")
                output.append(f"Name: {dungeon.get('SeasonFullName', 'N/A')}")
                output.append(f"Short Name: {dungeon.get('FriendSupportUse', 'N/A')}")
                output.append(f"Mode: {dungeon.get('DungeonMode', 'N/A')}")
                output.append(f"Play Mode: {dungeon.get('DungeonPlayMode', 'N/A')}")
                output.append(f"Area ID: {dungeon.get('AreaID', 'N/A')}")
                output.append(f"Recommend Level: {dungeon.get('RecommandLevel', 'N/A')}")
                output.append(f"Recommend BP: {dungeon.get('RecommendBattlePower', 'N/A')}")
                output.append(f"Limit Count: {dungeon.get('LimitCount', 'N/A')}")
                output.append(f"Require Ticket: {dungeon.get('RequireTicket', 'N/A')}")
                output.append(f"Require Value: {dungeon.get('RequireValue', 'N/A')}")
                output.append(f"Reward ID: {dungeon.get('RewardID', 'N/A')}")
                output.append(f"Sweep Reward ID: {dungeon.get('SweepRewardID', 'N/A')}")
                output.append(f"Farming Target: {dungeon.get('FarmingTargetItemID', 'N/A')}")
                output.append(f"Is Sweep: {dungeon.get('IsSweep', 'N/A')}")
                output.append(f"Scene ID: {dungeon.get('SceneID', 'N/A')}")
                output.append(f"BGM: {dungeon.get('BGM', 'N/A')}")

                # Spawn positions (other waves)
                spawn_positions = []
                for i in range(10):
                    pos = dungeon.get(f'SpawnID_Pos{i}', '')
                    if pos:
                        spawn_positions.append(f"Pos{i}: {pos}")
                if spawn_positions:
                    output.append(f"Spawn Positions: {', '.join(spawn_positions)}")

                # Advantage rates
                adv_hp = dungeon.get('SpawnAdvantageRate_HP', '')
                adv_def = dungeon.get('SpawnAdvantageRate_Def', '')
                adv_spd = dungeon.get('SpawnAdvantageRate_Spd', '')
                adv_atk = dungeon.get('SpawnAdvantageRate_Atk', '')
                if adv_hp or adv_def or adv_spd or adv_atk:
                    output.append("Advantage Rates:")
                    if adv_hp:
                        output.append(f"  HP: {adv_hp}")
                    if adv_def:
                        output.append(f"  DEF: {adv_def}")
                    if adv_spd:
                        output.append(f"  Speed: {adv_spd}")
                    if adv_atk:
                        output.append(f"  ATK: {adv_atk}")

                output.append("")

                # Area info
                area = result.get('area')
                if area:
                    output.append("--- AREA INFO ---")
                    output.append(f"Season ID: {area.get('season_id', 'N/A')}")
                    output.append(f"Episode: {area.get('episode', 'N/A')}")
                    output.append(f"Name Symbol: {area.get('name_symbol', 'N/A')}")
                    output.append(f"Short Name Symbol: {area.get('short_name_symbol', 'N/A')}")
                    output.append(f"BG Image: {area.get('bg_image', 'N/A')}")
                    output.append("")

            else:
                output.append("--- DUNGEON INFO ---")
                output.append("No dungeon information found")
                output.append("")

        return '\n'.join(output)
