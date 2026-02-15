"""
Deep analysis of skill_other diffs (277 occurrences)
"""

import json
import sys
import io
from pathlib import Path
from collections import Counter

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

REPORT = Path(__file__).parent / "export" / "batch_comparison.json"

with open(REPORT, "r", encoding="utf-8") as f:
    data = json.load(f)

chars = data["characters"]["different"]

sub_categories = Counter()
samples = {}

for char in chars:
    name = char["name"]
    for d in char["diffs"]:
        if not d.startswith("skills."):
            continue
        # Skip already-categorized diffs
        if ".burnEffect" in d or ".true_desc" in d or ".name" in d:
            continue

        # Deeper categorization
        if ".dual_buff" in d:
            cat = "dual_buff"
        elif ".dual_debuff" in d:
            cat = "dual_debuff"
        elif ".buff:" in d or ".buff[" in d:
            cat = "buff_array"
        elif ".debuff:" in d or ".debuff[" in d:
            cat = "debuff_array"
        elif ".classification" in d:
            cat = "classification"
        elif ".range" in d:
            cat = "range"
        elif ".offensive" in d:
            cat = "offensive"
        elif ".target" in d:
            cat = "target"
        elif ".effect" in d:
            cat = "effect_text"
        elif ".desc" in d:
            cat = "desc_text"
        elif "effectsBySource" in d:
            cat = "effectsBySource"
        else:
            cat = "truly_other"

        sub_categories[cat] += 1
        if cat not in samples:
            samples[cat] = []
        if len(samples[cat]) < 8:
            samples[cat].append(f"[{name}] {d[:250]}")

print("=== skill_other breakdown ===\n")
total = sum(sub_categories.values())
print(f"Total: {total}\n")
for cat, count in sub_categories.most_common():
    print(f"\n--- {cat}: {count} ---")
    for s in samples[cat]:
        print(f"  {s}")
