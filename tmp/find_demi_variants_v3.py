"""Match shader variants by their uniform/sampler declarations rather than the
unreliable keyword trailer. We know which textures Demi uses per layer."""
import re
import sys
sys.stdout.reconfigure(encoding='utf-8')

data = open('tmp/shader_p0_gles3.bin', 'rb').read()
text = data.decode('ascii', errors='replace')

# Split by `#ifdef VERTEX` (start of variant) — same as v2.
vertex_starts = [m.start() for m in re.finditer(r'#ifdef VERTEX', text)]

variants = []
for i, start in enumerate(vertex_starts):
    end = vertex_starts[i + 1] if i + 1 < len(vertex_starts) else len(text)
    chunk = text[start:end]
    # Extract FRAGMENT block (balanced)
    frag_idx = chunk.find('#ifdef FRAGMENT')
    if frag_idx < 0:
        continue
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
    if end_pos < 0:
        continue
    frag = block[:end_pos]
    samplers = set(re.findall(r'sampler2D (_\w+);', frag))
    has_second_add = 'u_xlat16_8' in frag and ('+ u_xlat16_8' in frag or '+ u_xlat16_1' in frag and 'u_xlat5.xyz +' in frag)
    variants.append({'offset': start, 'frag': frag, 'samplers': samplers})

print(f'{len(variants)} fragment shader variants')


def find_by_samplers(needed, forbidden=None):
    forbidden = forbidden or set()
    return [v for v in variants if needed <= v['samplers'] and not (forbidden & v['samplers'])]


# Demi INNER: uses _MainTex, _SecondTex, _ThirdTex, _AlphaTex, _NoiseTex (because _NOISE_UV_ON=1)
inners = find_by_samplers({'_MainTex', '_SecondTex', '_ThirdTex', '_AlphaTex', '_NoiseTex'},
                          forbidden={'_DissolveTex'})
# Demi OUT: same but no _AlphaTex (because _ALPHA_TEX_ON=0)
outs = find_by_samplers({'_MainTex', '_SecondTex', '_ThirdTex', '_NoiseTex'},
                        forbidden={'_AlphaTex', '_DissolveTex'})

print(f'\nInner candidates ({len(inners)}):')
for v in inners[:5]:
    # Look at composite line patterns
    lines = v['frag'].split('\n')
    composite_lines = [l.strip() for l in lines if 'u_xlat16_1.xyz' in l or 'u_xlat16_5.xyz' in l]
    main_contrast = '_MainContrast' in v['frag']
    print(f'  @{v["offset"]} samplers={sorted(v["samplers"])} contrast={main_contrast}')

print(f'\nOut candidates ({len(outs)}):')
for v in outs[:5]:
    main_clamp = 'clamp(u_xlat10.xy' in v['frag'] or 'clamp(u_xlat3.xy' in v['frag'] or 'clamp(' in v['frag']
    print(f'  @{v["offset"]} samplers={sorted(v["samplers"])} has_clamp={main_clamp}')

# We need INNER with: NOISE_UV (noise distorts main+second+third), MAIN_CONTRAST, ALPHA_TEX,
# both SECOND and THIRD as MULTI (no TYPE_ADD keywords). Both `+` keywords present means TYPE_ADD enabled.
# In Demi inner: SECOND_TYPE_ADD=0, THIRD_TYPE_ADD=0 → both multiplicative → in shader code,
# composite = main * second * third (no `+` between them).

def has_multi_multi(frag):
    """Check the composite formula: should have main*second*third pattern."""
    # u_xlat5.xyz holds 'main' (with optional contrast).
    # u_xlat16_8.xyz holds 'second'. u_xlat16_7.xyz holds 'third'.
    # Multi composite: u_xlat5.xyz * u_xlat16_8.xyz, then *= u_xlat16_7.xyz.
    # OR a single combined line.
    for ln in frag.split('\n'):
        ln = ln.strip()
        # Multi: 'A * B * C' or 'A * B' followed by '* C'
        if 'u_xlat16_1.xyz = u_xlat' in ln:
            # See if second is added or multiplied
            if '* u_xlat16_8.xyz' in ln and ('+ u_xlat16_7' not in ln) and ('+ u_xlat16_8' not in ln):
                return True
    return False


inner_multi = [v for v in inners if has_multi_multi(v['frag'])]
print(f'\nInner with multi/multi composite: {len(inner_multi)}')
if inner_multi:
    open('tmp/shader_demi_inner.glsl', 'w', encoding='utf-8').write(inner_multi[0]['frag'])
    print(f'  Wrote tmp/shader_demi_inner.glsl @{inner_multi[0]["offset"]}')
else:
    # Fallback to first inner
    if inners:
        open('tmp/shader_demi_inner.glsl', 'w', encoding='utf-8').write(inners[0]['frag'])

# Demi OUT: SECOND_TYPE_ADD=1 (additive), THIRD_TYPE_ADD=0 (multi).
# composite = main * third + second (since main_contrast'd)? Or reverse order.
# In code: u_xlat16_1 = main * third + second; or main * third, then += second.

def has_add_multi(frag):
    """SECOND additive, THIRD multiplicative."""
    for ln in frag.split('\n'):
        ln = ln.strip()
        if 'u_xlat16_1.xyz = u_xlat' in ln:
            # main * third + second pattern
            if ('* u_xlat16_7.xyz' in ln) and ('+ u_xlat16_8' in ln):
                return True
            if ('* u_xlat16_8.xyz' in ln) and ('+ u_xlat16_7' in ln):
                return True
    return False


out_addmulti = [v for v in outs if has_add_multi(v['frag'])]
print(f'Out with add/multi composite: {len(out_addmulti)}')
if out_addmulti:
    open('tmp/shader_demi_out.glsl', 'w', encoding='utf-8').write(out_addmulti[0]['frag'])
    print(f'  Wrote tmp/shader_demi_out.glsl @{out_addmulti[0]["offset"]}')
else:
    if outs:
        open('tmp/shader_demi_out.glsl', 'w', encoding='utf-8').write(outs[0]['frag'])
