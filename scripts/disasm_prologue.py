"""
Disasm just the prologue of FindBuffAdditionalDamage to identify which floating
constants get loaded into s9, s10, s11, s12 (which the per-type handlers use).
"""
import sys, struct
from capstone import Cs, CS_ARCH_ARM64, CS_MODE_ARM

sys.stdout.reconfigure(encoding="utf-8")

SO = "C:/Users/Sevih/Downloads/Il2CppDumper-net7-win-v6.7.46/libil2cpp.so"

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
    raise ValueError("VA not found")

def read_at(va, n):
    off = vaddr_to_offset(va)
    with open(SO, "rb") as f:
        f.seek(off)
        return f.read(n)

# Disasm prologue (first ~100 instructions)
va = 0x2637548
code = read_at(va, 0x600)

md = Cs(CS_ARCH_ARM64, CS_MODE_ARM)

print(f"Prologue of FindBuffAdditionalDamage @ 0x{va:x}:")
for i, ins in enumerate(md.disasm(code, va)):
    if i > 110: break
    print(f"  0x{ins.address:08x}  {ins.mnemonic:10s} {ins.op_str}")

# Read the float constants at the addresses referenced
# Common pattern: adrp xN, #BASE; ldr sM, [xN, #OFFSET]
print("\nFloat constants likely referenced (load from .rodata at 0x1034000-0x1035000):")
for addr in [0x1033e14, 0x1033e70, 0x1034038, 0x1034064, 0x1034074]:
    data = read_at(addr, 4)
    val = struct.unpack("<f", data)[0]
    print(f"  0x{addr:x} = {val}")
