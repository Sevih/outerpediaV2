"""
Mapping Loader - Dynamically load enum to text mappings from TextSystem.bytes
"""
from pathlib import Path
from cache_manager import CacheManager

BASE_PATH = Path(__file__).parent.parent
BYTES_FOLDER = BASE_PATH / "extracted_astudio" / "assets" / "editor" / "resources" / "templetbinary"

def load_mappings():
    """
    Load all enum to text mappings from TextSystem.bytes
    Returns a dict with ELEMENT_MAP, CLASS_MAP, and SUBCLASS_MAP
    """
    # Use cache for fast loading
    cache = CacheManager(BYTES_FOLDER)
    text_system_data = cache.get_data("TextSystem.bytes")

    # Build index for fast lookup
    text_index = {t.get('IDSymbol'): t for t in text_system_data if t.get('IDSymbol')}

    # Element mappings
    element_map = {}
    element_enums = {
        'CET_FIRE': 'SYS_ELEMENT_FIRE',
        'CET_WATER': 'SYS_ELEMENT_WATER',
        'CET_EARTH': 'SYS_ELEMENT_EARTH',
        'CET_LIGHT': 'SYS_ELEMENT_LIGHT',
        'CET_DARK': 'SYS_ELEMENT_DARK'
    }
    for enum_val, text_id in element_enums.items():
        text_entry = text_index.get(text_id)
        if text_entry:
            element_map[enum_val] = text_entry.get('English', enum_val)

    # Class mappings
    class_map = {}
    class_enums = {
        'CCT_DEFENDER': 'SYS_CLASS_DEFENDER',
        'CCT_ATTACKER': 'SYS_CLASS_ATTACKER',  # Old: Attacker, now: Striker
        'CCT_STRIKER': 'SYS_CLASS_STRIKER',    # New unified Striker class
        'CCT_RANGER': 'SYS_CLASS_RANGER',
        'CCT_PRIEST': 'SYS_CLASS_PRIEST',      # Old: Priest, now: Healer
        'CCT_HEALER': 'SYS_CLASS_HEALER',      # New unified Healer class
        'CCT_MAGE': 'SYS_CLASS_MAGE'
    }
    for enum_val, text_id in class_enums.items():
        text_entry = text_index.get(text_id)
        if text_entry:
            class_map[enum_val] = text_entry.get('English', enum_val)

    # SubClass mappings
    subclass_map = {}
    subclass_enums = {
        'SWEEPER': 'SYS_CLASS_NAME_SWEEPER',
        'PHALANX': 'SYS_CLASS_NAME_PHALANX',
        'ATTACKER': 'SYS_CLASS_NAME_ATTACKER',  # SubClass Attacker
        'BRUISER': 'SYS_CLASS_NAME_BRUISER',
        'TACTICIAN': 'SYS_CLASS_NAME_TACTICIAN',
        'VANGUARD': 'SYS_CLASS_NAME_VANGUARD',
        'SAGE': 'SYS_CLASS_NAME_SAGE',
        'RELIEVER': 'SYS_CLASS_NAME_RELIEVER',
        'WIZARD': 'SYS_CLASS_NAME_WIZARD',
        'ENCHANTER': 'SYS_CLASS_NAME_ENCHANTER'
    }
    for enum_val, text_id in subclass_enums.items():
        text_entry = text_index.get(text_id)
        if text_entry:
            subclass_map[enum_val] = text_entry.get('English', enum_val)

    return {
        'ELEMENT_MAP': element_map,
        'CLASS_MAP': class_map,
        'SUBCLASS_MAP': subclass_map
    }
