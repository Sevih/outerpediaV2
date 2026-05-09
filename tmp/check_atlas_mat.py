"""Inspect material asset for atlas/star particles to see cross-bundle
texture references."""
import UnityPy
import sys
sys.stdout.reconfigure(encoding='utf-8')

env = UnityPy.load('datamine/files/bundles/9e6fbb19710c5ca23bef34edc94d3e59')

target_names = {
    'M_FX_Atlas_01_Add_01_rainbow_UI',
    'M_FX_Atlas_01_Add_04_pow_UIParticle',
    'M_FX_Atlas_01_Add_01_UI',
    'M_FX_Atlas_01_Add_02_UI',
    'M_FX_Star_Glow_01_UIParticle',
    'M_FX_UI_2000085_Bubble',
    'M_FX_UI_Char_List_2000086',  # the 'web' material for 2000086
}

for o in env.objects:
    if o.type.name != 'Material':
        continue
    mat = o.read_typetree()
    name = mat.get('m_Name', '')
    if name not in target_names:
        continue
    print(f'\n=== {name} ===')
    saved = mat.get('m_SavedProperties', {})
    for tname, tval in saved.get('m_TexEnvs', []):
        tex_ref = tval.get('m_Texture', {})
        fid = tex_ref.get('m_FileID', 0)
        pid = tex_ref.get('m_PathID', 0)
        scale = tval.get('m_Scale', {})
        offset = tval.get('m_Offset', {})
        print(f'  {tname}: m_FileID={fid} m_PathID={pid} ST=({scale.get("x",1):g},{scale.get("y",1):g}) off=({offset.get("x",0):g},{offset.get("y",0):g})')
