"""Extract OUT-style variant with formula 'second additive, third multiplicative'."""
import re
import sys
sys.stdout.reconfigure(encoding='utf-8')

text = open('tmp/shader_p0_gles3.bin', 'rb').read().decode('ascii', errors='replace')

# Variant @130860 was the first match for pattern 2
target_offset = 130860
positions = [m.start() for m in re.finditer(r'#ifdef VERTEX', text)]
i = positions.index(target_offset)
end = positions[i + 1] if i + 1 < len(positions) else len(text)
chunk = text[target_offset:end]

# Strip everything after the FRAGMENT block ends (the binary trailer).
# Find the FRAGMENT block and balance its #endif.
frag_idx = chunk.find('#ifdef FRAGMENT')
block = chunk[frag_idx:]
depth = 0
end_pos = -1
for m in re.finditer(r'#(ifdef|if|endif)\b', block):
    if m.group(1) in ('ifdef', 'if'):
        depth += 1
    else:
        depth -= 1
        if depth == 0:
            end_pos = m.end()
            break

frag = block[:end_pos]
open('tmp/shader_demi_out.glsl', 'w', encoding='utf-8').write(frag)
print(f'Wrote tmp/shader_demi_out.glsl ({len(frag)} chars)')

# Print main body
body_start = frag.find('void main()')
print('\n--- main() body ---')
print(frag[body_start:body_start + 4000])
