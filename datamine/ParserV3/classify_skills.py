"""
Skill Classification Script
Determines for each character skill:
1. Offensive or not (deals damage vs utility/heal/buff)
2. Target count: mono (single), duo (double), or multi (AoE)

Uses cached CharacterTemplet.json and CharacterSkillTemplet.json.
Injects results directly into src/data/char/{slug}.json files.
"""
import json
from pathlib import Path

CACHE_FOLDER = Path(__file__).parent / "cache"
CHAR_DATA_FOLDER = Path(__file__).parent.parent.parent / "src" / "data" / "char"
SRC_DATA_FOLDER = Path(__file__).parent.parent.parent / "src" / "data"

# Skill types we care about
RELEVANT_SKILL_TYPES = {
    'SKT_FIRST', 'SKT_SECOND', 'SKT_ULTIMATE',
    'SKT_BURST_1', 'SKT_BURST_2', 'SKT_BURST_3',
    'SKT_CHAIN_PASSIVE',
}

# TargetTeamType → offensive classification
OFFENSIVE_TARGETS = {'ENEMY', 'ENEMY,ENEMY'}

# RangeType → target classification
RANGE_TO_TARGET = {
    'SINGLE': 'mono',
    'DOUBLE': 'duo',
    'DOUBLE_SPEED': 'duo',
    'ALL': 'multi',
}

# Characters with alternate forms (ID → alt ID)
# Both forms' skills are merged: offensive if either is, both targets kept if different
ALT_FORMS = {
    '2000119': '2000120',  # Demiurge Luna (White Night / Polar Night)
}


def load_cache(filename):
    """Load a cached JSON file"""
    path = CACHE_FOLDER / filename
    if not path.exists():
        raise FileNotFoundError(f"Cache file not found: {path}")
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)


def build_skill_index(skill_data):
    """Build index: NameIDSymbol → skill entry"""
    index = {}
    for skill in skill_data:
        name_id = skill.get('NameIDSymbol')
        if name_id:
            index[name_id] = skill
    return index


def classify_skill(skill):
    """Classify a single skill entry from CharacterSkillTemplet.
    Returns (offensive: bool, target: str|None)
    """
    target_team = skill.get('TargetTeamType', '')
    range_type = skill.get('RangeType', '')

    offensive = target_team in OFFENSIVE_TARGETS
    target = RANGE_TO_TARGET.get(range_type)

    return offensive, target


def merge_classification(cls_a, cls_b):
    """Merge two skill classifications from alt forms.
    Offensive if either is. Keep both targets if different (e.g. ["mono", "multi"]).
    """
    offensive = cls_a['offensive'] or cls_b['offensive']
    t_a = cls_a['target']
    t_b = cls_b['target']
    if t_a == t_b:
        target = t_a
    elif t_a is None:
        target = t_b
    elif t_b is None:
        target = t_a
    else:
        target = [t_a, t_b]
    return {'offensive': offensive, 'target': target}


def get_character_skill_ids(char):
    """Extract all Skill_N values from a CharacterTemplet entry"""
    skill_ids = []
    for key, value in char.items():
        if key.startswith('Skill_') and value and value != '0':
            skill_ids.append(value)
    return skill_ids


def classify_all():
    """Main classification + injection into char JSONs"""
    print("Loading caches...")
    characters = load_cache("CharacterTemplet.json")
    skills_raw = load_cache("CharacterSkillTemplet.json")

    skill_index = build_skill_index(skills_raw)
    print(f"Loaded {len(characters)} characters, {len(skill_index)} skills")

    # Load _SlugToChar.json for slug → ID mapping
    slug_to_char_path = SRC_DATA_FOLDER / "_SlugToChar.json"
    with open(slug_to_char_path, 'r', encoding='utf-8') as f:
        slug_to_char = json.load(f)

    # Build reverse mapping: ID → slug
    id_to_slug = {}
    for slug, info in slug_to_char.items():
        id_to_slug[info['ID']] = slug

    # Load _allCharacters.json as authoritative list
    all_chars_path = SRC_DATA_FOLDER / "_allCharacters.json"
    with open(all_chars_path, 'r', encoding='utf-8') as f:
        all_chars = json.load(f)

    valid_ids = {}
    for c in all_chars:
        valid_ids[c['ID']] = c['Fullname']
    print(f"Valid characters: {len(valid_ids)}")

    # Index CharacterTemplet by ID
    char_by_id = {c['ID']: c for c in characters if c.get('Type') == 'CT_PC'}

    stats = {'injected': 0, 'skills': 0, 'skipped': 0}

    for char_id, char_name in valid_ids.items():
        char = char_by_id.get(char_id)
        if not char:
            continue

        slug = id_to_slug.get(char_id)
        if not slug:
            print(f"  Warning: no slug for {char_name} ({char_id})")
            continue

        char_json_path = CHAR_DATA_FOLDER / f"{slug}.json"
        if not char_json_path.exists():
            print(f"  Warning: {char_json_path.name} not found")
            continue

        # Build classification from datamine
        skill_ids = get_character_skill_ids(char)
        char_skills = {}
        for sid in skill_ids:
            skill = skill_index.get(sid)
            if skill:
                skill_type = skill.get('SkillType', '')
                if skill_type in RELEVANT_SKILL_TYPES:
                    char_skills[skill_type] = skill

        if not char_skills:
            continue

        classification = {}

        # Main skills + bursts
        for skill_type in ['SKT_FIRST', 'SKT_SECOND', 'SKT_ULTIMATE',
                           'SKT_BURST_1', 'SKT_BURST_2', 'SKT_BURST_3']:
            if skill_type in char_skills:
                offensive, target = classify_skill(char_skills[skill_type])
                classification[skill_type] = {'offensive': offensive, 'target': target}

        # Chain passive: hardcode
        if 'SKT_CHAIN_PASSIVE' in char_skills:
            classification['SKT_CHAIN_PASSIVE'] = {'offensive': True, 'target': 'multi'}
            classification['DUAL_ATTACK'] = {'offensive': True, 'target': 'mono'}

        # Merge alt form if applicable
        alt_id = ALT_FORMS.get(char_id)
        if alt_id:
            alt_char = char_by_id.get(alt_id)
            if alt_char:
                alt_skill_ids = get_character_skill_ids(alt_char)
                alt_char_skills = {}
                for sid in alt_skill_ids:
                    skill = skill_index.get(sid)
                    if skill:
                        skill_type = skill.get('SkillType', '')
                        if skill_type in RELEVANT_SKILL_TYPES:
                            alt_char_skills[skill_type] = skill

                for skill_type in ['SKT_FIRST', 'SKT_SECOND', 'SKT_ULTIMATE',
                                   'SKT_BURST_1', 'SKT_BURST_2', 'SKT_BURST_3']:
                    if skill_type in alt_char_skills:
                        alt_off, alt_tgt = classify_skill(alt_char_skills[skill_type])
                        alt_cls = {'offensive': alt_off, 'target': alt_tgt}
                        if skill_type in classification:
                            classification[skill_type] = merge_classification(
                                classification[skill_type], alt_cls)
                        else:
                            classification[skill_type] = alt_cls

                print(f"  Merged alt form {alt_id} into {char_name}")

        # Inject into char JSON
        with open(char_json_path, 'r', encoding='utf-8') as f:
            char_data = json.load(f)

        skills = char_data.get('skills', {})
        modified = False

        for skill_key, cls in classification.items():
            if skill_key == 'DUAL_ATTACK':
                # Dual goes into chain passive as dual_offensive / dual_target
                if 'SKT_CHAIN_PASSIVE' in skills:
                    skills['SKT_CHAIN_PASSIVE']['dual_offensive'] = cls['offensive']
                    skills['SKT_CHAIN_PASSIVE']['dual_target'] = cls['target']
                    modified = True
                    stats['skills'] += 1
            elif skill_key in skills:
                skills[skill_key]['offensive'] = cls['offensive']
                skills[skill_key]['target'] = cls['target']
                modified = True
                stats['skills'] += 1
            elif skill_key.startswith('SKT_BURST_'):
                # Bursts are inside burnEffect of the base skill
                for base_skill in skills.values():
                    burn = base_skill.get('burnEffect', {})
                    if skill_key in burn:
                        burn[skill_key]['offensive'] = cls['offensive']
                        burn[skill_key]['target'] = cls['target']
                        modified = True
                        stats['skills'] += 1
                        break

        if modified:
            with open(char_json_path, 'w', encoding='utf-8') as f:
                json.dump(char_data, f, ensure_ascii=False, indent=2)
            stats['injected'] += 1
        else:
            stats['skipped'] += 1

    print(f"\nDone!")
    print(f"  Characters injected: {stats['injected']}")
    print(f"  Skills classified: {stats['skills']}")
    print(f"  Skipped (no skills): {stats['skipped']}")


if __name__ == "__main__":
    classify_all()
