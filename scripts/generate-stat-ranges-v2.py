"""
Generate data/equipment/stat-ranges-v2.json from data/admin/json2/.

All formula constants (enhance factor, tier factor, Singularity activation +
per-step factors) are READ FROM JSON — nothing is hardcoded except the unavoidable
enum-to-display-string mappings (slot, rarity, stat key).

Output structure:
{
  "$source": "...",
  "constants": {
    "enhanceFactor": 0.4,
    "tierFactor": 0.05,
    "maxEnhanceLevel": 10,
    "maxTier": 4,
    "singularity": {
      "activation": 0.15,
      "steps": [0.10, 0.10, 0.10, 0.10, 0.20],
      "minRarity": "legendary",
      "minStar": 6,
      "slots": ["weapons", "accessories", "Helmet", ...]
    }
  },
  "ranges": {
    "weapons": {
      "ATK": {
        "legendary": {
          "6": [
            {
              "base": 200,
              "itemIds": [...],
              "levels": {        // +0 to +10 standard
                "0":  [200, 210, 220, 230, 240],
                ...
                "10": [1000, 1050, 1100, 1150, 1200]
              },
              "ascended": {      // only when Singularity applicable
                "10": [1030, 1081, 1133, 1184, 1236],  // post-activation
                "11": [1050, 1102, 1155, 1207, 1260],
                ...
                "15": [1150, 1207, 1265, 1322, 1380]
              }
            }
          ]
        }
      }
    }
  }
}

Formula (reverse-engineered from JSON + verified against in-game):
  stat(lv, tier, ascended) = floor_display(
    base
    × (1 + enhanceFactor × min(lv, 10)
         + (activation if ascended else 0)
         + sum(steps[: max(0, lv - 10)]))
    × (1 + tierFactor × tier)
  )

  floor_display() = floor() for integer stats, floor to 0.1 for percentage stats.
"""

import json
import math
import os
import re
import sys
from collections import defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
JSON_DIR = os.path.join(ROOT, 'data', 'admin', 'json2')
OUT_FILE = os.path.join(ROOT, 'data', 'equipment', 'stat-ranges-v2.json')
REF_FILE = os.path.join(ROOT, 'data', 'equipment', 'statRanges.json')

REQUIRED_INPUTS = [
    'ItemTemplet',
    'ItemOptionTemplet',
    'ItemEnchantTemplet',
    'ItemBreakLimitTemplet',
    'SingularityEquipEnchantTemplet',
]

# ── Display name mappings (unavoidable: JSON enums → display strings) ──

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

# (StatType, ApplyingType) → display key
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

# Stats whose OptionValue is stored ×10 in JSON (130 → 13%, 80 → 8 CHC, etc.)
STORED_TIMES_TEN = {
    'ATK%', 'DEF%', 'HP%', 'CHC', 'CHD', 'PEN%',
    'DMG UP%', 'DMG RED%', 'CDMG RED%',
}

# Stats displayed as percentage (with one decimal precision)
PERCENT_STATS = STORED_TIMES_TEN  # same set

# Output scope: only the rarities and stars that actually appear in current
# end-game gear (legendary/epic, 5★/6★). Lower tiers are not displayed on the site.
INCLUDED_RARITIES = {'epic', 'legendary'}
INCLUDED_STARS = {'5', '6'}


def load(name):
    with open(os.path.join(JSON_DIR, f'{name}.json'), 'r', encoding='utf-8') as f:
        return json.load(f)


# ── Bail gracefully if datamine missing (prod build, fresh checkout) ──

if not os.path.isdir(JSON_DIR):
    print('skipped: data/admin/json2 not present')
    sys.exit(0)

missing = [n for n in REQUIRED_INPUTS if not os.path.isfile(os.path.join(JSON_DIR, f'{n}.json'))]
if missing:
    print(f'skipped: missing {len(missing)} input(s): {", ".join(missing)}')
    sys.exit(0)


# ── Load inputs ──

items = load('ItemTemplet')
opts = load('ItemOptionTemplet')
enchants = load('ItemEnchantTemplet')
breaks = load('ItemBreakLimitTemplet')
singularity = load('SingularityEquipEnchantTemplet')


# ── Extract constants (NO HARDCODING) ──

def assert_uniform(values, label):
    s = set(values)
    if len(s) != 1:
        raise ValueError(f'expected uniform {label}, got {sorted(s)}')
    return s.pop()


def read_enhance_constants(enchants):
    """Read enhanceFactor + maxEnhanceLevel from ItemEnchantTemplet for standard slots."""
    factors = []
    max_level = 0
    for e in enchants:
        if e.get('ItemSubType') not in SLOT_MAP:
            continue
        factors.append(float(e['UpgradeFactorforOP']))
        max_level = max(max_level, int(e['EnchantLevel']))
    factor = assert_uniform(factors, 'UpgradeFactorforOP across standard slots')
    return factor, max_level


def read_tier_constants(breaks):
    """Read tierFactor + maxTier from ItemBreakLimitTemplet."""
    factors = []
    max_tier = 0
    for b in breaks:
        for k, v in b.items():
            if not k.startswith('Factor'):
                continue
            try:
                tier_idx = int(k[len('Factor'):])
            except ValueError:
                continue
            factors.append(float(v))
            max_tier = max(max_tier, tier_idx)
    factor = assert_uniform(factors, 'BreakLimit Factor1..N')
    return factor, max_tier


def read_singularity_constants(singularity):
    """Read activation + per-step factors + eligible slots from SingularityEquipEnchantTemplet."""
    activations_per_slot = defaultdict(list)
    steps_per_slot = defaultdict(dict)  # slot → {next_lv: factor}
    eligible_slots = set()

    for s in singularity:
        slot = s.get('ItemSubType')
        if slot not in SLOT_MAP:
            continue
        eligible_slots.add(slot)
        etype = s.get('EnchantType')
        factor = float(s['UpgradeFactorforOP'])
        next_lv = int(s['NextEnchantLevel'])

        if etype == 'SET_ENCHANT':
            activations_per_slot[slot].append(factor)
        elif etype == 'SET_EQUIP_ENHANCE':
            steps_per_slot[slot][next_lv] = factor
        # SET_EQUIP_REROLL ignored (Reload Cartridges, not stat-affecting)

    # All slots should share the same activation factor
    all_acts = [f for fs in activations_per_slot.values() for f in fs]
    activation = assert_uniform(all_acts, 'Singularity activation factor')

    # All slots should share the same step pattern
    canonical_steps = None
    for slot, lvl_map in steps_per_slot.items():
        ordered = [lvl_map[i] for i in sorted(lvl_map.keys())]
        if canonical_steps is None:
            canonical_steps = ordered
        elif ordered != canonical_steps:
            raise ValueError(f'Singularity step pattern differs for {slot}: {ordered} vs {canonical_steps}')

    return {
        'activation': activation,
        'steps': canonical_steps,
        'slots': sorted(SLOT_MAP[s] for s in eligible_slots),
    }


enhance_factor, max_enhance_level = read_enhance_constants(enchants)
tier_factor, max_tier = read_tier_constants(breaks)
sing = read_singularity_constants(singularity)

# Singularity in-game restriction: only legendary 6★ items can ascend
# (this is a game rule — not derivable from JSON since the templates don't gate by rarity/star)
SINGULARITY_MIN_RARITY = 'legendary'
SINGULARITY_MIN_STAR = '6'


# ── Aggregate bases per (slot, stat, rarity, star) with item IDs ──

opts_by_gid = defaultdict(list)
for o in opts:
    opts_by_gid[o['GroupID']].append(o)

# (slot, stat, rarity, star) → { base_value: set(itemIds) }
bases_by_key = defaultdict(lambda: defaultdict(set))

for it in items:
    if it.get('ItemType') != 'IT_EQUIP':
        continue
    slot = SLOT_MAP.get(it.get('ItemSubType'))
    rarity = RARITY_MAP.get(it.get('ItemGrade'))
    if not slot or not rarity:
        continue
    if rarity not in INCLUDED_RARITIES:
        continue
    star = it.get('BasicStar')
    if star not in INCLUDED_STARS:
        continue
    raw_gid = it.get('MainOptionGroupID')
    if not raw_gid:
        continue
    item_id = it.get('ID')
    # Composite "groupA,groupB" main option (weapon/gloves/shoes split: fixed + rolled)
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
                val = float(o['OptionValue'])
            except (TypeError, ValueError):
                continue
            if key in STORED_TIMES_TEN:
                val /= 10
            bases_by_key[(slot, key, rarity, star)][val].add(item_id)


# ── Formula application + display rounding ──

def floor_display(value, stat_key):
    """Floor for integer stats, floor to 0.1 for percentage stats."""
    if stat_key in PERCENT_STATS:
        return math.floor(value * 10 + 1e-9) / 10
    return math.floor(value + 1e-9)


def compute_table(base, stat_key, levels_range, ascended=False, ascended_base_offset=0.0):
    """
    Compute a per-tier list for each level in levels_range.

    `ascended=False`: standard enhance, multiplier = 1 + enhanceFactor × lv
    `ascended=True`:  with Singularity, multiplier = 1 + enhanceFactor × 10 + activation + sum(steps[:lv-10])
    Returns { str(lv): [stat_T0, ..., stat_T(maxTier)] }
    """
    table = {}
    for lv in levels_range:
        if not ascended:
            mult = 1 + enhance_factor * lv
        else:
            standard_part = enhance_factor * max_enhance_level
            sing_part = sing['activation'] + sum(sing['steps'][:max(0, lv - max_enhance_level)])
            mult = 1 + standard_part + sing_part
        per_tier = []
        for t in range(max_tier + 1):
            raw = base * mult * (1 + tier_factor * t)
            per_tier.append(floor_display(raw, stat_key))
        table[str(lv)] = per_tier
    return table


# ── Build output ──

ranges = {}
for (slot, stat_key, rarity, star), base_to_items in sorted(bases_by_key.items()):
    bucket = ranges.setdefault(slot, {}).setdefault(stat_key, {}).setdefault(rarity, {})
    entries = []
    can_ascend = (rarity == SINGULARITY_MIN_RARITY
                  and star == SINGULARITY_MIN_STAR
                  and slot in sing['slots'])
    for base in sorted(base_to_items.keys()):
        item_ids = sorted(base_to_items[base], key=lambda x: int(x) if str(x).isdigit() else x)
        entry = {
            'base': base if base != int(base) else int(base),
            'itemIds': item_ids,
            'levels': compute_table(base, stat_key, range(0, max_enhance_level + 1)),
        }
        if can_ascend:
            n_sing_steps = len(sing['steps'])
            entry['ascended'] = compute_table(
                base,
                stat_key,
                range(max_enhance_level, max_enhance_level + n_sing_steps + 1),
                ascended=True,
            )
        entries.append(entry)
    bucket[star] = entries


output = {
    '$source': 'Generated from data/admin/json2/ — do not edit by hand. Run scripts/generate-stat-ranges-v2.py to regenerate.',
    'constants': {
        'enhanceFactor': enhance_factor,
        'tierFactor': tier_factor,
        'maxEnhanceLevel': max_enhance_level,
        'maxTier': max_tier,
        'singularity': {
            'activation': sing['activation'],
            'steps': sing['steps'],
            'minRarity': SINGULARITY_MIN_RARITY,
            'minStar': int(SINGULARITY_MIN_STAR),
            'slots': sing['slots'],
        },
    },
    'ranges': ranges,
}

def dump_compact(obj):
    """Indented JSON, but inline arrays containing only primitives (numbers/strings).
    Keeps the file diff-friendly while staying ~5× smaller than full indent=2."""
    text = json.dumps(obj, ensure_ascii=False, indent=2)
    # Pattern: [<newline><indented items, no nested object/array><newline>  ]
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


# ── Cross-check vs legacy statRanges.json ──

n_entries = sum(
    len(entries)
    for slot in ranges.values()
    for stat in slot.values()
    for rarity in stat.values()
    for entries in rarity.values()
)
print(f'Wrote {OUT_FILE}')
print(f'  constants: enhance={enhance_factor}, tier={tier_factor}, '
      f'sing.activation={sing["activation"]}, sing.steps={sing["steps"]}')
print(f'  entries:   {n_entries} (across {len(ranges)} slots)')

if not os.path.isfile(REF_FILE):
    sys.exit(0)

with open(REF_FILE, 'r', encoding='utf-8') as f:
    legacy = json.load(f)

n_match = 0
n_legacy_only = 0
divergences = []
for slot, stats in legacy.items():
    if slot in ('talismans', 'ee'):
        continue
    for stat_key, by_rarity in stats.items():
        if not isinstance(by_rarity, dict):
            continue
        for rarity, by_star in by_rarity.items():
            if not isinstance(by_star, dict):
                continue
            for star, ref_range in by_star.items():
                ref_base, ref_max = ref_range
                entries = ranges.get(slot, {}).get(stat_key, {}).get(rarity, {}).get(star)
                if not entries:
                    n_legacy_only += 1
                    continue
                # legacy [base, max] should match ONE of the (base, +10T4) pairs
                generated_pairs = [(e['base'], e['levels'][str(max_enhance_level)][max_tier]) for e in entries]
                if any(abs(b - ref_base) < 0.05 and abs(m - ref_max) < 0.05 for b, m in generated_pairs):
                    n_match += 1
                else:
                    divergences.append((slot, stat_key, rarity, star, ref_range, generated_pairs))

print(f'  vs legacy statRanges.json:')
print(f'    matches:     {n_match}')
print(f'    only legacy: {n_legacy_only}')
print(f'    divergent:   {len(divergences)}')
for slot, stat_key, rarity, star, ref, gen in divergences[:15]:
    print(f'      [{slot}/{stat_key}/{rarity}/{star}*] legacy={ref}  generated bases+max={gen}')
if len(divergences) > 15:
    print(f'      ... and {len(divergences) - 15} more')
