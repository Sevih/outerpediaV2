"""Dump all fr: '...' values from a given file for inspection."""
import re
import sys

path = sys.argv[1]
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

pattern = re.compile(r"fr:\s*'((?:[^'\\]|\\.)*)'")
matches = pattern.findall(content)
print(f'Total fr values: {len(matches)}\n')
for i, m in enumerate(matches):
    print(f'{i:3d}| {m}')
