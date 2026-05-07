"""
Generate data/equipment/ascension-view.json — a slim, client-bundle-friendly
view of Singularity Ascension data.

Reads `data/generated/singularity-ascension.json` (full datamine, gitignored
exception) and emits a compact subset suitable for direct static import in
client components — replaces the hardcoded constants in
`src/app/[lang]/guides/_contents/general-guides/gear/helpers.tsx`.

Output structure (matches the legacy `BonusEffect` / `AscensionStep` shapes
already consumed by `AscensionStepsTable` and `AscensionBonusEffectsTable`):

{
  "$source": "...",
  "$generatedAt": "...",
  "init": { gold, chip, hammer, successRate, factorOP, addMaxLevel, addReforgeCount },
  "steps": [{ from, to, gold, chip, hammer, success, factor, mainStatPct, unlocksBonus? }],
  "reroll": { gold, cartridge, successRate },
  "activation": { mainStatPct, totalMainStatPct },
  "groupBySlot": { weapons: "30000", accessories: "30000", Helmet: "31000", ... },
  "options": {
    "30000": [BonusEffect, ...],   // offensive (collapses 5 elemental → 1 row)
    "31000": [BonusEffect, ...]    // defensive (collapses 5 elemental → 1 split row F/W/E vs L/D)
  },
  "totalRate": 10000,
  "grades": ["C", "B", "A", "S", "S+"]
}

The collapse rules match the legacy editorial choice in helpers.tsx:
  - Offensive elemental DMG (5 effects, identical ranges) → 1 "dmg_to_element" row
  - Defensive elemental DMG-Reduce (5 effects, 2 distinct ranges) → 1 "dmg_reduce_by_element"
    row with `splitLabels: { primary: 'F/W/E', alt: 'L/D' }` and `rangeAlt`
"""

import json
import os
import re
import sys
from collections import defaultdict
from datetime import datetime, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC_FILE = os.path.join(ROOT, 'data', 'generated', 'singularity-ascension.json')
OUT_FILE = os.path.join(ROOT, 'data', 'equipment', 'ascension-view.json')

# Material ID → semantic key used by the UI
MATERIAL_KEYS = {
    '25001': 'chip',
    '21004': 'hammer',
    '25002': 'cartridge',
}

# Game ItemSubType → site-side slot key (matches stat-ranges-v2.json convention)
SLOT_KEY = {
    'ITS_EQUIP_WEAPON': 'weapons',
    'ITS_EQUIP_ACCESSORY': 'accessories',
    'ITS_EQUIP_HELMET': 'Helmet',
    'ITS_EQUIP_ARMOR': 'Armor',
    'ITS_EQUIP_GLOVES': 'Gloves',
    'ITS_EQUIP_SHOES': 'Shoes',
}

GRADES = ['C', 'B', 'A', 'S', 'S+']

# Match nameIDs of elemental DMG / DMG Reduce variants
ELEMENTAL_DMG_RE = re.compile(r'^UO_SINGULAREQUIP_DMG_TO_(EARTH|WATER|FIRE|LIGHT|DARK)_NAME$')
ELEMENTAL_REDUCE_RE = re.compile(r'^UO_SINGULAREQUIP_DMG_REDUCE_BY_(EARTH|WATER|FIRE|LIGHT|DARK)_NAME$')

# Defensive split: F/W/E share strong values, L/D share weaker values
DEFENSIVE_PRIMARY = {'EARTH', 'WATER', 'FIRE'}
DEFENSIVE_ALT = {'LIGHT', 'DARK'}


def graceful_skip(reason):
    print(f'skipped: {reason}')
    sys.exit(0)


if not os.path.isfile(SRC_FILE):
    graceful_skip(f'source file missing: {SRC_FILE}')

with open(SRC_FILE, 'r', encoding='utf-8') as f:
    src = json.load(f)


# ── Init / steps / reroll (uniform across slots, except specialOptionGroupID
#    which we map separately via groupBySlot). Read from the WEAPON slot. ──

weapon = src['ascension']['ITS_EQUIP_WEAPON']
init_raw = weapon['init']


def material_count(materials, mat_id):
    return next((m['count'] for m in materials if m['id'] == mat_id), 0)


init = {
    'gold': init_raw['gold'],
    'chip': material_count(init_raw['materials'], '25001'),
    'hammer': material_count(init_raw['materials'], '21004'),
    'successRate': init_raw['successRate'],
    'factorOP': init_raw['factorOP'],
    'addMaxLevel': init_raw['addMaxLevel'],
    'addReforgeCount': init_raw['addReforgeCount'],
}

steps = []
for s in weapon['steps']:
    entry = {
        'from': s['from'],
        'to': s['to'],
        'gold': s['gold'],
        'chip': material_count(s['materials'], '25001'),
        'hammer': material_count(s['materials'], '21004'),
        'success': s['successRate'],
        'factor': s['factorOP'],
        # Main-stat gain at this step, expressed as a fraction of the +10 stat value.
        # Derivation: bonus added to the cumulative multiplier is `factor`, base multiplier
        # at +10 is 5 → relative gain over +10 = factor / 5 = factor × 0.20.
        'mainStatPct': round(s['factorOP'] * 0.20, 4),
    }
    if s['to'] == 15:
        entry['unlocksBonus'] = True
    steps.append(entry)

reroll_raw = weapon['reroll']
reroll = {
    'gold': reroll_raw['gold'],
    'cartridge': material_count(reroll_raw['materials'], '25002'),
    'successRate': reroll_raw['successRate'],
}

activation = {
    # +3% over +10 — derived from init.factorOP × 0.20 = 0.15 × 0.20 = 0.03
    'mainStatPct': round(init_raw['factorOP'] * 0.20, 4),
    # Cumulative total at +15: activation + sum(step factors) all × 0.20
    'totalMainStatPct': round(
        (init_raw['factorOP'] + sum(s['factorOP'] for s in weapon['steps'])) * 0.20,
        4,
    ),
}


# ── groupBySlot: map slot key → "30000" or "31000" ──

group_by_slot = {}
for sub_type, slot_key in SLOT_KEY.items():
    group_by_slot[slot_key] = src['ascension'][sub_type]['optionGroupID']


# ── Aggregate one effect's tiers into per-grade rows ──

def aggregate_effect_tiers(tiers, total_rate):
    """Return { grade: { range, rate, rateNorm } } where rate is summed weight,
    rateNorm is integer percentage of total_rate."""
    by_grade = defaultdict(list)
    for t in tiers:
        by_grade[t['grade']].append(t)
    out = {}
    for grade in GRADES:
        bucket = by_grade.get(grade, [])
        if not bucket:
            continue
        rate_sum = sum(t['rate'] for t in bucket)
        values = [t['value'] for t in bucket]
        rng = values[0] if len(values) == 1 else f'{values[0]}-{values[-1]}'
        out[grade] = {
            'range': rng,
            'rate': round(rate_sum / total_rate * 100),
        }
    return out


def make_bonus_effect(key, name_lang, total_rate, grades_dict, **extras):
    """Build a BonusEffect entry matching helpers.tsx shape."""
    entry = {
        'key': key,
        'rate': total_rate,
        'name': name_lang,
        'grades': grades_dict,
    }
    entry.update(extras)
    return entry


# ── Process options groups (30000 offensive, 31000 defensive) ──

def process_offensive_group(effects):
    """Group 30000 — collapses 5 elemental DMG effects into one `dmg_to_element` row."""
    output = []
    elemental_grades = None
    elemental_total = 0
    elemental_name = None

    for e in effects:
        m = ELEMENTAL_DMG_RE.match(e['nameID'])
        if m:
            # Aggregate; all 5 elements share identical ranges, so any element's grades suffice.
            elemental_grades = aggregate_effect_tiers(e['tiers'], e['totalRate'])
            elemental_total += e['totalRate']
            if elemental_name is None:
                # Use the first element's name as a template; UI may want a separate "vs Element" label.
                elemental_name = {
                    lang: re.sub(r' vs \w+$', ' vs <Element>', s)
                    for lang, s in e['name'].items()
                }
            continue

        # Non-elemental: keep as-is, derive a stable key from the nameID
        key = e['nameID'].replace('UO_SINGULAREQUIP_', '').replace('_NAME', '').lower()
        # Map to legacy keys used in helpers.tsx
        legacy_key_map = {
            'dmg': 'dmg',
            'dmg_singular': 'dmg_singular',
            'skill3_dmg_singular': 'dmg_skill3_singular',
        }
        key = legacy_key_map.get(key, key)
        grades = aggregate_effect_tiers(e['tiers'], e['totalRate'])
        output.append(make_bonus_effect(key, e['name'], e['totalRate'], grades))

    if elemental_grades is not None:
        output.append(make_bonus_effect(
            'dmg_to_element',
            elemental_name,
            elemental_total,
            elemental_grades,
        ))

    return output


def process_defensive_group(effects):
    """Group 31000 — collapses 5 elemental DMG-Reduce into one `dmg_reduce_by_element` row
    with split labels (F/W/E primary, L/D alt)."""
    output = []
    primary_grades = None
    alt_grades = None
    elemental_total = 0
    elemental_name = None

    for e in effects:
        m = ELEMENTAL_REDUCE_RE.match(e['nameID'])
        if m:
            element = m.group(1)
            grades = aggregate_effect_tiers(e['tiers'], e['totalRate'])
            if element in DEFENSIVE_PRIMARY and primary_grades is None:
                primary_grades = grades
            elif element in DEFENSIVE_ALT and alt_grades is None:
                alt_grades = grades
            elemental_total += e['totalRate']
            if elemental_name is None:
                elemental_name = {
                    lang: re.sub(r' vs \w+$', ' vs <Element>', s)
                    for lang, s in e['name'].items()
                }
            continue

        key = e['nameID'].replace('UO_SINGULAREQUIP_', '').replace('_NAME', '').lower()
        legacy_key_map = {
            'dmg_reduce': 'dmg_reduce',
            'dmg_reduce_singular': 'dmg_reduce_singular',
        }
        key = legacy_key_map.get(key, key)
        grades = aggregate_effect_tiers(e['tiers'], e['totalRate'])
        output.append(make_bonus_effect(key, e['name'], e['totalRate'], grades))

    if primary_grades is not None and alt_grades is not None:
        # Merge primary + alt: each grade row carries `range` (primary) and `rangeAlt` (alt)
        merged = {}
        for grade in GRADES:
            p = primary_grades.get(grade)
            a = alt_grades.get(grade)
            if not p or not a:
                continue
            merged[grade] = {
                'range': p['range'],
                'rangeAlt': a['range'],
                'rate': p['rate'],  # rate normalised — same for both branches
            }
        output.append(make_bonus_effect(
            'dmg_reduce_by_element',
            elemental_name,
            elemental_total,
            merged,
            splitLabels={'primary': 'F/W/E', 'alt': 'L/D'},
        ))

    return output


offensive = process_offensive_group(src['options']['30000']['effects'])
defensive = process_defensive_group(src['options']['31000']['effects'])


# ── Emit slim view ──

output = {
    '$source': 'Generated from data/generated/singularity-ascension.json — do not edit by hand. Run scripts/generate-ascension-view.py to regenerate.',
    '$generatedAt': datetime.now(timezone.utc).isoformat(timespec='seconds'),
    'totalRate': src['options']['30000']['totalRate'],
    'grades': GRADES,
    'init': init,
    'steps': steps,
    'reroll': reroll,
    'activation': activation,
    'groupBySlot': group_by_slot,
    'options': {
        '30000': offensive,
        '31000': defensive,
    },
}


def dump_compact(obj):
    """Indented JSON, but inline arrays of primitives. Diff-friendly + small."""
    text = json.dumps(obj, ensure_ascii=False, indent=2)
    pattern = re.compile(r'\[\s*\n((?:\s*[^\[\]{}\n,]+,?\s*\n)+?)\s*\]')

    def replace(m):
        items = [s.strip().rstrip(',').strip() for s in m.group(1).split('\n') if s.strip()]
        return '[' + ', '.join(items) + ']'

    prev = None
    while text != prev:
        prev, text = text, pattern.sub(replace, text)
    return text


os.makedirs(os.path.dirname(OUT_FILE), exist_ok=True)
with open(OUT_FILE, 'w', encoding='utf-8') as f:
    f.write(dump_compact(output))
    f.write('\n')

print(f'Wrote {OUT_FILE}')
print(f'  steps:      {len(steps)}')
print(f'  offensive:  {len(offensive)} effects (collapsed)')
print(f'  defensive:  {len(defensive)} effects (collapsed)')
