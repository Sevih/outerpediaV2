"""Dump every module of a ParticleSystem + every property of its
ParticleSystemRenderer for a specific layer (Dungeon star) to see what we
might be missing for size/animation.
"""
import json
import sys
import UnityPy
sys.stdout.reconfigure(encoding='utf-8')

env = UnityPy.load('datamine/files/bundles/9e6fbb19710c5ca23bef34edc94d3e59')
by_pid = {o.path_id: o for o in env.objects}


def read(pid):
    o = by_pid.get(pid)
    return o.read_typetree() if o else None


# Find the Dungeon prefab
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


def is_meaningful(v):
    if v is None:
        return False
    if isinstance(v, (int, float)):
        return v != 0
    if isinstance(v, str):
        return v != ''
    if isinstance(v, list):
        return any(is_meaningful(x) for x in v)
    if isinstance(v, dict):
        return any(is_meaningful(x) for x in v.values())
    return True


def walk(pid, target_name=None, depth=0):
    go = read(pid)
    if not go:
        return
    name = go.get('m_Name', '?')
    is_target = (target_name in name) if target_name else True

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
        elif t == 'ParticleSystem':
            psys = comp
        elif t == 'ParticleSystemRenderer':
            psys_render = comp

    if is_target and psys:
        print(f'\n{"=" * 70}')
        print(f'LAYER: {name}')
        print(f'{"=" * 70}')
        # All ParticleSystem modules
        for k, v in psys.items():
            if k.startswith('m_') or k in ('serializedVersion',):
                continue
            if not isinstance(v, dict):
                if is_meaningful(v):
                    print(f'  {k}: {v}')
                continue
            # Modules — dict
            enabled = v.get('enabled')
            if enabled == 0 or (enabled is None and not is_meaningful(v)):
                continue
            print(f'  [{k}]')
            for kk, vv in v.items():
                if kk == 'enabled':
                    continue
                if not is_meaningful(vv):
                    continue
                # Compact formatting for short dicts
                if isinstance(vv, dict) and 'scalar' in vv and len(vv) <= 8:
                    val = vv.get('scalar')
                    minv = vv.get('minScalar')
                    mode = vv.get('minMaxState', 0)
                    extra = f' min={minv}' if minv not in (None, 0, val) else ''
                    print(f'    {kk}: mode={mode} val={val}{extra}')
                else:
                    sv = json.dumps(vv, default=str)
                    print(f'    {kk}: {sv[:200]}')
        # Renderer
        if psys_render:
            print(f'\n  RENDERER:')
            for k, v in psys_render.items():
                if k.startswith('m_Materials') or k.startswith('m_StaticBatch'):
                    continue
                if k == 'm_Mesh':
                    pid = v.get('m_PathID') if isinstance(v, dict) else 0
                    if pid:
                        mesh_obj = read(pid)
                        print(f'    m_Mesh: pid={pid} name={mesh_obj.get("m_Name") if mesh_obj else "?"}')
                    continue
                if not is_meaningful(v):
                    continue
                sv = json.dumps(v, default=str)
                print(f'    {k}: {sv[:200]}')
        # Transform
        if rt_pid:
            rt = read(rt_pid)
            print(f'\n  TRANSFORM:')
            print(f'    localScale: {rt.get("m_LocalScale")}')
            print(f'    sizeDelta: {rt.get("m_SizeDelta")}')

    if rt_pid:
        rt = read(rt_pid)
        for ch in rt.get('m_Children', []):
            cht = read(ch['m_PathID'])
            if cht and cht.get('m_GameObject'):
                walk(cht['m_GameObject']['m_PathID'], target_name, depth + 1)


# Dump all particle layers of Dungeon
walk(roots['fx_ui_character_list_dungeon'], target_name=None)
