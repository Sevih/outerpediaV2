"""Find specific shader variants matching keyword profiles of the 4 character-
specific prefabs to see how Unity handles their composite + alpha math."""
import re
import sys
sys.stdout.reconfigure(encoding='utf-8')

text = open('tmp/shader_p0_gles3.bin', 'rb').read().decode('ascii', errors='replace')
positions = [m.start() for m in re.finditer(r'#ifdef VERTEX', text)]


def extract_frag(start, end):
    chunk = text[start:end]
    fi = chunk.find('#ifdef FRAGMENT')
    if fi < 0:
        return ''
    blk = chunk[fi:]
    depth = 0
    end_pos = -1
    for m in re.finditer(r'#(ifdef|if|endif)\b', blk):
        if m.group(1) in ('ifdef', 'if'):
            depth += 1
        else:
            depth -= 1
            if depth == 0:
                end_pos = m.end()
                break
    return blk[:end_pos] if end_pos > 0 else ''


def has_sampler(frag, names):
    return all(f'sampler2D {n};' in frag for n in names)


def lacks_sampler(frag, names):
    return all(f'sampler2D {n};' not in frag for n in names)


variants = []
for i, start in enumerate(positions):
    end = positions[i + 1] if i + 1 < len(positions) else len(text)
    frag = extract_frag(start, end)
    if frag:
        variants.append({'offset': start, 'frag': frag})


# 2000093 inner profile:
# _THIRD_TEX_ON + _THIRD_TYPE_ADD + _ALPHA_TEX_ON (no main contrast, no second, no noise)
# samplers: _MainTex, _ThirdTex, _AlphaTex (no _SecondTex, no _NoiseTex)
target = []
for v in variants:
    f = v['frag']
    if has_sampler(f, ['_MainTex', '_ThirdTex', '_AlphaTex']) and \
       lacks_sampler(f, ['_SecondTex', '_NoiseTex', '_DissolveTex']):
        target.append(v)

print(f'2000093-inner-style candidates: {len(target)}')
if target:
    # Print uniforms list of first
    v = target[0]
    uniforms = re.findall(r'^uniform.*$', v['frag'], re.MULTILINE)
    print('\nUniforms:')
    for u in uniforms:
        print(f'  {u.strip()}')

    # Print main() body
    body = v['frag'][v['frag'].find('void main()'):]
    body = body[:body.find('return;') + 7]
    print('\nMain body:')
    print(body)

    open('tmp/shader_2000093_inner.glsl', 'w', encoding='utf-8').write(v['frag'])
    print(f'\nWrote tmp/shader_2000093_inner.glsl @{v["offset"]}')
