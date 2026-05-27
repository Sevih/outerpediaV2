"""
Generate data/generated/singularity-rotation.json

Reads the Dimensional Singularity rotation structure from json2 sources:
  - SingularityTemplet.json              : 6-week schedule (start DOW, period, themes)
  - SingularityDungeonGroupTemplet.json  : 4 bosses per group, with thumbnail codes

Resolves each thumbnail code to a boss ID by scanning data/boss/*.json where
location.mode.en == "Dimensional Singularity". Falls back to a 5-digit prefix
match when the templet thumbnail code differs slightly from the boss file's
`icons` field (observed for Harshna: templet=4086020 vs boss=4086026).

Output:
  {
    "generatedAt": "YYYY-MM-DD",
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

REQUIRED_INPUTS = ['SingularityTemplet', 'SingularityDungeonGroupTemplet']

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


def build_code_to_boss_id():
    """Map a thumbnail code (e.g. '4038004') to a Dimensional Singularity boss ID.

    Exact match by `icons` field, with a 5-digit prefix fallback for cases
    where the templet thumbnail code drifts from the boss file's icons code
    (Harshna: 4086020 vs 4086026).
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
        if not icons:
            continue
        exact[icons] = boss_id
        by_prefix5.setdefault(icons[:5], []).append((icons, boss_id))
    return exact, by_prefix5


def resolve_code(code, exact, by_prefix5):
    if code in exact:
        return exact[code]
    candidates = by_prefix5.get(code[:5], [])
    if len(candidates) == 1:
        return candidates[0][1]
    if len(candidates) > 1:
        # Pick the closest icons numerically (smallest absolute diff)
        try:
            target = int(code)
            best = min(candidates, key=lambda c: abs(int(c[0]) - target))
            return best[1]
        except ValueError:
            return candidates[0][1]
    return None


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

    exact, by_prefix5 = build_code_to_boss_id()
    if not exact:
        print('skipped: no Dimensional Singularity bosses found in data/boss')
        return 0

    # Build per-GroupID -> ordered list of (order, code)
    # `Order` is missing for the main/first boss (treat as 0)
    raw = {}
    for entry in dungeon_group:
        gid = entry['GroupID']
        order = int(entry.get('Order') or 0)
        thumbnail = entry.get('BossThumbnail', '')
        # MT_Singularity_<code>
        code = thumbnail.rsplit('_', 1)[-1] if thumbnail else ''
        raw.setdefault(gid, []).append((order, code, entry.get('SingularBossGroupID')))

    # Theme name from SingularityTemplet, keyed by SingularityDungeonGroupID
    theme_by_group = {row['SingularityDungeonGroupID']: row.get('SingularityThemeName', '') for row in singularity}

    groups = []
    unresolved = []
    for gid_str in sorted(raw.keys(), key=lambda x: int(x)):
        entries = sorted(raw[gid_str], key=lambda t: t[0])
        boss_ids = []
        for _, code, _ in entries:
            bid = resolve_code(code, exact, by_prefix5)
            if bid is None:
                unresolved.append((gid_str, code))
                boss_ids.append(None)
            else:
                boss_ids.append(bid)
        groups.append({
            'id': int(gid_str),
            'themeName': theme_by_group.get(gid_str, ''),
            'bossIds': boss_ids,
        })

    if unresolved:
        print(f'skipped: could not resolve boss code(s): {unresolved}')
        return 0

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
        'generatedAt': today.isoformat(),
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
