import UnityPy
import sys
sys.stdout.reconfigure(encoding='utf-8')

env = UnityPy.load('datamine/files/bundles/992c5320cae80f9b78114e07dff12057')

for o in env.objects:
    if o.type.name != 'Shader':
        continue
    tt = o.read_typetree()
    name = tt.get('m_ParsedForm', {}).get('m_Name') or tt.get('m_Name', '')
    if 'S_Assemble_Particle_UI' not in name:
        continue
    print('Found:', name)
    pf = tt.get('m_ParsedForm', {})
    # Properties
    props = pf.get('m_PropInfo', {}).get('m_Props', [])
    print(f'Properties ({len(props)}):')
    for p in props:
        attrs = p.get('m_Attributes', [])
        print(f"  {p.get('m_Name')} ({p.get('m_Description')}) type={p.get('m_Type')} flags={p.get('m_Flags')} default={p.get('m_DefValue')}")
    # SubShaders / passes
    subshaders = pf.get('m_SubShaders', [])
    print(f'SubShaders: {len(subshaders)}')
    for i, ss in enumerate(subshaders):
        passes = ss.get('m_Passes', [])
        print(f'  SubShader {i}: {len(passes)} passes')
        for j, ps in enumerate(passes):
            print(f'    Pass {j}: name={ps.get("m_Name", "")} state.blend={ps.get("m_State", {}).get("rtBlend0", {}).get("srcBlend"), ps.get("m_State", {}).get("rtBlend0", {}).get("dstBlend")}')
            tags = ps.get('m_State', {}).get('m_Tags', {}).get('tags', [])
            print(f'      tags: {tags}')
    obj = o.read()
    out = f'tmp/shader_S_Assemble_Particle_UI.txt'
    methods = [m for m in dir(obj) if not m.startswith('_')]
    print(f'\nObject methods: {methods}')
    # Try save
    try:
        if hasattr(obj, 'export'):
            data = obj.export()
            print('export() returned type:', type(data).__name__, 'len:', len(data) if hasattr(data,'__len__') else '?')
            if isinstance(data, str):
                open(out,'w',encoding='utf-8').write(data)
                print('Wrote', out)
            elif isinstance(data, bytes):
                open(out,'wb').write(data)
                print('Wrote bytes to', out)
    except Exception as e:
        print('export() error:', e)
    break
