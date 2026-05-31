"""
Generate data/equipment/item-stats-detail.json — a PER-ITEM breakdown of base
main stats + the enhancement / breakthrough formula, for every documented piece
of equipment.

Goal: a single file that explains, for each item, what its base main stat(s) are
and how the displayed value is derived from enhancement level and breakthrough
tier (and Singularity ascension where applicable). It does NOT bake the full
level×tier matrix (that lives in stat-ranges-v2.json) — it stores base + formula,
so the value at any (level, tier) can be recomputed.

Scope (cross-referenced by `id` with data/equipment/):
  - weapons      → weapon.json     (curated named weapons)
  - accessories  → accessory.json  (curated named accessories)
  - talismans    → talisman.json   (OOPARTS — per-stat +0..+10 lookup, no breakthrough)
  - armor        → every armor piece (Helmet/Armor/Gloves/Shoes) belonging to a
                   set listed in sets.json, scoped to epic/legendary 5★/6★
  - ee           → ee.json (Exclusive Equipment — character-bound; conditional %-stat
                   + flat HIT_AP/KILL_AP, both scaling +0..+10; LV10 unique-option upgrade)

Main-stat shape per item: a list of "slots", each either
  { "type": "fixed",  "stat":    { "key", "base" } }              # always granted
  { "type": "choice", "options": [ { "key", "base" }, ... ] }     # player picks one
This mirrors the in-game mechanic (e.g. a weapon grants a fixed ATK plus one
chosen %-stat; an accessory grants one chosen main stat; gloves grant two fixed).

Formula (identical to generate-stat-ranges-v2.py, read from JSON — not hardcoded):
  standard:  value(lv, tier) = floor_display(
                 base × (1 + enhanceFactor × lv) × (1 + tierFactor × tier))
  ascended:  value(lv, tier) = floor_display(
                 base × (1 + enhanceFactor × 10 + activation + Σ steps[: lv-10])
                      × (1 + tierFactor × tier))
  talisman:  value = base  (UpgradeFactorforOP is 0 → no enhance/breakthrough)
  floor_display = floor() for flat stats, floor to 0.1 for percentage stats.
"""

import json
import os
import re
import sys
from collections import defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
JSON_DIR = os.path.join(ROOT, 'data', 'admin', 'json2')
EQUIP_DIR = os.path.join(ROOT, 'data', 'equipment')
OUT_FILE = os.path.join(EQUIP_DIR, 'item-stats-detail.json')

REQUIRED_INPUTS = [
    'ItemTemplet',
    'ItemOptionTemplet',
    'ItemEnchantTemplet',
    'ItemBreakLimitTemplet',
    'SingularityEquipEnchantTemplet',
    'BuffTemplet',
    'ItemSpecialOptionTemplet',
    'TextSkill',
    'TextSystem',
]

# Curated equipment files cross-referenced by id (item-names.json is itself produced
# by the item-names pipeline step).
REQUIRED_EQUIP = ['weapon', 'accessory', 'talisman', 'sets', 'item-names', 'ee']

# ── Display name mappings (unavoidable: JSON enums → display strings) ──

SLOT_MAP = {
    'ITS_EQUIP_WEAPON': 'weapons',
    'ITS_EQUIP_ACCESSORY': 'accessories',
    'ITS_EQUIP_HELMET': 'Helmet',
    'ITS_EQUIP_ARMOR': 'Armor',
    'ITS_EQUIP_GLOVES': 'Gloves',
    'ITS_EQUIP_SHOES': 'Shoes',
}

ARMOR_SLOTS = {'ITS_EQUIP_HELMET', 'ITS_EQUIP_ARMOR', 'ITS_EQUIP_GLOVES', 'ITS_EQUIP_SHOES'}

RARITY_MAP = {
    'IG_NORMAL': 'normal',
    'IG_MAGIC': 'superior',
    'IG_RARE': 'epic',
    'IG_UNIQUE': 'legendary',
}

# (StatType, ApplyingType) → display key. Note EFF/RES appear twice: gear stores
# them as flat OAT_ADD points, talismans as OAT_RATE percentages (see TIMES_TEN).
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
    ('ST_BUFF_CHANCE', 'OAT_RATE'): 'EFF',
    ('ST_BUFF_RESIST', 'OAT_ADD'): 'RES',
    ('ST_BUFF_RESIST', 'OAT_RATE'): 'RES',
    ('ST_PIERCE_POWER_RATE', 'OAT_ADD'): 'PEN%',
    ('ST_DMG_BOOST', 'OAT_ADD'): 'DMG UP%',
    ('ST_DMG_REDUCE_RATE', 'OAT_ADD'): 'DMG RED%',
    ('ST_E_CRI_DMG_REDUCE', 'OAT_ADD'): 'CDMG RED%',
}

# (StatType, ApplyingType) pairs whose raw value is stored ×10 (130 → 13%, 72 → 7.2).
# Decided per pair, not per display key: gear EFF/RES (OAT_ADD) are flat points,
# while talisman EFF/RES (OAT_RATE) are ÷10 percentages.
TIMES_TEN = {
    ('ST_ATK', 'OAT_RATE'),
    ('ST_DEF', 'OAT_RATE'),
    ('ST_HP', 'OAT_RATE'),
    ('ST_CRITICAL_RATE', 'OAT_ADD'),
    ('ST_CRITICAL_DMG_RATE', 'OAT_ADD'),
    ('ST_PIERCE_POWER_RATE', 'OAT_ADD'),
    ('ST_DMG_BOOST', 'OAT_ADD'),
    ('ST_DMG_REDUCE_RATE', 'OAT_ADD'),
    ('ST_E_CRI_DMG_REDUCE', 'OAT_ADD'),
    ('ST_BUFF_CHANCE', 'OAT_RATE'),
    ('ST_BUFF_RESIST', 'OAT_RATE'),
}

# Display keys rendered with one-decimal precision in the scaling formula.
# (EFF/RES are intentionally absent: their *main* values are whole-number percentages
#  — floored to integers in-game — even though they are still % stats. See PERCENT_DISPLAY.)
PERCENT_STATS = {
    'ATK%', 'DEF%', 'HP%', 'CHC', 'CHD', 'PEN%',
    'DMG UP%', 'DMG RED%', 'CDMG RED%',
}

# Every display key that is shown with a "%" sign in-game. Used only to flag stats
# (statMeta) so EFF/RES aren't mistaken for flat values. ATK/DEF/HP/SPD are flat.
PERCENT_DISPLAY = PERCENT_STATS | {'EFF', 'RES'}
FLAT_STATS = {'ATK', 'DEF', 'HP', 'SPD'}

# Site display scope for armor (weapons/accessories/talismans use their curated lists).
INCLUDED_RARITIES = {'epic', 'legendary'}
INCLUDED_STARS = {'5', '6'}


def load(name):
    with open(os.path.join(JSON_DIR, f'{name}.json'), 'r', encoding='utf-8') as f:
        return json.load(f)


def load_equip(name):
    with open(os.path.join(EQUIP_DIR, f'{name}.json'), 'r', encoding='utf-8') as f:
        return json.load(f)


# ── Bail gracefully if datamine missing (prod build, fresh checkout) ──

if not os.path.isdir(JSON_DIR):
    print('skipped: data/admin/json2 not present')
    sys.exit(0)

missing = [n for n in REQUIRED_INPUTS if not os.path.isfile(os.path.join(JSON_DIR, f'{n}.json'))]
if missing:
    print(f'skipped: missing {len(missing)} json2 input(s): {", ".join(missing)}')
    sys.exit(0)

missing_equip = [n for n in REQUIRED_EQUIP if not os.path.isfile(os.path.join(EQUIP_DIR, f'{n}.json'))]
if missing_equip:
    print(f'skipped: missing {len(missing_equip)} equipment input(s): {", ".join(missing_equip)}')
    sys.exit(0)


# ── Load inputs ──

items = load('ItemTemplet')
opts = load('ItemOptionTemplet')
enchants = load('ItemEnchantTemplet')
breaks = load('ItemBreakLimitTemplet')
singularity = load('SingularityEquipEnchantTemplet')
buffs = load('BuffTemplet')
special_opts = load('ItemSpecialOptionTemplet')
text_skill = load('TextSkill')
text_system = load('TextSystem')

special_opt_by_id = {s['ID']: s for s in special_opts}
text_skill_by_id = {t['ID']: t for t in text_skill}
text_system_by_id = {t['ID']: t for t in text_system}
# TextSkill language columns (matches lib.ts LANG_COLUMNS / i18n config order)
GAME_LANGS = {'en': 'English', 'jp': 'Japanese', 'kr': 'Korean', 'zh': 'China_Simplified'}

items_by_id = {it['ID']: it for it in items}
opts_by_gid = defaultdict(list)
for o in opts:
    opts_by_gid[o['GroupID']].append(o)
# Talisman (OOPARTS) main stats scale via BUFF LEVELS, not the enhance factor:
# each stat BuffID has 11 levels (Level 1 = +0 … Level 11 = +10), values are an
# explicit non-uniform lookup table. Keep every level, ordered by enhancement.
buff_levels_by_strid = defaultdict(list)
for b in buffs:
    bid = b.get('BuffID')
    if bid:
        buff_levels_by_strid[bid].append(b)
for bid in buff_levels_by_strid:
    buff_levels_by_strid[bid].sort(key=lambda b: int(b.get('Level', 0)))


# ── Extract formula constants (NO HARDCODING) ──

def assert_uniform(values, label):
    s = set(values)
    if len(s) != 1:
        raise ValueError(f'expected uniform {label}, got {sorted(s)}')
    return s.pop()


def read_enhance_constants(enchants):
    factors, max_level = [], 0
    for e in enchants:
        if e.get('ItemSubType') not in SLOT_MAP:
            continue
        factors.append(float(e['UpgradeFactorforOP']))
        max_level = max(max_level, int(e['EnchantLevel']))
    return assert_uniform(factors, 'UpgradeFactorforOP across standard slots'), max_level


def read_tier_constants(breaks):
    factors, max_tier = [], 0
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
    return assert_uniform(factors, 'BreakLimit Factor1..N'), max_tier


def read_singularity_constants(singularity):
    activations, steps_per_slot, eligible_slots = [], defaultdict(dict), set()
    for s in singularity:
        slot = s.get('ItemSubType')
        if slot not in SLOT_MAP:
            continue
        eligible_slots.add(slot)
        etype = s.get('EnchantType')
        factor = float(s['UpgradeFactorforOP'])
        if etype == 'SET_ENCHANT':
            activations.append(factor)
        elif etype == 'SET_EQUIP_ENHANCE':
            steps_per_slot[slot][int(s['NextEnchantLevel'])] = factor
    activation = assert_uniform(activations, 'Singularity activation factor')
    canonical_steps = None
    for slot, lvl_map in steps_per_slot.items():
        ordered = [lvl_map[i] for i in sorted(lvl_map.keys())]
        if canonical_steps is None:
            canonical_steps = ordered
        elif ordered != canonical_steps:
            raise ValueError(f'Singularity steps differ for {slot}')
    return {
        'activation': activation,
        'steps': canonical_steps,
        'slots': sorted(SLOT_MAP[s] for s in eligible_slots),
    }


def read_talisman_enhance(enchants):
    """OOPARTS enhance factor — expected 0 (flat stat)."""
    factors = [float(e['UpgradeFactorforOP']) for e in enchants
               if e.get('ItemSubType') == 'ITS_EQUIP_OOPARTS']
    return assert_uniform(factors, 'OOPARTS UpgradeFactorforOP') if factors else 0.0


enhance_factor, max_enhance_level = read_enhance_constants(enchants)
tier_factor, max_tier = read_tier_constants(breaks)
sing = read_singularity_constants(singularity)
talisman_factor = read_talisman_enhance(enchants)

SINGULARITY_MIN_RARITY = 'legendary'
SINGULARITY_MIN_STAR = '6'
# Game rule (not in the stat templates): ascension grants +3 reforge attempts.
SINGULARITY_REFORGE_BONUS = 3


# ── Stat extraction helpers ──

def resolve_stat(stat_type, applying_type, raw_value):
    """(StatType, ApplyingType, rawValue) → {key, base, percent} or None if not a known stat.
    `percent` is per occurrence: OAT_RATE pairs (in TIMES_TEN) display with "%", OAT_ADD
    pairs are flat. EFF/RES depend on this — flat on gear (OAT_ADD), % on talisman (OAT_RATE).
    """
    pair = (stat_type, applying_type)
    key = STAT_KEY_MAP.get(pair)
    if not key or raw_value is None:
        return None
    val = float(raw_value)
    if pair in TIMES_TEN:
        val /= 10
    return {'key': key, 'base': val if val != int(val) else int(val), 'percent': pair in TIMES_TEN}


def resolve_substat(o):
    """A sub-option row → {key, step, max, percent} (one reforge segment = `step`).
    `percent` follows the same OAT_RATE vs OAT_ADD rule as resolve_stat."""
    pair = (o.get('StatType'), o.get('ApplyingType'))
    key = STAT_KEY_MAP.get(pair)
    if not key or o.get('OptionValue') is None:
        return None
    is_pct = pair in TIMES_TEN
    div = 10 if is_pct else 1
    step = float(o['OptionValue']) / div
    mx = float(o['OptionMaxValue']) / div if o.get('OptionMaxValue') is not None else step
    fmt = lambda v: v if v != int(v) else int(v)
    return {'key': key, 'step': fmt(step), 'max': fmt(mx), 'percent': is_pct}


def resolve_substat_pool(gid):
    """Resolve a SubOptionGroupID into its substat pool + segment cap.
    `step` is the per-segment value; `max` = step × maxSegmentsPerStat."""
    pool = [s for s in (resolve_substat(o) for o in opts_by_gid.get(gid, [])
                        if o.get('OptionType') == 'IOT_STAT') if s]
    # Some special groups are empty in the datamine (e.g. Etheric "of X" variants
    # whose sub-stat is fixed elsewhere) — keep them so references never dangle.
    segs = {round(p['max'] / p['step']) for p in pool if p['step']}
    return {
        'maxSegmentsPerStat': segs.pop() if len(segs) == 1 else None,
        'pool': pool,
    }


def stats_from_group(gid):
    """All IOT_STAT (key, base) pairs in an ItemOptionTemplet group."""
    out = []
    for o in opts_by_gid.get(gid, []):
        if o.get('OptionType') != 'IOT_STAT':
            continue
        s = resolve_stat(o.get('StatType'), o.get('ApplyingType'), o.get('OptionValue'))
        if s:
            out.append(s)
    return out


def stats_from_buff_group(gid):
    """Talisman main option groups reference stat buffs (IOT_BUFF → BuffTemplet).
    Each option carries its full +0..+10 lookup table (one value per buff level)."""
    out = []
    for o in opts_by_gid.get(gid, []):
        levels = buff_levels_by_strid.get(o.get('BuffID'))
        if not levels:
            continue
        b0 = levels[0]
        s = resolve_stat(b0.get('StatType'), b0.get('ApplyingType'), b0.get('Value'))
        if not s:
            continue
        table = [resolve_stat(b.get('StatType'), b.get('ApplyingType'), b.get('Value'))['base']
                 for b in levels]
        s['levels'] = table
        out.append(s)
    return out


def build_main_stats(item, use_buffs=False):
    """Return the list of main-stat slots (fixed / choice) for an item."""
    raw_gid = item.get('MainOptionGroupID')
    if not raw_gid:
        return []
    extractor = stats_from_buff_group if use_buffs else stats_from_group
    slots = []
    for gid in str(raw_gid).split(','):
        gid = gid.strip()
        if not gid:
            continue
        group_stats = extractor(gid)
        if not group_stats:
            continue
        if len(group_stats) == 1:
            slots.append({'type': 'fixed', 'stat': group_stats[0]})
        else:
            slots.append({'type': 'choice', 'options': group_stats})
    return slots


def fixed_main_keys(main_stats):
    """Stat keys granted by FIXED main slots — always barred from the sub-stat pool
    (a stat can't appear twice on one item). Keys from `choice` slots are excluded
    only when actually selected, so they are not listed here."""
    return sorted({slot['stat']['key'] for slot in main_stats if slot['type'] == 'fixed'})


def can_ascend(slot_display, rarity, star):
    return (rarity == SINGULARITY_MIN_RARITY
            and star == SINGULARITY_MIN_STAR
            and slot_display in sing['slots'])


# ── Unique passive resolution (ported from src/app/api/admin/extractor-v3/equip/lib.ts) ──
# Weapon/accessory passives are a TextSkill template with [Value]/[Rate]/[Turn]
# placeholders, filled from a BuffTemplet entry whose Level == breakthrough tier+1.
# The buff has one Level per breakthrough tier (T0..T4 → Level 1..5), so the passive
# text changes at every breakthrough.

def _is_permille(buff):
    if buff.get('ApplyingType') == 'OAT_RATE':
        return True
    st = buff.get('StatType') or ''
    if '_RATE' in st or '_DMG' in st:
        return True
    t = buff.get('Type') or ''
    return t == 'BT_ADDITIVE_TURN' or '_ENHANCE' in t


def _num(x):
    """Format like JS number output: drop a trailing .0 (15.0 -> '15', 1.5 -> '1.5')."""
    return str(int(x)) if x == int(x) else str(x)


def _fmt_value(buff):
    if not buff:
        return '?'
    try:
        v = int(buff.get('Value') or 0)
    except ValueError:
        v = 0
    return f'{_num(abs(v) / 10)}%' if _is_permille(buff) else str(abs(v))


def _fmt_turn(buff):
    td = (buff or {}).get('TurnDuration') or ''
    return td if td.isdigit() else '?'


def _find_buff(buff_id_str, level, index=0):
    ids = [s.strip() for s in buff_id_str.split(',')]
    target = ids[0] if index == 0 else (ids[index] if index < len(ids) else f'{ids[0]}_{index + 1}')
    for b in buff_levels_by_strid.get(target, []):
        if b.get('Level') == str(level):
            return b
    return None


def _max_buff_level(buff_id_str):
    first = buff_id_str.split(',')[0].strip()
    levels = [int(b.get('Level') or 1) for b in buff_levels_by_strid.get(first, [])]
    return max(levels) if levels else 1


TOKEN_RE = re.compile(r'\[[^\]]+\]')


def _lang_texts(row):
    """A TextSkill/TextSystem/TextItem row → { en, jp, kr, zh } (trimmed, smart quotes normalized)."""
    if not row:
        return None
    return {
        lang: ((row.get(col) or '').strip().replace('‘', "'").replace('’', "'"))
        for lang, col in GAME_LANGS.items()
    }


def _curated_lang(row, base):
    """A curated equipment row (ee.json, talisman.json, …) → { en, jp, kr, zh } for `base`
    using the suffix convention `base` (en) / `base_jp` / `base_kr` / `base_zh`."""
    if not row:
        return None
    return {lang: (row.get(base) if lang == 'en' else row.get(f'{base}_{lang}')) for lang in GAME_LANGS}


def _token_values(buff_id_str, level):
    """Every placeholder token → its formatted value at a given buff level (= breakthrough
    tier + 1). Values are PLAIN (no color tag) — the consumer wraps them when rendering."""
    b = _find_buff(buff_id_str, level, 0)
    b2 = _find_buff(buff_id_str, level, 1)
    b4 = _find_buff(buff_id_str, level, 3)
    b5 = _find_buff(buff_id_str, level, 4)
    rate = f'{_num(int(b["CreateRate"]) / 10)}%' if b and b.get('CreateRate') else '?'
    val, turn = _fmt_value(b), _fmt_turn(b)
    val2, turn2 = _fmt_value(b2), _fmt_turn(b2)
    val4, val5 = _fmt_value(b4), _fmt_value(b5)
    return {
        '[Value]': val, '[+Value]': f'+{val}', '[-Value]': f'-{val}',
        '[Value2]': val2, '[+Value2]': f'+{val2}', '[-Value2]': f'-{val2}',
        '[Value4]': val4, '[Value5]': val5,
        '[Rate]': rate, '[RATE]': rate, '[Rate1]': rate,
        '[Turn]': turn, '[Turn1]': turn, '[+Turn]': turn, '[+Turn1]': turn, '[-Turn]': f'-{turn}',
        '[Turn2]': turn2,
    }


def build_passive(item):
    """Weapon/accessory unique passive as a language-agnostic template:
      { name:{en,jp,kr,zh}, desc:{en,jp,kr,zh}, valuesByTier: [ {token: value}, … ] }
    `desc` keeps each language's native placeholder tokens (they differ across languages),
    `valuesByTier[tier]` maps every token seen in any language to its value at that
    breakthrough tier (index 0 = T0). Resolve = replace each token with its value.
    Returns None when the item has no unique passive."""
    uo = item.get('UniqueOptionID')
    if not uo:
        return None
    opt = special_opt_by_id.get(uo.split(',')[0].strip())
    if not opt:
        return None
    buff_id_str = opt.get('BuffID') or ''
    desc_id = opt.get('DescID') or opt.get('CustomCraftDescID')
    desc = _lang_texts(text_skill_by_id.get(desc_id)) if desc_id else None
    if not desc or not buff_id_str or not any(desc.values()):
        return None

    tokens = set()
    for text in desc.values():
        tokens |= set(TOKEN_RE.findall(text or ''))

    values_by_tier = []
    for lv in range(1, _max_buff_level(buff_id_str) + 1):
        all_vals = _token_values(buff_id_str, lv)
        # Iterate all_vals (fixed insertion order), not `tokens` (a set whose
        # iteration order varies by run) — keeps the emitted key order canonical
        # and deterministic so the committed JSON is diff-free across rebuilds.
        values_by_tier.append({tok: all_vals[tok] for tok in all_vals if tok in tokens})

    return {
        'name': _lang_texts(text_skill_by_id.get(opt.get('NameID'))),
        'desc': desc,
        'valuesByTier': values_by_tier,
    }


# ── EE (Exclusive Equipment) — character-bound, conditional main + flat secondary + LV10 passive ──
# Each EE's `MainOptionGroupID` resolves to ONE ItemOption entry that bundles:
#   • a direct flat stat (StatType + OptionFactor/OptionMaxValue: HIT_AP or KILL_AP), and
#   • a BuffID giving the conditional %-stat (DMG vs X / EFF vs X / etc.) over 11 buff levels.
# Display values for the conditional stat follow the same permille/abs rules as other buffs.

# ItemOption StatType → canonical EE flat-secondary stat key (no % display).
EE_FLAT_STAT_KEY_MAP = {
    'ST_HIT_AP': 'HIT_AP',
    'ST_KILL_AP': 'KILL_AP',
}
# In-game system text IDs for those flat stats' labels (4-language).
EE_FLAT_STAT_LABEL_ID = {
    'ST_HIT_AP': 'SYS_STAT_HIT_AP',
    'ST_KILL_AP': 'SYS_STAT_KILL_AP',
}

# Conditional main stat: keyed by the BuffID PREFIX (not by StatType+ApplyingType).
# Reason: the in-game display flips some pairs vs the raw buff:
#   • BUFF_CHANCE uses ST_BUFF_RESIST (reduces enemy resist) → DISPLAYED as EFF, not RES
#   • DMG/DMG_REDUCE buffs are OAT_RATE permille — not in the standard STAT_KEY_MAP
# The 4 prefixes below match the existing EE_STAT_KEY_MAP in src/lib/data/equipment.ts.
EE_BUFF_PREFIX_KEY = {
    'DMG_REDUCE':         'DMG RED%',
    'DMG':                'DMG UP%',
    'BUFF_CHANCE':        'EFF',
    'BUFF_CRITICAL_RATE': 'CHC',
}


def _ee_conditional_key(buff_id):
    """BuffID like `BID_CEQUIP_MAIN_DMG_REDUCE_FIRE` → 'DMG RED%' (matches the in-game display)."""
    if not buff_id or not buff_id.startswith('BID_CEQUIP_MAIN_'):
        return None
    rest = buff_id[len('BID_CEQUIP_MAIN_'):]
    prefix = rest.rsplit('_', 1)[0]
    return EE_BUFF_PREFIX_KEY.get(prefix)


def _ee_buff_levels(buff_id, max_lv=11):
    """Resolve the 11 enhance-level values from the buff template. Returns a list of
    numerics (float for %, int for flat) — abs() applied because some buffs store a
    negative raw (e.g. BUFF_RESIST reduces enemy resist → my effectiveness goes up)."""
    out = []
    for lv in range(1, max_lv + 1):
        b = _find_buff(buff_id, lv, 0)
        if not b:
            out.append(None)
            continue
        try:
            v = int(b.get('Value') or 0)
        except ValueError:
            v = 0
        v = abs(v)
        if _is_permille(b):
            val = v / 10
            out.append(int(val) if val == int(val) else val)
        else:
            out.append(v)
    return out


def build_ee_main_stats(item, curated_entry):
    """Build the EE mainStats array — two slots, both scaling on enhancement level (+0..+10):
      • [0] conditional %-stat (e.g. "Reduced DMG Taken vs Earth") with curated localized label
        from ee.json (the "vs X" element is character-specific, only resolvable from curated data)
      • [1] flat secondary stat (HIT_AP / KILL_AP) with label from TextSystem (SYS_STAT_*).
    Returns [] if anything is missing — guards prod against partially-extracted EE."""
    group_id = item.get('MainOptionGroupID')
    if not group_id:
        return []
    opt_rows = opts_by_gid.get(group_id) or []
    if not opt_rows:
        return []
    opt = opt_rows[0]
    out = []

    # Conditional %-stat (the wrapping option's BuffID).
    buff_id = opt.get('BuffID')
    if buff_id:
        key = _ee_conditional_key(buff_id)
        levels = _ee_buff_levels(buff_id)
        if key and levels and None not in levels:
            label = _curated_lang(curated_entry, 'mainStat') if curated_entry else None
            out.append({
                'key': key,
                'label': label,
                'percent': True,
                'conditional': True,
                'levels': levels,
            })

    # Flat secondary (option row's own StatType + Factor/MaxValue).
    flat_st = opt.get('StatType')
    flat_key = EE_FLAT_STAT_KEY_MAP.get(flat_st)
    if flat_key:
        try:
            factor = int(opt.get('OptionFactor') or 0)
            max_val = int(opt.get('OptionMaxValue') or 0)
        except ValueError:
            factor, max_val = 0, 0
        # Formula: value(enh) = min(MaxValue, Factor × (enh + 1)). +0 yields Factor, then +1 per enh.
        levels = [min(max_val, factor * (lv + 1)) for lv in range(11)]
        label = _lang_texts(text_system_by_id.get(EE_FLAT_STAT_LABEL_ID.get(flat_st)))
        out.append({
            'key': flat_key,
            'label': label,
            'percent': False,
            'conditional': False,
            'levels': levels,
        })

    return out


def build_talisman_passive(item):
    """Talisman passive — handles the multi-option pattern (`UniqueOptionID = "base[, lv10]"`).
    6★ talismans bundle a base option (Level=1) with a Lv 10 option (Level=10). The Lv 10
    option's `IsAdd` flag tells the renderer whether the second effect is cumulative
    (True → both active at +10) or an upgrade of the same effect (False → replaces value).
    Each option becomes a tier:
      { unlockLevel, isAdd, desc:{en,jp,kr,zh}, values:{token: value} }
    Values are looked up at the option's own `Level` in the buff; falls back to buff Level=1
    if the buff doesn't have that level (some `_lv10` buffs only declare Level=1).
    `name` is shared across tiers (all options of one talisman use the same NameID).
    Returns None when the item has no resolvable description.
    """
    uo = item.get('UniqueOptionID')
    if not uo:
        return None
    tiers = []
    shared_name = None
    for oid in (s.strip() for s in uo.split(',')):
        opt = special_opt_by_id.get(oid)
        if not opt:
            continue
        buff_id_str = opt.get('BuffID') or ''
        desc_id = opt.get('DescID') or opt.get('CustomCraftDescID')
        desc = _lang_texts(text_skill_by_id.get(desc_id)) if desc_id else None
        if not desc or not any(desc.values()):
            continue
        tokens = set()
        for text in desc.values():
            tokens |= set(TOKEN_RE.findall(text or ''))
        try:
            lv = int(opt.get('Level') or 1)
        except ValueError:
            lv = 1
        # Resolve token values from the buff (if any). Talismans/EE with no tokens in the
        # desc don't need a buff — the value is already baked in the text (e.g. Eclipse Lv10
        # "+30% Critical Damage"). Only drop the tier if it has tokens we can't resolve
        # (= the "ghost" Lv 10 case where the datamine has a placeholder option without buff).
        all_vals = {}
        if buff_id_str:
            all_vals = _token_values(buff_id_str, lv)
            if all_vals.get('[Value]') == '?':
                all_vals = _token_values(buff_id_str, 1)
        # Case-insensitive token resolution: some localized strings use lowercase variants
        # of the canonical token (e.g. Korean `UO_OOPARTS_11_DESC` uses `[value]` instead of
        # `[Value]`). Build a case-insensitive index of the canonical values, then preserve
        # the exact case found in each language's text so the renderer's `split/join` matches.
        all_vals_ci = {k.lower(): v for k, v in all_vals.items()}
        resolved = {}
        # sorted() for deterministic key order (`tokens` is a set) → diff-free JSON.
        for tok in sorted(tokens):
            v = all_vals.get(tok) if tok in all_vals else all_vals_ci.get(tok.lower())
            if v is not None and v != '?':
                resolved[tok] = v
        if any(t not in resolved for t in tokens):
            continue
        if shared_name is None:
            shared_name = _lang_texts(text_skill_by_id.get(opt.get('NameID')))
        tiers.append({
            'unlockLevel': lv,
            'isAdd': opt.get('IsAdd') == 'True',
            'desc': desc,
            'values': resolved,
        })
    if not tiers:
        return None
    return {'name': shared_name, 'tiers': tiers}


# ── Build per-item entries ──

def base_entry(item):
    slot = SLOT_MAP.get(item.get('ItemSubType'))
    rarity = RARITY_MAP.get(item.get('ItemGrade'))
    star = item.get('BasicStar')
    return slot, rarity, star


weapons, accessories, talismans, armor, ee_items = {}, {}, {}, {}, {}
skipped = []
referenced_sub_groups = set()


def sub_group_of(item):
    """Record and return an item's SubOptionGroupID (substat pool), if any."""
    sg = item.get('SubOptionGroupID')
    if sg:
        referenced_sub_groups.add(sg)
    return sg

# Weapons (curated) -----------------------------------------------------------
for src in load_equip('weapon'):
    iid = str(src['id'])
    it = items_by_id.get(iid)
    if not it:
        skipped.append(('weapon', iid))
        continue
    slot, rarity, star = base_entry(it)
    main_stats = build_main_stats(it)
    weapons[iid] = {
        'name': src.get('name'),
        'slot': slot,
        'rarity': rarity,
        'star': int(star) if star and star.isdigit() else star,
        'canAscend': can_ascend(slot, rarity, star),
        'mainStats': main_stats,
        'subStatGroupId': sub_group_of(it),
        'excludedSubStats': fixed_main_keys(main_stats),
        'passive': build_passive(it),
    }

# Accessories (curated) -------------------------------------------------------
for src in load_equip('accessory'):
    iid = str(src['id'])
    it = items_by_id.get(iid)
    if not it:
        skipped.append(('accessory', iid))
        continue
    slot, rarity, star = base_entry(it)
    main_stats = build_main_stats(it)
    accessories[iid] = {
        'name': src.get('name'),
        'slot': slot,
        'rarity': rarity,
        'star': int(star) if star and star.isdigit() else star,
        'canAscend': can_ascend(slot, rarity, star),
        'mainStats': main_stats,
        'subStatGroupId': sub_group_of(it),
        'excludedSubStats': fixed_main_keys(main_stats),
        'passive': build_passive(it),
    }

# Talismans (curated — flat, no scaling) --------------------------------------
for src in load_equip('talisman'):
    iid = str(src['id'])
    it = items_by_id.get(iid)
    if not it:
        skipped.append(('talisman', iid))
        continue
    _, rarity, star = base_entry(it)
    talismans[iid] = {
        'name': src.get('name'),
        'slot': 'talisman',
        'subType': src.get('type'),  # CP / AP
        'rarity': rarity,
        'star': int(star) if star and star.isdigit() else star,
        'scalesVia': 'enhanceLevels',  # per-stat +0..+10 lookup; no breakthrough
        'mainStats': build_main_stats(it, use_buffs=True),
        'passive': build_talisman_passive(it),
    }

# EE / Exclusive Equipment (curated — character-bound, +0..+10 enhancement, Lv 10 unlock) -----
# Iterates over the curated ee.json (the authoritative list of which EE the site surfaces).
# Datamine ItemTemplet supplies CharacterLimit + MainOptionGroupID + UniqueOptionID; curated
# ee.json supplies the localized `mainStat` label (the "vs <element>" part is character-specific).
for eid, src in load_equip('ee').items():
    iid = str(eid)
    it = items_by_id.get(iid)
    if not it:
        skipped.append(('ee', iid))
        continue
    _, rarity, star = base_entry(it)
    ee_items[iid] = {
        'name': src.get('name'),
        'slot': 'ee',
        'characterId': it.get('CharacterLimit'),
        'rarity': rarity,
        'star': int(star) if star and star.isdigit() else star,
        'scalesVia': 'enhanceLevels',
        'mainStats': build_ee_main_stats(it, src),
        'passive': build_talisman_passive(it),  # same multi-tier shape; EE always upgrade pattern
    }

# Armor (every piece of a documented set, scoped to epic/legendary 5★/6★) ------
item_names = load_equip('item-names')
sets = load_equip('sets')
set_by_id = {str(s['id']): s for s in sets}
set_name_by_id = {sid: s.get('name') for sid, s in set_by_id.items()}
set_ids = set(set_by_id)
referenced_set_ids = set()

for it in items:
    if it.get('ItemType') != 'IT_EQUIP' or it.get('ItemSubType') not in ARMOR_SLOTS:
        continue
    set_id = it.get('SetOptionID')
    if set_id not in set_ids:
        continue
    slot, rarity, star = base_entry(it)
    if rarity not in INCLUDED_RARITIES or star not in INCLUDED_STARS:
        continue
    referenced_set_ids.add(set_id)
    iid = it['ID']
    main_stats = build_main_stats(it)
    armor[iid] = {
        'name': item_names.get(iid),
        'slot': slot,
        'rarity': rarity,
        'star': int(star),
        'setId': set_id,
        'setName': set_name_by_id.get(set_id),
        'canAscend': can_ascend(slot, rarity, star),
        'mainStats': main_stats,
        'subStatGroupId': sub_group_of(it),
        'excludedSubStats': fixed_main_keys(main_stats),
    }


# ── Resolve the referenced sub-stat pools (deduplicated) ──

sub_stat_pools = {}
for gid in sorted(referenced_sub_groups, key=lambda x: int(x) if str(x).isdigit() else x):
    sub_stat_pools[gid] = resolve_substat_pool(gid)


# ── Set passives (the armor "passive": changes only at breakthrough 4) ──
# Already resolved in data/equipment/sets.json: effect_<pieces>_1 = base (T0..T3),
# effect_<pieces>_4 = breakthrough 4. EN only, mirroring item names elsewhere.

def _set_field(row, base):
    """A localized sets.json field (e.g. 'name', 'effect_2_1') → { en, jp, kr, zh }.
    en is the bare key; other langs use the _<lang> suffix."""
    return {lang: (row.get(base) if lang == 'en' else row.get(f'{base}_{lang}'))
            for lang in GAME_LANGS}


set_effects = {}
for sid in sorted(referenced_set_ids, key=lambda x: int(x) if str(x).isdigit() else x):
    s = set_by_id[sid]
    set_effects[sid] = {
        'name': _set_field(s, 'name'),
        'rarity': s.get('rarity'),
        '2pc': {'base': _set_field(s, 'effect_2_1'), 'bt4': _set_field(s, 'effect_2_4')},
        '4pc': {'base': _set_field(s, 'effect_4_1'), 'bt4': _set_field(s, 'effect_4_4')},
    }


# ── Assemble output ──

output = {
    '$source': ('Generated from data/admin/json2/ + data/equipment/'
                '{weapon,accessory,talisman,sets}.json — do not edit by hand. '
                'Run scripts/generate-item-stats-detail.py to regenerate.'),
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
            'reforgeBonus': SINGULARITY_REFORGE_BONUS,
            'note': ('Singularity Ascension (Monad Gate) extends a +10 / max-reforge gear from '
                     '+10 to +15. Activation does NOT consume an enhance level (stays +10) but '
                     'raises the multiplier from (1 + enhanceFactor×10)=5.00 to +activation=5.15 '
                     '— an immediate +3% main stat — and grants +reforgeBonus reforge attempts. '
                     'The `ascended` formula then covers +10..+15 (5.15 → 5.75, i.e. +15% over '
                     'the standard +10). Eligible: legendary minStar★ in `slots`. Irreversible '
                     '(disables Gear Reset, clears substat locks).'),
        },
        'talisman': {
            'enhanceFactor': talisman_factor,  # 0 in ItemEnchantTemplet — scaling is table-driven
            'hasBreakthrough': False,
            'maxEnhanceLevel': max_enhance_level,
        },
        'reforge': {
            'maxSubStats': 4,
            'note': ('Sub-stats do NOT scale with enhancement or breakthrough — they grow '
                     'through reforging. Reforge adds a sub-stat until 4 are present, then '
                     'upgrades an existing one by one segment (each segment = the pool\'s '
                     '`step`), up to that pool\'s maxSegmentsPerStat. An item can be reforged '
                     'up to its star level (e.g. 6× for a 6★ item).'),
        },
    },
    'formula': {
        'standard': ('value(lv, tier) = floor_display(base × (1 + enhanceFactor × lv) '
                     '× (1 + tierFactor × tier)) ; lv 0..maxEnhanceLevel, tier 0..maxTier'),
        'ascended': ('value(lv, tier) = floor_display(base × (1 + enhanceFactor × maxEnhanceLevel '
                     '+ singularity.activation + sum(singularity.steps[: lv - maxEnhanceLevel])) '
                     '× (1 + tierFactor × tier)) ; lv maxEnhanceLevel..maxEnhanceLevel+len(steps), '
                     'only when canAscend is true'),
        'talisman': ('no breakthrough; each main-stat option carries an explicit "levels" array '
                     'of 11 values (index 0 = +0 … index 10 = +10) — use levels[lv] directly'),
        'ee': ('no breakthrough; each EE mainStats entry has its own "levels" array of 11 values '
               '(index 0 = +0 … index 10 = +10). The conditional %-stat (item 0) is derived from '
               'the BuffID Lv 1..11; the flat secondary (item 1, HIT_AP/KILL_AP) follows '
               'min(MaxValue, Factor × (enh + 1)). Use levels[lv] directly — no formula needed.'),
        'floor_display': 'floor() for flat stats; floor to 0.1 for percentage stats',
        'percentStats': sorted(PERCENT_STATS),
        'subStats': ('reforge-driven, not enhancement-driven. Each item references a '
                     'subStatGroupId → subStatPools[id]: the pool of possible sub-stats with '
                     'their per-segment `step` and `max` value. A sub-stat can never duplicate '
                     'one of the item\'s main stats: exclude every key in the item\'s '
                     '`excludedSubStats` (its fixed main stats) plus the selected option of any '
                     'choice main. See constants.reforge.'),
        'passive': ('weapons/accessories: `passive` = { name{en,jp,kr,zh}, desc{en,jp,kr,zh}, '
                    'valuesByTier:[{token:value}, …] }. `desc` keeps each language\'s native '
                    'placeholder tokens (e.g. [Value], [Rate], [Turn] — they differ across '
                    'languages). To render for (lang, breakthrough tier): take desc[lang] and '
                    'replace every token by valuesByTier[tier][token] (optionally wrapped in '
                    '<color=#28d9ed>…</color>). Index 0 = T0 → the passive changes at every '
                    'breakthrough. talismans: `passive` = { name{…}, tiers:[{unlockLevel,isAdd,'
                    'desc{…},values{token:value}}, …] }. Base tier (unlockLevel=1) is always '
                    'active; additional tiers unlock at their unlockLevel (typically +10). '
                    '`isAdd=true` → tier stacks on top of base (cumulative); `isAdd=false` → '
                    'tier replaces the base description (upgraded value of same effect). '
                    'armor: passive is the SET bonus in sets[setId] (changes only at '
                    'breakthrough 4: base vs bt4). All effect text covers en/jp/kr/zh.'),
    },
    'statMeta': {
        k: {'percent': k in PERCENT_DISPLAY}
        for k in sorted(set(STAT_KEY_MAP.values()))
    },
    'subStatPools': sub_stat_pools,
    'sets': set_effects,
    'items': {
        'weapons': dict(sorted(weapons.items(), key=lambda kv: int(kv[0]))),
        'accessories': dict(sorted(accessories.items(), key=lambda kv: int(kv[0]))),
        'talismans': dict(sorted(talismans.items(), key=lambda kv: int(kv[0]))),
        'armor': dict(sorted(armor.items(), key=lambda kv: int(kv[0]))),
        'ee': dict(sorted(ee_items.items(), key=lambda kv: int(kv[0]))),
    },
}


def dump_compact(obj):
    """Indented JSON, but inline arrays of primitives — diff-friendly, ~5× smaller."""
    text = json.dumps(obj, ensure_ascii=False, indent=2)
    pattern = re.compile(r'\[\s*\n((?:\s*[^\[\]{}\n,]+,?\s*\n)+?)\s*\]')

    def replace(m):
        parts = [s.strip().rstrip(',').strip() for s in m.group(1).split('\n') if s.strip()]
        return '[' + ', '.join(parts) + ']'

    prev = None
    while text != prev:
        prev, text = text, pattern.sub(replace, text)
    return text


with open(OUT_FILE, 'w', encoding='utf-8') as f:
    f.write(dump_compact(output))
    f.write('\n')

print(f'Wrote {OUT_FILE}')
print(f'  constants: enhance={enhance_factor}, tier={tier_factor}, '
      f'talisman={talisman_factor}, sing.activation={sing["activation"]}')
print(f'  items: weapons={len(weapons)}, accessories={len(accessories)}, '
      f'talismans={len(talismans)}, armor={len(armor)}, ee={len(ee_items)}')
print(f'  subStatPools: {len(sub_stat_pools)} -> {sorted(sub_stat_pools)}')
n_passive = sum(1 for d in (*weapons.values(), *accessories.values()) if d.get('passive'))
n_tali_passive = sum(1 for d in talismans.values() if d.get('passive'))
n_tali_tiers = sum(len(d['passive']['tiers']) for d in talismans.values() if d.get('passive'))
n_ee_passive = sum(1 for d in ee_items.values() if d.get('passive'))
n_ee_tiers = sum(len(d['passive']['tiers']) for d in ee_items.values() if d.get('passive'))
n_ee_mainstats = sum(1 for d in ee_items.values() if d.get('mainStats'))
print(f'  passives: {n_passive} (weapons+accessories), '
      f'{n_tali_passive} talismans ({n_tali_tiers} tiers), '
      f'{n_ee_passive} EE ({n_ee_tiers} tiers), sets: {len(set_effects)}')
print(f'  EE main stats resolved: {n_ee_mainstats}/{len(ee_items)}')
if skipped:
    print(f'  skipped (not in ItemTemplet): {len(skipped)} -> {skipped[:10]}')
