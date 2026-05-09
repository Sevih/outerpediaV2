"""Try to extract decompiled shader via the m_Script (CGPROGRAM source) or via
Unity's compiled SubProgramBlob (which may have textual disasm we can read)."""
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
    pf = tt.get('m_ParsedForm', {})
    # Look at the pass-level program source
    subshaders = pf.get('m_SubShaders', [])
    for i, ss in enumerate(subshaders):
        for j, ps in enumerate(ss.get('m_Passes', [])):
            print(f'=== SubShader {i} Pass {j} ===')
            print('Pass keys:', list(ps.keys())[:30])
            # Look for program source
            for prog_key in ('progVertex', 'progFragment', 'progGeometry', 'progHull', 'progDomain'):
                prog = ps.get(prog_key)
                if not prog:
                    continue
                sub = prog.get('m_SubPrograms', [])
                print(f'  {prog_key}: {len(sub)} subprograms')
                for k, sp in enumerate(sub[:3]):
                    print(f'    SubProg {k}: keys={list(sp.keys())[:15]}')
            # progVertex/progFragment may be older format. Try newer field:
            if 'progVertex' not in ps:
                # Newer Unity
                pass
            # Check m_Tags/state for blend
            state = ps.get('m_State', {})
            blend0 = state.get('rtBlend0', {})
            print(f'  Blend: src={blend0.get("srcBlend")} dst={blend0.get("dstBlend")} op={blend0.get("blendOp")}')
            print(f'  ZWrite: {state.get("zWrite")}')
            print(f'  ZTest: {state.get("zTest")}')
            print(f'  Cull: {state.get("culling")}')
    # Also try the m_Script field (raw shader source if it's a Surface shader)
    obj = o.read()
    script = getattr(obj, 'm_Script', None)
    print(f'\nm_Script length: {len(script) if script else 0}')
    if script and len(script) < 100000:
        print('--- m_Script ---')
        # Could be bytes or string
        text = script.decode('utf-8', errors='replace') if isinstance(script, bytes) else script
        print(text[:3000])
    # Last resort: dump the SubProgramBlob's first chunk and grep for shader source
    blob = obj.m_SubProgramBlob if hasattr(obj, 'm_SubProgramBlob') else None
    if blob:
        print(f'\nSubProgramBlob: {len(blob)} bytes')
        # Save for later inspection
        with open('tmp/shader_subprogram.bin', 'wb') as f:
            f.write(blob)
        print('Wrote tmp/shader_subprogram.bin')
    break
