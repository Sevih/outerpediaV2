"""
Localization Extractor - Extract localization texts for characters

DUPLICATE of CharacterExtractor with ONLY China_Simplified support added.
No other changes to the extraction logic.

Author: ParserV3
Date: 2025-10
"""
from cache_manager import CacheManager
from buff_extractor import BuffExtractor
from config import BYTES_FOLDER
import json
import logging
import re

logger = logging.getLogger(__name__)

# Precompile regex for buff tag replacement
_BUFF_TAG_RE = re.compile(r"\[Buff_([CTV])_([^\]]+)\]")


class LocalizationExtractor:
    """Extract localization texts - DUPLICATE of CharacterExtractor"""

    # Class-level cache
    _parsers_cache = None

    # Class-level buff extractor cache
    _buff_extractor_cache = None

    @classmethod
    def _load_parsers(cls):
        """Load all parsers once and cache them"""
        if cls._parsers_cache is None:
            cache = CacheManager(BYTES_FOLDER)

            char_data = cache.get_data("CharacterTemplet.bytes")
            skill_data = cache.get_data("CharacterSkillTemplet.bytes")
            text_char_data = cache.get_data("TextCharacter.bytes")
            text_skill_data = cache.get_data("TextSkill.bytes")
            skill_level_data = cache.get_data("CharacterSkillLevelTemplet.bytes")
            char_extra_data = cache.get_data("CharacterExtraTemplet.bytes")

            # Build indexes
            char_index = {c.get('ID'): c for c in char_data}
            skill_index = {s.get('NameIDSymbol'): s for s in skill_data if s.get('NameIDSymbol')}
            text_char_index = {t.get('IDSymbol'): t for t in text_char_data if t.get('IDSymbol')}
            text_skill_index = {t.get('IDSymbol'): t for t in text_skill_data if t.get('IDSymbol')}

            skill_level_by_skill = {}
            for level in skill_level_data:
                skill_id = level.get('SkillID')
                if skill_id:
                    if skill_id not in skill_level_by_skill:
                        skill_level_by_skill[skill_id] = []
                    skill_level_by_skill[skill_id].append(level)

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
                'char_index': char_index,
                'skill_index': skill_index,
                'text_char_index': text_char_index,
                'text_skill_index': text_skill_index,
                'skill_level_by_skill': skill_level_by_skill
            }

        return cls._parsers_cache

    def __init__(self, char_id: str, bytes_field: str = "China_Simplified", suffix: str = "_zh"):
        self.char_id = char_id
        self.bytes_field = bytes_field
        self.suffix = suffix
        self.loc_data = {}
        self.char_data = {}  # Mimicking CharacterExtractor

        parsers = self._load_parsers()
        self.char_parser = parsers['char']
        self.skill_parser = parsers['skill']
        self.text_char_parser = parsers['text_char']
        self.text_skill_parser = parsers['text_skill']
        self.skill_level_parser = parsers['skill_level']
        self.char_extra_parser = parsers['char_extra']

        self.char_index = parsers['char_index']
        self.skill_index = parsers['skill_index']
        self.text_char_index = parsers['text_char_index']
        self.text_skill_index = parsers['text_skill_index']
        self.skill_level_by_skill = parsers['skill_level_by_skill']

        # Initialize BuffExtractor for placeholder replacement
        if LocalizationExtractor._buff_extractor_cache is None:
            LocalizationExtractor._buff_extractor_cache = BuffExtractor()
        self.buff_extractor = LocalizationExtractor._buff_extractor_cache

    def extract(self):
        """Main extraction - returns localization data"""
        char = self.char_index.get(self.char_id)
        if not char:
            raise ValueError(f"Character {self.char_id} not found")

        logger.info(f"Extracting localization for character {self.char_id}")

        # Collect all data first
        names_data = {}
        transcend_data = {}
        skills_data = {}

        # Extract names
        self._extract_names(char)
        if f'Fullname{self.suffix}' in self.loc_data:
            names_data[f'Fullname{self.suffix}'] = self.loc_data.pop(f'Fullname{self.suffix}')
        if f'VoiceActor{self.suffix}' in self.loc_data:
            names_data[f'VoiceActor{self.suffix}'] = self.loc_data.pop(f'VoiceActor{self.suffix}')

        # Extract transcendance
        self._extract_transcendance(char)
        if 'transcend' in self.loc_data:
            transcend_data['transcend'] = self.loc_data.pop('transcend')

        # Extract skills
        self._extract_skills(char)
        if 'skills' in self.loc_data:
            skills_data['skills'] = self.loc_data.pop('skills')

        # Replace placeholder tags in skill descriptions
        if 'skills' in skills_data:
            self.loc_data['skills'] = skills_data['skills']
            self._translate_descriptions()
            skills_data['skills'] = self.loc_data.pop('skills')

        # Rebuild loc_data in correct order: names, transcend, skills
        self.loc_data = {}
        self.loc_data.update(names_data)
        self.loc_data.update(transcend_data)
        self.loc_data.update(skills_data)

        return self.loc_data

    def _should_use_surname(self, char):
        """Check if should use surname - COPIED from CharacterExtractor"""
        all_extra = self.char_extra_parser.get_data()
        char_extra = next((e for e in all_extra if e.get('CharacterID') == self.char_id), None)

        if char_extra:
            show_nickname = char_extra.get('ShowNickName', 'False')
            if show_nickname in ['True', 'true', '1']:
                return True

            thumb_fb1 = char_extra.get('ThumbnailEffect_fallback1', 'False')
            if thumb_fb1 in ['True', 'true', '1']:
                return True

        return False

    def _extract_names(self, char):
        """Extract names - COPIED from CharacterExtractor, added China_Simplified"""
        name_id = char.get('NameIDSymbol')
        nick_id = char.get('GachaCommentIDSymbol')
        cv_id = char.get('CVNameIDSymbol')

        name_text = self.text_char_index.get(name_id)
        nick_text = self.text_char_index.get(nick_id)

        # Voice actor (Chinese): Try {hero_id}_CVName_jp with China_Simplified, fallback to English
        if cv_id:
            cv_text_jp = self.text_char_index.get(f"{self.char_id}_CVName_jp")
            if cv_text_jp:
                # Try China_Simplified first
                va_zh = cv_text_jp.get(self.bytes_field, '')
                # If empty or "0", fallback to English
                if not va_zh or va_zh == "0":
                    va_zh = cv_text_jp.get('English', '')

                if va_zh and va_zh != "0":
                    self.loc_data[f'VoiceActor{self.suffix}'] = va_zh

        # Fullname
        if name_text:
            name_value = name_text.get(self.bytes_field, '')
            nick_value = nick_text.get(self.bytes_field, '') if nick_text else ''

            use_surname = self._should_use_surname(char)

            if use_surname and nick_value:
                self.loc_data[f'Fullname{self.suffix}'] = f"{nick_value} {name_value}".strip()
            elif name_value:
                self.loc_data[f'Fullname{self.suffix}'] = name_value

    def _get_skill_text(self, skill_id):
        """Get skill text - COPIED from CharacterExtractor"""
        return self.text_skill_index.get(skill_id)

    def _extract_transcendance(self, char):
        """Extract transcend - COPIED from CharacterExtractor, added China_Simplified"""
        transcend = {}

        # Get rarity (need to extract basic info first)
        basic_star = char.get('BasicStar', '1')
        try:
            rarity = int(basic_star)
        except:
            rarity = 1

        if self.char_id == '2000020':  # Alice fix
            rarity = 3

        # Transcend 1 (always null)
        transcend[f"1{self.suffix}"] = None

        # Transcend 2
        if rarity < 3:
            transcend[f"2{self.suffix}"] = "ATK DEF HP +5%"
        else:
            transcend[f"2{self.suffix}"] = None

        # Find SKT_UNIQUE_PASSIVE
        unique_passive_skill = None
        for key, value in char.items():
            if key.startswith('Skill_') and value and value != '0':
                skill = self.skill_index.get(value)
                if skill and skill.get('SkillType') == 'SKT_UNIQUE_PASSIVE':
                    unique_passive_skill = value
                    break

        # Get unique passive descriptions (Chinese only)
        unique_passive_descs = {}
        if unique_passive_skill:
            unique_levels = self.skill_level_by_skill.get(unique_passive_skill, [])

            for level in unique_levels:
                skill_level = level.get('SkillLevel', 'N/A')
                for key, value in level.items():
                    if isinstance(value, str) and value.startswith('SE_DESC'):
                        text_entry = self._get_skill_text(value)
                        if text_entry:
                            desc_zh = text_entry.get(self.bytes_field, '').replace('\\n', '\n')
                            if desc_zh:
                                unique_passive_descs[skill_level] = desc_zh
                        break

        # Transcend 3
        transcend[f"3{self.suffix}"] = "ATK DEF HP +10%"

        # Transcend 4
        if rarity < 3:
            base_stats = "ATK DEF HP +16%"
            if '2' in unique_passive_descs:
                transcend[f"4{self.suffix}"] = f"{base_stats}\n{unique_passive_descs['2']}"
            else:
                transcend[f"4{self.suffix}"] = base_stats
        else:
            base_stats = "ATK DEF HP +16%"
            if '2' in unique_passive_descs:
                transcend[f"4_1{self.suffix}"] = f"{base_stats}\n{unique_passive_descs['2']}"
            else:
                transcend[f"4_1{self.suffix}"] = base_stats
            transcend[f"4_2{self.suffix}"] = "ATK DEF HP +19%"

        # Transcend 5
        if rarity < 3:
            base_stats = "ATK DEF HP +22%"
            if '3' in unique_passive_descs:
                transcend[f"5{self.suffix}"] = f"{base_stats}\n{unique_passive_descs['3']}"
            else:
                transcend[f"5{self.suffix}"] = base_stats
        else:
            base_stats = "ATK DEF HP +22%"
            if '3' in unique_passive_descs:
                transcend[f"5_1{self.suffix}"] = f"{base_stats}\n{unique_passive_descs['3']}"
            else:
                transcend[f"5_1{self.suffix}"] = base_stats
            transcend[f"5_2{self.suffix}"] = "ATK DEF HP +25%"
            transcend[f"5_3{self.suffix}"] = "ATK DEF HP +28%"

        # Transcend 6
        base_stats = "ATK DEF HP +30%"
        if '4' in unique_passive_descs:
            transcend[f"6{self.suffix}"] = f"{base_stats}\n{unique_passive_descs['4']}"
        else:
            transcend[f"6{self.suffix}"] = base_stats

        if transcend:
            self.loc_data['transcend'] = transcend

    def _process_skill(self, skill):
        """Process skill - COPIED EXACTLY from CharacterExtractor, added China_Simplified"""
        skill_data = {}

        name_id = skill.get('NameIDSymbol')

        # Collect data first, then add in correct order
        name_value = None
        desc_value = None
        enhancement_value = None

        # Get skill name from SkipNameID
        skip_name_id = skill.get('SkipNameID')
        if skip_name_id:
            name_texts = self._get_skill_text(skip_name_id)
            if name_texts:
                name = name_texts.get(self.bytes_field, '')
                if name:
                    name_value = name

        # Get skill description from DescID
        desc_id = skill.get('DescID', '')
        if desc_id:
            # Parse DescID (multiple refs separated by commas)
            desc_ids = [d.strip() for d in desc_id.split(',')]

            # Take only _LV1 and deduplicate
            lv1_descs = []
            seen = set()
            for d in desc_ids:
                if d.endswith('_LV1') and d not in seen:
                    lv1_descs.append(d)
                    seen.add(d)

            descriptions = []
            for desc_ref in lv1_descs:
                desc_texts = self._get_skill_text(desc_ref)
                if desc_texts:
                    desc = desc_texts.get(self.bytes_field, '')
                    if desc:
                        descriptions.append(desc)

            if descriptions:
                desc_value = '\n'.join(descriptions)

        # Get enhancement levels (2-5) - COPIED EXACTLY from CharacterExtractor
        skill_levels = self.skill_level_by_skill.get(name_id, [])
        if skill_levels:
            enhancement = {}
            for level in skill_levels:
                skill_level = level.get('SkillLevel')

                # Levels 2-5 are enhancements (1 is base)
                if skill_level and skill_level in ['2', '3', '4', '5']:
                    level_data_list = []

                    # Find fields starting with SE_, SKILL_DESC_, or SKILL_NAME_
                    enhance_raw = ""
                    for key, value in level.items():
                        if isinstance(value, str) and (value.startswith("SE_") or
                                                       value.startswith("SKILL_DESC_") or
                                                       value.startswith("SKILL_NAME_")):
                            enhance_raw = value
                            break

                    if enhance_raw:
                        # Split by comma and process each reference
                        enhance_refs = [e.strip() for e in enhance_raw.split(',') if e.strip()]

                        for ref in enhance_refs:
                            desc_texts = self._get_skill_text(ref)
                            if desc_texts:
                                text = desc_texts.get(self.bytes_field, '')
                                if text:
                                    level_data_list.append(text)

                    # Add enhancement if found
                    if level_data_list:
                        enhancement[f"{skill_level}{self.suffix}"] = level_data_list

            if enhancement:
                enhancement_value = enhancement

        # Now add to skill_data in the correct order (matching CharacterExtractor)
        # Order: name, true_desc, enhancement
        if name_value:
            skill_data[f'name{self.suffix}'] = name_value
        if desc_value:
            skill_data[f'true_desc{self.suffix}'] = desc_value
        if enhancement_value:
            skill_data['enhancement'] = enhancement_value

        return skill_data

    def _extract_skills(self, char):
        """Extract skills - COPIED from CharacterExtractor, added China_Simplified"""
        # Get skill IDs
        skill_ids = []
        for key, value in char.items():
            if key.startswith('Skill_') and value and value != '0':
                skill_ids.append(value)

        logger.info(f"Found skill IDs: {skill_ids}")

        # Load skills
        all_skills = self.skill_parser.get_data()
        char_skills = {}

        for skill in all_skills:
            name_id = skill.get('NameIDSymbol')
            if name_id in skill_ids:
                skill_type = skill.get('SkillType', '?')
                char_skills[skill_type] = skill

        logger.info(f"Char skills found: {list(char_skills.keys())}")

        # Process each skill
        skills_dict = {}
        main_skills = ['SKT_FIRST', 'SKT_SECOND', 'SKT_ULTIMATE', 'SKT_PASSIVE', 'SKT_CHAIN_PASSIVE']

        for skill_type in main_skills:
            if skill_type in char_skills:
                skill_data = self._process_skill(char_skills[skill_type])
                logger.info(f"Processed {skill_type}: {list(skill_data.keys()) if skill_data else 'EMPTY'}")
                if skill_data:
                    skills_dict[skill_type] = skill_data

        # Burst/Burn effects
        self._extract_burst(char_skills, skills_dict)

        logger.info(f"Final skills_dict: {list(skills_dict.keys())}")

        if skills_dict:
            self.loc_data['skills'] = skills_dict

    def _extract_burst(self, char_skills, skills_dict):
        """Extract burst - COPIED from CharacterExtractor, added China_Simplified"""
        # Find burst base skill
        burst_base_skill = None
        for skill_type, skill in char_skills.items():
            require_ap = skill.get('RequireAP', '')
            if require_ap and ',' in str(require_ap):
                burst_base_skill = skill_type
                break

        if not burst_base_skill:
            return

        # Extract burst skills
        burst_skills = {}
        for skill_type, skill in char_skills.items():
            if 'BURST' in skill_type:
                icon_name = skill.get('IconName')
                burst_text = self.text_skill_index.get(icon_name, {})
                burst_effect = burst_text.get(self.bytes_field, '')
                if burst_effect:
                    burst_skills[skill_type] = burst_effect

        # Build burnEffect structure
        if burst_skills:
            burn_effect = {}
            for burst_type in ['SKT_BURST_1', 'SKT_BURST_2', 'SKT_BURST_3']:
                if burst_type in burst_skills:
                    burn_effect[burst_type] = {
                        f"effect{self.suffix}": burst_skills[burst_type]
                    }

            if burn_effect and burst_base_skill in skills_dict:
                skills_dict[burst_base_skill]['burnEffect'] = burn_effect

    def _load_buff_for_placeholder(self, buff_id: str, level: str = "1") -> dict:
        """Load buff data for placeholder replacement (always use level 1 for descriptions)"""
        # Use BuffExtractor's all_buffs
        all_buffs = self.buff_extractor.all_buffs

        # Find buff by BuffID and Level
        for buff in all_buffs:
            if buff.get('BuffID') == buff_id and buff.get('Level') == level:
                return buff

        return {}

    def _replace_buff_tags(self, desc_txt: str, lang: str = "zh") -> str:
        """
        Replace [Buff_C_ID], [Buff_T_ID], [Buff_V_ID] with values.
        - [Buff_C_xxx]: CreateRate (application rate in %)
        - [Buff_T_xxx]: TurnDuration (duration in turns)
        - [Buff_V_xxx]: Value (with OAT_RATE/OAT_ADD handling)

        Args:
            desc_txt: Description text with placeholders
            lang: Language ("en", "jp", "kr", "zh") - for English, remove negative signs
        """
        if not isinstance(desc_txt, str):
            return desc_txt

        def get_replacement(match: re.Match) -> str:
            buff_type = match.group(1)  # C, T, or V
            buff_id = match.group(2)    # buff ID

            # Load buff data
            data = self._load_buff_for_placeholder(buff_id)
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
        """Replace placeholder tags in Chinese skill descriptions"""
        for skill_type, skill in self.loc_data.get('skills', {}).items():
            # Process Chinese true_desc
            field_name = f"true_desc{self.suffix}"
            desc_text = skill.get(field_name)
            if not desc_text:
                continue

            # Fast path: no tags
            if "[" not in desc_text:
                continue

            # Replace tags IN PLACE
            skill[field_name] = self._replace_buff_tags(desc_text, lang="zh")
