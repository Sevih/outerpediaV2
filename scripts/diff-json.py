"""
Compare a JSON file's working copy against its last git-committed version.
Reports: missing keys, extra keys, and value differences.
Ignores key order in objects AND item order in arrays.

Usage:
  python scripts/diff-json.py <file_path>
  python scripts/diff-json.py data/character/2000001.json
  python scripts/diff-json.py data/character/  # all JSON files in dir
  python scripts/diff-json.py data/character/ 10-20  # IDs 2000010 to 2000020
  python scripts/diff-json.py data/character/ 42     # single ID 2000042
"""
import re

import json
import subprocess
import sys
import os
from pathlib import Path

# Force UTF-8 output on Windows
sys.stdout.reconfigure(encoding="utf-8")


def get_git_version(filepath):
    """Get the last committed version of a file from git."""
    result = subprocess.run(
        ["git", "show", f"HEAD:{filepath}"],
        capture_output=True, text=True, encoding="utf-8"
    )
    if result.returncode != 0:
        return None
    return json.loads(result.stdout)


def sort_array(arr):
    """Sort an array for order-independent comparison. Handles mixed types."""
    try:
        return sorted(arr, key=lambda x: json.dumps(x, sort_keys=True, ensure_ascii=False))
    except TypeError:
        return arr


def deep_diff(old, new, path=""):
    """Recursively compare two JSON values. Returns (missing, added, changed) lists."""
    missing = []
    added = []
    changed = []

    if type(old) != type(new):
        changed.append((path, old, new))
        return missing, added, changed

    if isinstance(old, dict):
        old_keys = set(old.keys())
        new_keys = set(new.keys())
        for k in sorted(old_keys - new_keys):
            p = f"{path}.{k}" if path else k
            missing.append((p, old[k]))
        for k in sorted(new_keys - old_keys):
            p = f"{path}.{k}" if path else k
            added.append((p, new[k]))
        for k in sorted(old_keys & new_keys):
            p = f"{path}.{k}" if path else k
            m, a, c = deep_diff(old[k], new[k], p)
            missing.extend(m)
            added.extend(a)
            changed.extend(c)
    elif isinstance(old, list):
        # Compare as sets (order-independent)
        old_sorted = sort_array(old)
        new_sorted = sort_array(new)
        if old_sorted != new_sorted:
            old_strs = [json.dumps(x, sort_keys=True, ensure_ascii=False) for x in old]
            new_strs = [json.dumps(x, sort_keys=True, ensure_ascii=False) for x in new]
            old_only = [s for s in old_strs if s not in set(new_strs)]
            new_only = [s for s in new_strs if s not in set(old_strs)]
            # Pair up as CHANGED when both sides have diffs
            pairs = min(len(old_only), len(new_only))
            for i in range(pairs):
                changed.append((f"{path}[]", json.loads(old_only[i]), json.loads(new_only[i])))
            for i in range(pairs, len(old_only)):
                missing.append((f"{path}[]", json.loads(old_only[i])))
            for i in range(pairs, len(new_only)):
                added.append((f"{path}[]", json.loads(new_only[i])))
    else:
        if old != new:
            changed.append((path, old, new))

    return missing, added, changed


def compare(filepath):
    """Compare working copy vs git HEAD for a single file."""
    git_data = get_git_version(filepath)
    if git_data is None:
        print(f"  ! Not in git or no committed version: {filepath}")
        return None

    with open(filepath, "r", encoding="utf-8") as f:
        work_data = json.load(f)

    missing, added, changed = deep_diff(git_data, work_data)

    # Detect known patterns and simplify
    notes = []
    # empty tags removed
    empty_tags = [m for m in missing if m[0] == "tags" and m[1] == []]
    if empty_tags:
        missing = [m for m in missing if m not in empty_tags]
        notes.append("empty tags removed")

    # wgr/cd: added but null = formatting
    null_formatting = [a for a in added if a[0].endswith((".wgr", ".cd")) and a[1] is None]
    if null_formatting:
        added = [a for a in added if a not in null_formatting]
        keys = sorted(set(a[0].rsplit(".", 1)[-1] for a in null_formatting))
        notes.append(f"{', '.join(keys)}: null keys added (formatting)")

    # CD string→int normalization
    cd_normalized = [c for c in changed if c[0].endswith(".cd") and isinstance(c[1], str) and isinstance(c[2], int) and c[1] == str(c[2])]
    if cd_normalized:
        changed = [c for c in changed if c not in cd_normalized]
        notes.append("cd: string -> int")

    # true_desc added/removed at skill level = formatting
    import re as _re
    td_pattern = _re.compile(r'^skills\.\w+\.true_desc(_[a-z]{2})?$')
    td_missing = [m for m in missing if td_pattern.match(m[0])]
    if td_missing:
        missing = [m for m in missing if m not in td_missing]
        notes.append("true_desc removed (formatting)")

    rarity = work_data.get("Rarity") or work_data.get("rarity")
    useless_transcend = [m for m in missing if m[0] in ("transcend.1", "transcend.2") and m[1] is None]
    if useless_transcend and rarity == 3:
        missing = [m for m in missing if not (m[0] in ("transcend.1", "transcend.2") and m[1] is None)]
        notes.append("useless transcend removed (rarity 3)")

    return missing, added, changed, notes


def fmt_val(val):
    """Format a value for display, truncated."""
    s = repr(val)
    if len(s) > 80:
        s = s[:80] + "..."
    return s


def print_report(filepath, result):
    """Print a human-readable diff report."""
    if result is None:
        return

    missing, added, changed, notes = result

    if not missing and not added and not changed and not notes:
        return False

    fname = Path(filepath).name

    # Only notes, no real diffs = formatting only
    if not missing and not added and not changed:
        print(f"  {fname}: formatting only")
        return "fmt"

    print(f"\n{'='*60}")
    print(f"  {filepath}")
    print(f"{'='*60}")

    if notes:
        for note in notes:
            print(f"\n  >> {note}")

    if missing:
        print(f"\n  MISSING (in git, not in working copy): {len(missing)}")
        for path, val in missing:
            print(f"    - {path}")
            print(f"      was: {fmt_val(val)}")

    if added:
        print(f"\n  ADDED (not in git, in working copy): {len(added)}")
        for path, val in added:
            print(f"    + {path}")
            print(f"      now: {fmt_val(val)}")

    if changed:
        print(f"\n  CHANGED values: {len(changed)}")
        for path, old, new in changed:
            print(f"    ~ {path}")
            print(f"      git:  {fmt_val(old)}")
            print(f"      now:  {fmt_val(new)}")

    print()
    return True


def filter_by_range(files, range_str):
    """Filter files by ID range. '10-20' -> 2000010 to 2000020, '42' -> 2000042."""
    m = re.match(r'^(\d+)(?:-(\d+))?$', range_str)
    if not m:
        print(f"Invalid range: {range_str} (expected: 10-20 or 42)")
        sys.exit(1)
    lo = int(m.group(1))
    hi = int(m.group(2)) if m.group(2) else lo
    id_lo = 2000000 + lo
    id_hi = 2000000 + hi
    return [f for f in files if extract_id(f) is not None and id_lo <= extract_id(f) <= id_hi]


def extract_id(filepath):
    """Extract numeric ID from a filename like 2000001.json."""
    m = re.search(r'(\d+)\.json$', str(filepath))
    return int(m.group(1)) if m else None


def main():
    if len(sys.argv) < 2:
        print("Usage: python scripts/diff-json.py <file_or_dir> [range]")
        print("  range: 10-20 (IDs 2000010-2000020) or 42 (ID 2000042)")
        sys.exit(1)

    target = sys.argv[1]
    id_range = sys.argv[2] if len(sys.argv) >= 3 else None

    if os.path.isdir(target):
        files = sorted(Path(target).glob("*.json"))
        if id_range:
            files = filter_by_range(files, id_range)
        if not files:
            print(f"No JSON files found in {target}" +
                  (f" for range {id_range}" if id_range else ""))
            sys.exit(1)
        total_missing = total_added = total_changed = 0
        fmt_only = []
        for f in files:
            rel = str(f).replace("\\", "/")
            result = compare(rel)
            if result:
                m, a, c, n = result
                if m or a or c or n:
                    status = print_report(rel, result)
                    if status == "fmt":
                        fmt_only.append(f.name)
                    else:
                        total_missing += len(m)
                        total_added += len(a)
                        total_changed += len(c)
        print(f"\nTotal across {len(files)} files: "
              f"{total_missing} missing, {total_added} added, {total_changed} changed")
    else:
        filepath = target.replace("\\", "/")
        result = compare(filepath)
        print_report(filepath, result)


if __name__ == "__main__":
    main()
