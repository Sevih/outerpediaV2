"""Extract all FX_UI_Character_List_* prefabs to JSON descriptors.

Walks every prefab in `prefabs/character/ui_effect` and writes one JSON per
effect to `data/admin/fx/<name>.json`. Generalised version of dump_demi.py.

Run from project root:  python scripts/fx/dump_fx_to_json.py
"""
import json
import sys
from pathlib import Path
import UnityPy

sys.stdout.reconfigure(encoding='utf-8')

ROOT = Path(__file__).resolve().parents[2]
BUNDLE = ROOT / 'datamine/files/bundles/9e6fbb19710c5ca23bef34edc94d3e59'
OUT_DIR = ROOT / 'data/admin/fx'
OUT_DIR.mkdir(parents=True, exist_ok=True)

env = UnityPy.load(str(BUNDLE))
by_pid = {obj.path_id: obj for obj in env.objects}

# Load dependent bundles so cross-bundle texture references (m_FileID > 0)
# resolve. The list is in `m_Dependencies` of the root bundle's AssetBundle
# object, with names like `effects/common/textures/t_fx_atlas_01`. Resolve
# each name → bundle filename via the manifest.
import json as _json
MANIFEST_PATH = ROOT / 'datamine/files/bundles/manifest.dat'
manifest = _json.loads(MANIFEST_PATH.read_text(encoding='utf-8'))
name_to_filename = {b['name']: b['filename'] for b in manifest['bundleInfos']}

dep_envs: list = []
for o in env.objects:
    if o.type.name != 'AssetBundle':
        continue
    ab = o.read_typetree()
    for dep_name in ab.get('m_Dependencies', []):
        fn = name_to_filename.get(dep_name)
        if not fn:
            continue
        dep_path = ROOT / 'datamine/files/bundles' / fn
        if not dep_path.exists():
            continue
        try:
            dep_env = UnityPy.load(str(dep_path))
            dep_envs.append(dep_env)
            for obj in dep_env.objects:
                # Don't overwrite an existing local entry.
                by_pid.setdefault(obj.path_id, obj)
        except Exception as e:
            print(f'  (skipped dep {dep_name}: {e})')
    break


def read(pid):
    o = by_pid.get(pid)
    return o.read_typetree() if o else None


def type_of(pid):
    o = by_pid.get(pid)
    return o.type.name if o else None


def vec(d, *keys, default=0):
    return [d.get(k, default) for k in keys] if isinstance(d, dict) else [default] * len(keys)


def color(d):
    return [d.get('r', 0), d.get('g', 0), d.get('b', 0), d.get('a', 0)] if isinstance(d, dict) else [0, 0, 0, 0]


def minmax_curve(c):
    if not isinstance(c, dict):
        return c
    out = {'mode': c.get('minMaxState', 0), 'value': c.get('scalar', 0)}
    if c.get('minScalar') not in (None, 0) and c.get('minScalar') != c.get('scalar'):
        out['min'] = c.get('minScalar')
    return out


def gradient(g):
    if not isinstance(g, dict):
        return None
    keys = []
    for i in range(8):
        k = g.get(f'key{i}')
        if k:
            keys.append(color(k))
    return {
        'colorKeys': keys,
        'ctimes': [g.get(f'ctime{i}', 0) for i in range(8)],
        'atimes': [g.get(f'atime{i}', 0) for i in range(8)],
        'numColorKeys': g.get('m_NumColorKeys', 0),
        'numAlphaKeys': g.get('m_NumAlphaKeys', 0),
    }


def animation_curve(c):
    """Capture an AnimationCurve (m_Curve list of keys) as time/value pairs."""
    if not isinstance(c, dict):
        return None
    keys = c.get('m_Curve', [])
    if not keys:
        return None
    return [{'t': k.get('time', 0), 'v': k.get('value', 0)} for k in keys]


def particle_module(comp):
    init = comp.get('InitialModule', {})
    color_mod = comp.get('ColorModule', {})
    emit = comp.get('EmissionModule', {})
    uv_mod = comp.get('UVModule', {})
    size_mod = comp.get('SizeModule', {})

    bursts = []
    for b in emit.get('m_Bursts', []) or []:
        bursts.append({
            'count': minmax_curve(b.get('countCurve', {})),
            'cycleCount': b.get('cycleCount', 1),
            'repeatInterval': b.get('repeatInterval', 0),
            'probability': b.get('probability', 1),
            'time': b.get('time', 0),
        })

    out = {
        'duration': comp.get('lengthInSec', 1),
        'looping': bool(comp.get('looping', 1)),
        'playOnAwake': bool(comp.get('playOnAwake', 1)),
        'startLifetime': minmax_curve(init.get('startLifetime', {})),
        'startSpeed': minmax_curve(init.get('startSpeed', {})),
        'startSize': minmax_curve(init.get('startSize', {})),
        'startRotation': minmax_curve(init.get('startRotation', {})),
        'startRotationY': minmax_curve(init.get('startRotationY', {})),
        'rotation3D': bool(init.get('rotation3D', 0)),
        'maxNumParticles': init.get('maxNumParticles', 1000),
        'gravityModifier': minmax_curve(init.get('gravityModifier', {})),
    }

    if color_mod and color_mod.get('enabled'):
        grad = color_mod.get('gradient', {})
        out['colorOverLifetime'] = {
            'mode': grad.get('minMaxState', 0),
            'maxGradient': gradient(grad.get('maxGradient', {})),
            'minGradient': gradient(grad.get('minGradient', {})),
        }

    if emit.get('enabled'):
        out['emission'] = {
            'rateOverTime': minmax_curve(emit.get('rateOverTime', {})),
            'bursts': bursts,
        }

    if uv_mod.get('enabled'):
        out['uvModule'] = {
            'tilesX': uv_mod.get('tilesX', 1),
            'tilesY': uv_mod.get('tilesY', 1),
            'frameOverTime': minmax_curve(uv_mod.get('frameOverTime', {})),
            'startFrame': minmax_curve(uv_mod.get('startFrame', {})),
            'cycles': uv_mod.get('cycles', 1),
            'animationType': uv_mod.get('animationType', 0),
            'rowMode': uv_mod.get('rowMode', 0),
        }

    if size_mod.get('enabled'):
        size_curve = size_mod.get('curve', {})
        out['sizeOverLifetime'] = {
            'mode': size_curve.get('minMaxState', 0),
            'scalar': size_curve.get('scalar', 1),
            'minScalar': size_curve.get('minScalar', 1),
            'curve': animation_curve(size_curve.get('maxCurve', {})),
            'separateAxes': bool(size_mod.get('separateAxes', 0)),
        }

    return out


def material_data(mat_pid):
    mat = read(mat_pid)
    if not mat:
        return None
    saved = mat.get('m_SavedProperties', {})
    floats = {n: v for n, v in saved.get('m_Floats', [])}
    colors = {n: color(v) for n, v in saved.get('m_Colors', [])}
    textures = {}
    for name, tval in saved.get('m_TexEnvs', []):
        tex_pid = tval.get('m_Texture', {}).get('m_PathID', 0)
        tex = read(tex_pid) if tex_pid in by_pid else None
        textures[name] = {
            'file': tex.get('m_Name') if tex else None,
            'scale': vec(tval.get('m_Scale', {}), 'x', 'y', default=1),
            'offset': vec(tval.get('m_Offset', {}), 'x', 'y', default=0),
        }
    shader_ref = mat.get('m_Shader', {})
    shader_name = None
    if shader_ref.get('m_PathID'):
        sh = read(shader_ref['m_PathID'])
        if sh:
            shader_name = sh.get('m_ParsedForm', {}).get('m_Name') or sh.get('m_Name')
    return {
        'name': mat.get('m_Name'),
        'shader': shader_name,
        'floats': floats,
        'colors': colors,
        'textures': textures,
    }


def renderer_data(comp):
    out = {
        'renderMode': comp.get('m_RenderMode', 0),
        'sortMode': comp.get('m_SortMode', 0),
        'alignment': comp.get('m_RenderAlignment', 0),
        'lengthScale': comp.get('m_LengthScale', 0),
        'allowRoll': bool(comp.get('m_AllowRoll', 0)),
        'maxParticleSize': comp.get('m_MaxParticleSize', 0),
    }
    mats = comp.get('m_Materials', []) or []
    if mats:
        mp = mats[0].get('m_PathID', 0)
        if mp:
            out['material'] = material_data(mp)
    return out


def transform_data(comp):
    return {
        'localPosition': vec(comp.get('m_LocalPosition', {}), 'x', 'y', 'z'),
        'localRotation': vec(comp.get('m_LocalRotation', {}), 'x', 'y', 'z', 'w'),
        'localScale': vec(comp.get('m_LocalScale', {}), 'x', 'y', 'z'),
        'anchoredPosition': vec(comp.get('m_AnchoredPosition', {}), 'x', 'y'),
        'sizeDelta': vec(comp.get('m_SizeDelta', {}), 'x', 'y'),
        'pivot': vec(comp.get('m_Pivot', {}), 'x', 'y'),
    }


def walk(pid, depth=0):
    go = read(pid)
    if not go:
        return None

    layer = {
        'name': go.get('m_Name'),
        'active': bool(go.get('m_IsActive', 1)),
        'depth': depth,
        'children': [],
    }

    rt_pid = None
    for c in go.get('m_Component', []):
        cpid = c['component']['m_PathID']
        t = type_of(cpid)
        comp = read(cpid)
        if not comp:
            continue
        if t in ('Transform', 'RectTransform'):
            layer['transform'] = transform_data(comp)
            rt_pid = cpid
        elif t == 'ParticleSystem':
            layer['particle'] = particle_module(comp)
        elif t == 'ParticleSystemRenderer':
            layer['renderer'] = renderer_data(comp)

    if rt_pid:
        rt = read(rt_pid)
        for ch in rt.get('m_Children', []):
            cht = read(ch['m_PathID'])
            if cht and cht.get('m_GameObject'):
                child = walk(cht['m_GameObject']['m_PathID'], depth + 1)
                if child:
                    layer['children'].append(child)

    return layer


def flatten_layers(layer, out, parent_name=''):
    full_name = layer['name'] if not parent_name else f'{parent_name}/{layer["name"]}'
    if 'renderer' in layer and layer['renderer'].get('material'):
        out.append({
            'name': full_name,
            'depth': layer['depth'],
            'transform': layer.get('transform', {}),
            'particle': layer.get('particle', {}),
            'renderer': layer['renderer'],
        })
    for child in layer.get('children', []):
        flatten_layers(child, out, full_name)


def collect_roots():
    """Map prefab.name → root GameObject path_id from the AssetBundle index."""
    roots = {}
    for obj in env.objects:
        if obj.type.name != 'AssetBundle':
            continue
        ab = obj.read_typetree()
        for path, info in ab['m_Container']:
            if path.endswith('.prefab'):
                key = path.rsplit('/', 1)[-1].replace('.prefab', '')
                roots[key] = info['asset']['m_PathID']
        break
    return roots


def slug_to_pretty(slug: str) -> str:
    """fx_ui_character_list_demi → FX_UI_Character_List_Demi (canonical Unity name)."""
    parts = slug.split('_')
    out = []
    for p in parts:
        # Numeric suffixes stay as-is. Letters: title-case but keep all-caps for FX/UI.
        if p.isdigit():
            out.append(p)
        elif p.upper() in {'FX', 'UI'}:
            out.append(p.upper())
        else:
            out.append(p.capitalize())
    return '_'.join(out)


roots = collect_roots()
target_roots = {k: v for k, v in roots.items() if k.startswith('fx_ui_character_list_')}
print(f'Found {len(target_roots)} character_list prefabs')

written = []
for slug, pid in sorted(target_roots.items()):
    tree = walk(pid)
    flat = []
    flatten_layers(tree, flat)

    pretty_name = slug_to_pretty(slug)
    descriptor = {
        'name': pretty_name,
        'rect': {
            'size': tree.get('transform', {}).get('sizeDelta', [100, 100]),
            'pivot': tree.get('transform', {}).get('pivot', [0.5, 0.5]),
        },
        'layers': flat,
    }

    out_path = OUT_DIR / f'{slug}.json'
    out_path.write_text(json.dumps(descriptor, indent=2, ensure_ascii=False), encoding='utf-8')
    written.append((pretty_name, slug, len(flat)))
    print(f'  {slug}.json ({len(flat)} layers, {pretty_name})')

# Inventory all referenced textures so the user can verify public/images/fx/ has them all.
referenced_textures = set()
for _, slug, _ in written:
    desc = json.loads((OUT_DIR / f'{slug}.json').read_text(encoding='utf-8'))
    for layer in desc['layers']:
        for tex in layer['renderer'].get('material', {}).get('textures', {}).values():
            if tex.get('file'):
                referenced_textures.add(tex['file'])

public_dir = ROOT / 'public/images/fx'
missing = sorted(t for t in referenced_textures if not (public_dir / f'{t}.webp').exists())
if missing:
    print(f'\n⚠ Missing textures (need to be exported to public/images/fx/):')
    for t in missing:
        print(f'  - {t}.webp')
else:
    print(f'\n✓ All {len(referenced_textures)} referenced textures present in public/images/fx/')
