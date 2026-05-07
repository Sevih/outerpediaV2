"""
Generate data/generated/singularity-ascension.json

Aggregates Singularity Ascension data (gear cap +10 -> +15) from json2 sources:
  - SingularityEquipEnchantTemplet.json : per-step costs / success rates / materials
  - ItemSpecialOptionTemplet.json       : bonus options unlocked at +15 (groups 30000 / 31000)
  - TextSkill.json                      : option NameID/DescID translations + grades
  - TextItem.json                       : material name translations
  - ItemTemplet.json                    : material grade lookup
  - TextSystem.json                     : Singularity Ascension UI strings

Output structure (root keys):
  - materials : { itemID -> { name: LangMap, grade } }
  - ui        : { sysKey -> LangMap }   subset of SYS_SINGULAR_ENHANCE_*
  - ascension : { ITS_EQUIP_* -> { init, steps, reroll, optionGroupID } }
  - options   : { groupID -> { slots, totalRate, effects: [ { nameID, name, totalRate, tiers: [...] } ] } }

Usage: python scripts/generate-singularity-ascension.py
"""

import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
JSON_DIR = os.path.join(ROOT, 'data', 'admin', 'json2')
OUT_DIR = os.path.join(ROOT, 'data', 'generated')
OUT_FILE = os.path.join(OUT_DIR, 'singularity-ascension.json')

REQUIRED_INPUTS = [
    'SingularityEquipEnchantTemplet',
    'ItemSpecialOptionTemplet',
    'TextSkill',
    'TextItem',
    'TextSystem',
    'ItemTemplet',
]

LANG_FIELDS = [
    ('en', 'English'),
    ('jp', 'Japanese'),
    ('kr', 'Korean'),
    ('zh', 'China_Simplified'),
]

# Hex colors -> grade letter (from ItemSpecialOptionTemplet desc strings)
GRADE_BY_HEX = {
    '#27D054': 'C',
    '#0EA8F5': 'B',
    '#F5340E': 'A',
    '#b266ff': 'S',
    '#ff00ff': 'S+',
}

EQUIP_SLOTS = [
    'ITS_EQUIP_WEAPON', 'ITS_EQUIP_ACCESSORY',
    'ITS_EQUIP_HELMET', 'ITS_EQUIP_ARMOR',
    'ITS_EQUIP_GLOVES', 'ITS_EQUIP_SHOES',
]


def load(name):
    """json2 format: bare list at root."""
    path = os.path.join(JSON_DIR, f'{name}.json')
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)


def lang_map(text_row):
    """Build a LangMap from a TextItem/TextSkill/TextSystem row."""
    return {short: text_row.get(full) or '' for short, full in LANG_FIELDS}


def index_text(rows):
    return {r['ID']: r for r in rows}


# ── Load sources ─────────────────────────────────────────────────────

# Graceful skip if json2 is unavailable (e.g. prod build without datamine)
# or if any required source is missing.
if not os.path.isdir(JSON_DIR):
    print('skipped: data/admin/json2 not present')
    sys.exit(0)

missing = [n for n in REQUIRED_INPUTS if not os.path.isfile(os.path.join(JSON_DIR, f'{n}.json'))]
if missing:
    print(f'skipped: missing {len(missing)} input(s): {", ".join(missing)}')
    sys.exit(0)

asc_rows = load('SingularityEquipEnchantTemplet')
opt_rows = load('ItemSpecialOptionTemplet')
text_skill = index_text(load('TextSkill'))
text_item = index_text(load('TextItem'))
text_system = index_text(load('TextSystem'))
item_rows = load('ItemTemplet')
item_by_id = {r['ID']: r for r in item_rows}


# ── Materials ────────────────────────────────────────────────────────

MATERIAL_IDS = {'21004', '25001', '25002'}


def build_material(item_id):
    item = item_by_id.get(item_id)
    if not item:
        return None
    name_row = text_item.get(item.get('NameID'))
    return {
        'id': item_id,
        'name': lang_map(name_row) if name_row else {},
        'grade': item.get('ItemGrade'),
    }


materials = {mid: build_material(mid) for mid in sorted(MATERIAL_IDS)}


# ── Ascension grid ───────────────────────────────────────────────────

def to_int(s):
    try:
        return int(s)
    except (TypeError, ValueError):
        return 0


def materials_block(row):
    out = []
    for i in (1, 2, 3):
        mid = row.get(f'RequireMaterial{i}')
        cnt = to_int(row.get(f'MaterialCount{i}'))
        if mid and mid != '0' and cnt > 0:
            out.append({'id': mid, 'count': cnt})
    return out


def step_payload(row):
    """Common payload (without slot-specific group)."""
    return {
        'gold': to_int(row['UpgradePrice']),
        'successRate': to_int(row['SuccessRate']) / 1_000_000.0,  # JSON uses ppm-style 1_000_000 = 100%
        'factorOP': float(row['UpgradeFactorforOP']),
        'priceRestoration': float(row['UpgradePriceRestoration']),
        'materials': materials_block(row),
    }


ascension = {}
for slot in EQUIP_SLOTS:
    slot_rows = [r for r in asc_rows if r['ItemSubType'] == slot]
    by_type = {r['EnchantType']: [] for r in slot_rows}
    for r in slot_rows:
        by_type.setdefault(r['EnchantType'], []).append(r)

    init_row = next((r for r in slot_rows if r['EnchantType'] == 'SET_ENCHANT'), None)
    enhance_rows = sorted(
        (r for r in slot_rows if r['EnchantType'] == 'SET_EQUIP_ENHANCE'),
        key=lambda r: int(r['EnchantLevel']),
    )
    reroll_row = next((r for r in slot_rows if r['EnchantType'] == 'SET_EQUIP_REROLL'), None)

    init_block = None
    if init_row:
        init_block = step_payload(init_row)
        init_block['addMaxLevel'] = to_int(init_row['AddMaxLevel'])
        init_block['addReforgeCount'] = to_int(init_row['AddSmeltingCount'])

    # Each enhance row uses local levels 0..5, mapping to game levels +10..+15.
    steps = []
    for r in enhance_rows:
        local_from = to_int(r['EnchantLevel'])
        local_to = to_int(r['NextEnchantLevel'])
        block = step_payload(r)
        block['from'] = 10 + local_from
        block['to'] = 10 + local_to
        # Final step (+14 -> +15) carries the option group that unlocks the bonus stat
        group_id = r.get('AddSpecialOptionGroupID')
        if group_id and group_id != '0':
            block['specialOptionGroupID'] = group_id
        steps.append(block)

    reroll_block = None
    if reroll_row:
        reroll_block = step_payload(reroll_row)
        group_id = reroll_row.get('AddSpecialOptionGroupID')
        if group_id and group_id != '0':
            reroll_block['specialOptionGroupID'] = group_id

    # Resolved option group from the +14->+15 step (single source of truth)
    final_step = next((s for s in steps if 'specialOptionGroupID' in s), None)
    option_group_id = final_step['specialOptionGroupID'] if final_step else None

    ascension[slot] = {
        'optionGroupID': option_group_id,
        'init': init_block,
        'steps': steps,
        'reroll': reroll_block,
    }


# ── Bonus options (groups 30000 / 31000) ─────────────────────────────

# desc parsing: <color=#GRADE_HEX>GRADE</color> ... <color=#0D99DA>VALUE</color>
GRADE_RE = re.compile(r'<color=#([0-9A-Fa-f]{6})>([^<]+)</color>')
# value tag uses #0D99DA but we just take the second color tag
VALUE_RE = re.compile(r'<color=#0D99DA>([^<]+)</color>', re.IGNORECASE)


def parse_grade(desc_en):
    """Extract grade letter from English desc."""
    if not desc_en:
        return None
    m = GRADE_RE.search(desc_en)
    if not m:
        return None
    hex_code = '#' + m.group(1)
    # Try direct match, then normalized lowercase
    return GRADE_BY_HEX.get(hex_code) or GRADE_BY_HEX.get(hex_code.lower()) or GRADE_BY_HEX.get(
        '#' + m.group(1).upper()
    )


def parse_value(desc_en):
    if not desc_en:
        return None
    m = VALUE_RE.search(desc_en)
    return m.group(1) if m else None


def desc_langmap(desc_id):
    row = text_skill.get(desc_id)
    return lang_map(row) if row else {}


def name_langmap(name_id):
    row = text_skill.get(name_id)
    return lang_map(row) if row else {}


# Group rows by (GroupID, NameID), preserving original order
options = {}
for slot, slot_data in ascension.items():
    gid = slot_data.get('optionGroupID')
    if not gid:
        continue
    if gid in options:
        options[gid]['slots'].append(slot)
        continue
    options[gid] = {'slots': [slot], 'totalRate': 0, 'effects': []}

for row in opt_rows:
    gid = row['GroupID']
    if gid not in options:
        continue
    bucket = options[gid]
    name_id = row['NameID']
    desc_id = row['DescID']
    rate = to_int(row.get('Rate'))
    bucket['totalRate'] += rate

    eff = next((e for e in bucket['effects'] if e['nameID'] == name_id), None)
    if eff is None:
        eff = {
            'nameID': name_id,
            'name': name_langmap(name_id),
            'totalRate': 0,
            'tiers': [],
        }
        bucket['effects'].append(eff)
    eff['totalRate'] += rate

    desc = desc_langmap(desc_id)
    desc_en = desc.get('en', '')
    eff['tiers'].append({
        'descID': desc_id,
        'tier': len(eff['tiers']) + 1,
        'grade': parse_grade(desc_en),
        'value': parse_value(desc_en),
        'rate': rate,
        'buffID': row.get('BuffID') or None,
        'desc': desc,
    })


# ── UI strings ───────────────────────────────────────────────────────

UI_KEYS = [
    'SYS_SINGULAR_ENHANCE_TITLE',
    'SYS_SINGULAR_ENHANCE_RESULT',
    'SYS_SINGULAR_ENHANCE_MAIN_OPTION',
    'SYS_SINGULAR_ENHANCE_LEVEL',
    'SYS_SINGULAR_ENHANCE_SMELTING',
    'SYS_SINGULAR_ENHANCE_SPECIAL_OPTION_01',
    'SYS_SINGULAR_ENHANCE_SPECIAL_OPTION_02',
    'SYS_SINGULAR_ENHANCE_SPECIAL_OPTION_03',
    'SYS_SINGULAR_ENHANCE_SPECIAL_OPTION_RERALL',
    'SYS_SINGULAR_ENHANCE_WARNNING',
    'SYS_SINGULAR_ENHANCE_COMPLETE_ADD_NAME',
]

ui = {}
for key in UI_KEYS:
    row = text_system.get(key)
    if row:
        ui[key] = lang_map(row)


# ── Write output ─────────────────────────────────────────────────────

os.makedirs(OUT_DIR, exist_ok=True)
output = {
    'materials': materials,
    'ui': ui,
    'ascension': ascension,
    'options': options,
}

with open(OUT_FILE, 'w', encoding='utf-8') as f:
    json.dump(output, f, ensure_ascii=False, indent=2)

# Brief summary on stdout
n_effects = sum(len(g['effects']) for g in options.values())
n_tiers = sum(len(e['tiers']) for g in options.values() for e in g['effects'])
print(f'Wrote {OUT_FILE}')
print(f'  materials : {len(materials)}')
print(f'  slots     : {len(ascension)}')
print(f'  groups    : {len(options)}  ({n_effects} effects / {n_tiers} tiers)')
print(f'  ui        : {len(ui)}')
