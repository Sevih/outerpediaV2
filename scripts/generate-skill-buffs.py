"""
Generate data/generated/skill-buffs.json

Reads character JSONs (data/character/*.json) and ee.json as source of truth for
buff/debuff lists per skill, then enriches each entry with TargetType from BuffTemplet.

Output format:
{
  "2000001": {
    "s1":         [ { "type": "BT_REMOVE_BUFF", "debuff": true, "target": "ENEMY" } ],
    "s2":         [ ... ],
    "s3":         [ ... ],
    "chain":      [ ... ],
    "chain_dual": [ ... ],
    "ee":         [ ... ]
  }
}

Usage: python scripts/generate-skill-buffs.py
"""

import json
import os
import re
import glob
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
JSON_DIR = os.path.join(ROOT, 'data', 'admin', 'json')
CHAR_DIR = os.path.join(ROOT, 'data', 'character')
EE_PATH = os.path.join(ROOT, 'data', 'equipment', 'ee.json')
OUT_DIR = os.path.join(ROOT, 'data', 'generated')
OUT_FILE = os.path.join(OUT_DIR, 'skill-buffs.json')


def load(name):
    with open(os.path.join(JSON_DIR, f'{name}.json'), 'r', encoding='utf-8') as f:
        return json.load(f)['data']


if not os.path.isdir(JSON_DIR):
    sys.exit(0)  # No admin data (prod), skip silently


# ── Skill key mapping ────────────────────────────────────────────────

SKILL_KEY = {
    'SKT_FIRST': 's1',
    'SKT_SECOND': 's2',
    'SKT_ULTIMATE': 's3',
    'SKT_CHAIN_PASSIVE': 'chain',
}

# EE override renames: the EE extractor renames some types but the BuffTemplet has the original
EE_TYPE_ALIASES = {
    'BT_SHIELD_BASED_CASTER': 'BT_SHIELD_BASED_TARGET',  # 2000047 override
}

# Manual target overrides for forced/invented buff types that don't exist in BuffTemplet
# (tag, is_debuff) → target. Same tag can have different targets depending on context.
FORCED_TARGET = {
    ('HEAVY_STRIKE', False): 'ME',
    ('GRACE_OF_THE_VIRGIN_GODDESS', False): 'ME',
    ('BT_RANDOM_STAT', False): 'MY_TEAM',
    ('BT_EXTEND_DEBUFF', False): 'MY_TEAM',       # buff: reduces debuff duration on allies
    ('BT_EXTEND_DEBUFF', True): 'ENEMY',           # debuff: increases debuff duration on enemy
    ('BT_EXTEND_BUFF', False): 'MY_TEAM',          # buff: increases buff duration on allies
    ('BT_EXTEND_BUFF', True): 'ENEMY',             # debuff: reduces buff duration on enemy
    ('BT_STEAL_BUFF', True): 'ENEMY',
    ('BT_EXTRA_ATTACK_ON_TURN_END', False): 'ME',
    ('BT_WG_REVERSE_HEAL', True): 'ENEMY',
    ('BT_CALL_BACKUP', False): 'ME',
    ('BT_CALL_BACKUP_2', False): 'ME',
    ('BT_AP_CHARGE', False): 'ME',
    ('BT_DOT_POISON2', True): 'ENEMY',
}


# ── Load game data ───────────────────────────────────────────────────

print('Loading game data...')
char_templet = load('CharacterTemplet')
skill_templet = load('CharacterSkillTemplet')
skill_level_templet = load('CharacterSkillLevelTemplet')
buff_data = load('BuffTemplet')
change_templet = load('CharacterChangeTemplet')

# ── Build lookups ────────────────────────────────────────────────────

# Skill templet by NameIDSymbol
skill_by_ns = {}
for row in skill_templet:
    ns = row.get('NameIDSymbol', '')
    if ns:
        skill_by_ns[ns] = row

# Skill level rows grouped by SkillID
skill_levels_by_sid = {}
for row in skill_level_templet:
    sid = row.get('SkillID', '')
    if sid:
        skill_levels_by_sid.setdefault(sid, []).append(row)

# BuffID → first row (Level=1 preferred)
buff_by_id = {}
for row in buff_data:
    bid = row.get('BuffID', '')
    if bid and bid not in buff_by_id:
        buff_by_id[bid] = row

# Change map: charId → changeId
change_map = {}
for row in change_templet:
    cid = row.get('ID', '')
    chid = row.get('ID_fallback1', '')
    if cid and chid:
        change_map[cid] = chid

# CharacterTemplet by ID
char_row_by_id = {row.get('ID', ''): row for row in char_templet}


# ── Helpers ──────────────────────────────────────────────────────────

def collect_buff_ids_from_levels(skill_level_rows):
    """Collect buff IDs matching {7-digit}_ pattern from skill level rows."""
    ids = set()
    for row in skill_level_rows:
        for val in row.values():
            if not isinstance(val, str):
                continue
            for part in val.split(','):
                t = part.strip()
                if re.match(r'^\d{7}_', t):
                    ids.add(t)
    return ids


def collect_buff_ids_by_pattern(char_id, pattern):
    """Collect buff IDs from BuffTemplet by naming convention."""
    prefix = f'{char_id}_{pattern}_'
    return {row.get('BuffID', '') for row in buff_data
            if (row.get('BuffID', '') or '').startswith(prefix)
            and not row.get('BuffID', '').endswith('_old')}


def resolve_tag(row):
    """Resolve a BuffTemplet row to its tag (same logic as extractBuffDebuff)."""
    btype = row.get('Type', '')
    stat = row.get('StatType', '')
    icon = row.get('IconName', '') or ''

    # Interruption icon
    if '_Interruption' in icon:
        rename = {
            'IG_Buff_Stat_Atk_Interruption_D': 'BT_STAT|ST_ATK_IR',
            'IG_Buff_Stat_CriDmgRate_Interruption_D': 'BT_STAT|ST_CRITICAL_DMG_RATE_IR',
        }
        return rename.get(icon, icon)

    # BT_DOT_POISON with Poison02 icon
    if btype == 'BT_DOT_POISON' and row.get('RemoveEffect') == 'SYS_BUFF_POISON_2':
        return 'BT_DOT_POISON2'

    # BT_HEAL_BASED → BT_CONTINU_HEAL
    if btype in ('BT_HEAL_BASED_TARGET', 'BT_HEAL_BASED_CASTER'):
        if row.get('BuffRemoveType') == 'ON_TURN_END':
            return 'BT_CONTINU_HEAL'
        return None

    # BT_RUN_PASSIVE/ACTIVE → RemoveEffect
    if (btype.startswith('BT_RUN_PASSIVE_') or btype.startswith('BT_RUN_ACTIVE_')) and row.get('RemoveEffect'):
        return row['RemoveEffect']

    # BT_STAT|StatType
    if btype == 'BT_STAT' and stat and stat != 'ST_NONE':
        tag = f'{btype}|{stat}'
        if tag == 'BT_STAT|ST_AVOID':
            return 'SYS_BUFF_AVOID_UP'
        return tag

    return btype


def find_target_for_tag(tag, char_id, skill_buff_ids, is_debuff=False, ee=False):
    """Find TargetType from BuffTemplet for a given buff tag within a character's skill buffs."""

    # Manual overrides for forced/invented tags (context-aware)
    forced = FORCED_TARGET.get((tag, is_debuff))
    if forced:
        return forced

    # Tags to search for (include aliases for EE overrides)
    search_tags = {tag}
    alias = EE_TYPE_ALIASES.get(tag)
    if alias:
        search_tags.add(alias)

    # Search in the specific buff IDs for this skill
    for bid in skill_buff_ids:
        row = buff_by_id.get(bid)
        if not row:
            continue
        resolved = resolve_tag(row)
        if resolved in search_tags:
            return row.get('TargetType', '')

    # Fallback: search all character buffs
    prefixes = [f'{char_id}_', f'BID_CEQUIP_{char_id}'] if not ee else [f'BID_CEQUIP_{char_id}']
    for row in buff_data:
        bid = row.get('BuffID', '')
        if not any(bid.startswith(p) for p in prefixes):
            continue
        resolved = resolve_tag(row)
        if resolved in search_tags:
            return row.get('TargetType', '')

    return None


def get_skill_buff_ids(char_id, skill_type, sid, sid_to_slot, change_id, change_skill_ids):
    """Get all BuffIDs relevant to a skill (same logic as character extractor)."""
    is_chain = skill_type == 'SKT_CHAIN_PASSIVE'
    ids = set()

    if is_chain:
        ids = collect_buff_ids_by_pattern(char_id, 'chain')
        if change_id:
            ids |= collect_buff_ids_by_pattern(change_id, 'chain')
    else:
        levels = skill_levels_by_sid.get(sid, [])
        ids = collect_buff_ids_from_levels(levels)

        # Class passive (Skill_23)
        char_row = char_row_by_id.get(char_id)
        if char_row:
            passive_sid = char_row.get('Skill_23', '')
            if passive_sid:
                slot_num = sid_to_slot.get(sid, '').replace('Skill_', '')
                for lv in skill_levels_by_sid.get(passive_sid, []):
                    for val in lv.values():
                        if not isinstance(val, str):
                            continue
                        for part in val.split(','):
                            t = part.strip()
                            m = re.match(rf'^{char_id}_{slot_num}_', t)
                            if m:
                                ids.add(t)

        # Change character
        if change_id and change_skill_ids:
            for csid in change_skill_ids:
                cs = skill_by_ns.get(csid)
                if cs and cs.get('SkillType') == skill_type:
                    change_levels = skill_levels_by_sid.get(csid, [])
                    ids |= collect_buff_ids_from_levels(change_levels)
                    break

        # Burst skills
        srow = skill_by_ns.get(sid)
        if srow:
            rap = srow.get('RequireAP', '')
            if re.match(r'^\d+,\d+,\d+$', rap):
                char_row = char_row_by_id.get(char_id)
                if char_row:
                    all_sids = [char_row.get(f'Skill_{i}', '') for i in range(1, 24)]
                    for bsid in all_sids:
                        bs = skill_by_ns.get(bsid)
                        if bs and bs.get('SkillType', '').startswith('SKT_BURST'):
                            burst_levels = skill_levels_by_sid.get(bsid, [])
                            ids |= collect_buff_ids_from_levels(burst_levels)

    return ids


# ── Main generation ──────────────────────────────────────────────────

# Load existing character JSONs
char_files = sorted(glob.glob(os.path.join(CHAR_DIR, '*.json')))
print(f'Processing {len(char_files)} characters...')

# Load ee.json
ee_data = {}
if os.path.exists(EE_PATH):
    with open(EE_PATH, 'r', encoding='utf-8') as f:
        ee_data = json.load(f)

result = {}

for char_file in char_files:
    cid = os.path.splitext(os.path.basename(char_file))[0]
    with open(char_file, 'r', encoding='utf-8') as f:
        char = json.load(f)

    char_row = char_row_by_id.get(cid)
    if not char_row:
        continue

    # Collect skill IDs and slot mapping
    skill_ids = []
    sid_to_slot = {}
    for i in range(1, 24):
        sid = char_row.get(f'Skill_{i}', '')
        if sid and sid != '0':
            skill_ids.append(sid)
            sid_to_slot[sid] = f'Skill_{i}'

    # Change character
    change_id = change_map.get(cid)
    change_skill_ids = []
    if change_id:
        change_row = None
        for row in char_templet:
            if row.get('ModelID') == change_id:
                change_row = row
                break
        if change_row:
            for i in range(1, 24):
                s = change_row.get(f'Skill_{i}', '')
                if s and s != '0':
                    change_skill_ids.append(s)

    char_entry = {}

    for stype, sdata in char.get('skills', {}).items():
        skey = SKILL_KEY.get(stype)
        if not skey:
            continue

        buffs = sdata.get('buff', [])
        debuffs = sdata.get('debuff', [])
        if not buffs and not debuffs:
            continue

        # Find the NameIDSymbol for this skill type
        sid = None
        for s in skill_ids:
            srow = skill_by_ns.get(s)
            if srow and srow.get('SkillType') == stype:
                sid = s
                break

        # Get all BuffIDs relevant to this skill
        skill_buff_ids = get_skill_buff_ids(cid, stype, sid, sid_to_slot, change_id, change_skill_ids) if sid else set()

        entries = []
        for b in buffs:
            target = find_target_for_tag(b, cid, skill_buff_ids, is_debuff=False)
            entries.append({'type': b, 'debuff': False, 'target': target})
        for d in debuffs:
            target = find_target_for_tag(d, cid, skill_buff_ids, is_debuff=True)
            entries.append({'type': d, 'debuff': True, 'target': target})

        char_entry[skey] = entries

        # Chain dual
        if stype == 'SKT_CHAIN_PASSIVE':
            dual_buffs = sdata.get('dual_buff', [])
            dual_debuffs = sdata.get('dual_debuff', [])
            if dual_buffs or dual_debuffs:
                dual_ids = collect_buff_ids_by_pattern(cid, 'backup')
                if change_id:
                    dual_ids |= collect_buff_ids_by_pattern(change_id, 'backup')
                dual_entries = []
                for b in dual_buffs:
                    target = find_target_for_tag(b, cid, dual_ids, is_debuff=False)
                    dual_entries.append({'type': b, 'debuff': False, 'target': target})
                for d in dual_debuffs:
                    target = find_target_for_tag(d, cid, dual_ids, is_debuff=True)
                    dual_entries.append({'type': d, 'debuff': True, 'target': target})
                if dual_entries:
                    char_entry['chain_dual'] = dual_entries

    # ── EE ──
    ee_entry = ee_data.get(cid)
    if ee_entry:
        ee_buffs = ee_entry.get('buff', [])
        ee_debuffs = ee_entry.get('debuff', [])
        if ee_buffs or ee_debuffs:
            ee_buff_ids = {row.get('BuffID', '') for row in buff_data
                          if (row.get('BuffID', '') or '').startswith(f'BID_CEQUIP_{cid}')}
            ee_entries = []
            for b in ee_buffs:
                target = find_target_for_tag(b, cid, ee_buff_ids, is_debuff=False, ee=True)
                ee_entries.append({'type': b, 'debuff': False, 'target': target})
            for d in ee_debuffs:
                target = find_target_for_tag(d, cid, ee_buff_ids, is_debuff=True, ee=True)
                ee_entries.append({'type': d, 'debuff': True, 'target': target})
            if ee_entries:
                char_entry['ee'] = ee_entries

    if char_entry:
        result[cid] = char_entry

# ── Write ────────────────────────────────────────────────────────────

os.makedirs(OUT_DIR, exist_ok=True)
with open(OUT_FILE, 'w', encoding='utf-8') as f:
    json.dump(result, f, indent=2, ensure_ascii=False)
    f.write('\n')

print(f'Done! {len(result)} characters -> {OUT_FILE}')
