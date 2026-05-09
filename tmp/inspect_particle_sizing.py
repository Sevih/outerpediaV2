"""Deep inspection of how Unity particle sizing actually works for these
prefabs: scalingMode, m_RenderMode, m_LengthScale, full transform chain,
particle system flags."""
import UnityPy
import sys
sys.stdout.reconfigure(encoding='utf-8')

env = UnityPy.load('datamine/files/bundles/9e6fbb19710c5ca23bef34edc94d3e59')
by_pid = {o.path_id: o for o in env.objects}


def read(pid):
    o = by_pid.get(pid)
    return o.read_typetree() if o else None


# Find Dungeon root
roots = {}
for o in env.objects:
    if o.type.name != 'AssetBundle':
        continue
    ab = o.read_typetree()
    for path, info in ab['m_Container']:
        if path.endswith('.prefab'):
            n = path.rsplit('/', 1)[-1].replace('.prefab', '')
            roots[n] = info['asset']['m_PathID']
    break


def walk(pid, depth=0, parent_scale=(1.0, 1.0, 1.0)):
    go = read(pid)
    if not go:
        return
    indent = '  ' * depth
    name = go.get('m_Name', '?')
    rt_pid = None
    psys = None
    psys_render = None
    for c in go.get('m_Component', []):
        cpid = c['component']['m_PathID']
        comp = read(cpid)
        if not comp:
            continue
        o = by_pid.get(cpid)
        t = o.type.name if o else '?'
        if t in ('Transform', 'RectTransform'):
            rt_pid = cpid
            scale = comp.get('m_LocalScale', {})
            sx, sy, sz = scale.get('x', 1), scale.get('y', 1), scale.get('z', 1)
            world_scale = (parent_scale[0] * sx, parent_scale[1] * sy, parent_scale[2] * sz)
        elif t == 'ParticleSystem':
            psys = comp
        elif t == 'ParticleSystemRenderer':
            psys_render = comp

    if psys:
        scaling_mode = psys.get('scalingMode', 0)
        # Unity scalingMode: 0=Hierarchy, 1=Local, 2=Shape
        sm_name = ['Hierarchy', 'Local', 'Shape'][scaling_mode] if scaling_mode < 3 else f'?{scaling_mode}'
        size_init = psys.get('InitialModule', {}).get('startSize', {})
        size_val = size_init.get('scalar')
        size_min = size_init.get('minScalar')
        rect_size = read(rt_pid).get('m_SizeDelta', {})
        rsx, rsy = rect_size.get('x', 0), rect_size.get('y', 0)
        rotation_init = psys.get('InitialModule', {}).get('rotation3D', 0)
        render_mode = psys_render.get('m_RenderMode', 0) if psys_render else '?'
        length_scale = psys_render.get('m_LengthScale', 1) if psys_render else '?'

        print(f'{indent}{name}:')
        print(f'{indent}  Transform localScale=({world_scale[0]:.2f},{world_scale[1]:.2f},{world_scale[2]:.2f}) (after parent chain)')
        print(f'{indent}  RectTransform sizeDelta=({rsx},{rsy})')
        print(f'{indent}  ParticleSystem scalingMode={scaling_mode} ({sm_name})')
        print(f'{indent}  startSize: scalar={size_val} min={size_min}')
        print(f'{indent}  ParticleSystemRenderer renderMode={render_mode} lengthScale={length_scale}')

    if rt_pid:
        rt = read(rt_pid)
        scale = rt.get('m_LocalScale', {})
        ws = (parent_scale[0] * scale.get('x', 1), parent_scale[1] * scale.get('y', 1), parent_scale[2] * scale.get('z', 1))
        for ch in rt.get('m_Children', []):
            cht = read(ch['m_PathID'])
            if cht and cht.get('m_GameObject'):
                walk(cht['m_GameObject']['m_PathID'], depth + 1, ws)


print('=== Dungeon ===')
walk(roots['fx_ui_character_list_dungeon'])
print('\n=== 2000086 ===')
walk(roots['fx_ui_character_list_2000086'])
print('\n=== 2000093 ===')
walk(roots['fx_ui_character_list_2000093'])
