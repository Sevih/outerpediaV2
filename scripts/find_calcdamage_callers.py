"""
Scan the entire .text section for `bl #0x2B53EC8` (calls to CFormula.CalcDamage).
Locates every caller — narrows down where multi-hit is orchestrated.

ARM64 BL encoding: 0b100101 (6-bit opcode) | imm26 (26-bit signed offset, 4-byte aligned).
Match: (instr >> 26) == 0x25 (94 = 0b100101 → 0x25).
Target VA = caller_VA + sign_extended(imm26 << 2).
"""
import sys, struct
from capstone import Cs, CS_ARCH_ARM64, CS_MODE_ARM

sys.stdout.reconfigure(encoding="utf-8")

SO = "C:/Users/Sevih/Downloads/Il2CppDumper-net7-win-v6.7.46/libil2cpp.so"
TARGET = 0x2B53EC8


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
                return p_offset, p_vaddr, p_filesz
    raise ValueError(f"VA 0x{va:x} not in any PT_LOAD")


# Find PT_LOAD for the target VA — use that segment's bounds for full scan.
off, base_va, fsize = vaddr_to_offset(TARGET)
print(f"PT_LOAD: file_offset=0x{off - (TARGET - base_va):x}, VA_start=0x{base_va:x}, size=0x{fsize:x}")

# Read entire executable segment (text)
seg_off = off - (TARGET - base_va)
with open(SO, "rb") as f:
    f.seek(seg_off)
    text = f.read(fsize)

print(f"Scanning {len(text)} bytes for BL → 0x{TARGET:x}…\n")

callers = []
# Iterate all 4-byte aligned instructions
for i in range(0, len(text) - 3, 4):
    instr, = struct.unpack("<I", text[i:i+4])
    if (instr >> 26) != 0x25:  # not a BL
        continue
    imm26 = instr & 0x3FFFFFF
    if imm26 & (1 << 25):     # sign-extend
        imm26 -= (1 << 26)
    caller_va = base_va + i
    target_va = caller_va + (imm26 << 2)
    if target_va == TARGET:
        callers.append(caller_va)

print(f"Found {len(callers)} calls to 0x{TARGET:x}:")
for ca in callers:
    print(f"  caller @ 0x{ca:x}")

# For each caller, disasm 64 instr around it to identify the function context
print()
md = Cs(CS_ARCH_ARM64, CS_MODE_ARM)
for ca in callers[:6]:
    start = max(0, ca - base_va - 32 * 4)
    chunk = text[start:start + 64 * 4]
    insns = list(md.disasm(chunk, base_va + start))
    print(f"\n{'='*84}\n  Window around caller @ 0x{ca:x}\n{'='*84}")
    for ins in insns:
        marker = "  <<< CALL TO CalcDamage" if ins.address == ca else ""
        # Highlight loop / hit-count related ops
        m = ins.mnemonic
        o = ins.op_str
        extra = ""
        if m == "ldr" and "[" in o and ", #0x" in o:
            extra = "  [field load]"
        if m in ("cbz", "cbnz", "b.lt", "b.le", "b.ge", "b.gt", "b.eq", "b.ne", "b.lo", "b.hi", "b.hs"):
            extra = "  [branch]"
        if m in ("frintm", "fcvtms"):
            extra = "  [floor]"
        print(f"  0x{ins.address:08x}: {ins.mnemonic:<10} {ins.op_str}{marker}{extra}")
