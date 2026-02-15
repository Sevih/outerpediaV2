"""
Deep analysis of specific diff categories:
1. true_desc: placeholder issues vs text changes
2. dual_buff/dual_debuff: missing fields
3. wgr: missing field
"""

import json
import sys
import io
import re
from pathlib import Path
from config import CHAR_DATA

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

from character_extractor import CharacterExtractor

# Load existing char data for comparison
def load_existing(char_id):
    p = CHAR_DATA / f"{char_id}.json"
    with open(p, "r", encoding="utf-8") as f:
        return json.load(f)

# ============================================================
# 1. TRUE_DESC: Check for placeholder residues like [Value], [Turn], [Rate]
# ============================================================
print("=" * 60)
print("1. TRUE_DESC ANALYSIS: placeholder vs text changes")
print("=" * 60)

PLACEHOLDER_RE = re.compile(r"\[[A-Za-z_]+\]")

char_files = sorted(CHAR_DATA.glob("*.json"))
placeholder_issues = []
text_changes = []

for cf in char_files:
    char_id = cf.stem
    existing = load_existing(char_id)

    try:
        extractor = CharacterExtractor(char_id)
        extracted = extractor.extract()
    except Exception:
        continue

    for skill_key in ["SKT_FIRST", "SKT_SECOND", "SKT_ULTIMATE", "SKT_CHAIN_PASSIVE"]:
        ext_skill = extracted.get("skills", {}).get(skill_key, {})
        exi_skill = existing.get("skills", {}).get(skill_key, {})

        for field in ["true_desc", "true_desc_jp", "true_desc_kr", "true_desc_zh"]:
            ext_val = ext_skill.get(field, "")
            exi_val = exi_skill.get(field, "")

            if ext_val == exi_val:
                continue

            # Check for unresolved placeholders in extracted
            ext_placeholders = PLACEHOLDER_RE.findall(ext_val or "")
            exi_placeholders = PLACEHOLDER_RE.findall(exi_val or "")

            # New placeholders in extracted that weren't in existing
            if ext_placeholders and not exi_placeholders:
                placeholder_issues.append({
                    "char": existing.get("Fullname", char_id),
                    "skill": skill_key,
                    "field": field,
                    "extracted_placeholders": ext_placeholders,
                    "extracted": ext_val[:200] if ext_val else "",
                    "existing": exi_val[:200] if exi_val else "",
                })
            elif ext_placeholders != exi_placeholders:
                placeholder_issues.append({
                    "char": existing.get("Fullname", char_id),
                    "skill": skill_key,
                    "field": field,
                    "ext_ph": ext_placeholders,
                    "exi_ph": exi_placeholders,
                })
            else:
                text_changes.append({
                    "char": existing.get("Fullname", char_id),
                    "skill": skill_key,
                    "field": field,
                })

print(f"\nPlaceholder issues: {len(placeholder_issues)}")
for p in placeholder_issues[:10]:
    print(f"  [{p['char']}] {p['skill']}.{p['field']}")
    if "extracted_placeholders" in p:
        print(f"    Placeholders: {p['extracted_placeholders']}")
        print(f"    Extracted: {p.get('extracted', '')[:120]}")
        print(f"    Existing:  {p.get('existing', '')[:120]}")
    else:
        print(f"    ext: {p['ext_ph']} vs exi: {p['exi_ph']}")

print(f"\nPure text changes (no placeholder diff): {len(text_changes)}")
for t in text_changes[:5]:
    print(f"  [{t['char']}] {t['skill']}.{t['field']}")


# ============================================================
# 2. DUAL_BUFF / DUAL_DEBUFF: missing in v2
# ============================================================
print("\n" + "=" * 60)
print("2. DUAL_BUFF / DUAL_DEBUFF ANALYSIS")
print("=" * 60)

dual_issues = []

for cf in char_files:
    char_id = cf.stem
    existing = load_existing(char_id)

    try:
        extractor = CharacterExtractor(char_id)
        extracted = extractor.extract()
    except Exception:
        continue

    for skill_key in ["SKT_CHAIN_PASSIVE"]:
        ext_skill = extracted.get("skills", {}).get(skill_key, {})
        exi_skill = existing.get("skills", {}).get(skill_key, {})

        for field in ["dual_buff", "dual_debuff"]:
            ext_val = ext_skill.get(field)
            exi_val = exi_skill.get(field)

            if ext_val == exi_val:
                continue

            dual_issues.append({
                "char": existing.get("Fullname", char_id),
                "id": char_id,
                "field": field,
                "extracted": ext_val,
                "existing": exi_val,
            })

print(f"\nDual buff/debuff issues: {len(dual_issues)}")
for d in dual_issues:
    print(f"  [{d['char']}] {d['field']}: extracted={d['extracted']} | existing={d['existing']}")


# ============================================================
# 3. WGR: missing field
# ============================================================
print("\n" + "=" * 60)
print("3. WGR FIELD ANALYSIS")
print("=" * 60)

wgr_issues = []

for cf in char_files:
    char_id = cf.stem
    existing = load_existing(char_id)

    try:
        extractor = CharacterExtractor(char_id)
        extracted = extractor.extract()
    except Exception:
        continue

    for skill_key in ["SKT_FIRST", "SKT_SECOND", "SKT_ULTIMATE"]:
        ext_skill = extracted.get("skills", {}).get(skill_key, {})
        exi_skill = existing.get("skills", {}).get(skill_key, {})

        ext_wgr = ext_skill.get("wgr")
        exi_wgr = exi_skill.get("wgr")

        if ext_wgr == exi_wgr:
            continue

        wgr_issues.append({
            "char": existing.get("Fullname", char_id),
            "id": char_id,
            "skill": skill_key,
            "extracted": ext_wgr,
            "existing": exi_wgr,
        })

print(f"\nWGR issues: {len(wgr_issues)}")
for w in wgr_issues:
    print(f"  [{w['char']}] {w['skill']}: extracted={w['extracted']} | existing={w['existing']}")
