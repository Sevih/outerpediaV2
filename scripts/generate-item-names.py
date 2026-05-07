"""
Generate data/equipment/item-names.json from data/admin/json2/.

Maps every equipment itemID to its English display name. Used to give human
context to the `itemIds` arrays in stat-ranges-v2.json (and any other place
that references raw item IDs).

Output: { "<itemId>": "<English name>" } sorted by numeric ID.

Scope: all `IT_EQUIP` items (every rarity, every star). The file stays small
(~50 KB) so we keep it generic and reusable instead of mirroring the narrower
stat-ranges-v2 scope.
"""

import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
JSON_DIR = os.path.join(ROOT, 'data', 'admin', 'json2')
OUT_FILE = os.path.join(ROOT, 'data', 'equipment', 'item-names.json')

REQUIRED_INPUTS = ['ItemTemplet', 'TextItem']


def load(name):
    with open(os.path.join(JSON_DIR, f'{name}.json'), 'r', encoding='utf-8') as f:
        return json.load(f)


if not os.path.isdir(JSON_DIR):
    print('skipped: data/admin/json2 not present')
    sys.exit(0)

missing = [n for n in REQUIRED_INPUTS if not os.path.isfile(os.path.join(JSON_DIR, f'{n}.json'))]
if missing:
    print(f'skipped: missing {len(missing)} input(s): {", ".join(missing)}')
    sys.exit(0)


items = load('ItemTemplet')
texts = load('TextItem')

# Index TextItem by ID (= NameID) → English string
text_by_id = {t['ID']: t.get('English', '') for t in texts if t.get('ID')}


def sort_key(pair):
    item_id = pair[0]
    try:
        return (0, int(item_id))
    except ValueError:
        return (1, item_id)


name_by_item_id = {}
n_no_name = 0
for it in items:
    if it.get('ItemType') != 'IT_EQUIP':
        continue
    item_id = it.get('ID')
    name_id = it.get('NameID')
    if not item_id or not name_id:
        continue
    name = text_by_id.get(name_id, '').strip()
    if not name:
        n_no_name += 1
        continue
    name_by_item_id[item_id] = name


sorted_pairs = sorted(name_by_item_id.items(), key=sort_key)
output = dict(sorted_pairs)


os.makedirs(os.path.dirname(OUT_FILE), exist_ok=True)
with open(OUT_FILE, 'w', encoding='utf-8') as f:
    json.dump(output, f, ensure_ascii=False, indent=2)
    f.write('\n')

print(f'Wrote {OUT_FILE}')
print(f'  items:         {len(name_by_item_id)}')
if n_no_name:
    print(f'  no English name: {n_no_name} (skipped)')
