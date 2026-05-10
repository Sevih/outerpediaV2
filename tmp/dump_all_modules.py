"""Dump every ParticleSystem module unconditionally so we see what's
configured (Size/Rotation/Velocity/Force/Inherit/SubEmitters etc.)."""
import json
import sys
import UnityPy
sys.stdout.reconfigure(encoding='utf-8')

env = UnityPy.load('datamine/files/bundles/9e6fbb19710c5ca23bef34edc94d3e59')
by_pid = {o.path_id: o for o in env.objects}


def read(pid):
    o = by_pid.get(pid)
    return o.read_typetree() if o else None


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


# Modules we want to inspect specifically (size-related)
SIZE_MODULES = [
    'SizeModule',          # SizeOverLifetime
    'SizeBySpeedModule',
    'RotationModule',
    'RotationBySpeedModule',
    'VelocityModule',
    'InheritVelocityModule',
    'ForceModule',
    'NoiseModule',
    'TriggerModule',
    'SubModule',
    'CustomDataModule',
]


def walk(pid, depth=0):
    go = read(pid)
    if not go:
        return
    name = go.get('m_Name', '?')
    rt_pid = None
    psys = None
    for c in go.get('m_Component', []):
        cpid = c['component']['m_PathID']
        comp = read(cpid)
        if not comp:
            continue
        o = by_pid.get(cpid)
        if o is None:
            continue
        if o.type.name in ('Transform', 'RectTransform'):
            rt_pid = cpid
        elif o.type.name == 'ParticleSystem':
            psys = comp

    if psys:
        print(f'\n--- {name} ---')
        for mod in SIZE_MODULES:
            v = psys.get(mod)
            if v is None:
                continue
            enabled = v.get('enabled') if isinstance(v, dict) else None
            print(f'  [{mod}] enabled={enabled}')
            if enabled == 1:
                # Print everything
                for kk, vv in v.items():
                    if kk == 'enabled':
                        continue
                    print(f'    {kk}: {json.dumps(vv, default=str)[:300]}')

    if rt_pid:
        rt = read(rt_pid)
        for ch in rt.get('m_Children', []):
            cht = read(ch['m_PathID'])
            if cht and cht.get('m_GameObject'):
                walk(cht['m_GameObject']['m_PathID'], depth + 1)


for prefab_name in ['fx_ui_character_list_dungeon', 'fx_ui_character_list_2000086', 'fx_ui_character_list_2000093', 'fx_ui_character_list_2000110']:
    print(f'\n========== {prefab_name} ==========')
    walk(roots[prefab_name])
