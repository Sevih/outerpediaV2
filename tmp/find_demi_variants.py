"""Extract Unity shader variants by keyword set, then pick the ones matching
Demi's actual keyword combos (inner / out / root)."""
import re
import sys
sys.stdout.reconfigure(encoding='utf-8')

data = open('tmp/shader_p0_gles3.bin', 'rb').read()

# Each fragment shader is followed (after #endif) by a small "trailer" with the
# keyword list separated by spaces (extracted bytes contain the keyword names).
# Find blocks that look like a fragment shader followed by a keyword list.

# Strategy: split the file by '#ifdef VERTEX' / '#ifdef FRAGMENT' markers and
# associate keyword trailers.

# Find every (vertex_block, fragment_block, keyword_trailer) triplet
pattern = re.compile(
    rb'#ifdef VERTEX\n(.*?)\n#endif\n#ifdef FRAGMENT\n(.*?)\n#endif\n(.*?)#ifdef VERTEX',
    re.DOTALL,
)

variants = []
for m in pattern.finditer(data):
    vert = m.group(1).decode('ascii', errors='replace')
    frag = m.group(2).decode('ascii', errors='replace')
    trailer = m.group(3)
    # Extract keywords from trailer (printable ASCII strings of >= 6 chars
    # that look like SHADER_KEYWORD).
    kws = re.findall(rb'(?:[A-Z][A-Z0-9_]{2,}|_[A-Z][A-Z0-9_]+)', trailer)
    kws = sorted(set(k.decode('ascii') for k in kws))
    variants.append({'vert_offset': m.start(), 'frag': frag, 'keywords': kws})

print(f'Parsed {len(variants)} variants')

# Print keyword distribution
from collections import Counter
kw_counter = Counter()
for v in variants:
    for k in v['keywords']:
        kw_counter[k] += 1
print('\nKeyword frequency:')
for k, c in sorted(kw_counter.items()):
    print(f'  {k}: {c}')


# Demi inner keywords (from JSON):
#   _NOISE_UV_ON=1, _MAIN_CONTRAST_ON=1, _SECOND_TEX_ON=1, _THIRD_TEX_ON=1, _ALPHA_TEX_ON=1
# (TYPE_ADD float toggles encode multi/add at the operator level — those variants
# are presumably distinct compilations.)

INNER_REQUIRED = {'_NOISE_UV_ON', '_MAIN_CONTRAST_ON', '_SECOND_TEX_ON', '_THIRD_TEX_ON', '_ALPHA_TEX_ON'}
INNER_FORBIDDEN = {'_DISSOLVE_UV_ON', '_POLAR_UV_ON', '_USE_SCENE_LIGHT_COLOR'}

OUT_REQUIRED  = {'_NOISE_UV_ON', '_MAIN_CONTRAST_ON', '_SECOND_TEX_ON', '_THIRD_TEX_ON'}
OUT_FORBIDDEN = {'_ALPHA_TEX_ON', '_DISSOLVE_UV_ON', '_POLAR_UV_ON', '_USE_SCENE_LIGHT_COLOR'}


def matches(kws, required, forbidden):
    s = set(kws)
    return required.issubset(s) and not (s & forbidden)


inner_matches = [v for v in variants if matches(v['keywords'], INNER_REQUIRED, INNER_FORBIDDEN)]
out_matches   = [v for v in variants if matches(v['keywords'], OUT_REQUIRED,   OUT_FORBIDDEN)]

print(f'\nInner candidates: {len(inner_matches)}')
for v in inner_matches[:10]:
    # Extract the composite line ("u_xlat16_1.xyz = u_xlat... * ..." with second/third)
    lines = v['frag'].split('\n')
    formula = next((l for l in lines if '* u_xlat16_8' in l or '* u_xlat16_7' in l), '')
    print(f'  @{v["vert_offset"]} kws={v["keywords"]}')
    print(f'    composite: {formula.strip()}')

print(f'\nOut candidates: {len(out_matches)}')
for v in out_matches[:10]:
    lines = v['frag'].split('\n')
    formula = next((l for l in lines if '* u_xlat16_8' in l or '+ u_xlat16_7' in l), '')
    print(f'  @{v["vert_offset"]} kws={v["keywords"]}')
    print(f'    composite: {formula.strip()}')

# Save first matches
if inner_matches:
    open('tmp/shader_demi_inner.glsl', 'w', encoding='utf-8').write(inner_matches[0]['frag'])
    print(f'\nWrote tmp/shader_demi_inner.glsl ({len(inner_matches)} candidates)')
if out_matches:
    open('tmp/shader_demi_out.glsl', 'w', encoding='utf-8').write(out_matches[0]['frag'])
    print(f'Wrote tmp/shader_demi_out.glsl ({len(out_matches)} candidates)')
