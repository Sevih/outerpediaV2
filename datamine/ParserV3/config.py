"""Centralized path configuration for ParserV3."""

from pathlib import Path

# Root directories
PARSER_ROOT = Path(__file__).parent                      # datamine/ParserV3/
DATAMINE_ROOT = PARSER_ROOT.parent                       # datamine/
PROJECT_ROOT = DATAMINE_ROOT.parent                      # outerpedia-v2/

# Datamine assets
EXTRACTED_ASSETS = DATAMINE_ROOT / "extracted_astudio"
BYTES_FOLDER = EXTRACTED_ASSETS / "assets" / "editor" / "resources" / "templetbinary"
CWEBP_PATH = DATAMINE_ROOT / "pngTowebp" / "bin" / "cwebp.exe"

# Parser local folders
CACHE_FOLDER = PARSER_ROOT / "cache"
EXPORT_FOLDER = PARSER_ROOT / "export"

# Project data (static, imported from v1)
DATA_ROOT = PROJECT_ROOT / "data"
CHAR_DATA = DATA_ROOT / "char"
BOSS_DATA = DATA_ROOT / "boss"
EQUIPMENT_DATA = DATA_ROOT / "equipment"
EFFECTS_DATA = DATA_ROOT / "effects"
RECO_DATA = DATA_ROOT / "reco"

# Specific data files
BUFFS_FILE = EFFECTS_DATA / "buffs.json"
DEBUFFS_FILE = EFFECTS_DATA / "debuffs.json"
EE_FILE = EQUIPMENT_DATA / "ee.json"

# Public assets
PUBLIC_IMAGES = PROJECT_ROOT / "public" / "images"
PUBLIC_CHARACTERS = PUBLIC_IMAGES / "characters"

# Parser export files
IGNORED_EFFECTS_FILE = EXPORT_FOLDER / "ignored_effects.json"
SKILL_CLASSIFICATION_FILE = EXPORT_FOLDER / "skill_classification.json"
EFFECT_CATEGORIES_FILE = EXPORT_FOLDER / "effect_categories.json"
