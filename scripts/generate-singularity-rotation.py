"""
Generate data/generated/singularity-rotation.json

Reads the Dimensional Singularity rotation structure from json2 sources:
  - SingularityTemplet.json              : 6-week schedule (start DOW, period, themes)
  - SingularityDungeonGroupTemplet.json  : 4 bosses per group with DungeonID + thumbnail
  - DungeonTemplet.json                  : DungeonID → element letter via NameID
                                           (SYS_SINGULAR_DUNGEON_<F|W|E|L|D><NN>)

Resolves each group entry to a boss ID by combining:
  • Element from the DungeonID's NameID (the L/D distinction matters for the
    Norn sisters Urd/Skuld/Verdandi, who all have Light AND Dark variants
    sharing the same `icons` code — e.g. Urd Light=60000010 vs Dark=60000013
    both use icons 4004006).
  • Icons code from BossThumbnail / boss file's `icons` field, with a 5-digit
    prefix fallback for Harshna (templet=4086020 vs boss=4086026).

When a (icons, element) combination has no boss file (e.g. Verdandi Light or
Skuld Dark not yet shipped), the entry is reported as unresolved.

Output:
  {
    "cycleLengthWeeks": 6,
    "startDayOfWeek": "WED",
    "activeDays": 4,
    "rewardDays": 3,
    "anchor": { "date": "...", "groupId": N, "note": "..." },
    "groups": [ { "id": N, "themeName": "...", "bossIds": [ "60000xxx", ... ] } ],
    "rotation": [ { "startDate": "...", "endDate": "...", "groupId": N, "bossIds": [...] } ]
  }

Usage: python scripts/generate-singularity-rotation.py
"""

import json
import os
import sys
import glob
from datetime import date, timedelta

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
JSON_DIR = os.path.join(ROOT, 'data', 'admin', 'json2')
BOSS_DIR = os.path.join(ROOT, 'data', 'boss')
OUT_DIR = os.path.join(ROOT, 'data', 'generated')
OUT_FILE = os.path.join(OUT_DIR, 'singularity-rotation.json')

REQUIRED_INPUTS = ['SingularityTemplet', 'SingularityDungeonGroupTemplet', 'DungeonTemplet']

# DungeonTemplet NameID prefix used by Singularity dungeons
DUNGEON_NAME_PREFIX = 'SYS_SINGULAR_DUNGEON_'

# Element letter in the dungeon NameID → boss file's `element` field
ELEMENT_LETTER_TO_NAME = {
    'F': 'Fire',
    'W': 'Water',
    'E': 'Earth',
    'L': 'Light',
    'D': 'Dark',
}

# User-confirmed anchor: week starting 2026-05-20 was GroupID 3
# (Shichifuja, Harshna, Belial + Skuld on Saturday). The week before that
# (2026-05-13) was GroupID 2 (VI=E-11-A, Sphinx, Meteos + Verdandi), which
# is consistent with a sequential 1→2→3→4→5→6→1 cycle.
ANCHOR_DATE = date(2026, 5, 20)
ANCHOR_GROUP_ID = 3
ANCHOR_NOTE = 'Confirmed in-game: Shichifuja/Harshna/Belial + Skuld'

# How many weeks to emit around "today" in the dated rotation array
WEEKS_BACK = 26
WEEKS_FORWARD = 26


def load_json2(name):
    path = os.path.join(JSON_DIR, f'{name}.json')
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)


def build_boss_index():
    """Map (icons, element) → boss_id for every Dimensional Singularity boss.

    Also returns a prefix-5 index of (icons5, element) → boss_id for the
    Harshna case where the templet thumbnail (4086020) doesn't exact-match
    the boss file's icons (4086026).
    """
    exact = {}
    by_prefix5 = {}
    for f in sorted(glob.glob(os.path.join(BOSS_DIR, '*.json'))):
        try:
            with open(f, 'r', encoding='utf-8') as fp:
                d = json.load(fp)
        except Exception:
            continue
        mode = (d.get('location') or {}).get('mode', {}).get('en', '')
        if mode != 'Dimensional Singularity':
            continue
        boss_id = str(d.get('id'))
        icons = str(d.get('icons') or '')
        element = d.get('element') or ''
        if not icons or not element:
            continue
        exact[(icons, element)] = boss_id
        by_prefix5.setdefault((icons[:5], element), []).append((icons, boss_id))
    return exact, by_prefix5


def resolve_boss(code, element, exact, by_prefix5):
    if (code, element) in exact:
        return exact[(code, element)]
    # Prefix-5 fallback only fires when exactly ONE candidate shares the prefix
    # and the requested element — this handles Harshna's templet-vs-file code
    # drift (4086020 vs 4086026) without misattributing across distinct bosses
    # (the Norn sisters Urd/Skuld/Verdandi all share prefix 40040).
    candidates = by_prefix5.get((code[:5], element), [])
    if len(candidates) == 1:
        return candidates[0][1]
    return None


def build_dungeon_to_element(dungeon_rows):
    """Map DungeonID → element name via the SYS_SINGULAR_DUNGEON_<X><NN> NameID."""
    out = {}
    for r in dungeon_rows:
        name_id = r.get('NameID') or ''
        if not name_id.startswith(DUNGEON_NAME_PREFIX):
            continue
        suffix = name_id[len(DUNGEON_NAME_PREFIX):]
        if not suffix:
            continue
        letter = suffix[0]
        element = ELEMENT_LETTER_TO_NAME.get(letter)
        if element:
            out[str(r.get('ID'))] = element
    return out


def group_id_for_week(week_start):
    """Cycle 1..6 anchored on ANCHOR_DATE/ANCHOR_GROUP_ID."""
    delta_weeks = (week_start - ANCHOR_DATE).days // 7
    return ((ANCHOR_GROUP_ID - 1 + delta_weeks) % 6) + 1


def main():
    # Graceful skip if json2 is unavailable (prod build without datamine)
    if not os.path.isdir(JSON_DIR):
        print('skipped: data/admin/json2 not present')
        return 0

    missing = [n for n in REQUIRED_INPUTS if not os.path.isfile(os.path.join(JSON_DIR, f'{n}.json'))]
    if missing:
        print(f'skipped: missing {len(missing)} input(s): {", ".join(missing)}')
        return 0

    singularity = load_json2('SingularityTemplet')
    dungeon_group = load_json2('SingularityDungeonGroupTemplet')
    dungeon_rows = load_json2('DungeonTemplet')

    exact, by_prefix5 = build_boss_index()
    if not exact:
        print('skipped: no Dimensional Singularity bosses found in data/boss')
        return 0

    dungeon_to_element = build_dungeon_to_element(dungeon_rows)

    # Build per-GroupID -> ordered list of (order, code, element)
    # `Order` is missing for the main/first boss (treat as 0)
    raw = {}
    for entry in dungeon_group:
        gid = entry['GroupID']
        order = int(entry.get('Order') or 0)
        thumbnail = entry.get('BossThumbnail', '')
        # MT_Singularity_<code>
        code = thumbnail.rsplit('_', 1)[-1] if thumbnail else ''
        dungeon_id = str(entry.get('DungeonID') or '')
        element = dungeon_to_element.get(dungeon_id, '')
        raw.setdefault(gid, []).append((order, code, element))

    # Theme name from SingularityTemplet, keyed by SingularityDungeonGroupID
    theme_by_group = {row['SingularityDungeonGroupID']: row.get('SingularityThemeName', '') for row in singularity}

    groups = []
    unresolved = []
    for gid_str in sorted(raw.keys(), key=lambda x: int(x)):
        entries = sorted(raw[gid_str], key=lambda t: t[0])
        boss_ids = []
        for _, code, element in entries:
            bid = resolve_boss(code, element, exact, by_prefix5)
            if bid is None:
                unresolved.append((gid_str, code, element))
                boss_ids.append(None)
            else:
                boss_ids.append(bid)
        groups.append({
            'id': int(gid_str),
            'themeName': theme_by_group.get(gid_str, ''),
            'bossIds': boss_ids,
        })

    if unresolved:
        # Don't bail entirely — the Norn sister variants we haven't shipped yet
        # (e.g. Verdandi Light, Skuld Dark) will surface here. Log and continue
        # with null bossIds; consumers can render a "?" cell.
        print(f'note: {len(unresolved)} unresolved (icons, element) combination(s): {unresolved}')

    groups_by_id = {g['id']: g for g in groups}

    today = date.today()
    # Snap to current Wednesday (or the most recent Wednesday if today isn't Wed)
    # weekday(): Monday=0..Sunday=6, Wednesday=2
    days_since_wed = (today.weekday() - 2) % 7
    current_wed = today - timedelta(days=days_since_wed)

    rotation = []
    for i in range(-WEEKS_BACK, WEEKS_FORWARD + 1):
        start = current_wed + timedelta(weeks=i)
        end = start + timedelta(days=6)
        gid = group_id_for_week(start)
        rotation.append({
            'startDate': start.isoformat(),
            'endDate': end.isoformat(),
            'groupId': gid,
            'bossIds': groups_by_id[gid]['bossIds'],
        })

    out = {
        'cycleLengthWeeks': 6,
        'startDayOfWeek': 'WED',
        'activeDays': 4,
        'rewardDays': 3,
        'anchor': {
            'date': ANCHOR_DATE.isoformat(),
            'groupId': ANCHOR_GROUP_ID,
            'note': ANCHOR_NOTE,
        },
        'groups': groups,
        'rotation': rotation,
    }

    os.makedirs(OUT_DIR, exist_ok=True)
    with open(OUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
        f.write('\n')

    print(f'wrote {OUT_FILE} ({len(rotation)} weeks, {len(groups)} groups)')
    return 0


if __name__ == '__main__':
    sys.exit(main())
