"""
Analyze skill_content diffs in detail from batch_comparison.json
Categorizes into sub-patterns and shows samples for each.
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

        # Sub-categorize
        if "burnEffect: <MISSING in extracted>" in d:
            cat = "burnEffect_missing_in_v2"
        elif "burnEffect: <MISSING in existing>" in d:
            cat = "burnEffect_missing_in_v1"
        elif ".burnEffect." in d and "effect_zh: <MISSING in existing>" in d:
            cat = "burnEffect_zh_new_in_v2"
        elif ".burnEffect." in d and "offensive: <MISSING in existing>" in d:
            cat = "burnEffect_offensive_new_in_v2"
        elif ".burnEffect." in d and "target: <MISSING in existing>" in d:
            cat = "burnEffect_target_new_in_v2"
        elif ".burnEffect." in d and ".effect:" in d:
            cat = "burnEffect_text_diff"
        elif ".burnEffect." in d:
            cat = "burnEffect_other"
        elif "classification: <MISSING in existing>" in d:
            cat = "classification_new"
        elif "range: <MISSING in existing>" in d:
            cat = "range_new"
        elif ".effectsBySource" in d:
            cat = "effectsBySource"
        elif "effect_zh: <MISSING in existing>" in d:
            cat = "skill_zh_new_in_v2"
        elif "effect_zh: <MISSING in extracted>" in d:
            cat = "skill_zh_missing_in_v2"
        elif ".effect:" in d or ".effect_jp:" in d or ".effect_kr:" in d:
            cat = "skill_effect_text_diff"
        elif ".true_desc" in d:
            cat = "skill_true_desc_diff"
        elif ".name" in d:
            cat = "skill_name_diff"
        elif "buffs" in d or "debuffs" in d:
            cat = "skill_buffs_debuffs"
        else:
            cat = "skill_other"

        sub_categories[cat] += 1
        if cat not in samples:
            samples[cat] = []
        if len(samples[cat]) < 5:
            samples[cat].append(f"[{name}] {d[:200]}")

print("=== Skill Content Diff Analysis ===\n")
for cat, count in sub_categories.most_common():
    print(f"\n--- {cat}: {count} occurrences ---")
    for s in samples[cat]:
        print(f"  {s}")
