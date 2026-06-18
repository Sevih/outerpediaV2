"""
Generate data/generated/singularity-rotation.json

Reads the Dimensional Singularity rotation structure entirely from the game's
json2 datamine — it does NOT depend on our own data/boss/*.json files:
  - SingularityTemplet.json              : 6-week schedule (start DOW, period, themes)
  - SingularityDungeonGroupTemplet.json  : 4 entries per group with Order + DungeonID
  - DungeonSpawnTemplet.json             : DungeonID (spawn GroupID) → boss monster ID0

Resolution is fully deterministic: each group entry carries a DungeonID, and
the matching DungeonSpawnTemplet row (GroupID == DungeonID) points straight at
the boss monster id via its ID0 field. No (icons, element) matching and no
prefix fallback heuristics are needed — the spawn record already disambiguates
the Norn sisters (Urd/Skuld/Verdandi), who share the same model but live in
distinct dungeons (e.g. Group 3 → 60000012 Light vs Group 4 → 60000013 Dark).

This means new bosses resolve correctly even before we ship their data/boss file.

The ONLY thing the client templets do NOT contain is the calendar phase — i.e.
which group is active on which real-world date. The templets only describe the
cycle *order* (1→6); the anchor is server-driven, so ANCHOR_DATE/ANCHOR_GROUP_ID
below stays a user-confirmed constant.

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
from datetime import date, timedelta

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
JSON_DIR = os.path.join(ROOT, 'data', 'admin', 'json2')
OUT_DIR = os.path.join(ROOT, 'data', 'generated')
OUT_FILE = os.path.join(OUT_DIR, 'singularity-rotation.json')

REQUIRED_INPUTS = ['SingularityTemplet', 'SingularityDungeonGroupTemplet', 'DungeonSpawnTemplet']

# User-confirmed anchor: week starting 2026-05-20 was GroupID 3
# (Shichifuja, Harshna, Belial + Skuld on Saturday). The week before that
# (2026-05-13) was GroupID 2 (VI=E-11-A, Sphinx, Meteos + Verdandi), which
# is consistent with a sequential 1→2→3→4→5→6→1 cycle.
#
# This anchor is NOT derivable from the client datamine — the templets only
# encode the cycle order, not which calendar week maps to which group. It must
# be confirmed in-game and updated here if the live rotation ever desyncs.
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


def build_dungeon_to_boss(spawn_rows):
    """Map DungeonID → boss monster id via DungeonSpawnTemplet.

    Each spawn row's GroupID is the DungeonID it belongs to, and ID0 is the
    boss occupying the lead position (Pos0). Singularity dungeons hold a single
    boss, so a GroupID → ID0 mapping is unambiguous.
    """
    out = {}
    for r in spawn_rows:
        gid = r.get('GroupID')
        boss = r.get('ID0')
        if gid and boss:
            out[str(gid)] = str(boss)
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
    spawn_rows = load_json2('DungeonSpawnTemplet')

    dungeon_to_boss = build_dungeon_to_boss(spawn_rows)

    # Build per-GroupID -> ordered list of (order, dungeon_id)
    # `Order` is missing for the main/first boss (treat as 0)
    raw = {}
    for entry in dungeon_group:
        gid = entry['GroupID']
        order = int(entry.get('Order') or 0)
        dungeon_id = str(entry.get('DungeonID') or '')
        raw.setdefault(gid, []).append((order, dungeon_id))

    # Theme name from SingularityTemplet, keyed by SingularityDungeonGroupID
    theme_by_group = {row['SingularityDungeonGroupID']: row.get('SingularityThemeName', '') for row in singularity}

    groups = []
    unresolved = []
    for gid_str in sorted(raw.keys(), key=lambda x: int(x)):
        entries = sorted(raw[gid_str], key=lambda t: t[0])
        boss_ids = []
        for _, dungeon_id in entries:
            bid = dungeon_to_boss.get(dungeon_id)
            if bid is None:
                unresolved.append((gid_str, dungeon_id))
                boss_ids.append(None)
            else:
                boss_ids.append(bid)
        groups.append({
            'id': int(gid_str),
            'themeName': theme_by_group.get(gid_str, ''),
            'bossIds': boss_ids,
        })

    if unresolved:
        # A DungeonID with no spawn row would mean a brand-new dungeon not yet in
        # DungeonSpawnTemplet. Log and continue with null bossIds rather than bail.
        print(f'note: {len(unresolved)} dungeon(s) with no spawn row: {unresolved}')

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
