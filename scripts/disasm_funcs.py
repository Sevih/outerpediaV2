"""
Generic disasm-N-instructions tool for arbitrary function VAs in libil2cpp.so.
Resolves bl/b targets via script.json symbol map and float ldr targets via
.rodata reads.

Usage: python disasm_funcs.py <VA_HEX> [count=200]
"""
import sys, struct, json, os
from capstone import Cs, CS_ARCH_ARM64, CS_MODE_ARM

sys.stdout.reconfigure(encoding="utf-8")

SO = "C:/Users/Sevih/Downloads/Il2CppDumper-net7-win-v6.7.46/libil2cpp.so"
SCRIPT = "C:/Users/Sevih/Downloads/Il2CppDumper-net7-win-v6.7.46/script.json"

# Build symbol map
with open(SCRIPT, "r", encoding="utf-8") as f:
    script = json.load(f)
sym = {}
for m in script.get("ScriptMethod", []):
    addr = m.get("Address", 0)
    if addr:
        sym[addr] = m.get("Name", "")

def vaddr_to_offset(va):
    with open(SO, "rb") as f:
        f.seek(0x20)
        e_phoff, = struct.unpack("<Q", f.read(8))
        f.seek(0x36)
        e_phentsize, e_phnum = struct.unpack("<HH", f.read(4))
        f.seek(e_phoff)
        for _ in range(e_phnum):
            ph = f.read(e_phentsize)
            p_type, _, p_offset, p_vaddr, _, p_filesz, _, _ = struct.unpack("<IIQQQQQQ", ph[:56])
            if p_type == 1 and p_vaddr <= va < p_vaddr + p_filesz:
                return p_offset + (va - p_vaddr)
    return None

def read_at(va, n):
    off = vaddr_to_offset(va)
    if off is None: return None
    with open(SO, "rb") as f:
        f.seek(off)
        return f.read(n)

def read_float(va):
    data = read_at(va, 4)
    if data is None: return None
    return struct.unpack("<f", data)[0]

def disasm(va, count=200):
    code = read_at(va, count * 4 + 64)
    md = Cs(CS_ARCH_ARM64, CS_MODE_ARM)
    insns = list(md.disasm(code, va))

    # Track adrp registers to resolve adrp+ldr float loads.
    adrp_map = {}  # reg → adrp_target

    for i, ins in enumerate(insns):
        if i >= count: break
        line = f"  0x{ins.address:08x}  {ins.mnemonic:10s} {ins.op_str}"

        # Resolve bl/b targets
        if ins.mnemonic in ("bl", "b") and ins.op_str.startswith("#"):
            try:
                tgt = int(ins.op_str.lstrip("#"), 0)
                if tgt in sym:
                    line += f"   ; → {sym[tgt]}"
            except ValueError:
                pass

        # Track adrp
        if ins.mnemonic == "adrp":
            try:
                parts = ins.op_str.split(", #")
                reg = parts[0].strip()
                tgt = int(parts[1], 0)
                adrp_map[reg] = tgt
            except (IndexError, ValueError):
                pass

        # Resolve ldr s/d from adrp register
        if ins.mnemonic in ("ldr",) and ("[" in ins.op_str):
            # Match patterns like: s9, [x9, #0x38]
            try:
                op = ins.op_str
                if "[" in op and ", #" in op:
                    before, after = op.split("[", 1)
                    reg_part, off_part = after.rstrip("]").split(", #")
                    reg = reg_part.strip()
                    off = int(off_part.rstrip("]"), 0)
                    base = adrp_map.get(reg)
                    if base and (op.startswith("s") or " s" in op[:3]):
                        addr = base + off
                        val = read_float(addr)
                        if val is not None and abs(val) < 1e10:
                            line += f"   ; load f32 from 0x{addr:x} = {val}"
            except (ValueError, IndexError):
                pass

        # Decode mov w*, #0x... as f32 bitcast (typical: 0x447a0000 etc.)
        if ins.mnemonic == "mov" and ", #0x" in ins.op_str:
            try:
                imm = int(ins.op_str.split(", #")[1], 0)
                if imm > 0x10000000 and imm < 0xffffffff:
                    val = struct.unpack("<f", struct.pack("<I", imm))[0]
                    if 1e-6 < abs(val) < 1e6:
                        line += f"   ; bits as f32 = {val}"
            except (ValueError, IndexError):
                pass

        print(line)

if __name__ == "__main__":
    va = int(sys.argv[1], 0)
    count = int(sys.argv[2]) if len(sys.argv) > 2 else 200
    print(f"Disasm @ 0x{va:x} ({count} insns):")
    disasm(va, count)
