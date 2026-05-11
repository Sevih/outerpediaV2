"""Check whether the file contains replacement chars (U+FFFD) or other encoding issues."""
import sys

path = sys.argv[1]
with open(path, 'rb') as f:
    raw = f.read()

# Try decoding as UTF-8
try:
    text = raw.decode('utf-8')
except UnicodeDecodeError as e:
    print(f'UTF-8 decode error: {e}')
    sys.exit(1)

# Count replacement chars
count_fffd = text.count('�')
print(f'Replacement chars (U+FFFD): {count_fffd}')

# Sample some lines containing fffd
lines = text.split('\n')
shown = 0
for i, line in enumerate(lines, 1):
    if '�' in line and shown < 8:
        print(f'L{i}: {line[:200]}')
        shown += 1

# Show unique bytes that produced fffd? Can't really, the bytes are lost. But we can
# detect the surrounding context to know what char was probably stripped.
print('\n--- Sample of mojibake-prone patterns ---')
patterns_to_find = ['�quipement', 'd�buter', 'Heros']
for p in patterns_to_find:
    count = text.count(p)
    if count:
        print(f'  "{p}": {count}')
