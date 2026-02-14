"""
Boss Finder - Logic for searching and retrieving boss information
"""
import json
from typing import List, Dict, Any, Optional
from cache_manager import CacheManager


class BossFinder:
    """Handles boss search and data retrieval"""

    # Language mapping: short codes to full column names
    LANG_MAP = {
        'en': 'English',
        'kr': 'Korean',
        'jp': 'Japanese',
        'zh': 'China_Simplified'
    }

    def __init__(self, bytes_folder):
        self.bytes_folder = bytes_folder
        self.cache = CacheManager(bytes_folder)
        self._system_text_cache = None  # Lazy load TextSystem

    def _convert_lang_keys(self, lang_dict: Dict[str, str]) -> Dict[str, str]:
        """Convert language dictionary from full names to short codes

        Args:
            lang_dict: Dict with keys like 'English', 'Korean', etc.

        Returns:
            Dict with keys like 'en', 'kr', 'jp', 'zh'
        """
        result = {}
        for short_code, full_name in self.LANG_MAP.items():
            result[short_code] = lang_dict.get(full_name, '')
        return result

    def _get_system_text_index(self):
        """Get TextSystem index (lazy loaded)"""
        if self._system_text_cache is None:
            text_system_data = self.cache.get_data("TextSystem.bytes")
            self._system_text_cache = {t.get('IDSymbol'): t for t in text_system_data if t.get('IDSymbol')}
        return self._system_text_cache

    def _translate_dungeon_name(self, dungeon_name_id: str, multilang: bool = False) -> any:
        """Translate dungeon system name

        Args:
            dungeon_name_id: System text ID
            multilang: If True, return dict with all 4 languages

        Returns:
            String (English) if multilang=False, dict with all 4 languages if multilang=True
        """
        if not dungeon_name_id:
            return "Unknown" if not multilang else {'English': 'Unknown', 'Korean': 'Unknown', 'Japanese': 'Unknown', 'China_Simplified': 'Unknown'}

        system_index = self._get_system_text_index()
        text_entry = system_index.get(dungeon_name_id, {})

        if multilang:
            languages = ['English', 'Korean', 'Japanese', 'China_Simplified']
            return {lang: text_entry.get(lang, dungeon_name_id) for lang in languages}
        else:
            return text_entry.get('English', dungeon_name_id)

    def _format_dungeon_full_name(self, dungeon_info: Dict, multilang: bool = False) -> any:
        """Format full dungeon name from DungeonShortName + SeasonFullName

        Example: "10-10 Conqueror and Destroyer"
        Where: 10-10 = DungeonShortName, Conqueror and Destroyer = SeasonFullName

        Args:
            dungeon_info: Dungeon data dict
            multilang: If True, return dict with all 4 languages

        Returns:
            String (English) if multilang=False, dict with all 4 languages if multilang=True
        """
        if not dungeon_info:
            return "Unknown" if not multilang else {'English': 'Unknown', 'Korean': 'Unknown', 'Japanese': 'Unknown', 'China_Simplified': 'Unknown'}

        short_name_id = dungeon_info.get('DungeonShortName', '')
        season_name_id = dungeon_info.get('Name', '')  # Name contains SeasonFullName

        if multilang:
            # Get translations in all 4 languages
            short_name_ml = self._translate_dungeon_name(short_name_id, multilang=True) if short_name_id else None
            season_name_ml = self._translate_dungeon_name(season_name_id, multilang=True) if season_name_id else None

            languages = ['English', 'Korean', 'Japanese', 'China_Simplified']
            result = {}

            for lang in languages:
                short_name = short_name_ml.get(lang, '') if short_name_ml else ''
                season_name = season_name_ml.get(lang, '') if season_name_ml else ''

                # Skip short_name if it looks like an untranslated ID (e.g., "72000033")
                # Check if short_name is the same as short_name_id (not translated) and is numeric
                if short_name == short_name_id and short_name_id.isdigit():
                    short_name = ''

                # Combine them
                if short_name and season_name:
                    result[lang] = f"{short_name} {season_name}"
                elif season_name:
                    result[lang] = season_name
                elif short_name:
                    result[lang] = short_name
                else:
                    result[lang] = "Unknown"

            return result
        else:
            # Original behavior: English only
            short_name = self._translate_dungeon_name(short_name_id) if short_name_id else ''
            season_name = self._translate_dungeon_name(season_name_id) if season_name_id else ''

            # Combine them
            if short_name and season_name:
                return f"{short_name} {season_name}"
            elif season_name:
                return season_name
            elif short_name:
                return short_name
            else:
                return "Unknown"

    def _get_area_info(self, area_id: str, multilang: bool = False) -> Dict[str, any]:
        """Get area information from AreaTemplet by SeasonID

        Args:
            area_id: The AreaID (SeasonID in AreaTemplet)
            multilang: If True, return names in all 4 languages

        Returns:
            Dict with 'short_name' and 'full_name' keys
            If multilang=True, these values are dicts with language keys
        """
        if not area_id:
            return {}

        area_data = self.cache.get_data("AreaTemplet.bytes")

        # Find area with matching SeasonID
        area = next((a for a in area_data if a.get('SeasonID') == area_id), None)
        if not area:
            return {}

        # Get the name symbols
        short_name_symbol = area.get('ShortNameIDSymbol', '')
        full_name_symbol = area.get('RewardIDList', '')  # RewardIDList contains area name

        if multilang:
            # Translate in all 4 languages
            short_name = self._translate_dungeon_name(short_name_symbol, multilang=True) if short_name_symbol else {'English': '', 'Korean': '', 'Japanese': '', 'China_Simplified': ''}
            full_name = self._translate_dungeon_name(full_name_symbol, multilang=True) if full_name_symbol else {'English': '', 'Korean': '', 'Japanese': '', 'China_Simplified': ''}

            return {
                'short_name': short_name,
                'short_name_id': short_name_symbol,
                'full_name': full_name,
                'full_name_id': full_name_symbol
            }
        else:
            # Original behavior: English only
            short_name = self._translate_dungeon_name(short_name_symbol) if short_name_symbol else ''
            full_name = self._translate_dungeon_name(full_name_symbol) if full_name_symbol else ''

            return {
                'short_name': short_name,
                'short_name_id': short_name_symbol,
                'full_name': full_name,
                'full_name_id': full_name_symbol
            }

    def _get_skill_info(self, skill_name_id: str, multilang: bool = False) -> Dict[str, Any]:
        """Get skill information by NameIDSymbol

        Args:
            skill_name_id: The skill NameIDSymbol (e.g., '131531' from Skill_1 field)
            multilang: If True, return name/description in all 4 languages

        Returns:
            Dict with 'name', 'description', 'type', 'level_data' keys
            If multilang=True, 'name' and 'description' are dicts with language keys
        """
        if not skill_name_id:
            return {}

        # Load skill data
        skill_data = self.cache.get_data("MonsterSkillTemplet.bytes")

        # Find skill by NameIDSymbol
        skill = next((s for s in skill_data if s.get('NameIDSymbol') == skill_name_id), None)
        if not skill:
            return {}

        # Get skill name, description and icon
        name_symbol = skill.get('SkipNameID', '')
        desc_symbol = skill.get('DescID', '')
        skill_type = skill.get('SkillType', '')
        icon_name = skill.get('IconName', '')  # Get the actual icon name from the skill

        # Load TextSkill for translations
        text_skill_data = self.cache.get_data("TextSkill.bytes")
        text_skill_index = {t.get('IDSymbol'): t for t in text_skill_data if t.get('IDSymbol')}

        languages = ['English', 'Korean', 'Japanese', 'China_Simplified']

        if multilang:
            # Return translations in all 4 languages
            name_translations = {}
            description_translations = {}

            if name_symbol:
                name_entry = text_skill_index.get(name_symbol, {})
                for lang in languages:
                    name_translations[lang] = name_entry.get(lang, name_symbol)

            if desc_symbol:
                desc_entry = text_skill_index.get(desc_symbol, {})
                for lang in languages:
                    description_translations[lang] = desc_entry.get(lang, desc_symbol)

            # Get skill level data from MonsterSkillLevelTemplet
            skill_level_data = self.cache.get_data("MonsterSkillLevelTemplet.bytes")
            skill_levels = [sl for sl in skill_level_data if sl.get('SkillID') == skill_name_id]

            return {
                'name': name_translations,
                'description': description_translations,
                'type': skill_type,
                'icon': icon_name,
                'name_id': name_symbol,
                'desc_id': desc_symbol,
                'level_data': skill_levels
            }
        else:
            # Original behavior: English only
            name = ''
            description = ''
            if name_symbol:
                name_entry = text_skill_index.get(name_symbol, {})
                name = name_entry.get('English', name_symbol)

            if desc_symbol:
                desc_entry = text_skill_index.get(desc_symbol, {})
                description = desc_entry.get('English', desc_symbol)

            # Get skill level data from MonsterSkillLevelTemplet
            skill_level_data = self.cache.get_data("MonsterSkillLevelTemplet.bytes")
            skill_levels = [sl for sl in skill_level_data if sl.get('SkillID') == skill_name_id]

            return {
                'name': name,
                'description': description,
                'type': skill_type,
                'icon': icon_name,  # Real icon name from MonsterSkillTemplet
                'name_id': name_symbol,
                'desc_id': desc_symbol,
                'level_data': skill_levels  # List of all level entries for this skill
            }

    def _replace_skill_placeholders(self, description: str) -> str:
        """Replace skill description placeholders with actual values from BuffTemplet

        Placeholders format: [Buff_{TYPE}_{BuffID}]
        - TYPE: V (Value), C (CreateRate), T (TurnDuration)
        - BuffID: e.g., 4500154_1_1

        Examples:
        - [Buff_V_4500154_1_1] → "30%" (Value=300, ApplyingType=OAT_RATE, divided by 10)
        - [Buff_V_4076006_15_1] → "2" (Value=2, ApplyingType=OAT_ADD, not divided)
        - [Buff_C_4500154_2_1] → "100%" (CreateRate=1000, divided by 10)
        - [Buff_T_4076007_1_3] → "2" (TurnDuration=2, no division)
        """
        import re

        if not description:
            return description

        # Load BuffTemplet data (cached)
        buff_data = self.cache.get_data("BuffTemplet.bytes")
        buff_index = {b.get('BuffID'): b for b in buff_data if b.get('BuffID')}

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

    def _translate_mode_name(self, mode_id: str, multilang: bool = False) -> any:
        """Translate dungeon mode to readable name from TextSystem

        Args:
            mode_id: Mode ID (e.g., 'DM_RAID_1')
            multilang: If True, return dict with all 4 languages

        Returns:
            String (English) if multilang=False, dict with all 4 languages if multilang=True
        """
        # Mapping from DM_* modes to SYS_*_TITLE keys in TextSystem
        # For modes without a direct SYS_*_TITLE mapping, we'll return the raw mode_id
        mode_to_sys_key = {
            "DM_RAID_1": "SYS_RAID_1_TITLE",
            "DM_RAID_2": "SYS_RAID_2_TITLE",
            "DM_ADVENTURE_MISSION": "SYS_GUIDE_ADVENTURE_LICENSE_TITLE",
            "DM_TOWER_HARD": "SYS_CONTENS_LOCK_PVE_TOWER_HARD",
            "DM_IRREGULAR_INFILTRATE": "SYS_IRR_INFILTREATE_NAME_01",
            "DM_IRREGULAR_CHASE": "SYS_GUIDE_IRREGULAR_CHASE_TITLE",
            "SYS_WORLD_BOSS_TITLE": "SYS_WORLD_BOSS_TITLE",  # World Boss - direct translation
            # Add other mappings as they are discovered
            # Most modes don't have a SYS_*_TITLE and will fall back to mode_id
        }

        # Get the SYS key for this mode
        sys_key = mode_to_sys_key.get(mode_id)

        if sys_key:
            # Translate using TextSystem
            return self._translate_dungeon_name(sys_key, multilang=multilang)
        else:
            # Fallback to mode_id if no mapping found
            if multilang:
                return {'English': mode_id, 'Korean': mode_id, 'Japanese': mode_id, 'China_Simplified': mode_id}
            else:
                return mode_id

    def get_available_modes(self) -> List[str]:
        """Get list of all available dungeon modes"""
        dungeon_data = self.cache.get_data("DungeonTemplet.bytes")
        modes = set()

        for dungeon in dungeon_data:
            mode = dungeon.get('DungeonMode', '')
            if mode:
                modes.add(mode)

        return sorted(list(modes))

    def search_boss_by_mode(self, search_name: str, mode_filter: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Search for bosses by name and optionally filter by dungeon mode.

        Args:
            search_name: Monster name to search for
            mode_filter: Optional dungeon mode to filter by (e.g., "DM_TOWER_VERY_HARD")

        Returns:
            List of matching boss results with full details
        """
        # Load data
        monster_data = self.cache.get_data("MonsterTemplet.bytes")
        text_char_data = self.cache.get_data("TextCharacter.bytes")
        spawn_data = self.cache.get_data("DungeonSpawnTemplet.bytes")
        dungeon_data = self.cache.get_data("DungeonTemplet.bytes")

        # Build text index (include both IDSymbol and ID as keys)
        text_index = {}
        for t in text_char_data:
            id_symbol = t.get('IDSymbol', '')
            text_id = t.get('ID', '')
            if id_symbol:
                text_index[id_symbol] = t
            if text_id:
                text_index[text_id] = t

        # Step 1: Find ModelID by searching name
        matching_model_ids = self._find_model_ids_by_name(
            search_name, text_char_data, monster_data
        )

        if not matching_model_ids:
            return []

        # Step 2: Build spawn index
        monster_spawns = self._build_spawn_index(spawn_data)

        # Step 3: Build dungeon mapping
        hpline_to_dungeons = self._build_dungeon_mapping_all(dungeon_data)

        # Step 4: Find all monsters with matching ModelID
        matching_results = []

        for monster in monster_data:
            model_id = monster.get('ModelID', '')
            if model_id not in matching_model_ids:
                continue

            monster_id = monster.get('ID', '')

            # Find all spawns containing this monster
            for spawn_entry in monster_spawns:
                if spawn_entry['monster_id'] == monster_id:
                    hp_line = spawn_entry['HPLineCount']
                    spawn_id = spawn_entry['spawn_id']

                    # Get all dungeons - try both HPLineCount and direct Spawn ID
                    dungeons = []
                    if hp_line:
                        dungeons = hpline_to_dungeons.get(hp_line, [])

                    # If not found by HPLineCount, try by Spawn ID with prefixes
                    if not dungeons:
                        dungeons = self._find_dungeon_by_spawn_id(spawn_id, spawn_entry.get('dungeon_id', ''), hpline_to_dungeons)

                    # Filter by mode if specified
                    if mode_filter:
                        dungeons = [d for d in dungeons if d.get('Mode') == mode_filter]

                    # Create result for each dungeon (or one with no dungeon if list empty)
                    if not dungeons:
                        dungeons = [{}]

                    for dungeon_info in dungeons:
                        # Skip if mode filter specified but dungeon doesn't match
                        if mode_filter and not dungeon_info:
                            continue

                        # Get monster names
                        name, nickname = self._get_monster_names(monster, text_index)

                        matching_results.append({
                            'monster': monster,
                            'monster_id': monster_id,
                            'model_id': model_id,
                            'name': name,
                            'nickname': nickname,
                            'spawn_id': spawn_entry['spawn_id'],
                            'spawn_level': spawn_entry['level'],
                            'hp_line': hp_line,
                            'dungeon': dungeon_info
                        })

        return matching_results

    def search_boss(self, search_name: str, level: int) -> List[Dict[str, Any]]:
        """
        Search for bosses by name and level.

        Args:
            search_name: Monster name to search for
            level: Monster level to match

        Returns:
            List of matching boss results with full details
        """
        # Load data
        monster_data = self.cache.get_data("MonsterTemplet.bytes")
        text_char_data = self.cache.get_data("TextCharacter.bytes")
        spawn_data = self.cache.get_data("DungeonSpawnTemplet.bytes")
        dungeon_data = self.cache.get_data("DungeonTemplet.bytes")

        # Build text index (include both IDSymbol and ID as keys)
        text_index = {}
        for t in text_char_data:
            id_symbol = t.get('IDSymbol', '')
            text_id = t.get('ID', '')
            if id_symbol:
                text_index[id_symbol] = t
            if text_id:
                text_index[text_id] = t

        # Step 1: Find ModelID by searching name in TextCharacter
        matching_model_ids = self._find_model_ids_by_name(
            search_name, text_char_data, monster_data
        )

        if not matching_model_ids:
            return []

        # Step 2: Build spawn index with levels
        monster_spawns = self._build_spawn_index(spawn_data)

        # Step 3: Build HPLineCount -> Dungeon mapping
        hpline_to_dungeon = self._build_dungeon_mapping(dungeon_data)

        # Step 4: Find all monsters with matching ModelID and spawns at target level
        matching_results = self._find_matching_monsters(
            monster_data,
            matching_model_ids,
            level,
            monster_spawns,
            hpline_to_dungeon,
            text_index
        )

        return matching_results

    def search_boss_all_levels(self, search_name: str) -> List[Dict[str, Any]]:
        """
        Search for bosses by name only - returns all matching bosses at all levels.

        Args:
            search_name: Monster name to search for

        Returns:
            List of matching boss results with full details at all levels
        """
        # Load data
        monster_data = self.cache.get_data("MonsterTemplet.bytes")
        text_char_data = self.cache.get_data("TextCharacter.bytes")
        spawn_data = self.cache.get_data("DungeonSpawnTemplet.bytes")
        dungeon_data = self.cache.get_data("DungeonTemplet.bytes")

        # Build text index (include both IDSymbol and ID as keys)
        text_index = {}
        for t in text_char_data:
            id_symbol = t.get('IDSymbol', '')
            text_id = t.get('ID', '')
            if id_symbol:
                text_index[id_symbol] = t
            if text_id:
                text_index[text_id] = t

        # Step 1: Find ModelID by searching name in TextCharacter
        matching_model_ids = self._find_model_ids_by_name(
            search_name, text_char_data, monster_data
        )

        if not matching_model_ids:
            return []

        # Step 2: Build spawn index with levels
        monster_spawns = self._build_spawn_index(spawn_data)

        # Step 3: Build HPLineCount -> Dungeon mapping
        hpline_to_dungeon = self._build_dungeon_mapping(dungeon_data)

        # Step 4: Find all monsters with matching ModelID at ALL levels
        matching_results = self._find_matching_monsters_all_levels(
            monster_data,
            matching_model_ids,
            monster_spawns,
            hpline_to_dungeon,
            text_index
        )

        return matching_results

    def _find_model_ids_by_name(
        self,
        search_name: str,
        text_char_data: List[Dict],
        monster_data: List[Dict]
    ) -> set:
        """Find all ModelIDs that match the search name"""
        search_name_lower = search_name.lower()
        matching_model_ids = set()

        # First pass: find matching text IDs in TextCharacter
        matching_text_ids = set()
        for text_entry in text_char_data:
            english_text = text_entry.get('English', '').lower()
            if search_name_lower in english_text:
                # Get both IDSymbol and ID (ID is the actual key like "4076006_Name")
                symbol = text_entry.get('IDSymbol', '')
                text_id = text_entry.get('ID', '')

                if symbol:
                    matching_text_ids.add(symbol)
                if text_id:
                    matching_text_ids.add(text_id)

        # Second pass: find monsters with matching IDs in NameIDSymbol, FirstMeetIDSymbol, or CharacterIDSymbol
        for monster in monster_data:
            name_id = monster.get('NameIDSymbol', '')
            first_meet_id = monster.get('FirstMeetIDSymbol', '')
            char_id = monster.get('CharacterIDSymbol', '')

            # Check if any of these IDs match our text IDs
            if name_id in matching_text_ids or first_meet_id in matching_text_ids or char_id in matching_text_ids:
                model_id = monster.get('ModelID', '')
                if model_id:
                    matching_model_ids.add(model_id)

        return matching_model_ids

    def _build_spawn_index(self, spawn_data: List[Dict]) -> List[Dict]:
        """Build spawn index mapping monsters to their spawns and levels"""
        # Note: All monsters in a spawn share the same level (GroupID or Level0)
        monster_spawns = []

        for spawn in spawn_data:
            spawn_id = spawn.get('ID', '')
            hp_line = spawn.get('HPLineCount', '')

            # Get the level for this spawn (prefer GroupID, fallback to Level0)
            spawn_level = spawn.get('GroupID', spawn.get('Level0', '0'))
            # Convert to int for comparison
            try:
                spawn_level_int = int(spawn_level) if spawn_level else 0
            except (ValueError, TypeError):
                spawn_level_int = 0

            # Get ID0 - this is often used as the dungeon reference
            id0 = spawn.get('ID0', '')

            # Add all monsters in this spawn
            for field in ['ID0', 'ID1', 'ID2', 'ID3']:
                mid = spawn.get(field, '')
                if mid:
                    monster_spawns.append({
                        'monster_id': mid,
                        'spawn_id': spawn_id,
                        'level': spawn_level_int,
                        'HPLineCount': hp_line,
                        'dungeon_id': id0  # ID0 is often the dungeon reference
                    })

        return monster_spawns

    def _lookup_dungeon(self, hp_line: str, hpline_to_dungeon: Dict[str, Dict]) -> Dict:
        """Lookup dungeon by HPLineCount with special handling for various dungeon types

        For Adventure Missions (HPLineCount starting with 706000):
        Example: 706000191 -> extract 191 -> remove last digit -> 19 -> prepend 706000 -> 70600019

        For Irregular dungeons (HPLineCount starting with 7303):
        Example: 730303061 -> remove last digit -> 73030306 (matches FriendSupportUse)
        """
        if not hp_line:
            return {}

        # Try direct lookup first
        dungeon_info = hpline_to_dungeon.get(hp_line, {})

        # If not found and HPLineCount starts with 7303, try Irregular dungeon mapping
        # Remove last digit to match FriendSupportUse
        if not dungeon_info and hp_line.startswith('7303') and len(hp_line) > 1:
            irregular_key = hp_line[:-1]  # Remove last digit
            dungeon_info = hpline_to_dungeon.get(irregular_key, {})

        # If not found and HPLineCount starts with 706000, try Adventure Mission mapping
        if not dungeon_info and hp_line.startswith('706000'):
            # Extract the suffix after 706000
            suffix = hp_line[6:]  # Remove '706000' prefix
            if suffix and suffix != '0' * len(suffix):  # Has non-zero digits
                # Remove trailing zeros
                suffix_stripped = suffix.rstrip('0')
                if len(suffix_stripped) > 1:
                    # Remove last digit and prepend 706000
                    adventure_key = '706000' + suffix_stripped[:-1]
                    dungeon_info = hpline_to_dungeon.get(adventure_key, {})

        return dungeon_info

    def _lookup_world_boss(self, hp_line: str) -> Dict:
        """Lookup World Boss league by HPLineCount in WorldBossLeagueTemplet

        Returns dungeon_info dict with:
        - Name: League name (translated)
        - Mode: SYS_WORLD_BOSS_TITLE
        - ID: ChangeSpawnGroupID (the HPLineCount)
        """
        if not hp_line:
            return {}

        # Load WorldBossLeagueTemplet
        world_boss_data = self.cache.get_data("WorldBossLeagueTemplet.bytes")

        # Search for HPLineCount in ChangeSpawnGroupID column
        # ChangeSpawnGroupID can be a comma-separated list like "555000031,555000032"
        for wb_entry in world_boss_data:
            change_spawn = wb_entry.get('ChangeSpawnGroupID', '')

            # Check if hp_line is in the comma-separated list
            spawn_ids = [s.strip() for s in change_spawn.split(',')]
            if hp_line in spawn_ids:
                # Found a match - get the LeagueName
                league_name_key = wb_entry.get('LeagueName', '')

                # Build dungeon_info with World Boss format
                dungeon_info = {
                    'ID': change_spawn,
                    'Name': league_name_key,  # This is a SYS_ key to translate
                    'DungeonShortName': '',
                    'Mode': 'SYS_WORLD_BOSS_TITLE',  # Will be translated to "World Boss"
                    'AreaID': ''
                }

                return dungeon_info

        return {}

    def _build_dungeon_mapping(self, dungeon_data: List[Dict]) -> Dict[str, Dict]:
        """Build mapping from HPLineCount to dungeon information (first match only)

        Also maps FriendSupportUse as a prefix key for Adventure Missions
        """
        hpline_to_dungeon = {}

        for dungeon in dungeon_data:
            dungeon_info = {
                'ID': dungeon.get('ID', ''),
                'Name': dungeon.get('SeasonFullName', 'Unknown'),
                'DungeonShortName': dungeon.get('FriendSupportUse', ''),
                'Mode': dungeon.get('DungeonMode', 'Unknown'),
                'AreaID': dungeon.get('AreaID', '')
            }

            # Map SpawnID_Pos* references
            for i in range(10):
                pos_field = f'SpawnID_Pos{i}'
                spawn_ref = dungeon.get(pos_field, '')
                if spawn_ref:
                    hpline_to_dungeon[spawn_ref] = dungeon_info

            # Also map FriendSupportUse for Adventure Missions
            # (HPLineCount often starts with FriendSupportUse as prefix)
            friend_support = dungeon.get('FriendSupportUse', '')
            if friend_support:
                hpline_to_dungeon[friend_support] = dungeon_info

        return hpline_to_dungeon

    def _build_dungeon_mapping_all(self, dungeon_data: List[Dict]) -> Dict[str, List[Dict]]:
        """Build mapping from HPLineCount OR SpawnID to ALL dungeons (handles rotation)

        Some dungeons reference spawns by HPLineCount, others by direct Spawn ID with prefix.
        Example: spawn "3084" might be referenced as "300003084"
        """
        hpline_to_dungeons = {}

        for dungeon in dungeon_data:
            for i in range(10):
                pos_field = f'SpawnID_Pos{i}'
                spawn_ref = dungeon.get(pos_field, '')
                if spawn_ref:
                    if spawn_ref not in hpline_to_dungeons:
                        hpline_to_dungeons[spawn_ref] = []

                    dungeon_info = {
                        'ID': dungeon.get('ID', ''),
                        'Name': dungeon.get('SeasonFullName', 'Unknown'),
                        'DungeonShortName': dungeon.get('FriendSupportUse', ''),  # This contains SYS_DUNGEON_SHORT_NAME_*
                        'Mode': dungeon.get('DungeonMode', 'Unknown'),
                        'AreaID': dungeon.get('AreaID', '')
                    }
                    hpline_to_dungeons[spawn_ref].append(dungeon_info)

        return hpline_to_dungeons

    def _find_dungeon_by_spawn_id(self, spawn_id: str, dungeon_id: str, hpline_to_dungeons: Dict[str, List[Dict]]) -> List[Dict]:
        """Find dungeon by spawn ID or dungeon ID, trying multiple patterns

        Dungeons can reference spawns in different ways:
        1. By HPLineCount (if spawn has one)
        2. By dungeon_id (ID0 from spawn) - most common
        3. By direct Spawn ID with prefix (e.g., "3000" + spawn_id)
        """
        dungeons = []

        # Try dungeon_id first (ID0 from spawn)
        if dungeon_id and dungeon_id in hpline_to_dungeons:
            dungeons.extend(hpline_to_dungeons[dungeon_id])

        # If not found, try spawn_id with various prefixes
        if not dungeons:
            prefixes = ['', '3000', '30000', '300000']
            for prefix in prefixes:
                key = prefix + spawn_id
                if key in hpline_to_dungeons:
                    dungeons.extend(hpline_to_dungeons[key])
                    break

        return dungeons

    def _find_matching_monsters(
        self,
        monster_data: List[Dict],
        matching_model_ids: set,
        level: int,
        monster_spawns: List[Dict],
        hpline_to_dungeon: Dict[str, Dict],
        text_index: Dict[str, Dict]
    ) -> List[Dict[str, Any]]:
        """Find all monsters matching the criteria

        Note: Multiple spawns may share the same HPLineCount (rotation system).
        This function returns ALL matching combinations.
        """
        matching_results = []

        for monster in monster_data:
            model_id = monster.get('ModelID', '')
            if model_id not in matching_model_ids:
                continue

            monster_id = monster.get('ID', '')

            # Find spawns containing this monster at the right level
            for spawn_entry in monster_spawns:
                if spawn_entry['monster_id'] == monster_id and spawn_entry['level'] == level:
                    # Found matching spawn
                    hp_line = spawn_entry['HPLineCount']
                    spawn_id = spawn_entry['spawn_id']

                    # Try to find dungeon by HPLineCount first (includes Adventure Mission logic)
                    dungeon_info = self._lookup_dungeon(hp_line, hpline_to_dungeon)

                    # Check if this is a World Boss (Mode == DM_WORLD_BOSS)
                    # If so, look up the League name from WorldBossLeagueTemplet
                    if dungeon_info and dungeon_info.get('Mode') == 'DM_WORLD_BOSS':
                        wb_info = self._lookup_world_boss(hp_line)
                        if wb_info:
                            # Override with World Boss League info
                            dungeon_info = wb_info

                    # If not found, try World Boss League directly
                    if not dungeon_info:
                        dungeon_info = self._lookup_world_boss(hp_line)

                    # If not found, try by Spawn ID with prefixes
                    if not dungeon_info:
                        # Convert hpline_to_dungeon (single dict) to list format for compatibility
                        hpline_to_dungeons_temp = {}
                        for key, val in hpline_to_dungeon.items():
                            hpline_to_dungeons_temp[key] = [val]

                        dungeons_found = self._find_dungeon_by_spawn_id(spawn_id, spawn_entry.get('dungeon_id', ''), hpline_to_dungeons_temp)
                        if dungeons_found:
                            dungeon_info = dungeons_found[0]  # Take first match

                    # Get monster names
                    name, nickname = self._get_monster_names(monster, text_index)

                    matching_results.append({
                        'monster': monster,
                        'monster_id': monster_id,
                        'model_id': model_id,
                        'name': name,
                        'nickname': nickname,
                        'spawn_id': spawn_entry['spawn_id'],
                        'spawn_level': spawn_entry['level'],
                        'hp_line': hp_line,
                        'dungeon': dungeon_info
                    })

        return matching_results

    def _find_matching_monsters_all_levels(
        self,
        monster_data: List[Dict],
        matching_model_ids: set,
        monster_spawns: List[Dict],
        hpline_to_dungeon: Dict[str, Dict],
        text_index: Dict[str, Dict]
    ) -> List[Dict[str, Any]]:
        """Find all monsters matching the criteria at ALL levels

        Same as _find_matching_monsters but without level filtering
        """
        matching_results = []

        for monster in monster_data:
            model_id = monster.get('ModelID', '')
            if model_id not in matching_model_ids:
                continue

            monster_id = monster.get('ID', '')

            # Find ALL spawns containing this monster (no level filter)
            for spawn_entry in monster_spawns:
                if spawn_entry['monster_id'] == monster_id:
                    # Found matching spawn
                    hp_line = spawn_entry['HPLineCount']
                    spawn_id = spawn_entry['spawn_id']

                    # Try to find dungeon by HPLineCount first (includes Adventure Mission logic)
                    dungeon_info = self._lookup_dungeon(hp_line, hpline_to_dungeon)

                    # Check if this is a World Boss (Mode == DM_WORLD_BOSS)
                    # If so, look up the League name from WorldBossLeagueTemplet
                    if dungeon_info and dungeon_info.get('Mode') == 'DM_WORLD_BOSS':
                        wb_info = self._lookup_world_boss(hp_line)
                        if wb_info:
                            # Override with World Boss League info
                            dungeon_info = wb_info

                    # If not found, try World Boss League directly
                    if not dungeon_info:
                        dungeon_info = self._lookup_world_boss(hp_line)

                    # If not found, try by Spawn ID with prefixes
                    if not dungeon_info:
                        # Convert hpline_to_dungeon (single dict) to list format for compatibility
                        hpline_to_dungeons_temp = {}
                        for key, val in hpline_to_dungeon.items():
                            hpline_to_dungeons_temp[key] = [val]

                        dungeons_found = self._find_dungeon_by_spawn_id(spawn_id, spawn_entry.get('dungeon_id', ''), hpline_to_dungeons_temp)
                        if dungeons_found:
                            dungeon_info = dungeons_found[0]  # Take first match

                    # Get monster names
                    name, nickname = self._get_monster_names(monster, text_index)

                    matching_results.append({
                        'monster': monster,
                        'monster_id': monster_id,
                        'model_id': model_id,
                        'name': name,
                        'nickname': nickname,
                        'spawn_id': spawn_entry['spawn_id'],
                        'spawn_level': spawn_entry['level'],
                        'hp_line': hp_line,
                        'dungeon': dungeon_info
                    })

        return matching_results

    def _get_monster_names(
        self,
        monster: Dict,
        text_index: Dict[str, Dict]
    ) -> tuple:
        """Extract monster name and nickname from text data"""
        name_id_symbol = monster.get('NameIDSymbol', '')
        first_meet_id_symbol = monster.get('FirstMeetIDSymbol', '')
        monster_id = monster.get('ID', '')

        nickname = ''
        name = ''

        if name_id_symbol:
            name_text = text_index.get(name_id_symbol, {})
            name = name_text.get('English', f'Monster_{monster_id}')
            if first_meet_id_symbol:
                nickname_text = text_index.get(first_meet_id_symbol, {})
                nickname = nickname_text.get('English', '')
        else:
            if first_meet_id_symbol:
                name_text = text_index.get(first_meet_id_symbol, {})
                name = name_text.get('English', f'Monster_{monster_id}')

        return name, nickname

    def _get_monster_names_multilang(
        self,
        monster: Dict,
        text_index: Dict[str, Dict]
    ) -> Dict[str, Dict[str, str]]:
        """Extract monster name and nickname in all 4 languages

        Returns:
            Dict with 'name' and 'nickname' keys, each containing dict of language translations
        """
        name_id_symbol = monster.get('NameIDSymbol', '')
        first_meet_id_symbol = monster.get('FirstMeetIDSymbol', '')
        monster_id = monster.get('ID', '')

        languages = ['English', 'Korean', 'Japanese', 'China_Simplified']

        name_translations = {}
        nickname_translations = {}

        # Get name in all languages
        if name_id_symbol:
            name_text = text_index.get(name_id_symbol, {})
            for lang in languages:
                name_translations[lang] = name_text.get(lang, f'Monster_{monster_id}')
        else:
            # Fallback to first meet id
            if first_meet_id_symbol:
                name_text = text_index.get(first_meet_id_symbol, {})
                for lang in languages:
                    name_translations[lang] = name_text.get(lang, f'Monster_{monster_id}')

        # Get nickname in all languages
        if first_meet_id_symbol and name_id_symbol:  # Only if we have both
            nickname_text = text_index.get(first_meet_id_symbol, {})
            for lang in languages:
                nickname_translations[lang] = nickname_text.get(lang, '')

        return {
            'name': name_translations,
            'nickname': nickname_translations
        }

    def format_results_compact(self, results: List[Dict[str, Any]]) -> str:
        """Format search results in compact format for wiki/database output

        Includes: Name, Nickname, Level, Class, Element, Skills, Location
        """
        if not results:
            return "No results found"

        output = []

        for idx, result in enumerate(results, 1):
            monster = result['monster']

            # Basic info
            name = result.get('name', 'Unknown')
            nickname = result.get('nickname', '')
            level = result.get('spawn_level', 'Unknown')
            model_id = result.get('model_id', '')

            # Class and Element
            char_class = monster.get('Class', 'Unknown')
            element = monster.get('Element', 'Unknown')

            # Icon from FaceIconID field (real data, not extrapolated)
            face_icon_id = monster.get('FaceIconID', model_id)  # Use FaceIconID if available, fallback to ModelID
            icon_turn = f"IG_Turn_{face_icon_id}.png"

            output.append(f"{'='*80}")
            output.append(f"BOSS #{idx}")
            output.append(f"{'='*80}\n")

            # Header
            if nickname:
                output.append(f"{name} ({nickname}) - Level {level}")
            else:
                output.append(f"{name} - Level {level}")

            output.append(f"Class: {char_class} | Element: {element}")
            output.append(f"Icon: {icon_turn}")
            output.append("")

            # Skills
            output.append("--- Skills ---")
            for i in range(1, 30):
                skill_id = monster.get(f'Skill_{i}', '')
                if skill_id:
                    skill_info = self._get_skill_info(skill_id)
                    if skill_info:
                        skill_name = skill_info.get('name', f'Skill_{i}')
                        skill_desc = skill_info.get('description', '')
                        skill_type = skill_info.get('type', '')
                        skill_icon = skill_info.get('icon', '')  # Get real icon name from MonsterSkillTemplet

                        # Replace placeholders
                        skill_desc_formatted = self._replace_skill_placeholders(skill_desc)

                        output.append(f"\n{skill_name} ({skill_type})")
                        if skill_icon:
                            output.append(f"  Icon: {skill_icon}.png")
                        if skill_desc_formatted:
                            # Clean HTML color tags and convert \n to actual newlines
                            import re
                            clean_desc = re.sub(r'<[^>]+>', '', skill_desc_formatted)
                            clean_desc = clean_desc.replace('\\n', '\n')
                            # Indent multiline descriptions
                            lines = clean_desc.split('\n')
                            for line in lines:
                                if line.strip():
                                    output.append(f"  {line}")

            output.append("")

            # Location
            dungeon = result.get('dungeon', {})
            if dungeon:
                output.append("--- Location ---")
                dungeon_name = self._format_dungeon_full_name(dungeon)
                mode = self._translate_mode_name(dungeon.get('Mode', ''))

                # Area info
                area_id = dungeon.get('AreaID', '')
                area_info = self._get_area_info(area_id) if area_id else {}

                output.append(f"Dungeon: {dungeon_name}")
                output.append(f"Mode: {mode}")
                if area_info:
                    area_display = area_info.get('full_name', '')
                    if area_info.get('short_name'):
                        area_display = f"{area_info['short_name']} - {area_display}"
                    output.append(f"Area: {area_display}")

            output.append("")

        return '\n'.join(output)

    def format_results_html(self, results: List[Dict[str, Any]], image_base_path: str = "../../datamine/extracted_astudio/assets/editor/resources") -> str:
        """Format search results as HTML with icons displayed on the right

        Args:
            results: Search results
            image_base_path: Base path to the image assets folder

        Returns:
            HTML formatted string with icons
        """
        if not results:
            return "<p>No results found</p>"

        html = []
        html.append("<div class='boss-results'>")

        for idx, result in enumerate(results, 1):
            monster = result['monster']

            # Basic info
            name = result.get('name', 'Unknown')
            nickname = result.get('nickname', '')
            level = result.get('spawn_level', 'Unknown')
            model_id = result.get('model_id', '')

            # Class and Element
            char_class = monster.get('Class', 'Unknown')
            element = monster.get('Element', 'Unknown')

            # Icon from FaceIconID field
            face_icon_id = monster.get('FaceIconID', model_id)
            icon_turn = f"IG_Turn_{face_icon_id}.png"
            icon_path = f"{image_base_path}/sprite/{icon_turn}"

            html.append(f"<div class='boss-entry'>")
            html.append(f"<h2>Boss #{idx}</h2>")

            # Header with icon on the right
            html.append("<div class='boss-header'>")
            html.append("<div class='boss-info'>")
            if nickname:
                html.append(f"<h3>{name} ({nickname}) - Level {level}</h3>")
            else:
                html.append(f"<h3>{name} - Level {level}</h3>")
            html.append(f"<p><strong>Class:</strong> {char_class} | <strong>Element:</strong> {element}</p>")
            html.append("</div>")
            html.append(f"<div class='boss-icon'><img src='{icon_path}' alt='{name}' /></div>")
            html.append("</div>")

            # Skills
            html.append("<div class='skills-section'>")
            html.append("<h4>Skills</h4>")

            for i in range(1, 30):
                skill_id = monster.get(f'Skill_{i}', '')
                if skill_id:
                    skill_info = self._get_skill_info(skill_id)
                    if skill_info:
                        skill_name = skill_info.get('name', f'Skill_{i}')
                        skill_desc = skill_info.get('description', '')
                        skill_type = skill_info.get('type', '')
                        skill_icon = skill_info.get('icon', '')

                        # Replace placeholders
                        skill_desc_formatted = self._replace_skill_placeholders(skill_desc)

                        # Find icon path
                        skill_icon_path = ""
                        if skill_icon:
                            skill_icon_path = f"{image_base_path}/sprite/{skill_icon}.png"

                        html.append("<div class='skill-entry'>")
                        html.append("<div class='skill-info'>")
                        html.append(f"<h5>{skill_name} <span class='skill-type'>({skill_type})</span></h5>")
                        if skill_desc_formatted:
                            # Clean HTML color tags and convert \n to <br>
                            import re
                            clean_desc = re.sub(r'<color=[^>]+>', '<span class="skill-value">', skill_desc_formatted)
                            clean_desc = clean_desc.replace('</color>', '</span>')
                            clean_desc = clean_desc.replace('\\n', '<br>')
                            html.append(f"<p>{clean_desc}</p>")
                        html.append("</div>")
                        if skill_icon_path:
                            html.append(f"<div class='skill-icon'><img src='{skill_icon_path}' alt='{skill_name}' /></div>")
                        html.append("</div>")

            html.append("</div>")

            # Location
            dungeon = result.get('dungeon', {})
            if dungeon:
                html.append("<div class='location-section'>")
                html.append("<h4>Location</h4>")
                dungeon_name = self._format_dungeon_full_name(dungeon)
                mode = self._translate_mode_name(dungeon.get('Mode', ''))

                # Area info
                area_id = dungeon.get('AreaID', '')
                area_info = self._get_area_info(area_id) if area_id else {}

                html.append(f"<p><strong>Dungeon:</strong> {dungeon_name}</p>")
                html.append(f"<p><strong>Mode:</strong> {mode}</p>")
                if area_info:
                    area_display = area_info.get('full_name', '')
                    if area_info.get('short_name'):
                        area_display = f"{area_info['short_name']} - {area_display}"
                    html.append(f"<p><strong>Area:</strong> {area_display}</p>")
                html.append("</div>")

            html.append("</div>")  # Close boss-entry

        html.append("</div>")  # Close boss-results

        # Add basic CSS
        css = """
<style>
.boss-results { font-family: Arial, sans-serif; max-width: 1200px; margin: 0 auto; }
.boss-entry { border: 2px solid #333; padding: 20px; margin: 20px 0; border-radius: 8px; }
.boss-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; }
.boss-info { flex: 1; }
.boss-icon img { width: 64px; height: 64px; border-radius: 8px; }
.skills-section { margin: 20px 0; }
.skill-entry { display: flex; justify-content: space-between; align-items: flex-start; margin: 15px 0; padding: 10px; background: #f5f5f5; border-radius: 4px; }
.skill-info { flex: 1; padding-right: 10px; }
.skill-icon img { width: 48px; height: 48px; }
.skill-type { color: #666; font-size: 0.9em; }
.skill-value { color: #28d9ed; font-weight: bold; }
.location-section { margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd; }
h2 { color: #333; margin-top: 0; }
h3 { color: #444; margin: 5px 0; }
h4 { color: #555; border-bottom: 2px solid #ddd; padding-bottom: 5px; }
h5 { margin: 5px 0; color: #666; }
</style>
"""

        return css + '\n'.join(html)

    def format_results_images(self, results: List[Dict[str, Any]], image_base_path: str = "../extracted_astudio/assets/editor/resources") -> str:
        """Format just the images panel for display on the right side

        Args:
            results: Search results
            image_base_path: Base path to the image assets folder

        Returns:
            HTML formatted string with just images
        """
        if not results:
            return "<p>No images to display</p>"

        html = []
        html.append("<div class='images-panel'>")

        for idx, result in enumerate(results, 1):
            monster = result['monster']
            model_id = result.get('model_id', '')
            name = result.get('name', 'Unknown')

            # Boss icon
            # If model_id doesn't start with '2000', use MT_{model_id}.png
            # Otherwise use IG_Turn_{model_id}.png
            if model_id and not model_id.startswith('2000'):
                icon_filename = f"MT_{model_id}.png"
            else:
                icon_filename = f"IG_Turn_{model_id}.png"
            icon_path = f"{image_base_path}/sprite/{icon_filename}"

            html.append(f"<div class='boss-images'>")
            html.append(f"<h3>Boss #{idx}: {name}</h3>")
            html.append(f"<div class='boss-main-icon'>")
            html.append(f"<img src='{icon_path}' alt='{name}' title='{name}' />")
            html.append(f"</div>")

            # Skill icons
            html.append("<div class='skill-icons'>")
            html.append("<h4>Skills</h4>")

            for i in range(1, 30):
                skill_id = monster.get(f'Skill_{i}', '')
                if skill_id:
                    skill_info = self._get_skill_info(skill_id)
                    if skill_info:
                        skill_name = skill_info.get('name', f'Skill_{i}')
                        skill_icon = skill_info.get('icon', '')

                        if skill_icon:
                            skill_icon_path = f"{image_base_path}/sprite/{skill_icon}.png"
                            html.append(f"<div class='skill-icon-item'>")
                            html.append(f"<img src='{skill_icon_path}' alt='{skill_name}' title='{skill_name}' />")
                            html.append(f"<p>{skill_name}</p>")
                            html.append(f"</div>")

            html.append("</div>")  # Close skill-icons
            html.append("</div>")  # Close boss-images
            html.append("<hr>")

        html.append("</div>")  # Close images-panel

        # Add CSS for images panel
        css = """
<style>
.images-panel { padding: 10px; }
.boss-images { margin-bottom: 20px; }
.boss-images h3 { color: #333; margin-bottom: 10px; }
.boss-main-icon { text-align: center; margin: 15px 0; }
.boss-main-icon img { width: 96px; height: 96px; border: 2px solid #333; border-radius: 8px; }
.skill-icons h4 { color: #555; margin: 10px 0 5px 0; font-size: 14px; }
.skill-icon-item { display: inline-block; margin: 5px; text-align: center; }
.skill-icon-item img { width: 48px; height: 48px; border: 1px solid #ddd; border-radius: 4px; }
.skill-icon-item p { margin: 2px 0 0 0; font-size: 10px; color: #666; max-width: 60px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
hr { border: 1px solid #ddd; margin: 20px 0; }
</style>
"""

        return css + '\n'.join(html)

    def format_results_json(self, results: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Format search results as JSON with multilingual support

        Returns:
            List of boss dictionaries with:
            - Name: {English, Korean, Japanese, Chinese}
            - Surname: {English, Korean, Japanese, Chinese}
            - IncludeSurname: bool
            - class: mapped class name (Striker, Defender, etc.)
            - element: cleaned element (Fire, Water, etc.)
            - level: int
            - skills: list of skill data
            - location: dungeon info
        """
        class_map = {
            "CCT_ATTACKER": "Striker",
            "CCT_DEFENDER": "Defender",
            "CCT_RANGER": "Ranger",
            "CCT_SUPPORTER": "Support",
            "CCT_MAGE": "Mage",
            "CCT_PRIEST": "Healer"
        }

        json_results = []

        # Get text index for multilingual names
        text_char_data = self.cache.get_data("TextCharacter.bytes")
        text_index = {t.get('IDSymbol'): t for t in text_char_data if t.get('IDSymbol')}

        for result in results:
            monster = result['monster']

            # Get names in all 4 languages
            names_data = self._get_monster_names_multilang(monster, text_index)

            # Map class
            raw_class = monster.get('Class', 'Unknown')
            mapped_class = class_map.get(raw_class, raw_class)

            # Clean element (remove CET_ prefix and capitalize first letter only)
            raw_element = monster.get('Element', 'Unknown')
            if raw_element.startswith('CET_'):
                clean_element = raw_element[4:].capitalize()  # Remove CET_ and capitalize
            else:
                clean_element = raw_element.capitalize()

            # Determine if we should include surname
            has_nickname = any(names_data['nickname'].values())

            # Build skills list with multilingual support
            skills_list = []
            for i in range(1, 30):
                skill_id = monster.get(f'Skill_{i}', '')
                if skill_id:
                    skill_info = self._get_skill_info(skill_id, multilang=True)
                    if skill_info:
                        # Check if skill name and description are valid (not untranslated keys)
                        skill_name = skill_info.get('name', {})
                        skill_name_en = skill_name.get('English', '')

                        # Skip skills with untranslated names/descriptions (like SKILL_NAME_41722 or SKILL_DESC_10766)
                        if skill_name_en.startswith('SKILL_NAME_') or skill_name_en.startswith('SKILL_DESC_'):
                            continue

                        # Get description in all languages and process placeholders
                        import re

                        # skill_info['description'] is now a dict with language keys
                        description_ml = skill_info.get('description', {})

                        # Also check if description is untranslated
                        desc_en = description_ml.get('English', '')
                        if desc_en.startswith('SKILL_DESC_') or desc_en.startswith('SKILL_NAME_'):
                            continue

                        processed_descriptions = {}

                        for lang in ['English', 'Korean', 'Japanese', 'China_Simplified']:
                            desc = description_ml.get(lang, '')
                            # Replace placeholders
                            desc_with_values = self._replace_skill_placeholders(desc)
                            # Keep HTML tags but convert \n to actual newlines
                            desc_with_values = desc_with_values.replace('\\n', '\n')
                            processed_descriptions[lang] = desc_with_values

                        skills_list.append({
                            'name': skill_info.get('name', {}),  # Dict with language keys
                            'type': skill_info.get('type', ''),
                            'description': processed_descriptions,  # Dict with language keys
                            'icon': skill_info.get('icon', '')
                        })

            # Build location info with multilingual support
            dungeon = result.get('dungeon', {})

            # Always initialize location_info with default empty values
            if dungeon:
                # Get dungeon name in all languages
                dungeon_name_ml = self._format_dungeon_full_name(dungeon, multilang=True)

                location_info = {
                    'dungeon': dungeon_name_ml,  # Dict with language keys
                    'mode': self._translate_mode_name(dungeon.get('Mode', ''), multilang=True),  # Dict with language keys
                    'area_id': dungeon.get('AreaID', '')
                }

                # Add area info if available (multilingual)
                area_id = dungeon.get('AreaID', '')
                if area_id:
                    area_info = self._get_area_info(area_id, multilang=True)
                    if area_info:
                        # Combine short_name and full_name for each language
                        area_combined = {}
                        short_name_ml = area_info.get('short_name', {})
                        full_name_ml = area_info.get('full_name', {})

                        for lang in ['English', 'Korean', 'Japanese', 'China_Simplified']:
                            short = short_name_ml.get(lang, '')
                            full = full_name_ml.get(lang, '')
                            if short and full:
                                area_combined[lang] = f"{short} - {full}"
                            elif full:
                                area_combined[lang] = full
                            elif short:
                                area_combined[lang] = short
                            else:
                                area_combined[lang] = ''

                        location_info['area'] = area_combined
            else:
                # No dungeon info - provide empty multilingual values
                location_info = {
                    'dungeon': {'English': '', 'Korean': '', 'Japanese': '', 'China_Simplified': ''},
                    'mode': {'English': '', 'Korean': '', 'Japanese': '', 'China_Simplified': ''},
                    'area_id': ''
                }

            # Build final JSON object
            model_id = result.get('model_id', '')
            monster_id = result.get('monster_id', '')

            # Convert all language keys from full names to short codes
            converted_skills = []
            for skill in skills_list:
                converted_skills.append({
                    'name': self._convert_lang_keys(skill['name']),
                    'type': skill['type'],
                    'description': self._convert_lang_keys(skill['description']),
                    'icon': skill['icon']
                })

            # Convert location info (always present now, may contain empty strings)
            converted_location = {
                'dungeon': self._convert_lang_keys(location_info.get('dungeon', {})),
                'mode': self._convert_lang_keys(location_info.get('mode', {})),
                'area_id': location_info.get('area_id', '')
            }
            if 'area' in location_info:
                converted_location['area'] = self._convert_lang_keys(location_info['area'])

            # Get BuffImmune and StatBuffImmune from monster data
            buff_immune = monster.get('BuffImmune', '')
            stat_buff_immune = monster.get('StatBuffImmune', '')

            boss_json = {
                'id': monster_id,
                'Name': self._convert_lang_keys(names_data['name']),
                'Surname': self._convert_lang_keys(names_data['nickname']),
                'IncludeSurname': False,  # Always false for export
                'class': mapped_class,
                'element': clean_element,
                'level': result.get('spawn_level', 0),
                'skills': converted_skills,
                'location': converted_location,
                'icons': model_id,
                'BuffImmune': buff_immune,
                'StatBuffImmune': stat_buff_immune
            }

            json_results.append(boss_json)

        return json_results

    def format_results(self, results: List[Dict[str, Any]], search_name: str, level: int) -> str:
        """Format search results as readable text"""
        if not results:
            return f"No monsters found matching '{search_name}' at level {level}"

        output = []
        output.append(f"=== Found {len(results)} result(s) for '{search_name}' at level {level} ===\n")

        for idx, result in enumerate(results, 1):
            monster = result['monster']

            output.append(f"\n{'='*80}")
            output.append(f"RESULT #{idx}")
            output.append(f"{'='*80}\n")

            # Basic info
            output.append(f"Name: {result['name']}")
            if result['nickname']:
                output.append(f"Nickname: {result['nickname']}")
            output.append(f"Monster ID: {result['monster_id']}")
            output.append(f"Model ID: {result['model_id']}")
            output.append(f"Type: {monster.get('Type', 'N/A')}")
            output.append(f"Race: {monster.get('Race', 'N/A')}")
            output.append(f"Class: {monster.get('Class', 'N/A')}")
            output.append(f"Element: {monster.get('Element', 'N/A')}")

            # Stats
            output.append(f"\n--- Stats ---")
            output.append(f"HP: {monster.get('HP', 'N/A')} - {monster.get('MaxHP', 'N/A')}")
            output.append(f"Attack: {monster.get('Attack', 'N/A')} - {monster.get('MaxAttack', 'N/A')}")
            output.append(f"Defense: {monster.get('Defense', 'N/A')} - {monster.get('MaxDefense', 'N/A')}")
            output.append(f"Speed: {monster.get('Speed', 'N/A')}")
            output.append(f"Critical: {monster.get('Critical', 'N/A')}")
            output.append(f"Critical DMG: {monster.get('CriticalDMG', 'N/A')}")
            output.append(f"Accuracy: {monster.get('Accuracy', 'N/A')}")
            output.append(f"Resistance: {monster.get('Resistance', 'N/A')}")

            # Skills - check both Skill_X and SkillX formats
            output.append(f"\n--- Skills ---")
            skill_found = False
            for i in range(1, 30):  # Check Skill_1 to Skill_29
                skill_id = monster.get(f'Skill_{i}', '')
                if skill_id:
                    skill_found = True
                    skill_info = self._get_skill_info(skill_id)
                    if skill_info:
                        skill_name = skill_info.get('name', f'Skill_{i}')
                        skill_desc = skill_info.get('description', '')
                        skill_type = skill_info.get('type', '')
                        level_data = skill_info.get('level_data', [])

                        # Replace placeholders in description
                        skill_desc_formatted = self._replace_skill_placeholders(skill_desc)

                        output.append(f"\nSkill {i}: {skill_name}")
                        if skill_type:
                            output.append(f"  Type: {skill_type}")
                        if skill_desc_formatted:
                            output.append(f"  Description: {skill_desc_formatted}")
                        output.append(f"  (ID: {skill_id})")

                        # Display MonsterSkillLevelTemplet data
                        if level_data:
                            output.append(f"  Level Data ({len(level_data)} level(s)):")
                            for level_entry in level_data:
                                output.append(f"    Level {level_entry.get('DescID', '?')}:")
                                # Show all non-empty fields except SkillID and ID
                                for key, value in sorted(level_entry.items()):
                                    if value and key not in ['SkillID', 'ID', 'DescID']:
                                        output.append(f"      {key}: {value}")
                    else:
                        output.append(f"\nSkill {i}: {skill_id} (details not found)")

            if not skill_found:
                output.append("  No skills found")

            # Immunities
            immunities = monster.get('Immunities', '')
            if immunities:
                output.append(f"\n--- Immunities ---")
                output.append(f"  {immunities}")

            # Spawn info
            output.append(f"\n--- Spawn Information ---")
            output.append(f"Spawn ID: {result['spawn_id']}")
            output.append(f"Spawn Level: {result['spawn_level']}")
            output.append(f"HPLineCount: {result['hp_line']}")

            # Dungeon info
            dungeon = result['dungeon']
            if dungeon:
                output.append(f"\n--- Location ---")
                # Format full dungeon name (short name + season name)
                dungeon_name_full = self._format_dungeon_full_name(dungeon)
                output.append(f"Dungeon Name: {dungeon_name_full}")
                # Show raw IDs for debugging
                if dungeon.get('DungeonShortName') or dungeon.get('Name'):
                    short_id = dungeon.get('DungeonShortName', '')
                    season_id = dungeon.get('Name', '')
                    output.append(f"  (Short: {short_id}, Season: {season_id})")

                # Translate mode name
                mode_raw = dungeon.get('Mode', 'Unknown')
                mode_translated = self._translate_mode_name(mode_raw)
                output.append(f"Dungeon Mode: {mode_translated}")
                if mode_translated != mode_raw:
                    output.append(f"  (ID: {mode_raw})")

                output.append(f"Dungeon ID: {dungeon.get('ID', 'Unknown')}")

                # Area information
                area_id = dungeon.get('AreaID', '')
                output.append(f"Area ID: {area_id if area_id else 'Unknown'}")
                if area_id:
                    area_info = self._get_area_info(area_id)
                    if area_info:
                        area_display = area_info.get('full_name', 'Unknown')
                        if area_info.get('short_name'):
                            area_display = f"{area_info['short_name']} - {area_display}"
                        output.append(f"Area Name: {area_display}")
                        if area_info.get('short_name_id') or area_info.get('full_name_id'):
                            output.append(f"  (Short: {area_info.get('short_name_id', '')}, Full: {area_info.get('full_name_id', '')})")

            # Raw data
            output.append(f"\n--- Raw Monster Data (JSON) ---")
            output.append(json.dumps(monster, indent=2))

        return '\n'.join(output)
