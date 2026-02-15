"""
ParserV3 Character Extractor - Complete character data extraction from OUTERPLANE game files

This module extracts comprehensive character data including:
- Basic info: Name (multi-language), Rarity, Element, Class, SubClass
- Voice actors (EN/JP/KR/ZH with regional variants)
- Limited status and tags (seasonal, collab, festival, premium)
- Gift preferences from TrustTemplet
- Transcendence data with multi-language descriptions
- Skills with enhancements, burn effects, buffs/debuffs
- Chain/Dual passive effects
- YouTube video IDs from official channel
- Placeholder replacement in descriptions ([Buff_C/T/V_xxx])

Features:
- Efficient caching system for fast repeated extractions
- Index-based O(1) lookups for better performance
- Multi-level buff extraction from all skill fields
- Automatic surname handling for seasonal/collab characters
- YouTube API integration for video discovery

Usage:
    extractor = CharacterExtractor("2000066")  # Charlotte
    data = extractor.extract()
    print(json.dumps(data, indent=2, ensure_ascii=False))

Author: ParserV3
Date: 2025-10
"""
from bytes_parser import Bytes_parser
from buff_extractor import BuffExtractor
from cache_manager import CacheManager
from mapping_loader import load_mappings
from youtube_search import search_character_video
from config import BYTES_FOLDER
import json
import sys
import re

# Precompile regex for buff tag replacement
_BUFF_TAG_RE = re.compile(r"\[Buff_([CTV])_([^\]]+)\]")

# Skill classification constants
OFFENSIVE_TARGETS = {'ENEMY', 'ENEMY,ENEMY'}
RANGE_TO_TARGET = {
    'SINGLE': 'mono',
    'DOUBLE': 'duo',
    'DOUBLE_SPEED': 'duo',
    'ALL': 'multi',
}

class CharacterExtractor:
    """Extract complete character data from bytes files"""

    # Class-level cache for parsers (shared across all instances)
    _parsers_cache = None
    _buff_extractor_cache = None
    _mappings_cache = None

    # Mappings loaded dynamically from TextSystem.bytes
    ELEMENT_MAP = None
    CLASS_MAP = None
    SUBCLASS_MAP = None

    @classmethod
    def _load_parsers(cls):
        """Load all parsers once and cache them at class level"""
        if cls._parsers_cache is None:
            # Use CacheManager to load pre-decoded JSON files (with checksum validation)
            cache = CacheManager(BYTES_FOLDER)

            # Load data from cache (or parse if cache invalid)
            char_data = cache.get_data("CharacterTemplet.bytes")
            skill_data = cache.get_data("CharacterSkillTemplet.bytes")
            text_char_data = cache.get_data("TextCharacter.bytes")
            text_skill_data = cache.get_data("TextSkill.bytes")
            text_system_data = cache.get_data("TextSystem.bytes")
            skill_level_data = cache.get_data("CharacterSkillLevelTemplet.bytes")
            char_extra_data = cache.get_data("CharacterExtraTemplet.bytes")
            recruit_group_data = cache.get_data("RecruitGroupTemplet.bytes")
            transcend_data = cache.get_data("CharacterTranscendentTemplet.bytes")
            trust_data = cache.get_data("TrustTemplet.bytes")

            # Build indexes for fast lookups
            char_index = {c.get('ID'): c for c in char_data}
            skill_index = {s.get('NameIDSymbol'): s for s in skill_data if s.get('NameIDSymbol')}
            text_char_index = {t.get('IDSymbol'): t for t in text_char_data if t.get('IDSymbol')}
            text_skill_index = {t.get('IDSymbol'): t for t in text_skill_data if t.get('IDSymbol')}
            text_system_index = {t.get('IDSymbol'): t for t in text_system_data if t.get('IDSymbol')}
            trust_index = {str(t.get('ID')): t for t in trust_data if t.get('ID')}

            # For skill_level, we need to group by SkillID
            skill_level_by_skill = {}
            for level in skill_level_data:
                skill_id = level.get('SkillID')
                if skill_id:
                    if skill_id not in skill_level_by_skill:
                        skill_level_by_skill[skill_id] = []
                    skill_level_by_skill[skill_id].append(level)

            # Create simple wrapper objects that mimic Bytes_parser.get_data()
            class DataWrapper:
                def __init__(self, data):
                    self._data = data
                def get_data(self):
                    return self._data

            cls._parsers_cache = {
                'char': DataWrapper(char_data),
                'skill': DataWrapper(skill_data),
                'text_char': DataWrapper(text_char_data),
                'text_skill': DataWrapper(text_skill_data),
                'skill_level': DataWrapper(skill_level_data),
                'char_extra': DataWrapper(char_extra_data),
                'recruit_group': DataWrapper(recruit_group_data),
                'transcend': DataWrapper(transcend_data),
                # Indexes for O(1) lookup
                'char_index': char_index,
                'skill_index': skill_index,
                'text_char_index': text_char_index,
                'text_skill_index': text_skill_index,
                'text_system_index': text_system_index,
                'trust_index': trust_index,
                'skill_level_by_skill': skill_level_by_skill
            }

        # Load mappings dynamically from TextSystem.bytes
        if cls._mappings_cache is None:
            mappings = load_mappings()
            cls.ELEMENT_MAP = mappings['ELEMENT_MAP']
            cls.CLASS_MAP = mappings['CLASS_MAP']
            cls.SUBCLASS_MAP = mappings['SUBCLASS_MAP']
            cls._mappings_cache = True

        if cls._buff_extractor_cache is None:
            cls._buff_extractor_cache = BuffExtractor()
        return cls._parsers_cache, cls._buff_extractor_cache

    def __init__(self, char_id: str):
        self.char_id = char_id
        self.char_data = {}

        # Use cached parsers and indexes
        parsers, buff_extractor = self._load_parsers()
        self.char_parser = parsers['char']
        self.skill_parser = parsers['skill']
        self.text_char_parser = parsers['text_char']
        self.text_skill_parser = parsers['text_skill']
        self.skill_level_parser = parsers['skill_level']
        self.char_extra_parser = parsers['char_extra']
        self.recruit_group_parser = parsers['recruit_group']
        self.transcend_parser = parsers['transcend']
        self.buff_extractor = buff_extractor

        # Store indexes for fast lookup
        self.char_index = parsers['char_index']
        self.skill_index = parsers['skill_index']
        self.text_char_index = parsers['text_char_index']
        self.text_skill_index = parsers['text_skill_index']
        self.text_system_index = parsers['text_system_index']
        self.trust_index = parsers['trust_index']
        self.skill_level_by_skill = parsers['skill_level_by_skill']

    def extract(self):
        """Main extraction method - returns complete character data"""
        # 1. Base character info
        char = self._get_character()
        if not char:
            raise ValueError(f"Character {self.char_id} not found")

        self.char_data['ID'] = self.char_id

        # 2. Names (multi-language)
        self._extract_names(char)

        # 3. Basic info
        self._extract_basic_info(char)

        # 4. Transcendance
        self._extract_transcendance(char)

        # 5. Skills
        self._extract_skills(char)

        # 5.5. Collect tags from skills and move to root level
        self._collect_skill_tags()

        # 5.6. Luna special case: merge buffs/debuffs from 2000120
        if self.char_id == '2000119':
            self._merge_luna_dual_id()

        # 6. YouTube video (automatic search)
        self._extract_video()

        # 7. Clean up empty/false fields (limited, tags)
        # Only keep limited if True
        if not self.char_data.get('limited'):
            self.char_data.pop('limited', None)

        # Only keep tags if non-empty
        if not self.char_data.get('tags'):
            self.char_data.pop('tags', None)

        # 8. Manual fields (placeholders - to be filled manually)
        self.char_data['rank'] = None
        # rank_pvp only for 3-star characters
        if self.char_data.get('Rarity') == 3:
            self.char_data['rank_pvp'] = None
        self.char_data['role'] = None
        self.char_data['skill_priority'] = {
            "First": {"prio": 0},
            "Second": {"prio": 0},
            "Ultimate": {"prio": 0}
        }

        return self.char_data

    def _get_character(self):
        """Get character data from CharacterTemplet"""
        return self.char_index.get(self.char_id)

    def _should_use_surname(self, char):
        """
        Determine if character should use surname (nickname) in fullname.
        Uses ShowNickName or ThumbnailEffect_fallback1 field from CharacterExtraTemplet.
        """
        all_extra = self.char_extra_parser.get_data()
        char_extra = next((e for e in all_extra if e.get('CharacterID') == self.char_id), None)

        if char_extra:
            # Check ShowNickName field (most characters)
            show_nickname = char_extra.get('ShowNickName', 'False')
            if show_nickname in ['True', 'true', '1']:
                return True

            # Check ThumbnailEffect_fallback1 (some seasonal characters like Ember)
            thumb_fb1 = char_extra.get('ThumbnailEffect_fallback1', 'False')
            if thumb_fb1 in ['True', 'true', '1']:
                return True

        return False

    def _extract_names(self, char):
        """Extract character names (multi-language)"""
        name_id = char.get('NameIDSymbol')
        nick_id = char.get('GachaCommentIDSymbol')
        cv_id = char.get('CVNameIDSymbol')

        # Use index for fast lookup
        name_text = self.text_char_index.get(name_id)
        nick_text = self.text_char_index.get(nick_id)

        # Voice Actors: Each language has its own IDSymbol suffix
        cv_text_en = None
        cv_text_jp = None
        cv_text_kr = None

        if cv_id:
            # Try base ID first, then with language suffixes
            cv_text_en = self.text_char_index.get(f"{cv_id}_en")
            cv_text_jp = self.text_char_index.get(f"{cv_id}_jp")
            cv_text_kr = self.text_char_index.get(f"{cv_id}_kr")

            # Fallback to base cv_id if suffixed versions not found
            if not cv_text_en:
                cv_text_en = self.text_char_index.get(cv_id)
            if not cv_text_jp:
                cv_text_jp = cv_text_en  # Use EN as fallback
            if not cv_text_kr:
                cv_text_kr = cv_text_en  # Use EN as fallback

        if name_text:
            name_en = name_text.get('English', '')
            name_jp = name_text.get('Japanese', '')
            name_kr = name_text.get('Korean', '')
            name_zh = name_text.get('China_Simplified', '')

            # Check if we should include the surname (nickname)
            if nick_text:
                nick_en = nick_text.get('English', '')
                nick_jp = nick_text.get('Japanese', '')
                nick_kr = nick_text.get('Korean', '')
                nick_zh = nick_text.get('China_Simplified', '')

                # Determine if we should use surname
                # Need to check limited/tags status first
                use_surname = self._should_use_surname(char)

                # Fallback: Check ShowNickName field in CharacterExtraTemplet if limited/tags not set yet
                if not use_surname:
                    all_extra = self.char_extra_parser.get_data()
                    char_extra = next((e for e in all_extra if e.get('CharacterID') == self.char_id), None)

                    if char_extra:
                        # Use ShowNickName field from CharacterExtraTemplet
                        show_nickname = char_extra.get('ShowNickName', 'False')
                        use_surname = show_nickname in ['True', 'true', '1']
                # If not in CharacterExtraTemplet, character is normal (no surname)

                if use_surname:
                    # Include nickname before name
                    self.char_data['Fullname'] = f"{nick_en} {name_en}".strip()
                    self.char_data['Fullname_jp'] = f"{nick_jp} {name_jp}".strip() if (nick_jp or name_jp) else None
                    self.char_data['Fullname_kr'] = f"{nick_kr} {name_kr}".strip() if (nick_kr or name_kr) else None
                    self.char_data['Fullname_zh'] = f"{nick_zh} {name_zh}".strip() if (nick_zh or name_zh) else None
                else:
                    # Just use the name
                    self.char_data['Fullname'] = name_en
                    self.char_data['Fullname_jp'] = name_jp or None
                    self.char_data['Fullname_kr'] = name_kr or None
                    self.char_data['Fullname_zh'] = name_zh or None
            else:
                # No nickname, just use the name
                self.char_data['Fullname'] = name_en
                self.char_data['Fullname_jp'] = name_jp or None
                self.char_data['Fullname_kr'] = name_kr or None
                self.char_data['Fullname_zh'] = name_zh or None

        # Extract Voice Actors from respective IDSymbols and columns
        # English: {cv_id}_en → English column
        if cv_text_en:
            self.char_data['VoiceActor'] = cv_text_en.get('English', '')
        else:
            self.char_data['VoiceActor'] = ''

        # Japanese: {cv_id}_jp → Japanese column (fallback to English if empty/0)
        cv_jp = ''
        if cv_text_jp:
            cv_jp = cv_text_jp.get('Japanese', '')
            # Fallback to English if Japanese is empty or "0"
            if not cv_jp or cv_jp == '0':
                cv_jp = cv_text_jp.get('English', '')
        self.char_data['VoiceActor_jp'] = cv_jp

        # Korean: {cv_id}_kr → Korean column (fallback to English if empty/0)
        cv_kr = ''
        if cv_text_kr:
            cv_kr = cv_text_kr.get('Korean', '')
            # Fallback to English if Korean is empty or "0"
            if not cv_kr or cv_kr == '0':
                cv_kr = cv_text_kr.get('English', '')
        self.char_data['VoiceActor_kr'] = cv_kr

        # Chinese: {cv_id}_jp → China_Simplified column (fallback to English if empty/0)
        # Chinese version uses JP voice actors with Chinese localized names
        cv_zh = ''
        if cv_text_jp:
            cv_zh = cv_text_jp.get('China_Simplified', '')
            # Fallback to English if China_Simplified is empty or "0"
            if not cv_zh or cv_zh == '0':
                cv_zh = cv_text_jp.get('English', '')
        self.char_data['VoiceActor_zh'] = cv_zh

    def _extract_basic_info(self, char):
        """Extract basic character information"""
        # Rarity (with Alice fix)
        if self.char_id == '2000020':
            self.char_data['Rarity'] = 3
        else:
            basic_star = char.get('BasicStar', '1')
            try:
                self.char_data['Rarity'] = int(basic_star)
            except:
                self.char_data['Rarity'] = 1

        # Element, Class, SubClass
        self.char_data['Element'] = self.ELEMENT_MAP.get(char.get('Element'), char.get('Element'))
        self.char_data['Class'] = self.CLASS_MAP.get(char.get('Class'), char.get('Class'))
        self.char_data['SubClass'] = self.SUBCLASS_MAP.get(char.get('SubClass'), char.get('SubClass'))

        # Detect character type from RecruitGroupTemplet
        all_recruit_groups = self.recruit_group_parser.get_data()
        recruit_group = next((g for g in all_recruit_groups if g.get('EndDateTime') == self.char_id), None)

        if recruit_group:
            # Check ShowDate_fallback1 to determine character type
            showdate_marker = recruit_group.get('ShowDate_fallback1', '')
            showdate_fb2 = recruit_group.get('ShowDate_fallback2', '')

            if showdate_marker == 'PREMIUM':
                # Premium characters (festival banner)
                self.char_data['limited'] = False
                self.char_data['tags'] = ['premium']
            elif showdate_marker == 'OUTER_FES':
                # Limited festival characters (Gnosis Dahlia, Gnosis Nella, Omega Nadja)
                self.char_data['limited'] = True
                self.char_data['tags'] = ['limited']
            elif showdate_marker == 'SEASONAL':
                # Limited seasonal/collab - check ShowDate_fallback2 to distinguish
                self.char_data['limited'] = True

                if 'Collabo' in showdate_fb2:
                    self.char_data['tags'] = ['collab']
                elif 'Seasonal' in showdate_fb2:
                    self.char_data['tags'] = ['seasonal']
                else:
                    # Fallback to seasonal if unknown
                    self.char_data['tags'] = ['seasonal']
            else:
                # Unknown marker - default to normal character
                self.char_data['limited'] = False
                self.char_data['tags'] = []
        else:
            # Not in RecruitGroupTemplet - fallback to CharacterExtraTemplet
            all_extra = self.char_extra_parser.get_data()
            char_extra = next((e for e in all_extra if e.get('CharacterID') == self.char_id), None)

            if char_extra:
                thumbnail = char_extra.get('ThumbnailEffect', '')

                if thumbnail == 'FX_UI_Character_List_Dungeon':
                    # Collab characters (fallback detection)
                    self.char_data['limited'] = True
                    self.char_data['tags'] = ['collab']
                elif thumbnail == 'FX_UI_Character_List_Seasonal' or thumbnail.startswith('FX_UI_Character_List_2'):
                    # Seasonal characters (fallback detection)
                    self.char_data['limited'] = True
                    self.char_data['tags'] = ['seasonal']
                elif thumbnail == 'FX_UI_Character_List_Demi':
                    # Ambiguous - could be premium or limited festival
                    # Default to normal character since we can't distinguish
                    self.char_data['limited'] = False
                    self.char_data['tags'] = []
                else:
                    # Unknown or no thumbnail - normal character
                    self.char_data['limited'] = False
                    self.char_data['tags'] = []
            else:
                # Not in either - normal character
                self.char_data['limited'] = False
                self.char_data['tags'] = []

        # Extract gift preference from TrustTemplet
        trust_entry = self.trust_index.get(self.char_id)
        if trust_entry:
            present_type = trust_entry.get('PresentTypeLike')
            if present_type:
                # Map to English name via TextSystem
                text_key = f'SYS_{present_type}'
                text_entry = self.text_system_index.get(text_key)
                if text_entry:
                    self.char_data['gift'] = text_entry.get('English', '')

    def _extract_video(self):
        """Extract YouTube video ID from official OUTERPLANE channel"""
        # Get the character name for search
        fullname = self.char_data.get('Fullname', '')

        if not fullname:
            return  # Don't add video key if no name

        # Strategy: Try full name first, then fallback to base name
        video_url = None

        try:
            # First attempt: Search with full name
            video_url = search_character_video(fullname, search_official_only=True)

            # If not found and fullname has multiple words, try base name (last word)
            if not video_url and ' ' in fullname:
                # Example: "Summer Knight's Dream Ember" -> "Ember"
                base_name = fullname.split()[-1]
                video_url = search_character_video(base_name, search_official_only=True)

            # Extract just the video ID from the URL
            if video_url:
                # Extract ID from URL: https://www.youtube.com/watch?v=VIDEO_ID
                match = re.search(r'[?&]v=([^&]+)', video_url)
                if match:
                    self.char_data['video'] = match.group(1)
                # If no match, don't add video key
        except Exception as e:
            print(f"Warning: Failed to search YouTube for '{fullname}': {e}")
            # Don't add video key on error

    def _extract_transcendance(self, char):
        """Extract transcendance data"""
        transcend = {"1": None}  # Transcend 1 is always null

        # Get rarity
        rarity = self.char_data.get('Rarity', 3)

        # Transcend 2: null or stats based on rarity
        if rarity < 3:
            transcend["2"] = "ATK DEF HP +5%"
            transcend["2_jp"] = "ATK DEF HP +5%"
            transcend["2_kr"] = "ATK DEF HP +5%"
            transcend["2_zh"] = "ATK DEF HP +5%"
        else:
            # For rarity 3, transcend 2 is null (no localized versions needed)
            transcend["2"] = None

        # Transcend 3-6: Extract from SKT_UNIQUE_PASSIVE + hardcoded stats
        # Find SKT_UNIQUE_PASSIVE skill
        unique_passive_skill = None

        for key, value in char.items():
            if key.startswith('Skill_') and value and value != '0':
                skill = self.skill_index.get(value)
                if skill and skill.get('SkillType') == 'SKT_UNIQUE_PASSIVE':
                    unique_passive_skill = value
                    break

        # Get SKT_UNIQUE_PASSIVE skill levels for descriptions
        unique_passive_descs = {}
        if unique_passive_skill:
            unique_levels = self.skill_level_by_skill.get(unique_passive_skill, [])

            for level in unique_levels:
                skill_level = level.get('SkillLevel', 'N/A')
                # Find SE_DESC references
                for key, value in level.items():
                    if isinstance(value, str) and value.startswith('SE_DESC'):
                        # Get text from TextSkill
                        text_entry = self._get_skill_text(value)
                        if text_entry:
                            # Replace literal \\n with actual newlines
                            unique_passive_descs[skill_level] = {
                                'en': text_entry.get('English', '').replace('\\n', '\n'),
                                'jp': text_entry.get('Japanese', '').replace('\\n', '\n'),
                                'kr': text_entry.get('Korean', '').replace('\\n', '\n'),
                                'zh': text_entry.get('China_Simplified', '').replace('\\n', '\n')
                            }
                        break

        # Transcend 3: ATK DEF HP +10% (all rarities)
        transcend["3"] = "ATK DEF HP +10%"
        transcend["3_jp"] = "ATK DEF HP +10%"
        transcend["3_kr"] = "ATK DEF HP +10%"
        transcend["3_zh"] = "ATK DEF HP +10%"

        # Transcend 4
        if rarity < 3:
            # Rarity 1-2: single entry
            base_stats = "ATK DEF HP +16%"
            if '2' in unique_passive_descs:
                desc = unique_passive_descs['2']['en']
                transcend["4"] = f"{base_stats}\n{desc}" if desc else base_stats
                if unique_passive_descs['2']['jp']:
                    transcend["4_jp"] = f"{base_stats}\n{unique_passive_descs['2']['jp']}"
                if unique_passive_descs['2']['kr']:
                    transcend["4_kr"] = f"{base_stats}\n{unique_passive_descs['2']['kr']}"
                if unique_passive_descs['2']['zh']:
                    transcend["4_zh"] = f"{base_stats}\n{unique_passive_descs['2']['zh']}"
            else:
                transcend["4"] = base_stats
        else:
            # Rarity 3: split into 4_1 and 4_2
            base_stats = "ATK DEF HP +16%"
            if '2' in unique_passive_descs:
                desc = unique_passive_descs['2']['en']
                transcend["4_1"] = f"{base_stats}\n{desc}" if desc else base_stats
                if unique_passive_descs['2']['jp']:
                    transcend["4_1_jp"] = f"{base_stats}\n{unique_passive_descs['2']['jp']}"
                if unique_passive_descs['2']['kr']:
                    transcend["4_1_kr"] = f"{base_stats}\n{unique_passive_descs['2']['kr']}"
                if unique_passive_descs['2']['zh']:
                    transcend["4_1_zh"] = f"{base_stats}\n{unique_passive_descs['2']['zh']}"
            else:
                transcend["4_1"] = base_stats
            # 4_2 is hardcoded stats only (no localization needed)
            transcend["4_2"] = "ATK DEF HP +19%"

        # Transcend 5
        if rarity < 3:
            # Rarity 1-2: single entry
            base_stats = "ATK DEF HP +22%"
            if '3' in unique_passive_descs:
                desc = unique_passive_descs['3']['en']
                transcend["5"] = f"{base_stats}\n{desc}" if desc else base_stats
                if unique_passive_descs['3']['jp']:
                    transcend["5_jp"] = f"{base_stats}\n{unique_passive_descs['3']['jp']}"
                if unique_passive_descs['3']['kr']:
                    transcend["5_kr"] = f"{base_stats}\n{unique_passive_descs['3']['kr']}"
                if unique_passive_descs['3']['zh']:
                    transcend["5_zh"] = f"{base_stats}\n{unique_passive_descs['3']['zh']}"
            else:
                transcend["5"] = base_stats
        else:
            # Rarity 3: split into 5_1, 5_2, 5_3
            base_stats = "ATK DEF HP +22%"
            if '3' in unique_passive_descs:
                desc = unique_passive_descs['3']['en']
                transcend["5_1"] = f"{base_stats}\n{desc}" if desc else base_stats
                if unique_passive_descs['3']['jp']:
                    transcend["5_1_jp"] = f"{base_stats}\n{unique_passive_descs['3']['jp']}"
                if unique_passive_descs['3']['kr']:
                    transcend["5_1_kr"] = f"{base_stats}\n{unique_passive_descs['3']['kr']}"
                if unique_passive_descs['3']['zh']:
                    transcend["5_1_zh"] = f"{base_stats}\n{unique_passive_descs['3']['zh']}"
            else:
                transcend["5_1"] = base_stats
            # 5_2 and 5_3 are hardcoded stats only (no localization needed)
            transcend["5_2"] = "ATK DEF HP +25%"
            transcend["5_3"] = "ATK DEF HP +28%"

        # Transcend 6
        base_stats = "ATK DEF HP +30%"
        if '4' in unique_passive_descs:
            desc = unique_passive_descs['4']['en']
            transcend["6"] = f"{base_stats}\n{desc}" if desc else base_stats
            if unique_passive_descs['4']['jp']:
                transcend["6_jp"] = f"{base_stats}\n{unique_passive_descs['4']['jp']}"
            if unique_passive_descs['4']['kr']:
                transcend["6_kr"] = f"{base_stats}\n{unique_passive_descs['4']['kr']}"
            if unique_passive_descs['4']['zh']:
                transcend["6_zh"] = f"{base_stats}\n{unique_passive_descs['4']['zh']}"
        else:
            transcend["6"] = base_stats

        self.char_data['transcend'] = transcend

    def _extract_skills(self, char):
        """Extract all skills with complete data"""
        # 1. Get all skill IDs
        skill_ids = []
        for key, value in char.items():
            if key.startswith('Skill_') and value and value != '0':
                skill_ids.append(value)

        # 2. Load skills
        all_skills = self.skill_parser.get_data()
        char_skills = {}

        for skill in all_skills:
            name_id = skill.get('NameIDSymbol')
            if name_id in skill_ids:
                skill_type = skill.get('SkillType', '?')
                char_skills[skill_type] = skill

        # 3. Process each skill
        self.char_data['skills'] = {}

        # Main skills: FIRST, SECOND, ULTIMATE
        main_skills = ['SKT_FIRST', 'SKT_SECOND', 'SKT_ULTIMATE']

        for skill_type in main_skills:
            if skill_type in char_skills:
                skill = char_skills[skill_type]
                self.char_data['skills'][skill_type] = self._process_skill(skill)

        # Note: SKT_UNIQUE_PASSIVE est intentionnellement exclu
        # Les fichiers existants ne l'incluent pas

        # Add chain passive if exists
        if 'SKT_CHAIN_PASSIVE' in char_skills:
            skill = char_skills['SKT_CHAIN_PASSIVE']
            self.char_data['skills']['SKT_CHAIN_PASSIVE'] = self._process_skill(skill)

            # Chain: hardcode classification (always offensive AoE in-game)
            self.char_data['skills']['SKT_CHAIN_PASSIVE']['offensive'] = True
            self.char_data['skills']['SKT_CHAIN_PASSIVE']['target'] = 'multi'
            # Dual attack: always offensive single target
            self.char_data['skills']['SKT_CHAIN_PASSIVE']['dual_offensive'] = True
            self.char_data['skills']['SKT_CHAIN_PASSIVE']['dual_target'] = 'mono'

            # Extract chain & dual buffs/debuffs
            self._extract_chain_dual_buffs()

            # Extract Chain_Type from IconName
            self._extract_chain_type(skill)

        # 4. Extract burst data (if any skill has burst)
        self._extract_burst(char_skills)

        # 5. Replace placeholders in descriptions
        self._translate_descriptions()

    def _process_skill(self, skill):
        """Process a single skill - extract name, description, etc."""
        skill_data = {}

        # NameIDSymbol for lookups
        name_id = skill.get('NameIDSymbol')
        skill_data['NameIDSymbol'] = name_id

        # Icon and type info
        skill_data['IconName'] = skill.get('IconName')
        skill_data['SkillType'] = skill.get('SkillType')

        # Get skill name from TextSkill
        skip_name_id = skill.get('SkipNameID')
        if skip_name_id:
            name_texts = self._get_skill_text(skip_name_id)
            if name_texts:
                skill_data['name'] = name_texts.get('English', '')
                skill_data['name_jp'] = name_texts.get('Japanese', '')
                skill_data['name_kr'] = name_texts.get('Korean', '')
                skill_data['name_zh'] = name_texts.get('China_Simplified', '')

        # Get skill description
        desc_id = skill.get('DescID', '')
        if desc_id:
            # Parse DescID (peut contenir plusieurs refs séparées par virgules)
            desc_ids = [d.strip() for d in desc_id.split(',')]

            # On prend uniquement les _LV1 et on les déduplique
            lv1_descs = []
            seen = set()
            for d in desc_ids:
                if d.endswith('_LV1') and d not in seen:
                    lv1_descs.append(d)
                    seen.add(d)

            descriptions_en = []
            descriptions_jp = []
            descriptions_kr = []
            descriptions_zh = []

            for desc_ref in lv1_descs:
                desc_texts = self._get_skill_text(desc_ref)
                if desc_texts:
                    if desc_texts.get('English'):
                        descriptions_en.append(desc_texts['English'])
                    if desc_texts.get('Japanese'):
                        descriptions_jp.append(desc_texts['Japanese'])
                    if desc_texts.get('Korean'):
                        descriptions_kr.append(desc_texts['Korean'])
                    if desc_texts.get('China_Simplified'):
                        descriptions_zh.append(desc_texts['China_Simplified'])

            if descriptions_en:
                skill_data['true_desc'] = '\n'.join(descriptions_en)
            if descriptions_jp:
                skill_data['true_desc_jp'] = '\n'.join(descriptions_jp)
            if descriptions_kr:
                skill_data['true_desc_kr'] = '\n'.join(descriptions_kr)
            if descriptions_zh:
                skill_data['true_desc_zh'] = '\n'.join(descriptions_zh)

            # Extract true_desc_levels (all 5 levels)
            # DescID has exactly 5 comma-separated refs: positions 0-4 = levels 1-5
            if len(desc_ids) == 5:
                true_desc_levels = {}
                for level_idx, desc_ref in enumerate(desc_ids):
                    level_num = str(level_idx + 1)
                    desc_texts = self._get_skill_text(desc_ref)
                    if desc_texts:
                        true_desc_levels[level_num] = desc_texts.get('English', '') or ''
                        true_desc_levels[f"{level_num}_jp"] = desc_texts.get('Japanese', '') or ''
                        true_desc_levels[f"{level_num}_kr"] = desc_texts.get('Korean', '') or ''
                        true_desc_levels[f"{level_num}_zh"] = desc_texts.get('China_Simplified', '') or ''
                    else:
                        true_desc_levels[level_num] = ''
                        true_desc_levels[f"{level_num}_jp"] = ''
                        true_desc_levels[f"{level_num}_kr"] = ''
                        true_desc_levels[f"{level_num}_zh"] = ''
                skill_data['true_desc_levels'] = true_desc_levels

        # Get enhancement levels (2-5)
        skill_data['enhancement'] = self._get_enhancement_levels(name_id)

        # Cooldown and WGR - special logic like ParserV2
        skill_type = skill.get('SkillType')

        if skill_type == 'SKT_FIRST':
            # SKT_FIRST always has wgr=1 and cd=None
            skill_data['wgr'] = 1
            skill_data['cd'] = None
        elif skill_type == 'SKT_CHAIN_PASSIVE':
            # Chain passives always have wgr=3, wgr_dual=1, cd=None
            skill_data['wgr'] = 3
            skill_data['wgr_dual'] = 1
            skill_data['cd'] = None
        else:
            # For other skills, extract from CharacterSkillLevelTemplet
            cd, wgr = self._get_cd_wgr(name_id)
            if cd is not None:
                # Convert CD to string to match existing format
                skill_data['cd'] = str(cd)
            if wgr is not None:
                skill_data['wgr'] = wgr

        # Extract buffs/debuffs and tags from BuffID
        buff_debuff_data = self._extract_buffs_debuffs(name_id)
        if buff_debuff_data:
            skill_data['buff'] = buff_debuff_data.get('buff', [])
            skill_data['debuff'] = buff_debuff_data.get('debuff', [])
            # Store tags temporarily (will be collected at character level)
            tags = buff_debuff_data.get('tags', [])
            if tags:
                skill_data['_tags'] = tags  # Prefix with _ to mark as temporary

        # Skill classification: offensive + target
        target_team = skill.get('TargetTeamType', '')
        range_type = skill.get('RangeType', '')
        skill_data['offensive'] = target_team in OFFENSIVE_TARGETS
        skill_data['target'] = RANGE_TO_TARGET.get(range_type)

        return skill_data

    def _get_skill_text(self, text_id):
        """Get text from TextSkill.bytes by IDSymbol"""
        return self.text_skill_index.get(text_id, {})

    def _get_enhancement_levels(self, skill_id):
        """Get enhancement levels 2-5 for a skill (multi-language)"""
        # Use index for fast lookup
        skill_levels = self.skill_level_by_skill.get(skill_id, [])

        enhancements = {}

        for level in skill_levels:
            skill_level = level.get('SkillLevel')

            # Levels 2-5 sont les enhancements (1 est le base)
            if skill_level and skill_level in ['2', '3', '4', '5']:
                level_data_en = []
                level_data_jp = []
                level_data_kr = []
                level_data_zh = []

                # Chercher les champs qui commencent par SE_, SKILL_DESC_, ou SKILL_NAME_
                enhance_raw = ""
                for key, value in level.items():
                    if isinstance(value, str) and (value.startswith("SE_") or
                                                   value.startswith("SKILL_DESC_") or
                                                   value.startswith("SKILL_NAME_")):
                        enhance_raw = value
                        break

                if enhance_raw:
                    # Split par virgule et traiter chaque référence
                    enhance_refs = [e.strip() for e in enhance_raw.split(',') if e.strip()]

                    for ref in enhance_refs:
                        desc_texts = self._get_skill_text(ref)
                        if desc_texts:
                            if desc_texts.get('English'):
                                level_data_en.append(desc_texts['English'])
                            if desc_texts.get('Japanese'):
                                level_data_jp.append(desc_texts['Japanese'])
                            if desc_texts.get('Korean'):
                                level_data_kr.append(desc_texts['Korean'])
                            if desc_texts.get('China_Simplified'):
                                level_data_zh.append(desc_texts['China_Simplified'])

                # Add English enhancement
                if level_data_en:
                    enhancements[skill_level] = level_data_en

                # Add Japanese enhancement
                if level_data_jp:
                    enhancements[f"{skill_level}_jp"] = level_data_jp

                # Add Korean enhancement
                if level_data_kr:
                    enhancements[f"{skill_level}_kr"] = level_data_kr

                # Add Chinese enhancement
                if level_data_zh:
                    enhancements[f"{skill_level}_zh"] = level_data_zh

        return enhancements if enhancements else None

    def _get_cd_wgr(self, skill_id):
        """Get cooldown and weakness gauge reduce for a skill"""
        # Use index for fast lookup
        skill_levels = self.skill_level_by_skill.get(skill_id, [])

        if not skill_levels:
            return None, None

        # Chercher avec DescID == "1" d'abord
        data = next((l for l in skill_levels if l.get('DescID') == '1'), None)

        # Si pas trouvé, chercher avec GainCP == "1"
        if not data:
            data = next((l for l in skill_levels if l.get('GainCP') == '1'), None)

        # Si toujours pas trouvé, chercher avec DamageFactor == "1"
        if not data:
            data = next((l for l in skill_levels if l.get('DamageFactor') == '1'), None)

        if not data:
            return None, None

        # Extract cooldown
        cool = None
        start_cool = data.get('StartCool')
        cool_val = data.get('Cool')

        # Vérifier que StartCool est bien un nombre (pas un BuffID)
        if start_cool and str(start_cool).isdigit():
            if start_cool == cool_val:
                cool = int(start_cool)
            else:
                cool = int(start_cool)

        # Extract WGReduce
        wg = None
        wg_val = data.get('WGReduce')
        if wg_val and str(wg_val).isdigit():
            wg = int(wg_val)

        # Check if skill is non-damaging (buff/heal/debuff only)
        # These skills should have wgr=null even if WGReduce is set in data
        skill_info = self.skill_index.get(skill_id)
        if skill_info:
            non_damaging_types = ['CAST_BUFF', 'HEAL', 'GUARD', 'NONE', 'CAST_DEBUFF']

            # Check ApproachType (primary field)
            approach_type = skill_info.get('ApproachType', '') or ''
            if approach_type in non_damaging_types:
                wg = None

            # Check ApproachTime (some skills use this instead of ApproachType)
            # Only CAST_BUFF and HEAL are safe here - CAST_DEBUFF/NONE can still deal damage
            approach_time = skill_info.get('ApproachTime', '') or ''
            if approach_time in ['CAST_BUFF', 'HEAL', 'GUARD']:
                wg = None

            # Passive skills have no wgr (TriggerNameSkip=PASSIVE)
            trigger = skill_info.get('TriggerNameSkip', '') or ''
            if trigger == 'PASSIVE':
                wg = None

            # Also check fallback fields for CAST_BUFF/CAST_DEBUFF
            # Some skills don't have ApproachType but have it in fallback fields
            if not approach_type and not approach_time:
                for key, value in skill_info.items():
                    if 'fallback' in key and value in non_damaging_types:
                        wg = None
                        break

        return cool, wg

    def _extract_buffs_debuffs(self, skill_id):
        """Extract buffs and debuffs for a skill using BuffExtractor from ALL levels (1-5)"""
        # Use index for fast lookup
        skill_levels = self.skill_level_by_skill.get(skill_id, [])

        if not skill_levels:
            return None

        # Collect BuffIDs from ALL levels (not just level 1)
        # Check multiple fields: BuffID, GainCP, GainAP, StartCool, DamageFactor, and _fallback fields
        all_buff_ids = []
        fields_to_check = ['BuffID', 'GainCP', 'GainAP', 'StartCool', 'DamageFactor']

        for level in skill_levels:
            # Check standard fields
            for field in fields_to_check:
                buff_id_str = level.get(field, '')
                if buff_id_str and buff_id_str != '0':
                    # Split comma-separated BuffIDs
                    buff_ids = [b.strip() for b in buff_id_str.split(',') if b.strip() and b.strip() != '0']
                    all_buff_ids.extend(buff_ids)

            # Also check all _fallback fields (e.g., Cool_fallback1, BuffID_fallback1, etc.)
            for key, value in level.items():
                if '_fallback' in key and value and value != '0':
                    # Split comma-separated BuffIDs
                    buff_ids = [b.strip() for b in str(value).split(',') if b.strip() and b.strip() != '0']
                    all_buff_ids.extend(buff_ids)

        # Find conditional buffs (ON_SPAWN, SKILL_FINISH, etc.) for this skill
        # Determine skill number from skill_id
        skill_info = self.skill_index.get(skill_id)
        if skill_info:
            skill_type = skill_info.get('SkillType', '')
            # Map SkillType to skill number: SKT_FIRST=1, SKT_SECOND=2, SKT_ULTIMATE=3
            skill_num_map = {
                'SKT_FIRST': '1',
                'SKT_SECOND': '2',
                'SKT_ULTIMATE': '3',
                'SKT_CHAIN_PASSIVE': '4'
            }
            skill_num = skill_num_map.get(skill_type)
            if skill_num:
                # Find conditional buffs for this character+skill combination
                conditional_buffs = self.buff_extractor.find_conditional_buffs(self.char_id, skill_num)
                all_buff_ids.extend(conditional_buffs)

        if not all_buff_ids:
            return None

        # Remove duplicates while preserving order
        # Also convert special IDs (like "87" for Heavy Strike)
        seen = set()
        unique_buff_ids = []
        for buff_id in all_buff_ids:
            # Special case: "87" is Heavy Strike (BuffToolTipTemplet special entry)
            if buff_id == '87':
                buff_id = 'HEAVY_STRIKE'

            if buff_id not in seen:
                seen.add(buff_id)
                unique_buff_ids.append(buff_id)

        # Join all BuffIDs with commas for BuffExtractor
        combined_buff_ids = ','.join(unique_buff_ids)

        # Use BuffExtractor to extract buffs/debuffs
        return self.buff_extractor.extract_from_buff_ids(combined_buff_ids)

    def _extract_chain_dual_buffs(self):
        """Extract chain passive and dual attack buffs/debuffs"""
        if 'SKT_CHAIN_PASSIVE' not in self.char_data.get('skills', {}):
            return

        chain_passive_skill = self.char_data['skills']['SKT_CHAIN_PASSIVE']

        # Search in ALL skill levels for BuffIDs containing char_id_chain or char_id_backup
        # (Don't filter by NameIDSymbol because Luna has multiple skill IDs)
        all_levels = self.skill_level_parser.get_data()

        chain_buff_id = None
        backup_buff_id = None

        # Find chain and backup buffs by searching ALL fields in ALL levels
        for level in all_levels:
            # Check all fields for BuffIDs starting with char_id_chain or char_id_backup
            for key, value in level.items():
                if isinstance(value, str):
                    # Chain buff (e.g., "2000119_chain_1_1,2000119_chain_1_2")
                    if f"{self.char_id}_chain" in value:
                        chain_buff_id = value.split(',')[0].strip()
                    # Backup/dual buff (e.g., "2000119_backup_1_1")
                    if f"{self.char_id}_backup" in value:
                        backup_buff_id = value.split(',')[0].strip()
            # Stop if both found
            if chain_buff_id and backup_buff_id:
                break

        if chain_buff_id:
            chain_result = self.buff_extractor.extract_from_buff_ids(chain_buff_id)
            # Always store as lists for consistency
            if chain_result.get('buff') and len(chain_result['buff']) > 0:
                chain_passive_skill['buff'] = chain_result['buff']
            if chain_result.get('debuff') and len(chain_result['debuff']) > 0:
                chain_passive_skill['debuff'] = chain_result['debuff']

        # Check for Heavy Strike in Chain Starter Effect description
        desc = chain_passive_skill.get('true_desc', '')
        if 'Chain Starter Effect' in desc and 'Heavy Strike' in desc:
            # Extract the Chain Starter section
            chain_section = desc.split('Chain Starter Effect')[1]
            # Stop at next section (Dual Attack Effect or Chain Burst Effect)
            for next_section in ['Dual Attack Effect', 'Chain Burst Effect']:
                if next_section in chain_section:
                    chain_section = chain_section.split(next_section)[0]
                    break

            # Check if Heavy Strike is mentioned in this specific section
            if 'Heavy Strike' in chain_section:
                # Add HEAVY_STRIKE to buff
                if 'buff' not in chain_passive_skill:
                    chain_passive_skill['buff'] = []
                if 'HEAVY_STRIKE' not in chain_passive_skill['buff']:
                    chain_passive_skill['buff'].append('HEAVY_STRIKE')

        if backup_buff_id:
            backup_result = self.buff_extractor.extract_from_buff_ids(backup_buff_id)

            # Filter out heal/internal effects that are not meaningful for dual attacks
            DUAL_IGNORE = {'BT_HEAL_BASED_CASTER', 'BT_HEAL_BASED_TARGET', 'BT_STAT|ST_VAMPIRIC'}
            dual_buffs = [b for b in backup_result.get('buff', []) if b not in DUAL_IGNORE]
            dual_debuffs = backup_result.get('debuff', [])

            # Always set both keys when backup exists for consistency
            chain_passive_skill['dual_buff'] = dual_buffs
            chain_passive_skill['dual_debuff'] = dual_debuffs

        # Check for Heavy Strike in Dual Attack Effect description
        desc = chain_passive_skill.get('true_desc', '')
        if 'Dual Attack Effect' in desc and 'Heavy Strike' in desc:
            # Extract the Dual Attack section
            dual_section = desc.split('Dual Attack Effect')[1]
            # Stop at next section if exists (Chain Burst Effect, etc.)
            if 'Chain Burst Effect' in dual_section:
                dual_section = dual_section.split('Chain Burst Effect')[0]

            # Check if Heavy Strike is mentioned in this specific section
            if 'Heavy Strike' in dual_section:
                # Add HEAVY_STRIKE to dual_buff
                if 'dual_buff' not in chain_passive_skill:
                    chain_passive_skill['dual_buff'] = []
                if 'HEAVY_STRIKE' not in chain_passive_skill['dual_buff']:
                    chain_passive_skill['dual_buff'].append('HEAVY_STRIKE')

    def _collect_skill_tags(self):
        """Collect all tags from skills and move them to character root level"""
        all_tags = []

        # Iterate through all skills
        for skill_type, skill_data in self.char_data.get('skills', {}).items():
            # Check if skill has temporary _tags field
            if '_tags' in skill_data:
                tags = skill_data.pop('_tags')  # Remove from skill
                all_tags.extend(tags)

        # Remove duplicates and add to character root if any tags found
        if all_tags:
            unique_tags = list(dict.fromkeys(all_tags))  # Preserve order while removing duplicates
            if 'tags' not in self.char_data:
                self.char_data['tags'] = []
            self.char_data['tags'].extend(unique_tags)

    def _extract_chain_type(self, skill):
        """Extract Chain_Type from true_desc by detecting 'Chain xxx Effect' text"""
        # Get the true_desc from SKT_CHAIN_PASSIVE
        chain_passive_skill = self.char_data.get('skills', {}).get('SKT_CHAIN_PASSIVE', {})
        true_desc = chain_passive_skill.get('true_desc', '')

        if not true_desc:
            return

        # Check for Chain effect types in description
        # Format: <color=#ffd732>Chain xxx Effect</color>
        if 'Chain Starter Effect' in true_desc:
            self.char_data['Chain_Type'] = 'Start'
        elif 'Chain Companion Effect' in true_desc:
            self.char_data['Chain_Type'] = 'Join'
        elif 'Chain Finish Effect' in true_desc:
            self.char_data['Chain_Type'] = 'Finish'

    def _merge_luna_dual_id(self):
        """
        Luna special case: merge buffs/debuffs from 2000120 into 2000119
        Luna has two forms (White Night/Polar Night) with different skill effects
        """
        # Extract 2000120
        try:
            luna_120 = CharacterExtractor('2000120')
            luna_120_data = luna_120.extract()

            # Merge buffs/debuffs from each skill
            for skill_name in ['SKT_FIRST', 'SKT_SECOND', 'SKT_ULTIMATE', 'SKT_CHAIN_PASSIVE']:
                if skill_name in self.char_data.get('skills', {}) and skill_name in luna_120_data.get('skills', {}):
                    skill_119 = self.char_data['skills'][skill_name]
                    skill_120 = luna_120_data['skills'][skill_name]

                    # Merge buffs
                    buffs_119 = skill_119.get('buff', [])
                    buffs_120 = skill_120.get('buff', [])

                    # Convert to list if string
                    if isinstance(buffs_119, str):
                        buffs_119 = [buffs_119]
                    if isinstance(buffs_120, str):
                        buffs_120 = [buffs_120]

                    # Merge and deduplicate (preserve order)
                    merged_buffs = buffs_119.copy()
                    for buff in buffs_120:
                        if buff and buff not in merged_buffs:
                            merged_buffs.append(buff)

                    skill_119['buff'] = merged_buffs

                    # Merge debuffs
                    debuffs_119 = skill_119.get('debuff', [])
                    debuffs_120 = skill_120.get('debuff', [])

                    # Convert to list if string
                    if isinstance(debuffs_119, str):
                        debuffs_119 = [debuffs_119]
                    if isinstance(debuffs_120, str):
                        debuffs_120 = [debuffs_120]

                    # Merge and deduplicate (preserve order)
                    merged_debuffs = debuffs_119.copy()
                    for debuff in debuffs_120:
                        if debuff and debuff not in merged_debuffs:
                            merged_debuffs.append(debuff)

                    skill_119['debuff'] = merged_debuffs

                    # Merge classification (offensive OR, target merge if different)
                    off_119 = skill_119.get('offensive', False)
                    off_120 = skill_120.get('offensive', False)
                    skill_119['offensive'] = off_119 or off_120

                    tgt_119 = skill_119.get('target')
                    tgt_120 = skill_120.get('target')
                    if tgt_119 == tgt_120 or tgt_120 is None:
                        pass  # Keep tgt_119
                    elif tgt_119 is None:
                        skill_119['target'] = tgt_120
                    else:
                        skill_119['target'] = [tgt_119, tgt_120]

                    # Merge burst classification if both have burnEffect
                    burn_119 = skill_119.get('burnEffect', {})
                    burn_120 = skill_120.get('burnEffect', {})
                    for bk in burn_119:
                        if bk in burn_120:
                            b119 = burn_119[bk]
                            b120 = burn_120[bk]
                            b119['offensive'] = b119.get('offensive', False) or b120.get('offensive', False)
                            bt119 = b119.get('target')
                            bt120 = b120.get('target')
                            if bt119 == bt120 or bt120 is None:
                                pass
                            elif bt119 is None:
                                b119['target'] = bt120
                            else:
                                b119['target'] = [bt119, bt120]

                    # Merge dual_buff/dual_debuff (chain passive only)
                    if skill_name == 'SKT_CHAIN_PASSIVE':
                        # Merge dual_buff
                        dual_buff_119 = skill_119.get('dual_buff', [])
                        dual_buff_120 = skill_120.get('dual_buff', [])

                        # Ensure both are lists
                        if not isinstance(dual_buff_119, list):
                            dual_buff_119 = [dual_buff_119] if dual_buff_119 else []
                        if not isinstance(dual_buff_120, list):
                            dual_buff_120 = [dual_buff_120] if dual_buff_120 else []

                        # Merge and deduplicate
                        merged_dual_buff = dual_buff_119.copy()
                        for buff in dual_buff_120:
                            if buff and buff not in merged_dual_buff:
                                merged_dual_buff.append(buff)

                        if merged_dual_buff:
                            skill_119['dual_buff'] = merged_dual_buff

                        # Merge dual_debuff
                        dual_debuff_119 = skill_119.get('dual_debuff', [])
                        dual_debuff_120 = skill_120.get('dual_debuff', [])

                        # Ensure both are lists
                        if not isinstance(dual_debuff_119, list):
                            dual_debuff_119 = [dual_debuff_119] if dual_debuff_119 else []
                        if not isinstance(dual_debuff_120, list):
                            dual_debuff_120 = [dual_debuff_120] if dual_debuff_120 else []

                        # Merge and deduplicate
                        merged_dual_debuff = dual_debuff_119.copy()
                        for debuff in dual_debuff_120:
                            if debuff and debuff not in merged_dual_debuff:
                                merged_dual_debuff.append(debuff)

                        if merged_dual_debuff:
                            skill_119['dual_debuff'] = merged_dual_debuff

        except Exception as e:
            print(f"Warning: Failed to merge Luna 2000120 data: {e}")

    def _extract_burst(self, char_skills):
        """Extract burst data if character has burst"""
        # Helper function to check if a string is a valid cost pattern (int,int,int with ascending order)
        def is_valid_cost_pattern(val_str):
            """Check if string is 'int,int,int' where int1 < int2 < int3"""
            if not val_str or ',' not in val_str:
                return False, []
            parts = val_str.split(',')
            if len(parts) < 3:
                return False, []
            try:
                nums = [int(p.strip()) for p in parts[:3]]
                if nums[0] < nums[1] < nums[2]:
                    return True, [str(n) for n in nums]
            except (ValueError, AttributeError):
                pass
            return False, []

        burst_base_skill = None
        burst_costs = []

        # Step 1: Try to find a skill with RequireAP containing valid cost pattern (int,int,int)
        # No priority - just iterate through skills in their natural order
        for skill_type, skill in char_skills.items():
            require_ap = skill.get('RequireAP', '')

            if require_ap:
                is_valid, costs = is_valid_cost_pattern(str(require_ap))
                if is_valid:
                    burst_base_skill = skill_type
                    burst_costs = costs
                    break

        # Step 2: Fallback - if not found, look for RequireAP with commas (even TRUE,TRUE)
        # and search OTHER fields in THAT skill for the valid pattern
        if not burst_base_skill:
            for skill_type, skill in char_skills.items():
                require_ap = skill.get('RequireAP', '')

                # Has RequireAP with commas but not valid pattern?
                if require_ap and ',' in str(require_ap):
                    burst_base_skill = skill_type

                    # Search other fields in THIS skill for valid pattern
                    cost_found = False
                    for key, val in skill.items():
                        if key == 'RequireAP':
                            continue  # Already checked
                        val_str = str(val)
                        if len(val_str) < 50:  # Reasonable length
                            is_valid, costs = is_valid_cost_pattern(val_str)
                            if is_valid:
                                burst_costs = costs
                                cost_found = True
                                break

                    if cost_found:
                        break
                    else:
                        # No valid pattern found in other fields, use [0, 0, 0]
                        burst_costs = ['0', '0', '0']
                        break

        if not burst_base_skill:
            return  # No burst

        # 2. Extract burst skills (BURST_1, BURST_2, BURST_3)
        burst_skills = {}
        burst_buffs = []
        burst_debuffs = []

        for skill_type, skill in char_skills.items():
            if 'BURST' in skill_type:
                icon_name = skill.get('IconName')
                skill_id = skill.get('NameIDSymbol')

                burst_skills[skill_type] = {
                    'icon_name': icon_name,
                    'skill_id': skill_id,
                    'raw_skill': skill,
                }

                # Get description
                desc_texts = self._get_skill_text(icon_name)
                if desc_texts:
                    burst_skills[skill_type]['effect'] = desc_texts.get('English', '')
                    burst_skills[skill_type]['effect_jp'] = desc_texts.get('Japanese', '')
                    burst_skills[skill_type]['effect_kr'] = desc_texts.get('Korean', '')
                    burst_skills[skill_type]['effect_zh'] = desc_texts.get('China_Simplified', '')

                # Extract buffs/debuffs from burst skill
                burst_buff_debuff = self._extract_buffs_debuffs(skill_id)
                if burst_buff_debuff:
                    # Collect all buffs and debuffs from burst skills
                    for buff in burst_buff_debuff.get('buff', []):
                        if buff not in burst_buffs:
                            burst_buffs.append(buff)
                    for debuff in burst_buff_debuff.get('debuff', []):
                        if debuff not in burst_debuffs:
                            burst_debuffs.append(debuff)

        # 3. Build burnEffect structure
        if burst_skills:
            burnEffect = {}

            for i, burst_type in enumerate(['SKT_BURST_1', 'SKT_BURST_2', 'SKT_BURST_3'], 1):
                if burst_type in burst_skills:
                    data = burst_skills[burst_type]

                    # Parse cost (handle 'TRUE' or non-numeric values)
                    cost = 0
                    if i-1 < len(burst_costs):
                        cost_value = burst_costs[i-1]
                        if isinstance(cost_value, (int, float)):
                            cost = int(cost_value)
                        elif isinstance(cost_value, str) and cost_value.isdigit():
                            cost = int(cost_value)
                        # else: keep cost = 0 for invalid values like 'TRUE'

                    # Classify burst skill
                    raw = data.get('raw_skill', {})
                    burst_offensive = raw.get('TargetTeamType', '') in OFFENSIVE_TARGETS
                    burst_target = RANGE_TO_TARGET.get(raw.get('RangeType', ''))

                    burnEffect[burst_type] = {
                        "effect": data.get('effect', ''),
                        "effect_jp": data.get('effect_jp', ''),
                        "effect_kr": data.get('effect_kr', ''),
                        "effect_zh": data.get('effect_zh', ''),
                        "cost": cost,
                        "level": i,
                        "offensive": burst_offensive,
                        "target": burst_target,
                    }

            # Add burnEffect to the base skill
            if burst_base_skill in self.char_data['skills']:
                self.char_data['skills'][burst_base_skill]['burnEffect'] = burnEffect

                # Add burst buffs/debuffs to the base skill
                if burst_buffs or burst_debuffs:
                    # Add to existing buffs/debuffs
                    existing_buffs = self.char_data['skills'][burst_base_skill].get('buff', [])
                    existing_debuffs = self.char_data['skills'][burst_base_skill].get('debuff', [])

                    # Merge without duplicates
                    for buff in burst_buffs:
                        if buff not in existing_buffs:
                            existing_buffs.append(buff)
                    for debuff in burst_debuffs:
                        if debuff not in existing_debuffs:
                            existing_debuffs.append(debuff)

                    self.char_data['skills'][burst_base_skill]['buff'] = existing_buffs
                    self.char_data['skills'][burst_base_skill]['debuff'] = existing_debuffs

    def _load_buff_for_placeholder(self, buff_id: str, level: str = "1") -> dict:
        """Load buff data for placeholder replacement.
        Tries exact level first, then falls back to closest available level."""
        all_buffs = self.buff_extractor.all_buffs

        # Find buff by BuffID and exact Level
        for buff in all_buffs:
            if buff.get('BuffID') == buff_id and buff.get('Level') == level:
                return buff

        # Fallback: find closest available level (try descending from requested level)
        if level != "1":
            target = int(level)
            # Try lower levels first, then higher
            for fallback_lvl in range(target - 1, 0, -1):
                for buff in all_buffs:
                    if buff.get('BuffID') == buff_id and buff.get('Level') == str(fallback_lvl):
                        return buff
            for fallback_lvl in range(target + 1, 6):
                for buff in all_buffs:
                    if buff.get('BuffID') == buff_id and buff.get('Level') == str(fallback_lvl):
                        return buff

        return {}

    def _replace_buff_tags(self, desc_txt: str, lang: str = "en", buff_level: str = "1") -> str:
        """
        Replace [Buff_C_ID], [Buff_T_ID], [Buff_V_ID] with values.
        - [Buff_C_xxx]: CreateRate (application rate in %)
        - [Buff_T_xxx]: TurnDuration (duration in turns)
        - [Buff_V_xxx]: Value (with OAT_RATE/OAT_ADD handling)

        Args:
            desc_txt: Description text with placeholders
            lang: Language ("en", "jp", "kr", "zh") - for English, remove negative signs
            buff_level: Buff level to use for placeholder lookup (matches skill level)
        """
        if not isinstance(desc_txt, str):
            return desc_txt

        def get_replacement(match: re.Match) -> str:
            buff_type = match.group(1)  # C, T, or V
            buff_id = match.group(2)    # buff ID

            # Load buff data
            data = self._load_buff_for_placeholder(buff_id, level=buff_level)
            if not data:
                return "?"

            if buff_type == "C":  # CreateRate (application rate)
                rate = data.get("CreateRate", 0)
                try:
                    r = int(rate)
                    return f"{r/10:.0f}%"
                except Exception:
                    return str(rate)

            if buff_type == "T":  # TurnDuration
                duration = data.get("TurnDuration", "")
                return str(duration)

            # buff_type == "V" (Value)
            val = data.get("Value")
            type_val = data.get("Type")
            applying_type = data.get("ApplyingType", "")
            stat_type = data.get("StatType", "")

            # Special types that return raw value
            if type_val in ("BT_RESOURCE_USE_SKILL", "BT_REMOVE_BUFF", "BT_REMOVE_DEBUFF"):
                return str(val)

            try:
                iv = int(val)

                # Rules based on ApplyingType
                if applying_type == "OAT_RATE":
                    # OAT_RATE: always divide by 10 (250 → 25%)
                    result = iv / 10
                    # Remove negative sign for English (sentence already says "reduce")
                    if lang == "en" and result < 0:
                        result = abs(result)
                    return f"{int(result)}%" if (result == int(result)) else f"{result}%"
                elif applying_type == "OAT_ADD":
                    # OAT_ADD with ST_CRITICAL_RATE: divide by 10
                    if stat_type == "ST_CRITICAL_RATE":
                        result = iv / 10
                        if lang == "en" and result < 0:
                            result = abs(result)
                        return f"{int(result)}%" if (result == int(result)) else f"{result}%"
                    else:
                        # Other OAT_ADD stats: raw value (250 → 250)
                        if lang == "en" and iv < 0:
                            return str(abs(iv))
                        return str(iv)
                else:
                    # Fallback: unknown ApplyingType, raw value
                    if lang == "en" and iv < 0:
                        return str(abs(iv))
                    return str(iv)
            except Exception:
                return str(val)

        # Replace using precompiled regex
        replaced = _BUFF_TAG_RE.sub(get_replacement, desc_txt)

        # Second pass: transform '0.x%' -> 'x'
        replaced = re.sub(r"0\.(\d+)%", lambda m: m.group(1), replaced)

        return replaced

    def _translate_descriptions(self):
        """Replace placeholder tags in all skill descriptions"""
        for skill_type, skill in self.char_data.get('skills', {}).items():
            # Process all language variants (true_desc is already the field name)
            for field_name, lang in [
                ("true_desc", "en"),
                ("true_desc_jp", "jp"),
                ("true_desc_kr", "kr"),
                ("true_desc_zh", "zh")
            ]:
                desc_text = skill.get(field_name)
                if not desc_text:
                    continue

                # Fast path: no tags
                if "[" not in desc_text:
                    continue

                # Replace tags IN PLACE
                skill[field_name] = self._replace_buff_tags(desc_text, lang=lang)

            # Process true_desc_levels dict
            levels = skill.get('true_desc_levels')
            if levels:
                for key in list(levels.keys()):
                    val = levels[key]
                    if not val or "[" not in val:
                        continue
                    # Determine language and level number from key
                    if key.endswith("_jp"):
                        lvl_lang = "jp"
                        lvl_num = key.replace("_jp", "")
                    elif key.endswith("_kr"):
                        lvl_lang = "kr"
                        lvl_num = key.replace("_kr", "")
                    elif key.endswith("_zh"):
                        lvl_lang = "zh"
                        lvl_num = key.replace("_zh", "")
                    else:
                        lvl_lang = "en"
                        lvl_num = key
                    levels[key] = self._replace_buff_tags(val, lang=lvl_lang, buff_level=lvl_num)


def main():
    """CLI tool to extract a character by ID"""
    import io

    # Fix stdout encoding for Unicode characters
    if hasattr(sys.stdout, 'buffer'):
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

    if len(sys.argv) < 2:
        print("Usage: python character_extractor.py <character_id>")
        print("Example: python character_extractor.py 2000020")
        sys.exit(1)

    char_id = sys.argv[1]

    try:
        extractor = CharacterExtractor(char_id)
        data = extractor.extract()
        print(json.dumps(data, indent=2, ensure_ascii=False))

    except ValueError as e:
        # Character not found - this is normal, just show a clean message
        print(f'Error: {e}', file=sys.stderr)
        sys.exit(1)

    except Exception as e:
        # Unexpected error - show full traceback
        print(f'Error extracting character {char_id}: {e}', file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    main()
