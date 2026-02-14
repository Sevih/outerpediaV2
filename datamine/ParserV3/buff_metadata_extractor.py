"""
Buff/Debuff Metadata Extractor - Extract labels, descriptions, and icons for buffs/debuffs

This module extracts complete metadata for buff/debuff identifiers:
- Labels (EN/JP/KR)
- Descriptions (EN/JP/KR)
- Icon names

Usage:
    from buff_metadata_extractor import BuffMetadataExtractor

    extractor = BuffMetadataExtractor()
    metadata = extractor.get_metadata('BT_STAT|ST_ATK', is_buff=True)
    # Returns: {'name': 'BT_STAT|ST_ATK', 'label': '...', 'label_jp': '...', ...}

Author: ParserV3
Date: 2025-10
"""
from bytes_parser import Bytes_parser
from pathlib import Path
import re

BASE_PATH = Path(__file__).parent.parent
BYTES_FOLDER = BASE_PATH / "extracted_astudio" / "assets" / "editor" / "resources" / "templetbinary"


class BuffMetadataExtractor:
    """Extract complete metadata for buffs and debuffs"""

    def __init__(self):
        # Check if required files exist
        buff_file = BYTES_FOLDER / "BuffTemplet.bytes"
        tooltip_file = BYTES_FOLDER / "BuffToolTipTemplet.bytes"
        text_sys_file = BYTES_FOLDER / "TextSystem.bytes"

        if not buff_file.exists():
            raise FileNotFoundError(
                f"BuffTemplet.bytes not found at {buff_file}\n\n"
                "Please extract game assets first using Tools -> Rip Assets"
            )

        # Load BuffTemplet
        buff_parser = Bytes_parser(str(buff_file))
        self.all_buffs = buff_parser.get_data()

        # Load BuffToolTipTemplet (for detailed descriptions)
        tooltip_parser = Bytes_parser(str(tooltip_file))
        self.all_tooltips = tooltip_parser.get_data()

        # Load text files for labels and descriptions
        text_sys_parser = Bytes_parser(str(text_sys_file))
        self.text_sys = text_sys_parser.get_data()

        # Create indexes for fast lookup
        self._buff_cache = {}
        self._text_sys_index = {item.get('IDSymbol'): item for item in self.text_sys}
        self._tooltip_index = {item.get('NameIDSymbol'): item for item in self.all_tooltips}
        self._tooltip_id_index = {item.get('ID'): item for item in self.all_tooltips if item.get('ID')}

    def get_metadata(self, identifier: str, is_buff: bool) -> dict:
        """
        Get complete metadata for a buff/debuff identifier

        Args:
            identifier: Buff identifier (e.g., 'BT_STAT|ST_ATK' or 'IG_Buff_xxx')
            is_buff: True if buff, False if debuff

        Returns:
            {
                'name': identifier,
                'label': '...',  # or None
                'label_jp': '...',  # or None
                'label_kr': '...',  # or None
                'description': '...',  # or None
                'description_jp': '...',  # or None
                'description_kr': '...',  # or None
                'icon': '...'  # or None
            }
        """
        metadata = {
            'name': identifier,
            'label': None,
            'label_jp': None,
            'label_kr': None,
            'label_zh': None,
            'description': None,
            'description_jp': None,
            'description_kr': None,
            'description_zh': None,
            'icon': None
        }

        # Special case: HEAVY_STRIKE (BuffToolTipTemplet ID 87)
        if identifier == 'HEAVY_STRIKE':
            return self._extract_tooltip_id_metadata('87', metadata)

        # Special case: BT_AGGRO (BuffToolTipTemplet ID 32)
        if identifier == 'BT_AGGRO':
            return self._extract_tooltip_id_metadata('32', metadata)

        # Special case: Interruption buffs (use IconName directly)
        if identifier.startswith('IG_'):
            return self._extract_interruption_metadata(identifier, metadata)

        # Regular buffs: BT_STAT|ST_XXX or BT_XXX
        return self._extract_regular_metadata(identifier, metadata, is_buff)

    def _extract_interruption_metadata(self, identifier: str, metadata: dict) -> dict:
        """Extract metadata for Interruption buffs (IG_xxx)"""
        # DON'T auto-fill icon - always ask user manually
        # Leave metadata['icon'] = None

        # Use BuffToolTipTemplet to get label and description keys
        # The identifier (IG_xxx) is the NameIDSymbol in BuffToolTipTemplet
        tooltip_data = self._tooltip_index.get(identifier)

        if not tooltip_data:
            return metadata

        # Get label from DescIDSymbol (e.g., SYS_BUFF_NAME_2000119)
        label_key = tooltip_data.get('DescIDSymbol', '')
        if label_key:
            label_data = self._text_sys_index.get(label_key)
            if label_data:
                metadata['label'] = label_data.get('English')
                metadata['label_jp'] = label_data.get('Japanese')
                metadata['label_kr'] = label_data.get('Korean')
                metadata['label_zh'] = label_data.get('China_Simplified')

        # Get description from DescID (e.g., SYS_BUFF_DESC_2000119)
        desc_key = tooltip_data.get('DescID', '')
        if desc_key:
            desc_data = self._text_sys_index.get(desc_key)
            if desc_data:
                metadata['description'] = desc_data.get('English')
                metadata['description_jp'] = desc_data.get('Japanese')
                metadata['description_kr'] = desc_data.get('Korean')
                metadata['description_zh'] = desc_data.get('China_Simplified')

        return metadata

    def _extract_tooltip_id_metadata(self, tooltip_id: str, metadata: dict) -> dict:
        """Extract metadata using BuffToolTipTemplet ID (for special effects like Heavy Strike)"""
        # DON'T auto-fill icon - always ask user manually
        # Leave metadata['icon'] = None

        # Lookup by ID in BuffToolTipTemplet
        tooltip_data = self._tooltip_id_index.get(tooltip_id)

        if not tooltip_data:
            return metadata

        # Get label from DescIDSymbol
        label_key = tooltip_data.get('DescIDSymbol', '')
        if label_key:
            label_data = self._text_sys_index.get(label_key)
            if label_data:
                metadata['label'] = label_data.get('English')
                metadata['label_jp'] = label_data.get('Japanese')
                metadata['label_kr'] = label_data.get('Korean')
                metadata['label_zh'] = label_data.get('China_Simplified')

        # Get description from DescID
        desc_key = tooltip_data.get('DescID', '')
        if desc_key:
            desc_data = self._text_sys_index.get(desc_key)
            if desc_data:
                metadata['description'] = desc_data.get('English')
                metadata['description_jp'] = desc_data.get('Japanese')
                metadata['description_kr'] = desc_data.get('Korean')
                metadata['description_zh'] = desc_data.get('China_Simplified')

        return metadata

    def _extract_regular_metadata(self, identifier: str, metadata: dict, is_buff: bool) -> dict:
        """Extract metadata for regular buffs (BT_XXX or BT_STAT|ST_XXX)"""
        # Special case: BT_ACTION_GAUGE uses different keys for buff vs debuff
        if identifier == 'BT_ACTION_GAUGE':
            text_key = 'SYS_BUFF_ACTION_GAUGE_UP' if is_buff else 'SYS_BUFF_ACTION_GAUGE_DOWN'

            # Get label
            label_data = self._text_sys_index.get(text_key)
            if label_data:
                metadata['label'] = label_data.get('English')
                metadata['label_jp'] = label_data.get('Japanese')
                metadata['label_kr'] = label_data.get('Korean')
                metadata['label_zh'] = label_data.get('China_Simplified')

            # Get description
            desc_key = text_key.replace('SYS_BUFF_', 'SYS_DESC_')
            desc_data = self._text_sys_index.get(desc_key)
            if desc_data:
                metadata['description'] = desc_data.get('English')
                metadata['description_jp'] = desc_data.get('Japanese')
                metadata['description_kr'] = desc_data.get('Korean')
                metadata['description_zh'] = desc_data.get('China_Simplified')

            return metadata

        # Special case: BT_REVERSE_HEAL_BASED_TARGET (True/Fixed Damage)
        if identifier == 'BT_REVERSE_HEAL_BASED_TARGET':
            text_key = 'SYS_BUFF_TRUE_DAMAGE'

            # Get label
            label_data = self._text_sys_index.get(text_key)
            if label_data:
                metadata['label'] = label_data.get('English')
                metadata['label_jp'] = label_data.get('Japanese')
                metadata['label_kr'] = label_data.get('Korean')
                metadata['label_zh'] = label_data.get('China_Simplified')

            # Try to get description (may not exist)
            desc_key = 'SYS_DESC_TRUE_DAMAGE'
            desc_data = self._text_sys_index.get(desc_key)
            if desc_data:
                metadata['description'] = desc_data.get('English')
                metadata['description_jp'] = desc_data.get('Japanese')
                metadata['description_kr'] = desc_data.get('Korean')
                metadata['description_zh'] = desc_data.get('China_Simplified')

            return metadata

        # Special case: BT_CONTINU_HEAL (Sustained Recovery)
        # Identifier in JSON is BT_CONTINU_HEAL but TextSystem uses SYS_BUFF_TURN_HEAL
        if identifier == 'BT_CONTINU_HEAL':
            text_key = 'SYS_BUFF_TURN_HEAL'

            # Get label
            label_data = self._text_sys_index.get(text_key)
            if label_data:
                metadata['label'] = label_data.get('English')
                metadata['label_jp'] = label_data.get('Japanese')
                metadata['label_kr'] = label_data.get('Korean')
                metadata['label_zh'] = label_data.get('China_Simplified')

            # Get description
            desc_key = 'SYS_DESC_TURN_HEAL'
            desc_data = self._text_sys_index.get(desc_key)
            if desc_data:
                metadata['description'] = desc_data.get('English')
                metadata['description_jp'] = desc_data.get('Japanese')
                metadata['description_kr'] = desc_data.get('Korean')
                metadata['description_zh'] = desc_data.get('China_Simplified')

            return metadata

        # Special case: BT_XX_CHARGE types (AP, BP, CP)
        # These have different RemoveEffect values per character but consistent SYS_BUFF_CHARGE_XX keys
        if identifier in ['BT_AP_CHARGE', 'BT_BP_CHARGE', 'BT_CP_CHARGE']:
            # Extract the charge type (AP, BP, CP) from the identifier
            charge_type = identifier.replace('BT_', '').replace('_CHARGE', '')  # e.g., 'AP', 'BP', 'CP'
            text_key = f'SYS_BUFF_CHARGE_{charge_type}'

            # Get label
            label_data = self._text_sys_index.get(text_key)
            if label_data:
                metadata['label'] = label_data.get('English')
                metadata['label_jp'] = label_data.get('Japanese')
                metadata['label_kr'] = label_data.get('Korean')
                metadata['label_zh'] = label_data.get('China_Simplified')

            # Try to get description (may not exist for all charge types)
            desc_key = f'SYS_DESC_CHARGE_{charge_type}'
            desc_data = self._text_sys_index.get(desc_key)
            if desc_data:
                metadata['description'] = desc_data.get('English')
                metadata['description_jp'] = desc_data.get('Japanese')
                metadata['description_kr'] = desc_data.get('Korean')
                metadata['description_zh'] = desc_data.get('China_Simplified')

            return metadata

        # Parse identifier
        if '|' in identifier:
            buff_type, stat_type = identifier.split('|')
        else:
            buff_type = identifier
            stat_type = None

        # Special case: BT_STAT types use pattern SYS_BUFF_{STAT}_UP or _DOWN
        if buff_type == 'BT_STAT' and stat_type:
            # Extract stat name (e.g., ST_ATK → ATK, ST_ACCURACY → ACCURACY)
            stat_name = stat_type.replace('ST_', '')

            # Special mapping for stats that use different names in TextSystem
            stat_mapping = {
                'ATK': 'ATTACK',
                'DEF': 'DEFENCE',  # Note: British spelling in game files
                'CRITICAL_DMG_RATE': 'CRITICAL_DAMAGE',
                'CRITICAL_RATE': 'CRITICAL_RATE',  # ST_CRITICAL_RATE → SYS_BUFF_CRITICAL_RATE_UP/DOWN (not CRITICAL_HIT_CHANCE)
                'SPEED': 'ACTION_SPEED',  # ST_SPEED → SYS_BUFF_ACTION_SPEED_UP
                'BUFF_CHANCE': 'RATE_CHANCE',  # ST_BUFF_CHANCE → SYS_BUFF_RATE_CHANCE_UP
                'BUFF_RESIST': 'RATE_RESIST',  # ST_BUFF_RESIST → SYS_BUFF_RATE_RESIST_UP/DOWN
                # Add other mappings if needed
            }
            stat_name = stat_mapping.get(stat_name, stat_name)

            # Build text key based on buff/debuff
            suffix = '_UP' if is_buff else '_DOWN'
            text_key = f'SYS_BUFF_{stat_name}{suffix}'

            # Get label
            label_data = self._text_sys_index.get(text_key)
            if label_data:
                metadata['label'] = label_data.get('English')
                metadata['label_jp'] = label_data.get('Japanese')
                metadata['label_kr'] = label_data.get('Korean')
                metadata['label_zh'] = label_data.get('China_Simplified')

            # Get description
            desc_key = f'SYS_DESC_{stat_name}{suffix}'
            desc_data = self._text_sys_index.get(desc_key)
            if desc_data:
                metadata['description'] = desc_data.get('English')
                metadata['description_jp'] = desc_data.get('Japanese')
                metadata['description_kr'] = desc_data.get('Korean')
                metadata['description_zh'] = desc_data.get('China_Simplified')

            return metadata

        # Find buff entries matching this type
        if stat_type:
            # Find BT_STAT with matching StatType
            buff_entries = [
                b for b in self.all_buffs
                if b.get('Type') == buff_type and b.get('StatType') == stat_type
            ]
        else:
            # Find by Type only
            buff_entries = [
                b for b in self.all_buffs
                if b.get('Type') == buff_type
            ]

        if not buff_entries:
            return metadata

        # Prioritize buffs that have valid TextSystem keys
        # Sort by priority: Has SYS_ key > standard target types > simpler conditions
        def buff_priority(buff):
            # Check if buff has a valid RemoveEffect or ActivateText with SYS_ key
            remove_effect = buff.get('RemoveEffect', '')
            activate_text = buff.get('ActivateText', '')

            has_sys_key = False
            if isinstance(remove_effect, str) and 'SYS_' in remove_effect:
                has_sys_key = True
            elif isinstance(activate_text, str) and activate_text.startswith('SYS_'):
                has_sys_key = True

            target = buff.get('TargetType', '')
            has_condition = buff.get('BuffConditionType', 'NONE') != 'NONE'

            # Priority score (lower is better)
            score = 0

            # Highest priority: has a SYS_ key
            if not has_sys_key:
                score += 100

            # Target type priority
            if target.startswith('MY_TEAM'):
                score += 0
            elif target.startswith('ME'):
                score += 1
            else:
                score += 2

            # Condition penalty
            if has_condition:
                score += 10

            return score

        buff_entries.sort(key=buff_priority)

        # Use first entry (best match)
        buff_data = buff_entries[0]

        # DON'T auto-fill icon - always ask user manually
        # Leave metadata['icon'] = None

        # Try to get label and description from RemoveEffect first
        remove_effect = buff_data.get('RemoveEffect', '')
        text_key = None

        if remove_effect and isinstance(remove_effect, str):
            # Clean up RemoveEffect (might have [DEBUFF] prefix)
            clean_remove_effect = remove_effect.replace('[DEBUFF]', '').replace('[BUFF]', '')

            # Check if this is a text key (starts with SYS_)
            if clean_remove_effect.startswith('SYS_'):
                text_key = clean_remove_effect

        # If RemoveEffect didn't give a text key, try ActivateText
        # (some buffs like BT_INVINCIBLE use ActivateText for labels)
        if not text_key:
            activate_text = buff_data.get('ActivateText', '')
            if activate_text and isinstance(activate_text, str) and activate_text.startswith('SYS_'):
                text_key = activate_text

        # Fallback: construct text_key from buff type (e.g., BT_SILENCE → SYS_BUFF_SILENCE)
        if not text_key and buff_type:
            constructed_key = f"SYS_BUFF_{buff_type.replace('BT_', '')}"
            # Check if this key exists in TextSystem
            if constructed_key in self._text_sys_index:
                text_key = constructed_key

        # Extract label and description using the found text key
        if text_key:
            # Get label from SYS_BUFF_XXX
            label_data = self._text_sys_index.get(text_key)
            if label_data:
                metadata['label'] = label_data.get('English')
                metadata['label_jp'] = label_data.get('Japanese')
                metadata['label_kr'] = label_data.get('Korean')
                metadata['label_zh'] = label_data.get('China_Simplified')

            # Try to find detailed description: SYS_BUFF_XXX → SYS_DESC_XXX
            if text_key.startswith('SYS_BUFF_'):
                desc_key = text_key.replace('SYS_BUFF_', 'SYS_DESC_')
                desc_data = self._text_sys_index.get(desc_key)
                if desc_data:
                    metadata['description'] = desc_data.get('English')
                    metadata['description_jp'] = desc_data.get('Japanese')
                    metadata['description_kr'] = desc_data.get('Korean')

        return metadata

    def _convert_icon_name(self, icon_name: str) -> str:
        """Convert IconName to icon format (lowercase, no prefix)"""
        # Remove common prefixes
        icon = icon_name.replace('IG_Buff_', '').replace('IG_', '')
        # Convert to lowercase
        icon = icon.lower()
        # Remove underscores
        icon = icon.replace('_', '')
        return icon


if __name__ == "__main__":
    """Self-test"""
    import sys
    import io

    if hasattr(sys.stdout, 'buffer'):
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

    extractor = BuffMetadataExtractor()

    # Test cases
    test_cases = [
        ('BT_STAT|ST_ATK', True),
        ('BT_ACTION_GAUGE', True),
        ('BT_SEALED', False),
        ('IG_Buff_2000020_Interruption_D', False),
    ]

    print('BuffMetadataExtractor self-test')
    print('=' * 80)

    for identifier, is_buff in test_cases:
        metadata = extractor.get_metadata(identifier, is_buff)
        print(f"\n{identifier} ({'buff' if is_buff else 'debuff'}):")
        for key, value in metadata.items():
            if value:
                print(f"  {key}: {value}")
