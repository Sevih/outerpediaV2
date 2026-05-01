"""
Disassemble the multi-hit damage path in libil2cpp.so.

Goal: explain why Maxwell S1 (MaxHitCount=3) consistently overshoots our v2
calc by ~0.108% (~1/per_hit_damage). The single-hit path matches exactly,
so the divergence is in the multi-hit application logic.

Targets to inspect:
  - CFormula.CalcDamage              VA 0x2B53EC8  (outer entry)
  - g__CalcDamage|17_0               VA 0x2B54660  (inner helper, per-hit)
  - CCharacterBattle.UseSkill        VA 0x262E838  (caller)

Strategy:
  1. Find call sites where MaxHitCount is loaded (immediate or struct offset).
  2. Identify the per-hit loop pattern (cbz/cbnz + b on counter).
  3. Look for floor/round operations that differ between single and multi hit
     (frintm = floor, fcvtms = float-to-int rounding mode-floor).

Usage: python scripts/disasm_multihit.py
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
    raise ValueError(f"VA 0x{va:x} not in any PT_LOAD")


def read_bytes(va, n):
    off = vaddr_to_offset(va)
    with open(SO, "rb") as f:
        f.seek(off)
        return f.read(n)


def disasm_range(va, n_bytes, label=""):
    code = read_bytes(va, n_bytes)
    md = Cs(CS_ARCH_ARM64, CS_MODE_ARM)
    md.detail = True

    print(f"\n{'='*84}")
    print(f"  {label}  @ VA 0x{va:x}  ({n_bytes} bytes)")
    print(f"{'='*84}")
    out = []
    for insn in md.disasm(code, va):
        out.append(insn)
    return out


def print_disasm(insns, highlight_pred=None):
    for insn in insns:
        marker = ""
        if highlight_pred and highlight_pred(insn):
            marker = "  <<<"
        print(f"  0x{insn.address:08x}: {insn.mnemonic:<10} {insn.op_str}{marker}")


def find_calls_to(insns, target_va):
    """Return addresses of bl/b instructions targeting `target_va`."""
    hits = []
    for insn in insns:
        if insn.mnemonic in ("bl", "b") and insn.op_str.startswith("#"):
            try:
                t = int(insn.op_str.lstrip("#"), 0)
                if t == target_va:
                    hits.append(insn.address)
            except ValueError:
                pass
    return hits


def find_branches(insns):
    """Collect every conditional branch target — used to map basic blocks."""
    out = []
    for insn in insns:
        if insn.mnemonic.startswith(("b.", "cbz", "cbnz", "tbz", "tbnz")):
            parts = insn.op_str.split(",")
            tgt = parts[-1].strip().lstrip("#")
            try:
                out.append((insn.address, insn.mnemonic, int(tgt, 0)))
            except ValueError:
                pass
    return out


# ── 1. CFormula.CalcDamage (outer) ─────────────────────────────────────
print("\n" + "#"*84)
print("# 1. CFormula.CalcDamage @ 0x2B53EC8 — entry point, look for MaxHitCount load")
print("#"*84)

calc_outer = disasm_range(0x2B53EC8, 0x800, "CFormula.CalcDamage")

# Highlight: ldr Wn, [Xm, #offset] — struct field reads (CharacterDamageTemplet
# offsets are typically MaxHitCount @ small offset like 0x10..0x40).
# Also highlight bl/b calls (subroutine invocations).
def highlight_calc(insn):
    m = insn.mnemonic
    o = insn.op_str
    if m in ("bl", "b") and o.startswith("#0x"):
        return True
    if m.startswith(("ldr", "ldp")) and "[" in o and "#" in o:
        return True
    if m in ("frintm", "fcvtms"):
        return True
    return False

# Print full outer function (up to ret/end)
print_disasm(calc_outer, highlight_calc)


# ── 2. Inner helper g__CalcDamage|17_0 ─────────────────────────────────
print("\n" + "#"*84)
print("# 2. g__CalcDamage|17_0 @ 0x2B54660 — inner per-hit helper")
print("#"*84)

calc_inner = disasm_range(0x2B54660, 0x600, "g__CalcDamage|17_0")
print_disasm(calc_inner[:240], highlight_calc)


# ── 3. UseSkill caller — look for MaxHitCount loop ──────────────────────
print("\n" + "#"*84)
print("# 3. CCharacterBattle.UseSkill @ 0x262E838 — caller, look for hit-loop")
print("#"*84)
print("# (Showing instructions around the CalcDamage call site)")

# UseSkill is huge — disasm a window around the CalcDamage call sites.
# Spec note says CalcDamage is called at offset +0xBE8 = 0x262F420
# but that's the AddCheckEnemyTeamDecreaseDamageRate call. The actual
# CalcDamage call is somewhere nearby. Scan for it.
useskill = disasm_range(0x262E838, 0x2000, "UseSkill (window 0..0x2000)")
calls_to_calcdmg = find_calls_to(useskill, 0x2B53EC8)
print(f"\n  Calls to CFormula.CalcDamage (0x2B53EC8) from UseSkill: {len(calls_to_calcdmg)}")
for a in calls_to_calcdmg:
    print(f"    @ 0x{a:08x}")

calls_to_inner = find_calls_to(useskill, 0x2B54660)
print(f"  Calls to g__CalcDamage|17_0 (0x2B54660): {len(calls_to_inner)}")
for a in calls_to_inner:
    print(f"    @ 0x{a:08x}")

# Around each call to CalcDamage, dump 32 instructions before/after
for a in calls_to_calcdmg[:2]:
    rel = a - 0x262E838
    start_idx = max(0, next(i for i, ins in enumerate(useskill) if ins.address >= a) - 32)
    end_idx = min(len(useskill), start_idx + 64)
    print(f"\n  Window around call @ 0x{a:08x} (UseSkill+0x{rel:x}):")
    print_disasm(useskill[start_idx:end_idx], highlight_calc)
