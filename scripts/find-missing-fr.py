"""Find LangMap-shaped literals that have en+jp+kr+zh but no fr key, in given files."""
import re
import sys

pattern = re.compile(r"\{[^{}]*\ben:\s*'[^']*'[^{}]*\bjp:[^{}]*\bkr:[^{}]*\bzh:[^{}]*\}")

total = 0
for path in sys.argv[1:]:
    try:
        with open(path, 'r', encoding='utf-8') as f:
            content = f.read()
    except Exception as e:
        print(f'ERR reading {path}: {e}')
        continue
    matches = pattern.findall(content)
    missing = [m for m in matches if 'fr:' not in m]
    if missing:
        print(f'\n=== {path}: {len(missing)} LangMap WITHOUT fr ===')
        for m in missing:
            # Print a safe ASCII-only summary of the en field
            en_match = re.search(r"en:\s*'([^']*)'", m)
            if en_match:
                en_val = en_match.group(1)
                print(f"  | en: {en_val}")
            total += 1
print(f'\nTotal: {total} LangMaps need fr key.')
