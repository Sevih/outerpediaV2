"""Better variant extractor — split by `#ifdef VERTEX` markers and capture
everything between two markers (= one variant)."""
import re
import sys
sys.stdout.reconfigure(encoding='utf-8')

data = open('tmp/shader_p0_gles3.bin', 'rb').read()

# Find every `#ifdef VERTEX` position
vertex_starts = [m.start() for m in re.finditer(rb'#ifdef VERTEX', data)]
print(f'Found {len(vertex_starts)} variants')

# Each variant spans from one `#ifdef VERTEX` to the next.
variants = []
for i, start in enumerate(vertex_starts):
    end = vertex_starts[i + 1] if i + 1 < len(vertex_starts) else len(data)
    chunk = data[start:end]
    text = chunk.decode('ascii', errors='replace')
    # Extract the FRAGMENT block. The shader ends with `\n#endif\n` followed by
    # binary trailer; the `#endif` we want is the OUTER one closing the
    # `#ifdef FRAGMENT` (not the inner ones inside `#if HLSLCC_...`).
    frag_idx = text.find('#ifdef FRAGMENT')
    if frag_idx < 0:
        continue
    # Find last `#endif` before the binary trailer (right before non-printable)
    frag_block = text[frag_idx:]
    # Outer #endif balances the `#ifdef FRAGMENT`. We track depth.
    depth = 0
    end_pos = -1
    for m in re.finditer(r'#(ifdef|if|endif)\b', frag_block):
        token = m.group(1)
        if token in ('ifdef', 'if'):
            depth += 1
        else:
            depth -= 1
            if depth == 0:
                end_pos = m.end()
                break
    if end_pos < 0:
        continue
    frag_src = frag_block[:end_pos]
    trailer_offset = frag_idx + end_pos
    trailer = text[trailer_offset:]
    # Extract keyword names from trailer (printable ASCII strings)
    kw_bytes = data[start + frag_idx + end_pos:end]
    kws = re.findall(rb'_[A-Z][A-Z0-9_]+', kw_bytes)
    kws = sorted(set(k.decode('ascii') for k in kws))
    variants.append({'offset': start, 'frag': frag_src, 'keywords': kws})

print(f'Parsed {len(variants)} variants with FRAGMENT block')

# Demi inner: NOISE_UV + MAIN_CONTRAST + ALPHA_TEX + SECOND_TEX + THIRD_TEX, NO TYPE_ADDs (multi/multi)
INNER_REQ = {'_NOISE_UV_ON', '_MAIN_CONTRAST_ON', '_ALPHA_TEX_ON', '_SECOND_TEX_ON', '_THIRD_TEX_ON'}
INNER_FORBID = {'_DISSOLVE_UV_ON', '_POLAR_UV_ON', '_USE_SCENE_LIGHT_COLOR', '_MAIN_CLAMP',
                '_MAIN_ALPHACHANNEL_ON', '_SECOND_TYPE_ADD', '_THIRD_TYPE_ADD',
                '_ALPHA_CONTRAST_ON', '_ALPHA_CLAMP'}

# Demi out: NOISE_UV + MAIN_CONTRAST + SECOND_TEX (with TYPE_ADD) + THIRD_TEX (multi) + MAIN_CLAMP. NO ALPHA_TEX.
OUT_REQ = {'_NOISE_UV_ON', '_MAIN_CONTRAST_ON', '_SECOND_TEX_ON', '_SECOND_TYPE_ADD', '_THIRD_TEX_ON', '_MAIN_CLAMP'}
OUT_FORBID = {'_ALPHA_TEX_ON', '_DISSOLVE_UV_ON', '_POLAR_UV_ON', '_USE_SCENE_LIGHT_COLOR',
              '_MAIN_ALPHACHANNEL_ON', '_THIRD_TYPE_ADD', '_ALPHA_CONTRAST_ON', '_ALPHA_CLAMP'}


def matches(kws, req, forbid):
    s = set(kws)
    return req.issubset(s) and not (s & forbid)


def first_match(req, forbid):
    return [v for v in variants if matches(v['keywords'], req, forbid)]


inners = first_match(INNER_REQ, INNER_FORBID)
outs = first_match(OUT_REQ, OUT_FORBID)
print(f'Inner candidates: {len(inners)}')
print(f'Out candidates:   {len(outs)}')

if inners:
    open('tmp/shader_demi_inner.glsl', 'w', encoding='utf-8').write(inners[0]['frag'])
    print(f'\nInner kws: {inners[0]["keywords"]}')
if outs:
    open('tmp/shader_demi_out.glsl', 'w', encoding='utf-8').write(outs[0]['frag'])
    print(f'Out kws: {outs[0]["keywords"]}')
