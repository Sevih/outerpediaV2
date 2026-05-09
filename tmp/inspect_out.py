import re
import sys
sys.stdout.reconfigure(encoding='utf-8')

text = open('tmp/shader_p0_gles3.bin', 'rb').read().decode('ascii', errors='replace')

positions = [m.start() for m in re.finditer(r'#ifdef VERTEX', text)]
print(f'Total variants: {len(positions)}')

# Iterate all variants matching OUT layer's sampler set
out_variants = []
for i, start in enumerate(positions):
    end = positions[i + 1] if i + 1 < len(positions) else len(text)
    chunk = text[start:end]
    has = lambda s: f'sampler2D {s};' in chunk
    if not (has('_MainTex') and has('_SecondTex') and has('_ThirdTex') and has('_NoiseTex')):
        continue
    if has('_AlphaTex') or has('_DissolveTex'):
        continue
    out_variants.append((start, chunk))

print(f'OUT-style variants (samplers match): {len(out_variants)}')

# Print composite line for each
unique_composites = {}
for off, chunk in out_variants:
    composite_lines = []
    for ln in chunk.split('\n'):
        l = ln.strip()
        if 'u_xlat16_1.xyz =' in l or 'u_xlat16_5.xyz =' in l or '= u_xlat16_8.xyz' in l:
            composite_lines.append(l)
    key = '\n'.join(composite_lines)
    unique_composites.setdefault(key, []).append(off)

print(f'\nUnique composite formula patterns: {len(unique_composites)}')
for key, offs in unique_composites.items():
    print(f'\nFormula ({len(offs)} variants, e.g. @{offs[0]}):')
    print(key[:600])
