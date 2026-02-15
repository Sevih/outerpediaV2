"""Compare v2 char JSONs (by ID) with v1 char JSONs (by slug)."""

import json
import sys
import io
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

V1_CHAR = Path("C:/Users/colli/OneDrive/Documents/Projet perso/outerpedia-clean/src/data/char")
V2_CHAR = Path("../../data/char")
V1_SLUG_MAP = Path("C:/Users/colli/OneDrive/Documents/Projet perso/outerpedia-clean/src/data/_SlugToChar.json")

# Build ID -> slug mapping from v1
slug_map = json.load(open(V1_SLUG_MAP, encoding="utf-8"))
id_to_slug = {}
for slug, info in slug_map.items():
    id_to_slug[info["ID"]] = slug

v2_files = sorted(V2_CHAR.glob("*.json"))
print(f"V2 files: {len(v2_files)}")

no_v1 = []
identical = 0
different = 0

for v2_file in v2_files:
    char_id = v2_file.stem
    slug = id_to_slug.get(char_id)

    if not slug:
        no_v1.append(char_id)
        continue

    v1_file = V1_CHAR / f"{slug}.json"
    if not v1_file.exists():
        no_v1.append(f"{char_id} (slug={slug}, file missing)")
        continue

    v2_data = json.load(open(v2_file, encoding="utf-8"))
    v1_data = json.load(open(v1_file, encoding="utf-8"))

    if v2_data == v1_data:
        identical += 1
        continue

    # Find differences
    different += 1
    all_keys = set(list(v2_data.keys()) + list(v1_data.keys()))
    diffs = []
    for k in sorted(all_keys):
        v2_val = v2_data.get(k, "<MISSING>")
        v1_val = v1_data.get(k, "<MISSING>")
        if v2_val != v1_val:
            v2_str = str(v2_val)[:100]
            v1_str = str(v1_val)[:100]
            diffs.append(f"    {k}: v2={v2_str} | v1={v1_str}")

    name = v2_data.get("Fullname", char_id)
    print(f"DIFF: {name} ({char_id} / {slug})")
    for d in diffs:
        print(d)
    print()

print("---")
print(f"Identical: {identical}")
print(f"Different: {different}")
if no_v1:
    print(f"No v1 match: {no_v1}")
