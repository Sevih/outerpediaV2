"""Dump all fr: '...' values from a given file into another file (UTF-8 safe)."""
import re
import sys

path = sys.argv[1]
out_path = sys.argv[2] if len(sys.argv) > 2 else 'fr-dump.txt'

with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

pattern = re.compile(r"fr:\s*'((?:[^'\\]|\\.)*)'")
matches = pattern.findall(content)

with open(out_path, 'w', encoding='utf-8') as f:
    f.write(f'Total fr values: {len(matches)}\n\n')
    for i, m in enumerate(matches):
        f.write(f'{i:3d}| {m}\n')

print(f'Wrote {len(matches)} fr values to {out_path}')
