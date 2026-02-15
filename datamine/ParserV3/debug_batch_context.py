"""
Debug in batch context: run ALL chars sequentially (like batch does)
and check specific chars for dual_buff and wgr issues.
"""

import json
import sys
import io
from config import CHAR_DATA
from character_extractor import CharacterExtractor

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

TARGET_IDS = {"2000107", "2000069", "2000111", "2000003", "2000037"}

char_files = sorted(CHAR_DATA.glob("*.json"))
print(f"Running ALL {len(char_files)} characters sequentially...\n")

for cf in char_files:
    char_id = cf.stem

    with open(cf, "r", encoding="utf-8") as f:
        existing = json.load(f)

    try:
        extractor = CharacterExtractor(char_id)
        extracted = extractor.extract()
    except Exception as e:
        if char_id in TARGET_IDS:
            print(f"  FAILED {char_id}: {e}")
        continue

    if char_id in TARGET_IDS:
        name = existing.get("Fullname", char_id)
        chain_ext = extracted.get("skills", {}).get("SKT_CHAIN_PASSIVE", {})
        chain_exi = existing.get("skills", {}).get("SKT_CHAIN_PASSIVE", {})
        s2_ext = extracted.get("skills", {}).get("SKT_SECOND", {})
        s2_exi = existing.get("skills", {}).get("SKT_SECOND", {})

        print(f"=== {name} ({char_id}) ===")

        if char_id in {"2000107", "2000003", "2000037"}:
            print(f"  dual_buff  ext={chain_ext.get('dual_buff')} | exi={chain_exi.get('dual_buff')}")
            print(f"  dual_debuff ext={chain_ext.get('dual_debuff')} | exi={chain_exi.get('dual_debuff')}")

        if char_id in {"2000069", "2000111"}:
            print(f"  S2 wgr  ext={s2_ext.get('wgr')} | exi={s2_exi.get('wgr')}")
            print(f"  S2 name: {s2_ext.get('name')}")
            print(f"  S2 cd  ext={s2_ext.get('cd')} | exi={s2_exi.get('cd')}")

        print()
