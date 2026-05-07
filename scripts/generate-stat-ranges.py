"""
Generate data/generated/stat-ranges-calculated.json from ItemTemplet + ItemOptionTemplet.

Aggregates base main-option values (+0, T0) per (slot, statKey, rarity, star) and
projects the expected +10 T4 max via the standard formula:
    stat_at_+10_T4 = base × 6   (× 5 enhancement × × 1.20 transcend)

This formula matches all stats verified in-game except for three outliers, where
in-game observation reveals a smaller enhancement multiplier (~× 4.5 or × 4.375):
    Armor DEF       100 → 540  (ratio 5.4)
    Shoes RES        10 →  54  (ratio 5.4)
    Shoes HP%         4 →  21  (ratio 5.25)

These overrides are listed in STAT_RATIO_OVERRIDES below. They likely reflect
either a per-stat tuning or rounding artefacts in the displayed values; the
underlying ItemEnchantTemplet entries (Unique_6 lv10 = 25000) are uniform across
slots, so the divergence is not visible from JSON alone.

Output: { slot: { stat: { rarity: { star: [base, max] } } } }
Usage : python scripts/generate-stat-ranges.py
"""

import json
import os
import sys
from collections import defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
JSON_DIR = os.path.join(ROOT, 'data', 'admin', 'json2')
OUT_DIR = os.path.join(ROOT, 'data', 'generated')
OUT_FILE = os.path.join(OUT_DIR, 'stat-ranges-calculated.json')
REF_FILE = os.path.join(ROOT, 'data', 'equipment', 'statRanges.json')

REQUIRED_INPUTS = ['ItemTemplet', 'ItemOptionTemplet']

SLOT_MAP = {
    'ITS_EQUIP_WEAPON': 'weapons',
    'ITS_EQUIP_ACCESSORY': 'accessories',
    'ITS_EQUIP_HELMET': 'Helmet',
    'ITS_EQUIP_ARMOR': 'Armor',
    'ITS_EQUIP_GLOVES': 'Gloves',
    'ITS_EQUIP_SHOES': 'Shoes',
}

RARITY_MAP = {
    'IG_NORMAL': 'normal',
    'IG_MAGIC': 'superior',
    'IG_RARE': 'epic',
    'IG_UNIQUE': 'legendary',
}

# (StatType, ApplyingType) → display key (matches statRanges.json convention)
STAT_KEY_MAP = {
    ('ST_ATK', 'OAT_ADD'): 'ATK',
    ('ST_ATK', 'OAT_RATE'): 'ATK%',
    ('ST_DEF', 'OAT_ADD'): 'DEF',
    ('ST_DEF', 'OAT_RATE'): 'DEF%',
    ('ST_HP', 'OAT_ADD'): 'HP',
    ('ST_HP', 'OAT_RATE'): 'HP%',
    ('ST_SPEED', 'OAT_ADD'): 'SPD',
    ('ST_CRITICAL_RATE', 'OAT_ADD'): 'CHC',
    ('ST_CRITICAL_DMG_RATE', 'OAT_ADD'): 'CHD',
    ('ST_BUFF_CHANCE', 'OAT_ADD'): 'EFF',
    ('ST_BUFF_RESIST', 'OAT_ADD'): 'RES',
    ('ST_PIERCE_POWER_RATE', 'OAT_ADD'): 'PEN%',
    ('ST_DMG_BOOST', 'OAT_ADD'): 'DMG UP%',
    ('ST_DMG_REDUCE_RATE', 'OAT_ADD'): 'DMG RED%',
    ('ST_E_CRI_DMG_REDUCE', 'OAT_ADD'): 'CDMG RED%',
}

# Stats stored ×10 in JSON option values (e.g. 130 → 13%, 80 → 8 CHC).
# EFF, RES, SPD, raw ATK/DEF/HP are stored as direct integers — not divided.
STORED_TIMES_TEN = {
    'ATK%', 'DEF%', 'HP%', 'CHC', 'CHD', 'PEN%',
    'DMG UP%', 'DMG RED%', 'CDMG RED%',
}

# Default ratio +0 T0 → +10 T4 = × 5 enhance × × 1.20 transcend = × 6
DEFAULT_RATIO = 6.0

# Known per-(slot, stat) overrides (in-game verified; see header comment)
STAT_RATIO_OVERRIDES = {
    ('Armor', 'DEF'): 5.4,
    ('Shoes', 'RES'): 5.4,
    ('Shoes', 'HP%'): 5.25,
}


def load(name):
    with open(os.path.join(JSON_DIR, f'{name}.json'), 'r', encoding='utf-8') as f:
        return json.load(f)


# Graceful skip for prod build / missing datamine
if not os.path.isdir(JSON_DIR):
    print('skipped: data/admin/json2 not present')
    sys.exit(0)

missing = [n for n in REQUIRED_INPUTS if not os.path.isfile(os.path.join(JSON_DIR, f'{n}.json'))]
if missing:
    print(f'skipped: missing {len(missing)} input(s): {", ".join(missing)}')
    sys.exit(0)


# ── Load + index ─────────────────────────────────────────────────────

items = load('ItemTemplet')
opts = load('ItemOptionTemplet')

opts_by_gid = defaultdict(list)
for o in opts:
    opts_by_gid[o['GroupID']].append(o)


# ── Aggregate base option values per (slot, statKey, rarity, star) ──

bases = defaultdict(set)

for it in items:
    if it.get('ItemType') != 'IT_EQUIP':
        continue
    slot = SLOT_MAP.get(it.get('ItemSubType'))
    rarity = RARITY_MAP.get(it.get('ItemGrade'))
    if not slot or not rarity:
        continue
    star = it.get('BasicStar')
    raw_gid = it.get('MainOptionGroupID')
    if not raw_gid:
        continue
    # Weapon/Gloves/Shoes have a composite "groupA,groupB" main option (2 stats):
    # one fixed (Rate=10000) + one rolled among several (Rate≈3333 each).
    for gid in str(raw_gid).split(','):
        gid = gid.strip()
        if not gid:
            continue
        for o in opts_by_gid.get(gid, []):
            if o.get('OptionType') != 'IOT_STAT':
                continue
            key = STAT_KEY_MAP.get((o.get('StatType'), o.get('ApplyingType')))
            if not key:
                continue
            try:
                val = float(o.get('OptionValue'))
            except (TypeError, ValueError):
                continue
            if key in STORED_TIMES_TEN:
                val = val / 10
            bases[(slot, key, rarity, star)].add(val)


# ── Build output ─────────────────────────────────────────────────────

def fmt(x):
    """Drop trailing zeros, keep up to 4 decimals."""
    if x == int(x):
        return int(x)
    return round(x, 4)


output = {}
for (slot, stat_key, rarity, star), vals in sorted(bases.items()):
    if not vals:
        continue
    # Some rarities have multiple item variants with slightly different bases
    # (e.g. 6★ Unique weapon ATK = 190 or 200). Take the canonical (highest)
    # value, which matches the "stat preview" shown for fully-rolled items.
    base = max(vals)
    ratio = STAT_RATIO_OVERRIDES.get((slot, stat_key), DEFAULT_RATIO)
    max_val = base * ratio
    output.setdefault(slot, {}).setdefault(stat_key, {}).setdefault(rarity, {})[star] = [fmt(base), fmt(max_val)]


os.makedirs(OUT_DIR, exist_ok=True)
with open(OUT_FILE, 'w', encoding='utf-8') as f:
    json.dump(output, f, ensure_ascii=False, indent=2)


# ── Cross-check with statRanges.json (existing manual file) ─────────

mismatches = []
matches = 0
if os.path.isfile(REF_FILE):
    with open(REF_FILE, 'r', encoding='utf-8') as f:
        ref = json.load(f)
    for slot, stats in ref.items():
        if slot in ('talismans', 'ee'):
            continue
        for stat, by_rarity in stats.items():
            if not isinstance(by_rarity, dict):
                continue
            for rarity, by_star in by_rarity.items():
                if not isinstance(by_star, dict):
                    continue
                for star, ref_range in by_star.items():
                    calc = output.get(slot, {}).get(stat, {}).get(rarity, {}).get(star)
                    if calc is None:
                        mismatches.append((slot, stat, rarity, star, ref_range, None, 'missing-in-calc'))
                        continue
                    base_ok = abs(float(calc[0]) - float(ref_range[0])) < 0.05
                    max_ok = abs(float(calc[1]) - float(ref_range[1])) < 0.05
                    if base_ok and max_ok:
                        matches += 1
                    else:
                        mismatches.append((slot, stat, rarity, star, ref_range, calc, 'value-mismatch'))


# ── Summary ──────────────────────────────────────────────────────────

n_combos = sum(len(by_rarity) * len(stats) for slot in output.values() for stat in slot.values() for stats, by_rarity in [(stat, slot)])
total_entries = sum(
    1
    for slot in output.values()
    for stat in slot.values()
    for rarity in stat.values()
    for _ in rarity.values()
)

print(f'Wrote {OUT_FILE}')
print(f'  slots:   {len(output)}')
print(f'  entries: {total_entries}')
if matches or mismatches:
    print(f'  matches vs statRanges.json: {matches}')
    if mismatches:
        print(f'  mismatches: {len(mismatches)}')
        for slot, stat, rar, star, ref_v, calc_v, why in mismatches[:10]:
            print(f'    [{why}] {slot}.{stat}.{rar}.{star}: ref={ref_v} calc={calc_v}')
        if len(mismatches) > 10:
            print(f'    ... and {len(mismatches) - 10} more')
