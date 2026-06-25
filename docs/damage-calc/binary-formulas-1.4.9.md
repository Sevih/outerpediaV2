# Combat Formulas — Binary Reverse-Engineering (Outerplane 1.4.9)

> **Audience.** Anyone needing the *ground-truth* combat math straight from the
> game binary: damage, defense mitigation, and the Effectiveness-vs-Resilience
> debuff-resist roll. This is a raw RE reference, independent of the
> `00`–`06` Damage-Calculator V3 contract docs. Where the two disagree, **the
> binary wins** — every claim here is backed by a disassembled instruction.
>
> **Source.** APK `OUTERPLANE - Strategy Anime 1.4.9 (APKPure)`, native lib
> `lib/arm64-v8a/libil2cpp.so` (ARM64, stripped), cross-referenced with the
> Il2CppDumper output `datamine/APK/dumped/dump.cs`.
>
> **Method.** `dump.cs` gives the managed class/method layout and, for each
> method, `RVA` (= virtual address) and file `Offset`. The `.so` is
> disassembled at those offsets with Capstone (ARM64). VA == RVA in this image;
> `va_to_off()` walks the ELF program headers. Reproduction scripts are in the
> appendix.

All the math lives in the static class **`CFormula`** (`dump.cs:285348`,
`TypeDefIndex 7258`).

| Method | RVA | Role |
|---|---|---|
| `CalcDamage(...)` | `0x2C5AD30` | outer entry; multi-hit loop, vampiric, hit-recovery |
| `<CalcDamage>g__CalcDamage\|17_0` | `0x2C5B4DC` | **inner lambda — the actual per-hit damage math** |
| `CheckDamageRate(att, def)` | `0x2C5A448` | resolves crit / glancing / invincible and **builds `_nDamageRate`** |
| `GetElementeryDamageRate(att, def)` | `0x2C5AB60` | elemental advantage multiplier |
| `CalcDamageDOT(att, def, rate, stat)` | `0x2C5BC6C` | **damage-over-time per tick** (§6) |
| `CheckResist(eff, res)` | `0x2C5A388` | **Effectiveness vs Resilience** debuff-resist roll |

Two helper conventions used everywhere:

- **`/1000` is integer (floored) division** done with the signed-div magic
  constant `0x20C49BA5E353F7CF` then `asr #7` — i.e. truncation toward zero with
  the standard rounding-fix `add x, x, x lsr #63`.
- Percentages come in two scales (this matters):
  - **Combat multipliers** (skill factor, crit damage, penetration rate,
    element rate, damage boost, final reduce …) are **per-mille (‰)**: `1000` = 100 %.
  - **Effectiveness / Resilience** (`ST_BUFF_CHANCE` / `ST_BUFF_RESIST`) are
    **integer percentage points**: `45` = 45 %. (Corroborated by the BP-formula
    RE, where EFF/RES are also used as plain integers, and by the `+100`
    constant in `CheckResist` below.)

---

## 1. Damage formula

Decoded from the inner lambda `<CalcDamage>g__CalcDamage|17_0` (`0x2C5B4DC`).
The lambda takes `(_nDamageFactor, ref displayClass)`; the display class holds
`Attacker` `[0x00]`, `Defender` `[0x08]`, `_nDamageRate` `[0x10]`.

### 1.1 Inputs (with the getter each one comes from)

| Symbol | Source (RVA) | Scale | Meaning |
|---|---|---|---|
| `ATK` | `attacker.GetAttackStat()` `0x26E02A4` | flat | final ATK (already includes ATK% buffs) |
| `F` | `_nDamageFactor` (lambda arg, parsed from `CDamageTemplet` string) | ‰ | skill hit coefficient; multi-hit = several `F` |
| `SF` | `attacker.SkillManager.GetSkillFactor()` `0x24D29A4` | ‰ | global skill-power factor (default 1000) |
| `DEF` | `defender.get_Def()` `0x27E00D8` | flat | defender defense |
| `PPR` | `attacker.get_PiercePowerRate()` `0x27E0524` | ‰ | defense penetration **rate** (capped 100 %) |
| `PP` | `attacker.get_PiercePower()` `0x27E0448` | flat | defense penetration **flat** |
| `DR` | `_nDamageRate` = `displayClass[0x10]` (built by `CheckDamageRate`, §3) | ‰ | hit rate; **crit damage is folded in here** |
| `ER` | `GetElementeryDamageRate(att,def)` `0x2C5AB60` | ‰ | element multiplier (§2) |
| `MARK` | `defender.FindBuffByType(BT_MARKING=5)` `0x26C5AB0` | flag | marked target → ×1.15 |
| `MISS` | `defender.SkillRecord.DamageRateType[0x3c] == MISSED(3)` | flag | glancing → ×`MISSED_DAMAGE_RATE_PERMILLE` (`0x28D779C`) |
| `FR` | `defender.GetBuffDamgeFinalReduce(out, att)` `0x26DF06C` | ‰ | final damage reduction |

### 1.2 Exact integer pipeline (one hit)

```text
1.  effDef_scaled = Max( DEF × (1000 − min(PPR, 1000)) − 1000 × PP ,  −999000 )
2.  base      = ATK × F × SF / 1000
3.  afterDef  = base × 1_000_000 / (effDef_scaled + 1_000_000)        ← mitigation, §2.x
4.  dmg       = afterDef × DR / 1000
5.  if MARK : dmg = dmg × 1150 / 1000                                  (+15 %)
6.  dmg       = dmg × ER / 1000
7.  if MISS : dmg = dmg × MISSED_DAMAGE_RATE_PERMILLE / 1000
8.  dmg       = dmg × (1000 − FR) / 1_000_000
9.  return Max(dmg, 1)
```

Notes:
- `Max(..., −999000)` is `Math.Max(long,long)` (`0x48A46D8`) — keeps the
  denominator in step 3 ≥ `1000`, so it never divides by zero or a negative.
- `min(PPR, 1000)`: the `(1000 − PPR)` term is `csel`-clamped to `≥ 0`, i.e.
  **penetration rate caps at 100 %**.
- The `/1_000_000` in step 8 = `/1000` (the `(1000 − FR)` per-mille reduction)
  **×** `/1000` (un-scales the residual ×1000 that `SF` carries from step 2).

### 1.3 Readable form

```text
Damage = ATK
       × (F  / 1000)              skill coefficient
       × (SF / 1000)              global skill factor (≈1.0)
       × 1000 / (EffectiveDEF + 1000)      ← defense mitigation (§2)
       × (DR / 1000)              hit rate (crit damage lives here)
       × markMult                 1.15 if target marked, else 1
       × (ER / 1000)              1.2 / 1.0 / 0.8 element
       × missMult                 MISSED_DAMAGE_RATE if glancing, else 1
       × (1 − FR/1000)            final damage reduction
       , floored, minimum 1
```

**Sanity check (numeric, all f32 floors aside):** `ATK=2000`, `F=SF=1000`,
`DEF=1000`, no pen, `DR=1000`, neutral element, `FR=0` →
`base=2_000_000`, `effDef_scaled=1_000_000`,
`afterDef = 2_000_000×1e6 / 2e6 = 1_000_000`, `dmg = 1_000_000×1000/1e6 = 1000`.
That is exactly `ATK × mitigation = 2000 × 0.5`. ✔

### 1.4 Outer `CalcDamage` (`0x2C5AD30`) wrapper

- Parses the `CDamageTemplet` factor string (`Split`/`TryParse`) → calls the
  inner lambda once per hit factor `F` (multi-hit skills).
- `out _nVampiric  = MulPermille(damage, attacker.get_Vampiric())`     (`0x27E0600`)
- `out _nHitRecovery = MulPermille(damage, attacker.get_HitHPRecovery())` (`0x27E06DC`)
- `MulPermille(v, p) = v × p / 1000` (`0x28D81C0`).
- Shared-damage redistribution via `CalcCharacterSharedDamage` (`0x2C5B778`).

---

## 2. Defense mitigation

Extracted from steps 1 & 3 above. The defense applies a single hyperbolic
multiplier to the raw damage:

```text
EffectiveDEF = DEF × (1 − min(PPR,1000)/1000) − PP        (clamped ≥ −999)
Mitigation   = 1000 / (EffectiveDEF + 1000)
```

- Implemented in scaled integer space as
  `Mitigation = 1_000_000 / (effDef_scaled + 1_000_000)` where
  `effDef_scaled = DEF×(1000−min(PPR,1000)) − 1000×PP`, `Max(…, −999000)`.
- **Without penetration:** `Mitigation = 1000 / (DEF + 1000)`.
  - `DEF = 1000` → 0.500   (−50 % damage)
  - `DEF = 2000` → 0.333
  - `DEF = 3000` → 0.250
- **Penetration order:** `PPR` (rate, ‰, ≤100 %) multiplies the defense down
  first, then `PP` (flat) is subtracted. `EffectiveDEF` may go negative (down to
  −999), which makes the multiplier *exceed* 1.0 (bonus damage) but never
  blows up.

---

## 3. Hit type & `_nDamageRate` construction — `CheckDamageRate` (`0x2C5A448`)

`CheckDamageRate(attacker, defender)` is `void`; it writes two fields on the
defender's `CSkillRecord` (`get_SkillRecord` `0x26C7224`):

- `[0x3c]` = `DamageRateType` — enum `{ NONE=0, NORMAL=1, CRITICAL=2, MISSED=3, INVINCIBLE=4 }`
- `[0x40]` = the damage rate (‰) → this becomes `_nDamageRate` (`DR`) in §1.

### 3.1 Type resolution

1. **Special states first** (world-boss / boss / infiltrate / invincible /
   counter buff checks): can force `NORMAL` with `rate = 1000`, or `INVINCIBLE`
   with `rate = 0` (these early-return, bypassing the modifiers and the min
   clamp below).
2. **Glancing roll** — `roll = GetBattleRandomRange(0,1000)`; if
   `roll ≤ defender.get_Avoid()` (`0x27E0894`) → `MISSED`, base `rate = 1000`.
3. **Crit roll** — else if `attacker.get_CriticalRate()` (`0x27E0290`) ≥ 1:
   `roll = GetBattleRandomRange(0,1000)`; if `roll ≤ CriticalRate` → `CRITICAL`,
   base `rate = attacker.get_CriticalDMGRate()` (`0x27E036C`) `−`
   `defender.get_EnemyCriticalDamageReduce()` (`0x27E12E4`).
4. **Else** → `NORMAL`, base `rate = 1000`.

> Crit *chance* is a flat `roll ≤ CRC` (no crit-resist stat on the chance side);
> the only defensive crit stat is `EnemyCriticalDamageReduce`, applied to the
> crit **damage** rate.

### 3.2 Rate modifiers (applied to `[0x40]`, in order)

```text
rate += attacker.FindBuffAdditionalDamage(→defender)     0x26DD9B4
rate -= defender.FindBuffDamageReduce(vs attacker)       0x26DEBD8
rate += attacker.get_DMGBoost()                          0x27E1208
rate -= defender.get_DMGReduceRate()                     0x27E01B4
rate  = Max(rate, 300)            ← min damage rate 30 %  (cmp #0x12b → #0x12c)
```

So, e.g., a normal hit with a +20 % damage buff → `DR = 1200`; a crit with
`CriticalDMGRate = 2000‰` and no other mods → `DR = 2000` (×2.0), folded into
step 4 of §1.

---

## 4. Element multiplier — `GetElementeryDamageRate` (`0x2C5AB60`)

Returns a ‰ multiplier. Elements: `CHARACTER_ELEMENT_TYPE { EARTH=0, WATER=1,
FIRE=2, LIGHT=3, DARK=4 }` via `get_Element()` (`0x27DEAC8`).

Resolution order:

1. `attacker.FindBuffElementSuperiority()` (`0x26D2D44`) → **advantage**.
2. `attacker.FindBuffElementInferiority()` (`0x26DF574`) → **disadvantage** = `800`.
3. Otherwise by the element wheel on `(attElem, defElem)`:
   - **Basic triangle** (both ≤ 2): advantage iff `(attElem + 1) % 3 == defElem`
     → **Earth→Water→Fire→Earth** (Earth beats Water, Water beats Fire, Fire
     beats Earth). Reverse → disadvantage. Same element → neutral.
   - **Light / Dark** (either ≥ 3): same element → neutral; **Light↔Dark mutual
     advantage**; basic-vs-Light/Dark (and vice-versa) → neutral.

Values:
- **Advantage** = `1200 + attacker.FindBuffElementDamageRate()` (`0x26DF700`) — base **×1.2**, plus any elemental-damage buff.
- **Disadvantage** = `800` — **×0.8**.
- **Neutral** = `1000` — **×1.0**.

---

## 5. Effectiveness vs Resilience — `CheckResist` (`0x2C5A388`)

`public static bool CheckResist(int _nAttackerBuffChance, int _nDefenderBuffResist)`
— returns **`true` if the debuff is RESISTED** (i.e. does NOT apply).

### 5.1 Formula

```text
diff = RES − EFF
if diff < 0                       → return false       (EFF ≥ RES ⇒ never resisted)
diff' = max(diff, 1)
resistPermille = floor( 1000 / (1 + 100 / diff') )    ==  floor( 1000 × diff / (diff + 100) )
roll = GetBattleRandomRange(0, 1000)                   (0x2C59CE0)
return roll ≤ resistPermille
```

Resist chance (per-mille), with `EFF`/`RES` in **integer percentage points**:

```text
ResistChance‰ = 1000 × (RES − EFF) / ((RES − EFF) + 100) ,  0 if EFF ≥ RES
```

Diminishing-returns curve (the gap is divided by *itself + 100*):

| `RES − EFF` (pts) | Resist chance |
|---|---|
| ≤ 0 | 0 % |
| 25 | 20 % |
| 50 | 33 % |
| 100 | 50 % |
| 300 | 75 % |
| 900 | 90 % |

### 5.2 Caller & stat identity (how EFF/RES are fed in)

The **only** caller is `CBuff.Initialize(CBuffTemplet, caster, owner, …)`
(`0x22F4CDC`, call site `0x22F59F0`) — the resist check happens when a
buff/debuff is applied. At the call site:

```text
w0 = caster.get_BuffChance()   0x27E0970   → STAT_TYPE ST_BUFF_CHANCE (15)  = Effectiveness
w1 = owner.get_BuffResist()    0x27E0A4C   → STAT_TYPE ST_BUFF_RESIST (16)  = Effect Resistance
```

- Short-circuit: if `buff.get_IsIgnoreResist()` (`0x25A7420`) is true, the whole
  check is skipped (the debuff is unresistable).
- `get_BuffChance` / `get_BuffResist` are plain stat-dictionary lookups
  (keys `0xF` / `0x10`) — no scaling, so the values reach `CheckResist` as
  stored integer percentage points, which is why the curve constant is `100`.

> **Unit caveat.** The `100` constant is consistent with EFF/RES being integer
> percentage points (the displayed number). If a future build stored them ×10,
> the constant would be `1000` — re-verify against `STAT_TYPE` storage if numbers
> ever look off by 10×.

---

## 6. Damage over time (DoT) — `CalcDamageDOT` (`0x2C5BC6C`)

`public static int CalcDamageDOT(CCharacterBattle _Attacker, CCharacterBattle _Defender, int _nAttackRate, int _nStatValue)`
— returns the damage for **one tick** of a DoT (bleed / burn / poison …).

### 6.1 Inputs (from the caller `ProcessDamageOverTime`)

The only caller is `CBuff…ProcessDamageOverTime(CBuff buff, int nBuffValue, int nCount, caster)`
(`0x22E818C`, three identical call sites for the different DoT branches). It builds:

| Arg | Source | Meaning |
|---|---|---|
| `_nAttackRate` | `ApplyRate(nBuffValue, …)` (`0x28D18E4`) | per-tick coefficient (‰) |
| `_nStatValue` | `attacker.GetStatValue(buff.get_StatType())` (`0x27E13C0` / `0x22F4AE4`) | the stat the DoT scales on — **chosen by the buff templet's `StatType`** (e.g. attacker ATK, or a Max-HP-based DoT) |

So a DoT scales on **whatever stat the buff declares**, read from the **attacker**, times its coefficient.

### 6.2 Exact integer pipeline (per tick)

```text
1. effDef_scaled = Max( DEF × (1000 − min(PPR,1000)) − 1000 × PP ,  −999000 )   ← same as direct damage
2. DMGReduce'    = min( defender.get_DMGReduceRate() , 900 )                      ← capped at 90 %
3. dot = (_nAttackRate × _nStatValue) × 1_000_000 / (effDef_scaled + 1_000_000)  ← mitigation
4. dot = dot × (1000 − DMGReduce') / 1_000_000
   return dot
```

`PPR`/`PP`/`DEF` are the same getters as §1 (attacker penetration, defender defense).

### 6.3 Readable form

```text
DOT_tick = (StatValue × AttackRate / 1000)        coefficient on the chosen stat
         × 1000 / (EffectiveDEF + 1000)           ← same defense mitigation as §2
         × (1 − min(DMGReduceRate, 900) / 1000)   defender flat damage reduction, capped 90 %
```

**What DoTs do NOT use** (unlike direct damage): no crit, no element multiplier,
no Marking ×1.15, no `FinalReduce` / `AdditionalDamage` / `DamageBoost` buff
chains, and **no `Max(…, 1)` floor**. They *do* share the exact defense
mitigation curve (penetration included) and a separate, 90 %-capped
`DMGReduceRate`.

---

## Appendix — reproduction

ARM64 disassembly via Capstone. The lib path is relative to `datamine/APK/`.

**Disassemble a function** (`scratchpad/disasm.py` pattern):

```python
import capstone, struct
LIB = "OUTERPLANE+-+Strategy+Anime_1.4.9_APKPure/config.arm64_v8a/lib/arm64-v8a/libil2cpp.so"
data = open(LIB, "rb").read()
e_phoff = struct.unpack_from("<Q", data, 0x20)[0]
e_phnum = struct.unpack_from("<H", data, 0x38)[0]
e_phentsize = struct.unpack_from("<H", data, 0x36)[0]
segs = []
for i in range(e_phnum):
    pt, fl, po, pv, _pa, pf, pm, _al = struct.unpack_from("<IIQQQQQQ", data, e_phoff + i*e_phentsize)
    if pt == 1:                       # PT_LOAD
        segs.append((pv, pf, po))
def va_to_off(va):
    for v, fs, off in segs:
        if v <= va < v + fs:
            return off + (va - v)
md = capstone.Cs(capstone.CS_ARCH_ARM64, capstone.CS_MODE_ARM)
va, length = 0x2C5B4DC, 0x29C        # e.g. the inner damage lambda
off = va_to_off(va)
for ins in md.disasm(data[off:off+length], va):
    print(f"0x{ins.address:08X}: {ins.mnemonic:8s} {ins.op_str}")
```

**Resolve a `bl` target to a method name** — grep `dump.cs` (uppercase hex):

```bash
grep -n -A1 "RVA: 0x27E00D8 " datamine/APK/dumped/dump.cs   # → get_Def()
```

**Find every caller of a function** — scan executable segments for `BL` words
whose `signextend(imm26)<<2 + va` equals the target (see `scratchpad/callers.py`).

### Key resolved RVAs

| RVA | Method |
|---|---|
| `0x26E02A4` | `CCharacterBattle.GetAttackStat()` |
| `0x24D29A4` | `CSkillManager.GetSkillFactor()` |
| `0x27E00D8` | `get_Def()` |
| `0x27E0524` / `0x27E0448` | `get_PiercePowerRate()` / `get_PiercePower()` |
| `0x27E0290` / `0x27E036C` | `get_CriticalRate()` / `get_CriticalDMGRate()` |
| `0x27E12E4` | `get_EnemyCriticalDamageReduce()` |
| `0x27E0894` | `get_Avoid()` |
| `0x27E1208` / `0x27E01B4` | `get_DMGBoost()` / `get_DMGReduceRate()` |
| `0x26DD9B4` / `0x26DEBD8` / `0x26DF06C` | `FindBuffAdditionalDamage` / `FindBuffDamageReduce` / `GetBuffDamgeFinalReduce` |
| `0x26C5AB0` | `FindBuffByType(BUFF_TYPE)` (BT_MARKING = 5) |
| `0x28D779C` | `get_MISSED_DAMAGE_RATE_PERMILLE()` |
| `0x27DEAC8` | `get_Element()` |
| `0x26D2D44` / `0x26DF574` / `0x26DF700` | `FindBuffElementSuperiority` / `…Inferiority` / `…ElementDamageRate` |
| `0x27E0970` / `0x27E0A4C` | `get_BuffChance()` (EFF) / `get_BuffResist()` (RES) |
| `0x25A7420` | `get_IsIgnoreResist()` |
| `0x27E13C0` / `0x22F4AE4` | `GetStatValue(STAT_TYPE)` / `get_StatType()` (DoT stat) |
| `0x28D18E4` | `ApplyRate(value, rate)` (DoT coefficient) |
| `0x2C59CE0` | `GetBattleRandomRange(min,max)` |
| `0x48A46D8` | `Math.Max(long,long)` |
| `0x28D81C0` | `MulPermille(value, permille)` |
