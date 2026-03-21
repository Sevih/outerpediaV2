"""
Generate data/generated/skill-buffs.json
Maps character IDs → skills → buff/debuff entries with raw TargetType from BuffTemplet.

Usage: python scripts/generate-skill-buffs.py
"""

import json, os, re, glob, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
JSON_DIR = os.path.join(ROOT, 'data', 'admin', 'json')
CHAR_DIR = os.path.join(ROOT, 'data', 'character')
OUT_DIR = os.path.join(ROOT, 'data', 'generated')
OUT_FILE = os.path.join(OUT_DIR, 'skill-buffs.json')


def load(name):
    with open(os.path.join(JSON_DIR, f'{name}.json'), 'r', encoding='utf-8') as f:
        return json.load(f)['data']


# ── Blacklists & overrides (mirrored from config.ts) ─────────────────

BUFF_ID_BLACKLIST = {
    '2000052_backup_1_1', '2000029_2_2', '2000020_3_2', '2000039_3_2',
    '2000052_1_1', '2000042_u_3_2', '2000037_3_4', '2000060_u_3_1',
    '2000057_2_2', '2000057_2_3', '2000053_2_5', '2000059_1_1',
    '2000059_u_3', '2000059_2_1', '2000059_2_3', '2000059_2_7',
    '2000079_2_2', '2000109_3_3', '2000096_2_4', '2000096_3_2',
    '2000087_3_7', '2000087_3_8', '2000102_2_3', '2000102_2_4',
    '2000095_2_2',
}

BUFF_TYPE_BLACKLIST = {
    'BT_DMG', 'BT_DMG_TO_BOSS', 'BT_DMG_ENEMY_TEAM_DECREASE',
    'BT_RESOURCE_USE_SKILL', 'BT_RESOURCE_CHARGE', 'BT_SKILL_RANGE_ALL',
    'BT_STAT_PREMIUM', 'BT_DMG_OWNER_LOST_HP_RATE', 'BT_SKILL_USING_CONDITION',
    'BT_NONE', 'BT_STAT_OWNER_LOST_HP_RATE', 'BT_DMG_TARGET_DEBUFF',
    'BT_DMG_TARGET_BUFF', 'BT_SWAP_STAT_ATTACK', 'BT_GROUP',
    'BT_LIMIT_DMG_TURN', 'BT_SHARE_DMG', 'BT_DMG_TARGET_LOST_HP_RATE',
    'BT_SECOND_TRIGGER', 'BT_DMG_REDUCE_FINAL', 'BT_DMG_MY_TEAM_DECREASE',
    'BT_RESOURCE_CHARGE_BUFF_CASTER',
}

BUFF_TYPE_RENAME = {
    'BT_STAT|ST_AVOID': 'SYS_BUFF_AVOID_UP',
    'IG_Buff_Stat_Atk_Interruption_D': 'BT_STAT|ST_ATK_IR',
    'IG_Buff_Stat_CriDmgRate_Interruption_D': 'BT_STAT|ST_CRITICAL_DMG_RATE_IR',
}

BUFF_TYPE_FORCE = {
    'BT_WG_REVERSE_HEAL': 'debuff',
    'BT_KILL_UNDER_HP_RATE': 'debuff',
    'BT_SEALED_RESURRECTION': 'debuff',
}

SKILL_BUFF_FORCE = {
    '2000065:SKT_FIRST': {'buff': [('BT_EXTRA_ATTACK_ON_TURN_END', None)]},
    '2000084:SKT_FIRST': {'buff': [('BT_CALL_BACKUP_2', None), ('BT_CALL_BACKUP', None)]},
    '2000072:SKT_ULTIMATE': {'debuff': [('BT_STEAL_BUFF', None)]},
    '2000102:SKT_ULTIMATE': {'buff': [('BT_EXTEND_DEBUFF', None)], 'debuff': [('BT_EXTEND_BUFF', None)]},
    '2000093:SKT_SECOND': {'buff': [('BT_RANDOM_STAT', None)]},
    '2000095:SKT_SECOND': {'buff': [('GRACE_OF_THE_VIRGIN_GODDESS', None), ('BT_COOL3_CHARGE', None), ('BT_ACTION_GAUGE', None)]},
}

SKILL_KEY = {
    'SKT_FIRST': 's1',
    'SKT_SECOND': 's2',
    'SKT_ULTIMATE': 's3',
    'SKT_CHAIN_PASSIVE': 'chain',
}


# ── Helpers ───────────────────────────────────────────────────────────

def collect_buff_ids(skill_level_rows):
    """Collect buff group IDs matching {7-digit charId}_ pattern from skill level rows."""
    ids = set()
    for row in skill_level_rows:
        for val in row.values():
            if not isinstance(val, str):
                continue
            for part in val.split(','):
                t = part.strip()
                if re.match(r'^\d{7}_', t):
                    ids.add(t)
    return list(ids)


def collect_buff_ids_by_pattern(char_id, pattern, buff_data):
    """Collect buff IDs from BuffTemplet by naming convention (e.g. {charId}_chain_*)."""
    prefix = f'{char_id}_{pattern}_'
    ids = set()
    for row in buff_data:
        bid = row.get('BuffID', '')
        if bid.startswith(prefix) and not bid.endswith('_old'):
            ids.add(bid)
    return list(ids)


def extract_buff_debuff_with_target(buff_group_ids, buff_data, buff_by_id):
    """
    Like extractBuffDebuff from config.ts but returns list of {type, debuff, target}.
    """
    results = []
    seen_tags = set()

    # Expand buff group IDs to include siblings with _Interruption IconName
    expanded = set(buff_group_ids)
    for gid in buff_group_ids:
        parts = gid.split('_')
        if len(parts) >= 3 and re.match(r'^\d{7}$', parts[0]):
            prefix = f'{parts[0]}_{parts[1]}_'
            for row in buff_data:
                bid = row.get('BuffID', '')
                if (bid.startswith(prefix) and not bid.endswith('_old')
                        and '_Interruption' in (row.get('IconName', '') or '')):
                    expanded.add(bid)

    for group_id in expanded:
        row = buff_by_id.get(group_id)
        if not row:
            continue

        btype = row.get('Type', '')
        stat_type = row.get('StatType', '')
        bd_type = row.get('BuffDebuffType', '')
        target_type = row.get('TargetType', '')
        icon_name = row.get('IconName', '') or ''

        if not btype or group_id in BUFF_ID_BLACKLIST:
            continue

        # Interruption IconName = custom mechanic
        if '_Interruption' in icon_name:
            icon_tag = BUFF_TYPE_RENAME.get(icon_name, icon_name)
            if bd_type == 'BUFF':
                is_debuff = False
            elif bd_type.startswith('DEBUFF'):
                is_debuff = True
            else:
                is_debuff = icon_tag.endswith('_D')
            if icon_tag not in seen_tags:
                seen_tags.add(icon_tag)
                results.append({'type': icon_tag, 'debuff': is_debuff, 'target': target_type})
            continue

        if (btype in BUFF_TYPE_BLACKLIST
                or btype.startswith('BT_DMG_OWNER_STAT')
                or btype.startswith('BT_DMG_TARGET_STAT')):
            continue

        if btype.startswith('BT_IMMEDIATELY'):
            if btype not in seen_tags:
                seen_tags.add(btype)
                results.append({'type': btype, 'debuff': True, 'target': target_type})
            continue

        if btype in ('BT_HEAL_BASED_TARGET', 'BT_HEAL_BASED_CASTER'):
            if row.get('BuffRemoveType') == 'ON_TURN_END':
                tag = 'BT_CONTINU_HEAL'
                if tag not in seen_tags:
                    seen_tags.add(tag)
                    results.append({'type': tag, 'debuff': False, 'target': target_type})
            continue

        if btype == 'BT_STAT' and (row.get('TurnDuration') == '-1' or row.get('BuffRemoveType') == 'ON_SKILL_FINISH'):
            continue

        if (btype.startswith('BT_RUN_PASSIVE_') or btype.startswith('BT_RUN_ACTIVE_')) and row.get('RemoveEffect'):
            tag = row['RemoveEffect']
            if tag not in seen_tags:
                seen_tags.add(tag)
                results.append({'type': tag, 'debuff': False, 'target': target_type})
            continue

        if btype == 'BT_DMG_REDUCE':
            continue

        if btype in ('BT_REVERSE_HEAL_BASED_TARGET', 'BT_REVERSE_HEAL_BASED_CASTER'):
            if target_type.startswith('ENEMY'):
                if btype not in seen_tags:
                    seen_tags.add(btype)
                    results.append({'type': btype, 'debuff': True, 'target': target_type})
            continue

        # Resolve type tag
        resolved_type = btype
        if btype == 'BT_DOT_POISON' and row.get('RemoveEffect') == 'SYS_BUFF_POISON_2':
            resolved_type = 'BT_DOT_POISON2'

        raw_tag = (f'{resolved_type}|{stat_type}'
                   if resolved_type == 'BT_STAT' and stat_type and stat_type != 'ST_NONE'
                   else resolved_type)
        tag = BUFF_TYPE_RENAME.get(raw_tag, raw_tag)

        forced = BUFF_TYPE_FORCE.get(btype)
        if forced == 'buff' or (not forced and bd_type == 'BUFF'):
            is_debuff = False
        elif forced == 'debuff' or (not forced and bd_type.startswith('DEBUFF')):
            is_debuff = True
        else:
            continue  # NEUTRAL — skip

        if tag not in seen_tags:
            seen_tags.add(tag)
            results.append({'type': tag, 'debuff': is_debuff, 'target': target_type})

    return results


# ── Main ──────────────────────────────────────────────────────────────

def main():
    print('Loading game data...')
    char_templet = load('CharacterTemplet')
    skill_templet = load('CharacterSkillTemplet')
    skill_level_templet = load('CharacterSkillLevelTemplet')
    buff_data = load('BuffTemplet')
    change_templet = load('CharacterChangeTemplet')

    # Build lookups
    skill_by_ns = {}  # NameIDSymbol → skill row
    for row in skill_templet:
        ns = row.get('NameIDSymbol', '')
        if ns:
            skill_by_ns[ns] = row

    # Skill level rows grouped by SkillID
    skill_levels_by_sid = {}
    for row in skill_level_templet:
        sid = row.get('SkillID', '')
        if not sid:
            continue
        try:
            int(row.get('SkillLevel', '1') or '1')
        except ValueError:
            continue
        skill_levels_by_sid.setdefault(sid, []).append(row)

    # Buff lookup: BuffID → first Level=1 row
    buff_by_id = {}
    for row in buff_data:
        bid = row.get('BuffID', '')
        lvl = row.get('Level', '1')
        if bid and lvl == '1' and bid not in buff_by_id:
            buff_by_id[bid] = row

    # Change map: charId → changeId
    change_map = {}
    for row in change_templet:
        cid = row.get('ID', '')
        chid = row.get('ID_fallback1', '')
        if cid and chid:
            change_map[cid] = chid

    # Get existing character IDs
    char_ids = set()
    for f in glob.glob(os.path.join(CHAR_DIR, '*.json')):
        cid = os.path.splitext(os.path.basename(f))[0]
        char_ids.add(cid)

    # Map charId → CharacterTemplet row
    char_rows = {}
    for row in char_templet:
        cid = row.get('ID', '')
        if cid in char_ids:
            char_rows[cid] = row

    print(f'Processing {len(char_rows)} characters...')

    result = {}

    for cid, char_row in sorted(char_rows.items()):
        # Collect skill IDs
        skill_ids = []
        sid_to_slot = {}
        for i in range(1, 24):
            sid = char_row.get(f'Skill_{i}', '')
            if sid and sid != '0':
                skill_ids.append(sid)
                sid_to_slot[sid] = f'Skill_{i}'

        # Change character
        change_id = change_map.get(cid)
        change_char_row = None
        if change_id:
            for row in char_templet:
                if row.get('ModelID') == change_id:
                    change_char_row = row
                    break

        change_skill_ids = []
        if change_char_row:
            for i in range(1, 24):
                sid = change_char_row.get(f'Skill_{i}', '')
                if sid and sid != '0':
                    change_skill_ids.append(sid)

        # Class passive buff IDs by skill slot number
        passive_buffs_by_slot = {}
        passive_sid = char_row.get('Skill_23', '')
        if passive_sid:
            for lv in skill_level_templet:
                if lv.get('SkillID') != passive_sid:
                    continue
                for val in lv.values():
                    if not isinstance(val, str):
                        continue
                    for part in val.split(','):
                        t = part.strip()
                        m = re.match(rf'^{cid}_(\d+)_', t)
                        if m:
                            slot_num = m.group(1)
                            passive_buffs_by_slot.setdefault(slot_num, []).append(t)

        char_entry = {}

        for sid in skill_ids:
            skill_row = skill_by_ns.get(sid)
            if not skill_row:
                continue

            skill_type = skill_row.get('SkillType', '')
            skey = SKILL_KEY.get(skill_type)
            if not skey:
                continue

            is_chain = skill_type == 'SKT_CHAIN_PASSIVE'

            if is_chain:
                # Chain passive: buffs from {charId}_chain_* pattern
                group_ids = collect_buff_ids_by_pattern(cid, 'chain', buff_data)
            else:
                # Normal skill: buffs from skill level rows + class passive
                levels = skill_levels_by_sid.get(sid, [])
                group_ids = collect_buff_ids(levels)
                slot_str = sid_to_slot.get(sid, '').replace('Skill_', '')
                extra_ids = passive_buffs_by_slot.get(slot_str, [])
                group_ids = list(set(group_ids + extra_ids))

            effects = extract_buff_debuff_with_target(group_ids, buff_data, buff_by_id)

            # Merge change character's buffs
            if change_char_row:
                if is_chain:
                    change_ids = collect_buff_ids_by_pattern(change_id, 'chain', buff_data)
                else:
                    # Find matching skill type in change character
                    change_levels = []
                    for csid in change_skill_ids:
                        cs_row = skill_by_ns.get(csid)
                        if cs_row and cs_row.get('SkillType') == skill_type:
                            change_levels = skill_levels_by_sid.get(csid, [])
                            break
                    change_ids = collect_buff_ids(change_levels)

                change_effects = extract_buff_debuff_with_target(change_ids, buff_data, buff_by_id)
                existing_types = {e['type'] for e in effects}
                for ce in change_effects:
                    if ce['type'] not in existing_types:
                        effects.append(ce)
                        existing_types.add(ce['type'])

            # Burst skills: merge only into the parent skill (RequireAP=int,int,int)
            rap = skill_row.get('RequireAP', '')
            is_burst_parent = bool(re.match(r'^\d+,\d+,\d+$', rap))
            if is_burst_parent:
                burst_types = ['SKT_BURST_1', 'SKT_BURST_2', 'SKT_BURST_3']
                for bsid in skill_ids:
                    bs_row = skill_by_ns.get(bsid)
                    if not bs_row or bs_row.get('SkillType') not in burst_types:
                        continue
                    b_levels = skill_levels_by_sid.get(bsid, [])
                    if b_levels:
                        b_effects = extract_buff_debuff_with_target(
                            collect_buff_ids(b_levels), buff_data, buff_by_id)
                        existing_types = {e['type'] for e in effects}
                        for be in b_effects:
                            if be['type'] not in existing_types:
                                effects.append(be)
                                existing_types.add(be['type'])

            # Force overrides
            force_key = f'{cid}:{skill_type}'
            if force_key in SKILL_BUFF_FORCE:
                forced = SKILL_BUFF_FORCE[force_key]
                existing_types = {e['type'] for e in effects}
                for btype, target in forced.get('buff', []):
                    if btype not in existing_types:
                        effects.append({'type': btype, 'debuff': False, 'target': target})
                        existing_types.add(btype)
                for btype, target in forced.get('debuff', []):
                    if btype not in existing_types:
                        effects.append({'type': btype, 'debuff': True, 'target': target})
                        existing_types.add(btype)

            if effects:
                char_entry[skey] = effects

            # Chain passive dual attack (backup)
            if is_chain:
                dual_ids = collect_buff_ids_by_pattern(cid, 'backup', buff_data)
                if change_id:
                    dual_ids += collect_buff_ids_by_pattern(change_id, 'backup', buff_data)
                dual_effects = extract_buff_debuff_with_target(dual_ids, buff_data, buff_by_id)

                # Force overrides for dual
                if force_key in SKILL_BUFF_FORCE:
                    forced = SKILL_BUFF_FORCE[force_key]
                    existing_types = {e['type'] for e in dual_effects}
                    for btype, target in forced.get('dual_buff', []):
                        if btype not in existing_types:
                            dual_effects.append({'type': btype, 'debuff': False, 'target': target})
                            existing_types.add(btype)
                    for btype, target in forced.get('dual_debuff', []):
                        if btype not in existing_types:
                            dual_effects.append({'type': btype, 'debuff': True, 'target': target})
                            existing_types.add(btype)

                if dual_effects:
                    char_entry['chain_dual'] = dual_effects

        # HEAVY_STRIKE detection
        has_heavy_strike = any(
            r.get('BuffID', '').startswith(f'{cid}_passive')
            and r.get('StatType') == 'ST_CRITICAL_RATE'
            and r.get('Value') == '-1000'
            and r.get('ApplyingType') == 'OAT_RATE'
            for r in buff_data
        )
        if has_heavy_strike:
            for skey, effects in char_entry.items():
                # Add HEAVY_STRIKE to offensive skills
                existing_types = {e['type'] for e in effects}
                if 'HEAVY_STRIKE' not in existing_types:
                    # Check if any effect targets enemies (offensive skill)
                    has_enemy = any(e['target'] and e['target'].startswith('ENEMY') for e in effects if e.get('target'))
                    if has_enemy or skey == 'chain':
                        effects.insert(0, {'type': 'HEAVY_STRIKE', 'debuff': False, 'target': 'ME'})

        if char_entry:
            result[cid] = char_entry

    # Write output
    os.makedirs(OUT_DIR, exist_ok=True)
    with open(OUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(result, f, indent=2, ensure_ascii=False)
        f.write('\n')

    print(f'Done! {len(result)} characters -> {OUT_FILE}')


if __name__ == '__main__':
    main()
