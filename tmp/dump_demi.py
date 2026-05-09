"""Full dump of FX_UI_Character_List_Demi prefab.
Same layout as dump_dungeon.py — walks GameObject tree, dumps every component.
"""
import UnityPy
import sys

sys.stdout.reconfigure(encoding='utf-8')

env = UnityPy.load('datamine/files/bundles/9e6fbb19710c5ca23bef34edc94d3e59')
by_pid = {obj.path_id: obj for obj in env.objects}


def read(pid):
    o = by_pid.get(pid)
    return o.read_typetree() if o else None


def type_of(pid):
    o = by_pid.get(pid)
    return o.type.name if o else None


roots = {}
for obj in env.objects:
    if obj.type.name != 'AssetBundle':
        continue
    ab = obj.read_typetree()
    for path, info in ab['m_Container']:
        if path.endswith('.prefab'):
            n = path.rsplit('/', 1)[-1].replace('.prefab', '')
            roots[n] = info['asset']['m_PathID']
    break


def is_zero(v):
    if isinstance(v, (int, float)):
        return v == 0
    if isinstance(v, str):
        return v == ''
    if isinstance(v, dict):
        return all(is_zero(x) for x in v.values()) if v else True
    if isinstance(v, list):
        return all(is_zero(x) for x in v) if v else True
    if v is None:
        return True
    return False


def fmt_val(v):
    if isinstance(v, float):
        return f'{v:g}'
    if isinstance(v, dict):
        if set(v) <= {'x', 'y', 'z', 'w'}:
            return '(' + ','.join(f'{v.get(k, 0):g}' for k in 'xyzw' if k in v) + ')'
        if set(v) <= {'r', 'g', 'b', 'a'}:
            return '(' + ','.join(f'{v.get(k, 0):g}' for k in 'rgba' if k in v) + ')'
    return repr(v)[:120]


def dump_value(v, indent, depth=0):
    if depth > 5:
        print(f'{indent}<truncated>')
        return
    if isinstance(v, dict):
        keys = list(v.keys())
        if set(keys) <= {'x', 'y', 'z', 'w'} or set(keys) <= {'r', 'g', 'b', 'a'}:
            print(f'{indent}{fmt_val(v)}')
            return
        for k, val in v.items():
            if is_zero(val):
                continue
            if isinstance(val, (dict, list)) and val:
                if isinstance(val, dict) and 'scalar' in val and len(val) <= 6:
                    extra = ''
                    if val.get('minMaxState') is not None:
                        extra += f' mode={val["minMaxState"]}'
                    if val.get('minScalar') and val['minScalar'] != val.get('scalar'):
                        extra += f' min={val["minScalar"]}'
                    print(f'{indent}{k} = {val.get("scalar")}{extra}')
                    continue
                print(f'{indent}{k}:')
                dump_value(val, indent + '  ', depth + 1)
            else:
                print(f'{indent}{k}: {fmt_val(val)}')
    elif isinstance(v, list):
        for i, item in enumerate(v):
            if is_zero(item):
                continue
            if isinstance(item, (dict, list)):
                print(f'{indent}[{i}]:')
                dump_value(item, indent + '  ', depth + 1)
            else:
                print(f'{indent}[{i}]: {fmt_val(item)}')
    else:
        print(f'{indent}{fmt_val(v)}')


def dump_component(t, comp, indent):
    if t in ('RectTransform', 'Transform'):
        for k in ['m_LocalPosition', 'm_LocalRotation', 'm_LocalScale',
                  'm_AnchoredPosition', 'm_SizeDelta', 'm_AnchorMin',
                  'm_AnchorMax', 'm_Pivot']:
            if k in comp:
                print(f'{indent}{k}: {fmt_val(comp[k])}')
    elif t == 'ParticleSystem':
        for k in ['lengthInSec', 'simulationSpeed', 'looping', 'prewarm',
                  'playOnAwake', 'startDelay', 'moveWithTransform',
                  'scalingMode']:
            if k in comp and not is_zero(comp[k]):
                print(f'{indent}{k}: {fmt_val(comp[k])}')
        for k in sorted(comp.keys()):
            if k.startswith('m_'):
                continue
            if k in ['lengthInSec', 'simulationSpeed', 'looping', 'prewarm',
                     'playOnAwake', 'startDelay', 'moveWithTransform',
                     'scalingMode', 'serializedVersion']:
                continue
            v = comp[k]
            if isinstance(v, dict):
                if v.get('enabled') == 0:
                    continue
                if is_zero({kk: vv for kk, vv in v.items() if kk != 'enabled'}):
                    continue
                print(f'{indent}[{k}]')
                dump_value(v, indent + '  ')
    elif t == 'ParticleSystemRenderer':
        for k in ['m_RenderMode', 'm_SortMode', 'm_MinParticleSize',
                  'm_MaxParticleSize', 'm_RenderAlignment',
                  'm_VelocityScale', 'm_LengthScale', 'm_NormalDirection',
                  'm_Pivot', 'm_TrailMaterial', 'm_MaskInteraction',
                  'm_AllowRoll']:
            if k in comp and not is_zero(comp[k]):
                print(f'{indent}{k}: {fmt_val(comp[k])}')
        mats = comp.get('m_Materials', [])
        for i, m in enumerate(mats):
            mp = m.get('m_PathID', 0)
            if mp in by_pid:
                mat = read(mp)
                print(f'{indent}Material[{i}]: {mat.get("m_Name")} (pid={mp})')
                # Shader reference
                shader_ref = mat.get('m_Shader', {})
                if shader_ref.get('m_PathID'):
                    sh = read(shader_ref['m_PathID'])
                    if sh:
                        print(f'{indent}  shader: {sh.get("m_ParsedForm", {}).get("m_Name") or sh.get("m_Name")}')
                saved = mat.get('m_SavedProperties', {})
                for fname, fval in saved.get('m_Floats', []):
                    if fval != 0 and fval != 1:
                        print(f'{indent}  float  {fname} = {fval}')
                for cname, cval in saved.get('m_Colors', []):
                    if not is_zero(cval) or cname.endswith('Speed'):
                        print(f'{indent}  color  {cname} = {fmt_val(cval)}')
                for tname, tval in saved.get('m_TexEnvs', []):
                    tex_pid = tval.get('m_Texture', {}).get('m_PathID', 0)
                    tex = read(tex_pid) if tex_pid in by_pid else None
                    tex_name = tex.get('m_Name') if tex else '(external)'
                    scale = tval.get('m_Scale', {})
                    offset = tval.get('m_Offset', {})
                    print(f'{indent}  tex    {tname}: "{tex_name}" '
                          f'ST scale=({scale.get("x", 1):g},{scale.get("y", 1):g}) '
                          f'offset=({offset.get("x", 0):g},{offset.get("y", 0):g})')


def walk(pid, depth=0):
    if depth > 5:
        return
    go = read(pid)
    if not go:
        return
    indent = '  ' * depth
    name = go.get('m_Name', '?')
    active = go.get('m_IsActive', True)
    print(f'\n{indent}╔═════════════════════════════════════════════')
    print(f'{indent}║ GameObject: {name}  (active={active}, pid={pid})')
    print(f'{indent}╚═════════════════════════════════════════════')

    rt_pid = None
    for c in go.get('m_Component', []):
        cpid = c['component']['m_PathID']
        t = type_of(cpid)
        comp = read(cpid)
        if not comp:
            continue
        print(f'{indent}┌─ {t}')
        dump_component(t, comp, indent + '│  ')
        print(f'{indent}└─')
        if t in ('Transform', 'RectTransform'):
            rt_pid = cpid

    if rt_pid:
        rt = read(rt_pid)
        for ch in rt.get('m_Children', []):
            cht = read(ch['m_PathID'])
            if cht and cht.get('m_GameObject'):
                walk(cht['m_GameObject']['m_PathID'], depth + 1)


print('=' * 70)
print('Available roots:', list(roots.keys()))
print('=' * 70)

# Try several name casings
for key in ['fx_ui_character_list_demi', 'FX_UI_Character_List_Demi']:
    if key in roots:
        print(f'FULL DUMP: {key}')
        print('=' * 70)
        walk(roots[key])
        break
else:
    # Print roots case-insensitively to find Demi
    for k, pid in roots.items():
        if 'demi' in k.lower():
            print(f'FULL DUMP: {k}')
            print('=' * 70)
            walk(pid)
            break
