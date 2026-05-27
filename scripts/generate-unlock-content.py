"""
Generate data/generated/unlock-content.json

Reads content-unlock conditions from json2 sources:
  - ContentLockTemplet.json : { ContentType, UnLockConditionType, UnLockConditionValue, LockTextID }
  - DungeonTemplet.json     : { ID, NameID, AreaID, DungeonMode } for unlock-dungeon resolution
  - AreaTemplet.json        : { ID, SeasonID, EpisodeNum } for stage-label formatting
  - TextSystem.json         : i18n source for dungeon names + lock popup texts

Output: { "entries": [ { contentType, condition, stage?, dungeonName?, lockPopup, ... }, ... ] }

Stage-label derivation: look up the dungeon's AreaID in AreaTemplet to get
  SeasonID + EpisodeNum, take the stage from the dungeon ID's last two digits.
  Format: "S<season>[H]-<episode>-<stage>". The "H" suffix marks Hard-mode
  stages, detected via AreaTemplet.ShortName starting with "SYS_HARD_AREA".

  Note: dungeon IDs can be misleading. The same dungeon may have been
  reorganised across seasons over time (e.g. dungeon `121015` was once part
  of S2 but now lives in S3 Episode 10 per the current AreaTemplet). Always
  trust AreaID lookup over ID parsing.

Usage: python scripts/generate-unlock-content.py
"""

import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
JSON_DIR = os.path.join(ROOT, 'data', 'admin', 'json2')
OUT_DIR = os.path.join(ROOT, 'data', 'generated')
OUT_FILE = os.path.join(OUT_DIR, 'unlock-content.json')

REQUIRED_INPUTS = [
    'ContentLockTemplet',
    'DungeonTemplet',
    'AreaTemplet',
    'TextSystem',
]

LANG_FIELDS = [
    ('en', 'English'),
    ('jp', 'Japanese'),
    ('kr', 'Korean'),
    ('zh', 'China_Simplified'),
]

# Lock-screen name overrides: by default we read SYS_CONTENS_LOCK_<CT>, but a
# few ContentTypes have either no such entry or a stale one. These overrides
# point at the correct (current) TextSystem key per ContentType.
LOCK_SCREEN_OVERRIDES = {
    # No SYS_CONTENS_LOCK_* entry exists; these are the dedicated title keys.
    'SINGULARITY': 'SYS_SINGULARITY_MAIN_TITLE',
    'CHARACTER_FUSION': 'SYS_CHARACTER_FUSION_TITLE',
    # SYS_CONTENS_LOCK_* values below are stale / wrong / less common in-game.
    # The current player-facing labels live at these alternative keys:
    'PVE_EXP_DUNGEON': 'SYS_GOLD_DUNGEON',            # "Bandit Pursuit" → "Hypnotic Frog Hall"
    'PVE_REMAINS': 'SYS_SHORTCUT_REMAINS_TYPE_01',    # "Demon King's Ruins" → "The Archdemon's Ruins: The Deeps"
    'PVE_REMAINS_LOOP': 'SYS_SHORTCUT_REMAINS_TYPE_02',  # "Endless Corridor" → "The Archdemon's Ruins: The Infinite Corridor"
    'PVE_EXPLORATION': 'SYS_RUIN_ISLAND',             # "Isle of Ruin Exploration" → "Terminus Isle"
    'PIECE_DUNGEON': 'SYS_PIECE_DUNGEON',             # "Doppelgänger Hunt" → "Defeat the Doppelgänger"
    'IRREGULAR_INFILTRATE': 'SYS_IRR_INFILTREATE_NAME_01',  # "Infiltration Annihilation" → "Infiltration Operation"
    'IRREGULAR_CHASE': 'SYS_IRR_CHASE_NAME_01',       # "Pursuit Annihilation" → "Pursuit Operation"
    'AGIT_CUSTOM_CRAFT': 'SYS_CRAFT_DETAILS_TITLE',   # "Precision Crafting" → "Precise Craft"
    'EVENT_DUNGEON': 'SYS_MENU_EVENT_DUNGEON',        # "Event Story" → "Event Dungeon"
    # FESTIVAL → SYS_MERSHA_FES_MAIN_TITLE and MIRSHA_SETTLEMENT →
    # SYS_MIRSHA_SETTLEMENT_DEMIURGE_MISSION were resolved earlier but those
    # ContentTypes are no longer shown in the guide (event-only, not progression).
    # Kept commented out for reference if they need to come back.
}


def load_json2(name):
    with open(os.path.join(JSON_DIR, f'{name}.json'), 'r', encoding='utf-8') as f:
        return json.load(f)


def lang_map(row, default=''):
    if not row:
        return {short: default for short, _ in LANG_FIELDS}
    return {short: (row.get(full) or default) for short, full in LANG_FIELDS}


def build_hard_area_set(area_rows):
    """Hard areas use ShortName 'SYS_HARD_AREA{NN}'; Normal areas use 'SYS_AREA{NN}'."""
    return {r['ID'] for r in area_rows if (r.get('ShortName') or '').startswith('SYS_HARD_AREA')}


def derive_stage_label(dungeon_id, dungeon_row, area_index, hard_area_set):
    """Format 'S<season>-<episode>-<stage>' (optionally with 'H' suffix for Hard)."""
    if not dungeon_id or not dungeon_id.isdigit() or len(dungeon_id) < 2:
        return None
    if not dungeon_row:
        return None
    area_id = dungeon_row.get('AreaID')
    if not area_id:
        return None
    area = area_index.get(area_id)
    if not area:
        return None
    season = area.get('SeasonID')
    episode = area.get('EpisodeNum')
    if not (season and episode):
        return None
    try:
        stage = int(dungeon_id[-2:])
    except ValueError:
        return None
    hard = 'H' if area_id in hard_area_set else ''
    return f'S{season}{hard}-{episode}-{stage}'


def main():
    # Graceful skip if json2 is unavailable
    if not os.path.isdir(JSON_DIR):
        print('skipped: data/admin/json2 not present')
        return 0

    missing = [n for n in REQUIRED_INPUTS if not os.path.isfile(os.path.join(JSON_DIR, f'{n}.json'))]
    if missing:
        print(f'skipped: missing {len(missing)} input(s): {", ".join(missing)}')
        return 0

    lock_rows = load_json2('ContentLockTemplet')
    dungeon_rows = load_json2('DungeonTemplet')
    area_rows = load_json2('AreaTemplet')
    text_system = load_json2('TextSystem')

    dungeon_index = {r['ID']: r for r in dungeon_rows}
    area_index = {r['ID']: r for r in area_rows}
    text_index = {r['ID']: r for r in text_system}
    hard_area_set = build_hard_area_set(area_rows)

    def resolve_dungeon(did):
        """Build a unit-of-requirement: {dungeonId, stage, dungeonName, areaName}."""
        dungeon = dungeon_index.get(did)
        out = {'dungeonId': did, 'stage': None, 'dungeonName': None, 'areaName': None}
        if not dungeon:
            return out
        out['stage'] = derive_stage_label(did, dungeon, area_index, hard_area_set)
        name_id = dungeon.get('NameID') or ''
        out['dungeonName'] = lang_map(text_index.get(name_id)) if name_id else None
        area_id = dungeon.get('AreaID')
        if area_id and area_id in area_index:
            area_name_id = area_index[area_id].get('NameID') or ''
            out['areaName'] = lang_map(text_index.get(area_name_id)) if area_name_id else None
        return out

    entries = []
    for row in lock_rows:
        content_type = row.get('ContentType') or ''
        if not content_type:
            continue
        cond_type = row.get('UnLockConditionType') or ''
        cond_value = row.get('UnLockConditionValue') or ''
        lock_text_id = row.get('LockTextID') or ''
        text_id = row.get('TextID') or ''
        desc_text_id = row.get('DescTextID') or ''

        def resolve_text(tid):
            if not tid or tid == '0':
                return None
            row_ = text_index.get(tid)
            if not row_:
                return None
            lm = lang_map(row_)
            # All-empty maps are effectively missing data
            if not any(v for v in lm.values()):
                return None
            return lm

        # SYS_CONTENS_LOCK_<CONTENT_TYPE> is the player-facing label shown on
        # the unlock pop-up — typically the most reliable mode name available.
        # A handful of ContentTypes have no such key, or have a stale one
        # (e.g. PVE_EXP_DUNGEON points to "Bandit Pursuit" — an old game-mode
        # name no longer used; current name is "Hypnotic Frog Hall"). The
        # overrides below redirect those to better TextSystem keys.
        lock_screen_key = LOCK_SCREEN_OVERRIDES.get(content_type, f'SYS_CONTENS_LOCK_{content_type}')
        entry = {
            'id': row.get('ID'),
            'contentType': content_type,
            'condition': {
                'type': cond_type,
                'value': cond_value,
            },
            'textId': text_id,
            'descTextId': desc_text_id,
            'lockTextId': lock_text_id,
            'lockScreenName': resolve_text(lock_screen_key),
            'officialName': resolve_text(text_id),
            'officialDescription': resolve_text(desc_text_id),
            'lockPopup': resolve_text(lock_text_id),
            'requirements': [],
        }

        # Resolve dungeon-based conditions (may be CSV: "111007, 121511, 122010")
        if cond_type == 'DUNGEON_CLAER' and cond_value:
            ids = [s.strip() for s in cond_value.split(',') if s.strip()]
            entry['requirements'] = [resolve_dungeon(did) for did in ids]

        entries.append(entry)

    # Sort by ContentType for stable diffs
    entries.sort(key=lambda e: (e['contentType'], e['id']))

    out = {
        'entries': entries,
        'count': len(entries),
    }

    os.makedirs(OUT_DIR, exist_ok=True)
    with open(OUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
        f.write('\n')

    print(f'wrote {OUT_FILE} ({len(entries)} entries)')
    return 0


if __name__ == '__main__':
    sys.exit(main())
