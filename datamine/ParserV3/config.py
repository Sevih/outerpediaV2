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
CHAR_DATA = DATA_ROOT / "character"
BOSS_DATA = DATA_ROOT / "boss"
EQUIPMENT_DATA = DATA_ROOT / "equipment"
EFFECTS_DATA = DATA_ROOT / "effects"
RECO_DATA = DATA_ROOT / "reco"
GENERATED_DATA = DATA_ROOT / "generated"
CHARACTER_STATS_FILE = GENERATED_DATA / "character-stats.json"

# Specific data files
BUFFS_FILE = EFFECTS_DATA / "buffs.json"
DEBUFFS_FILE = EFFECTS_DATA / "debuffs.json"
EE_FILE = EQUIPMENT_DATA / "ee.json"

# Public assets
PUBLIC_IMAGES = PROJECT_ROOT / "public" / "images"

# Characters images
PUBLIC_CHARACTERS = PUBLIC_IMAGES / "characters"
PUBLIC_CHAR_PORTRAIT = PUBLIC_CHARACTERS / "portrait"
PUBLIC_CHAR_ATB = PUBLIC_CHARACTERS / "atb"
PUBLIC_CHAR_FULL = PUBLIC_CHARACTERS / "full"
PUBLIC_CHAR_SKILLS = PUBLIC_CHARACTERS / "skills"
PUBLIC_CHAR_CHAIN = PUBLIC_CHARACTERS / "chain"
PUBLIC_CHAR_EE = PUBLIC_CHARACTERS / "ee"
PUBLIC_CHAR_CUTIN = PUBLIC_CHARACTERS / "cutin"

# Bosses images
PUBLIC_BOSSES = PUBLIC_IMAGES / "bosses"
PUBLIC_BOSS_PORTRAIT = PUBLIC_BOSSES / "portrait"
PUBLIC_BOSS_MINI = PUBLIC_BOSSES / "mini"
PUBLIC_BOSS_SKILL = PUBLIC_BOSSES / "skill"

# Other public assets
PUBLIC_EQUIPMENT = PUBLIC_IMAGES / "equipment"
PUBLIC_UI = PUBLIC_IMAGES / "ui"
PUBLIC_BG = PUBLIC_IMAGES / "bg"

# Parser export files
IGNORED_EFFECTS_FILE = EXPORT_FOLDER / "ignored_effects.json"
SKILL_CLASSIFICATION_FILE = EXPORT_FOLDER / "skill_classification.json"
EFFECT_CATEGORIES_FILE = EXPORT_FOLDER / "effect_categories.json"
