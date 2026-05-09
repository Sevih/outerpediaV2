"""Extract every #version GLSL block from the decompressed shader blob."""
import re
import sys
sys.stdout.reconfigure(encoding='utf-8')

data = open('tmp/shader_p0_gles3.bin', 'rb').read()

# Find all #version markers
positions = [m.start() for m in re.finditer(rb'#version\s+\d+\s+es', data)]
print(f'Found {len(positions)} #version blocks')

# Group adjacent VERTEX/FRAGMENT shaders
variants = []
i = 0
while i < len(positions):
    start = positions[i]
    # Read until #endif followed by another #version (or end of section)
    next_start = positions[i + 1] if i + 1 < len(positions) else len(data)
    chunk = data[start:next_start].decode('ascii', errors='replace')
    # Determine if vertex or fragment
    is_frag = '#ifdef FRAGMENT' in data[max(0, start - 2000):start].decode('ascii', errors='replace')
    variants.append((start, is_frag, chunk))
    i += 1

# Look for any block that has all of: _NoiseSpeed (NOISE_UV_ON), texture3 (THIRD), _AlphaTex (ALPHA), _MainContrast (CONTRAST_ON), _SecondTex (SECOND)
fragments = [v for v in variants if v[1]]
print(f'Fragment shaders: {len(fragments)}')

target_uniforms = ['_NoiseSpeed', '_ThirdTex', '_AlphaTex', '_MainContrast', '_SecondTex', '_NoiseStrength']
matches = []
for pos, _, chunk in fragments:
    score = sum(1 for u in target_uniforms if u in chunk)
    matches.append((score, pos, chunk))

matches.sort(reverse=True)
for score, pos, chunk in matches[:5]:
    print(f'\nScore {score}/{len(target_uniforms)} at offset {pos} ({len(chunk)} chars)')
    # Print a brief uniform list
    uniforms = re.findall(r'^uniform\s+.*$', chunk, re.MULTILINE)
    for u in uniforms[:30]:
        print(f'  {u}')

# Save the top 3 candidates
for i, (score, pos, chunk) in enumerate(matches[:3]):
    out = f'tmp/shader_variant_{i}_score{score}.glsl'
    with open(out, 'w', encoding='utf-8') as f:
        f.write(chunk)
    print(f'Wrote {out}')
