"""
Disassemble FindBuffAdditionalDamage / FindBuffDamageReduce in libil2cpp.so
to extract per-BT_* branch behavior.

Outputs the cmp constants and the basic block following each cmp, so we can
map each BT_DMG_* type (83..105) to its aggregation logic.

Usage: python scripts/disasm_buff_funcs.py
"""
import sys, struct
from capstone import Cs, CS_ARCH_ARM64, CS_MODE_ARM

sys.stdout.reconfigure(encoding="utf-8")

SO = "C:/Users/Sevih/Downloads/Il2CppDumper-net7-win-v6.7.46/libil2cpp.so"

# ELF program-header parsing (manual VA→file-offset map)
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
    raise ValueError(f"VA 0x{va:x} not in any PT_LOAD")

def read_func(va, max_bytes=0x4000):
    off = vaddr_to_offset(va)
    with open(SO, "rb") as f:
        f.seek(off)
        return f.read(max_bytes)

def find_function_end(code, start_va):
    """Find function end by scanning for the typical epilogue (ret) followed by alignment."""
    md = Cs(CS_ARCH_ARM64, CS_MODE_ARM)
    last_ret = 0
    for insn in md.disasm(code, start_va):
        if insn.mnemonic == "ret":
            last_ret = insn.address - start_va + insn.size
            # Don't return immediately — there may be inner branches; continue.
            # For these functions, the canonical end is the LAST ret followed by
            # zero/nop padding. Take the first ret that's followed by another
            # function's prologue (not just by another bb).
        if insn.address - start_va > max(0x4000, last_ret + 0x100):
            break
    return last_ret if last_ret else len(code)

def disasm_function(va, name):
    code = read_func(va, 0x6000)
    end = find_function_end(code, va)
    code = code[:end]

    md = Cs(CS_ARCH_ARM64, CS_MODE_ARM)
    md.detail = True

    print(f"\n{'='*78}")
    print(f"  {name}  @ VA 0x{va:x}  ({end} bytes)")
    print(f"{'='*78}")

    cmps = []
    for insn in md.disasm(code, va):
        m = insn.mnemonic
        op = insn.op_str
        # Track every cmp Wn, #imm — these are the BT_* enum dispatch points.
        if m == "cmp" and "#" in op:
            try:
                imm_str = op.split("#")[1].split(",")[0].strip()
                imm = int(imm_str, 0)
                cmps.append((insn.address, imm, op))
            except ValueError:
                pass

    print(f"  cmp #imm constants found: {len(cmps)}")
    # Group cmps by imm value for the BT_* enum ranges (likely 80..150).
    from collections import Counter
    counter = Counter(imm for _, imm, _ in cmps)
    bt_range = sorted(v for v in counter if 1 <= v <= 200)
    print(f"  cmp imm values (in BT_* range 1..200): {bt_range}")
    print(f"  cmp imm values (full): {sorted(counter.keys())}")

    return code, end

if __name__ == "__main__":
    funcs = [
        (0x2637548, "FindBuffAdditionalDamage"),
        (0x2638638, "FindBuffDamageReduce"),
        (0x2638adc, "GetBuffDamgeFinalReduce"),
    ]
    for va, name in funcs:
        disasm_function(va, name)
