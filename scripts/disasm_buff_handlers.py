"""
For FindBuffAdditionalDamage / FindBuffDamageReduce: capture the basic block
following each `cmp Wn, #BT_*` so we see what each branch actually does.

The strategy:
1. Disasm the function linearly.
2. For each `cmp Wn, #imm` where imm ∈ [80..150], find the next `b.cond` and
   record both the imm and the branch target VA.
3. Disasm 40 instructions starting at each branch target — that's the handler.
4. Look for tell-tale instructions: `bl FindBuff…`, `fmadd`, `fadd`, `fmul`,
   `ldr s*`, `str s*` to identify the aggregation pattern.
5. Also annotate `bl` calls with the resolved symbol from script.json.
"""
import sys, struct, json
from capstone import Cs, CS_ARCH_ARM64, CS_MODE_ARM

sys.stdout.reconfigure(encoding="utf-8")

SO = "C:/Users/Sevih/Downloads/Il2CppDumper-net7-win-v6.7.46/libil2cpp.so"
SCRIPT = "C:/Users/Sevih/Downloads/Il2CppDumper-net7-win-v6.7.46/script.json"

# Build symbol map (VA → Name) for resolving bl targets.
print("Loading script.json…")
with open(SCRIPT, "r", encoding="utf-8") as f:
    script = json.load(f)
sym = {}
for m in script.get("ScriptMethod", []):
    addr = m.get("Address", 0)
    if addr:
        sym[addr] = m.get("Name", "")
print(f"  {len(sym)} symbols loaded")

# ELF program headers → VA→offset map
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

def read_func(va, max_bytes=0x6000):
    off = vaddr_to_offset(va)
    with open(SO, "rb") as f:
        f.seek(off)
        return f.read(max_bytes)

# Disasm and collect:
#   - linear instructions
#   - cmp_imm sites (with their next b.cond target)
def collect(va, size=0x5000):
    code = read_func(va, size)
    md = Cs(CS_ARCH_ARM64, CS_MODE_ARM)
    md.detail = False
    insns = list(md.disasm(code, va))
    return insns, code

def show_handler(insns, idx, n=30):
    """Pretty-print n instructions starting at insns[idx]."""
    out = []
    for i in range(idx, min(idx + n, len(insns))):
        ins = insns[i]
        line = f"    0x{ins.address:08x}  {ins.mnemonic:10s} {ins.op_str}"
        # Annotate bl with symbol
        if ins.mnemonic == "bl" and ins.op_str.startswith("#"):
            try:
                tgt = int(ins.op_str.lstrip("#"), 0)
                if tgt in sym:
                    line += f"   ; → {sym[tgt]}"
            except ValueError:
                pass
        out.append(line)
        # Stop on ret / b (unconditional branch out)
        if ins.mnemonic in ("ret",):
            break
    return "\n".join(out)

def find_handler(insns, va_target):
    for i, ins in enumerate(insns):
        if ins.address == va_target:
            return i
    return -1

def analyze_function(va, name, types_of_interest):
    print(f"\n{'='*100}")
    print(f"  {name}  @ VA 0x{va:x}")
    print(f"{'='*100}")
    insns, code = collect(va)

    # Find cmp imm,#N → next b.cond pattern
    for i, ins in enumerate(insns):
        if ins.mnemonic != "cmp" or "#" not in ins.op_str:
            continue
        try:
            imm = int(ins.op_str.split("#")[1].split(",")[0].strip(), 0)
        except ValueError:
            continue
        if imm not in types_of_interest:
            continue

        # Look at the next instruction (typically b.eq / b.ne / b.ls / b.cc).
        if i + 1 >= len(insns):
            continue
        nxt = insns[i + 1]
        if not nxt.mnemonic.startswith("b."):
            continue
        try:
            tgt = int(nxt.op_str.lstrip("#"), 0)
        except ValueError:
            continue

        print(f"\n--- BT_* type = {imm}  (cmp at 0x{ins.address:x}, branch {nxt.mnemonic} → 0x{tgt:x}) ---")
        # The matched handler is the FALLTHROUGH (when b.ne misses → cmp passed).
        # The b.ne target is the NEXT cmp dispatch — skip it for clarity.
        print(f"  matched-handler (fallthrough after {nxt.mnemonic}):")
        print(show_handler(insns, i + 2, 50))

# Types we care about
ADD_TYPES = list(range(83, 106)) + [140, 141]   # BT_DMG_* + Ame variants
RED_TYPES = [107, 110, 111, 112, 113, 145, 2]

if __name__ == "__main__":
    analyze_function(0x2637548, "FindBuffAdditionalDamage", set(ADD_TYPES))
    analyze_function(0x2638638, "FindBuffDamageReduce",     set(RED_TYPES))
