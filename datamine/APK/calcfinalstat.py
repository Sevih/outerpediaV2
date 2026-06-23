import capstone, struct

LIB = "OUTERPLANE+-+Strategy+Anime_1.4.9_APKPure/config.arm64_v8a/lib/arm64-v8a/libil2cpp.so"

with open(LIB, "rb") as f:
    data = f.read()

e_phoff = struct.unpack_from("<Q", data, 0x20)[0]
e_phentsize = struct.unpack_from("<H", data, 0x36)[0]
e_phnum = struct.unpack_from("<H", data, 0x38)[0]
segs = []
for i in range(e_phnum):
    base = e_phoff + i * e_phentsize
    p_type, _flags, p_offset, p_vaddr, _paddr, p_filesz, p_memsz, _align = struct.unpack_from("<IIQQQQQQ", data, base)
    if p_type == 1:
        segs.append((p_vaddr, p_filesz, p_offset))

def va_to_off(va):
    for v, fs, off in segs:
        if v <= va < v + fs:
            return off + (va - v)
    return None

# Locate boundary between functions. CalcBattlePower starts at 0x2C59EE4 per prior asm.
# So CalcFinalStat ends at 0x2C59EE0 (one inst before). Let's find its start by walking
# back from there until we find a `ret` followed by the next function start.
md = capstone.Cs(capstone.CS_ARCH_ARM64, capstone.CS_MODE_ARM)
md.detail = False

# Disassemble 256 bytes ending just before 0x2C59EE4
start_va = 0x2C59E00
end_va = 0x2C59EE4
off = va_to_off(start_va)
print(f"Disassembly from {hex(start_va)} to {hex(end_va)}:")
for ins in md.disasm(data[off:off + (end_va - start_va)], start_va):
    print(f"  {hex(ins.address)}: {ins.mnemonic:8s} {ins.op_str}")
