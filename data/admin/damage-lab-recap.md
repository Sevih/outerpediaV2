# Damage Lab — Recap (Outerplane)

## Goal

Reverse-engineer the full damage formula for the game **Outerplane**. The workflow is:
1. Log in-game damage observations via `/admin/damage-lab` (dev only)
2. Derive the formula empirically from the ratios obs/calc
3. Update `src/lib/damage/formula.ts` progressively

## Current state — formula (validated on 29 tests)

```
Dmg = (DF/1000) × ATK × (1 + pool/100) × 1000/(1000 + (1-PEN/100)×DEF) × (1 - targetDR/100) × elem_mult

pool = DMG Inc (attacker stat, gear + character passives)
     + 12 if Mage class
     + 30 if isBoss   [lvl 1 boss — may scale higher with boss level, NOT YET MODELED]
     + 50 if elem adv
     + (CHD - CDmgRed - 100) if crit

elem_mult = 1.20 if adv, 0.80 if disadv, 1.0 if neutral
```

### Validation stats (29 obs)

- **22/29 exact** (<0.1% error)
- **7/29** show ~0.7-2.1% residual — all on lvl-30 Sentry Archer boss (`ID 4003012`, 2⭐)
- Avg error: 0.4%, max: 2.06%

### Validated empirically

- ✅ Skeleton (structure, C=1000, skill=DF/1000, PEN formula, target DR multiplicative)
- ✅ **Crit: `(CHD - CDmgRed - 100)` additive in pool** — NOT a separate multiplier. The in-game CHD stat is the TOTAL crit damage multiplier (CHD=188 → 1.88×).
- ✅ **Boss quirk: +30% additive** (validated on low-level boss def=44 DR=0)
- ✅ **Adv: +50% additive AND ×1.20 multiplicative** (dual effect)
- ✅ **Disadv: ×0.80 multiplicative only** (no additive penalty — asymmetric with adv)
- ✅ **Mage class: +12% additive** (validated on Alice)
- ✅ **Striker/Attacker (same class): no offense quirk** (Noa, Rin)
- ✅ **Priest/Healer: no offense quirk** (Viella — class field is "Healer" in game data)

### NOT yet validated

- ❓ **Boss quirk scales with boss level** — suspected. Lvl 1 boss gives +30% exact. Lvl 30 Sentry Archer gives ~+31%. Need tests at lvl 15, 50, 99 to fit relation.
- ❓ Boss + crit interaction — persistent +~1% extra on boss+crit cases beyond the above.
- ❓ Ranger, Defender class quirks (suspected: Ranger +EFF defensive, Defender +DMG_REDUCE defensive — neither offensive)
- ❓ Character-specific passives (e.g. Noa has +17% DMG Inc when in advantage; Aer has +23% vs Earth — user manually enters these in `dmgInc`)
- ❓ "Quirks disabled" targets (e.g. lvl 99 bosses disable all quirks — user's earlier Alice tests on lvl 99 showed -18% mystery)

## Class mapping (in-game label → data file label)

| In-game | Data file |
|---|---|
| Striker | `CCT_ATTACKER` / "Attacker" (SAME class, different label) |
| Mage | `CCT_MAGE` / "Mage" |
| Ranger | `CCT_RANGER` / "Ranger" |
| Defender | `CCT_DEFENDER` / "Defender" |
| Priest | `CCT_PRIEST` / "Healer" (different label!) |

There's also a `SubClass` field in data (e.g., "Attacker" subclass) — unknown if it affects damage.

## Element advantage matrix (Outerplane)

- Fire > Wood (Earth), Wood > Water, Water > Fire (rock-paper-scissors)
- Light ↔ Dark (mutual)
- User uses "Earth" and "Wood" interchangeably; internally `CET_EARTH`

## Key files

- `src/lib/damage/formula.ts` — the validated formula with auto-quirks
- `src/app/admin/damage-lab/page.tsx` — UI for logging & live ratio check
- `src/app/api/admin/damage-lab/observations/route.ts` — GET/POST/DELETE to JSONL store
- `src/app/api/admin/damage-lab/characters/route.ts` — character data + skill DFs per lvl
- `data/admin/damage-lab-observations.jsonl` — the store (append-only JSONL, auto-save)
- `data/admin/json2/MonsterTemplet.json` — boss stats (Def_Min/Max, DR, Stars)
- `data/admin/json2/CharacterTemplet.json` — character data (class, element)

## The 29 observations (copy-paste into data/admin/damage-lab-observations.jsonl)

```jsonl
{"char":"Noa","charId":"2000022","slot":"S1","df":1900,"atk":2272,"chd":188,"dmgInc":0,"pen":0,"def":37,"tCdmgRed":0,"tDmgRed":0,"elem":"none","isBoss":false,"quirksDisabled":false,"crit":false,"obs":4162,"class":"Striker","element":"Earth"}
{"char":"Noa","charId":"2000022","slot":"S1","df":1900,"atk":2272,"chd":188,"dmgInc":0,"pen":0,"def":37,"tCdmgRed":0,"tDmgRed":0,"elem":"none","isBoss":false,"quirksDisabled":false,"crit":true,"obs":7826,"class":"Striker","element":"Earth"}
{"char":"Noa","charId":"2000022","slot":"S1","df":1900,"atk":2272,"chd":188,"dmgInc":0,"pen":0,"def":44,"tCdmgRed":0,"tDmgRed":0,"elem":"none","isBoss":true,"quirksDisabled":false,"crit":false,"obs":5375,"class":"Striker","element":"Earth"}
{"char":"Noa","charId":"2000022","slot":"S1","df":1900,"atk":2451,"chd":204,"dmgInc":0,"pen":32.4,"def":37,"tCdmgRed":0,"tDmgRed":0,"elem":"none","isBoss":false,"quirksDisabled":false,"crit":false,"obs":4543,"class":"Striker","element":"Earth"}
{"char":"Noa","charId":"2000022","slot":"S1","df":1900,"atk":2451,"chd":204,"dmgInc":0,"pen":32.4,"def":44,"tCdmgRed":0,"tDmgRed":0,"elem":"none","isBoss":true,"quirksDisabled":false,"crit":false,"obs":5879,"class":"Striker","element":"Earth"}
{"char":"Noa","charId":"2000022","slot":"S1","df":1900,"atk":2451,"chd":204,"dmgInc":0,"pen":32.4,"def":328,"tCdmgRed":0,"tDmgRed":0,"elem":"none","isBoss":false,"quirksDisabled":false,"crit":false,"obs":3811,"class":"Striker","element":"Earth"}
{"char":"Noa","charId":"2000022","slot":"S1","df":1900,"atk":2451,"chd":204,"dmgInc":0,"pen":32.4,"def":328,"tCdmgRed":0,"tDmgRed":0,"elem":"none","isBoss":false,"quirksDisabled":false,"crit":true,"obs":7775,"class":"Striker","element":"Earth"}
{"char":"Noa","charId":"2000022","slot":"S1","df":1900,"atk":2451,"chd":204,"dmgInc":17,"pen":32.4,"def":328,"tCdmgRed":0,"tDmgRed":0,"elem":"adv","isBoss":false,"quirksDisabled":false,"crit":false,"obs":7638,"class":"Striker","element":"Earth"}
{"char":"Noa","charId":"2000022","slot":"S1","df":1900,"atk":2451,"chd":204,"dmgInc":0,"pen":32.4,"def":328,"tCdmgRed":0,"tDmgRed":3,"elem":"none","isBoss":false,"quirksDisabled":false,"crit":false,"obs":3697,"class":"Striker","element":"Earth"}
{"char":"Noa","charId":"2000022","slot":"S1","df":1900,"atk":2451,"chd":204,"dmgInc":17,"pen":32.4,"def":433,"tCdmgRed":0,"tDmgRed":3,"elem":"adv","isBoss":true,"quirksDisabled":false,"crit":true,"obs":12882,"class":"Striker","element":"Earth"}
{"char":"Noa","charId":"2000022","slot":"S1","df":1900,"atk":2451,"chd":204,"dmgInc":17,"pen":32.4,"def":328,"tCdmgRed":0,"tDmgRed":0,"elem":"adv","isBoss":false,"quirksDisabled":false,"crit":true,"obs":12395,"class":"Striker","element":"Earth"}
{"char":"Noa","charId":"2000022","slot":"S1","df":1900,"atk":2451,"chd":204,"dmgInc":0,"pen":32.4,"def":382,"tCdmgRed":0,"tDmgRed":2.9,"elem":"none","isBoss":true,"quirksDisabled":false,"crit":true,"obs":8553,"class":"Striker","element":"Earth"}
{"char":"Noa","charId":"2000022","slot":"S1","df":1900,"atk":2212,"chd":204,"dmgInc":46.6,"pen":32.4,"def":319,"tCdmgRed":0,"tDmgRed":2.9,"elem":"none","isBoss":false,"quirksDisabled":false,"crit":false,"obs":4968,"class":"Striker","element":"Earth"}
{"char":"Noa","charId":"2000022","slot":"S1","df":1900,"atk":2212,"chd":204,"dmgInc":46.6,"pen":32.4,"def":319,"tCdmgRed":0,"tDmgRed":0,"elem":"none","isBoss":false,"quirksDisabled":false,"crit":false,"obs":5068,"class":"Striker","element":"Earth"}
{"char":"Noa","charId":"2000022","slot":"S1","df":1900,"atk":2212,"chd":204,"dmgInc":46.6,"pen":32.4,"def":319,"tCdmgRed":0,"tDmgRed":0,"elem":"none","isBoss":false,"quirksDisabled":false,"crit":true,"obs":8663,"class":"Striker","element":"Earth"}
{"char":"Noa","charId":"2000022","slot":"S1","df":1900,"atk":2212,"chd":204,"dmgInc":46.6,"pen":32.4,"def":382,"tCdmgRed":0,"tDmgRed":2.9,"elem":"none","isBoss":true,"quirksDisabled":false,"crit":true,"obs":9275,"class":"Striker","element":"Earth"}
{"char":"Alice","charId":"2000020","slot":"S1","df":1300,"atk":4036,"chd":204,"dmgInc":0,"pen":0,"def":319,"tCdmgRed":0,"tDmgRed":0,"elem":"none","isBoss":false,"quirksDisabled":false,"crit":false,"obs":4455,"class":"Mage","element":"Earth"}
{"char":"Alice","charId":"2000020","slot":"S1","df":1300,"atk":4036,"chd":204,"dmgInc":0,"pen":0,"def":319,"tCdmgRed":0,"tDmgRed":0,"elem":"adv","isBoss":false,"quirksDisabled":false,"crit":true,"obs":12697,"class":"Mage","element":"Earth"}
{"char":"Alice","charId":"2000020","slot":"S1","df":1300,"atk":4036,"chd":204,"dmgInc":0,"pen":0,"def":319,"tCdmgRed":0,"tDmgRed":0,"elem":"adv","isBoss":false,"quirksDisabled":false,"crit":false,"obs":7732,"class":"Mage","element":"Earth"}
{"char":"Alice","charId":"2000020","slot":"S1","df":1300,"atk":4036,"chd":204,"dmgInc":0,"pen":0,"def":382,"tCdmgRed":0,"tDmgRed":2.9,"elem":"none","isBoss":true,"quirksDisabled":false,"crit":false,"obs":5280,"class":"Mage","element":"Earth"}
{"char":"Alice","charId":"2000020","slot":"S1","df":1300,"atk":4036,"chd":204,"dmgInc":0,"pen":0,"def":319,"tCdmgRed":0,"tDmgRed":0,"elem":"none","isBoss":false,"quirksDisabled":false,"crit":true,"obs":8592,"class":"Mage","element":"Earth"}
{"char":"Rin","charId":"2000019","slot":"S1","df":2000,"atk":2272,"chd":188,"dmgInc":0,"pen":0,"def":319,"tCdmgRed":0,"tDmgRed":0,"elem":"disadv","isBoss":false,"quirksDisabled":false,"crit":false,"obs":2756,"class":"Striker","element":"Water"}
{"char":"Rin","charId":"2000019","slot":"S1","df":2000,"atk":2272,"chd":188,"dmgInc":0,"pen":0,"def":319,"tCdmgRed":0,"tDmgRed":0,"elem":"none","isBoss":false,"quirksDisabled":false,"crit":false,"obs":3445,"class":"Striker","element":"Water"}
{"char":"Rin","charId":"2000019","slot":"S1","df":2000,"atk":2272,"chd":188,"dmgInc":0,"pen":0,"def":382,"tCdmgRed":0,"tDmgRed":2.9,"elem":"disadv","isBoss":true,"quirksDisabled":false,"crit":false,"obs":3343,"class":"Striker","element":"Water"}
{"char":"Rin","charId":"2000019","slot":"S1","df":2000,"atk":2272,"chd":188,"dmgInc":0,"pen":0,"def":382,"tCdmgRed":0,"tDmgRed":2.9,"elem":"disadv","isBoss":true,"quirksDisabled":false,"crit":true,"obs":5657,"class":"Striker","element":"Water"}
{"char":"Viella","charId":"2000108","slot":"S1","df":1600,"atk":2463,"chd":180,"dmgInc":16,"pen":0,"def":319,"tCdmgRed":0,"tDmgRed":0,"elem":"none","isBoss":false,"quirksDisabled":false,"crit":false,"obs":3465,"class":"Healer","element":"Earth"}
{"char":"Viella","charId":"2000108","slot":"S1","df":1600,"atk":2463,"chd":180,"dmgInc":16,"pen":0,"def":319,"tCdmgRed":0,"tDmgRed":0,"elem":"none","isBoss":false,"quirksDisabled":false,"crit":true,"obs":5855,"class":"Healer","element":"Earth"}
{"char":"Viella","charId":"2000108","slot":"S1","df":1600,"atk":2463,"chd":180,"dmgInc":16,"pen":0,"def":319,"tCdmgRed":0,"tDmgRed":0,"elem":"adv","isBoss":false,"quirksDisabled":false,"crit":false,"obs":5951,"class":"Healer","element":"Earth"}
{"char":"Viella","charId":"2000108","slot":"S1","df":1600,"atk":2463,"chd":180,"dmgInc":16,"pen":0,"def":382,"tCdmgRed":0,"tDmgRed":2.9,"elem":"none","isBoss":true,"quirksDisabled":false,"crit":false,"obs":4080,"class":"Healer","element":"Earth"}
```

## Context summary

- L1-L16: Noa tests (Striker/Earth) — validated skeleton, crit, boss lvl 1, DR, PEN, and partial boss lvl 30 (def=382 residuals)
- L17-L21: Alice (Mage/Earth) → validated Mage +12% additive
- L22-L25: Rin (Striker/Water) → validated disadv = ×0.80 multiplicative pure
- L26-L29: Viella (Healer/Earth) → validated Priest has no offense quirk

The boss at def=44 (Noa L3/L5) is a different boss (possibly lvl 1 of some boss) and gives exactly +30%. The boss at def=382 DR=2.9% is the **Sentry Archer lvl 30, 2⭐ Ranger/Earth** (ID 4003012 in MonsterTemplet.json) and gives **~+31%** (residual ~+1%).

## Next tests to pin down boss quirk level scaling

**Priority 1 — boss quirk level dependency**:
- Same character (e.g., Alice or Noa), no-crit, no-adv, no-dmgInc
- Test on bosses at different levels (lvl 15, lvl 50, lvl 99)
- Fit `boss_quirk(level)` relation (linear, exponential?)

**Priority 2 — Ranger, Defender classes**:
- A Ranger character, baseline no-crit on mob → confirm no offense quirk
- A Defender character, same → confirm

**Priority 3 — quirksDisabled targets** (endgame bosses where all quirks disabled):
- Test same character on a lvl 99 quirks-disabled boss
- Should give `pool = dmgInc only` exactly (no boss, no adv, no Mage)

## Known residuals

| Pattern | Residual | Likely cause |
|---|---|---|
| Sentry Archer lvl 30 boss, no-crit | +0.7-0.95% | Boss quirk ≈ +31% (not +30%) for this level |
| Sentry Archer + crit | +1.7-2.1% | Above + ~+1% boss-crit interaction? |

## How to continue on another PC

1. `git pull` the project to sync `formula.ts`, `page.tsx`, etc.
2. Replace `data/admin/damage-lab-observations.jsonl` with the 29 obs above
3. Start dev: `npm run dev` (NEVER `npm run build`)
4. Open `http://localhost:3000/admin/damage-lab` (dev only, checks `NODE_ENV`)
5. Continue logging tests. Auto-save debounce 1500ms on `observed` field.
6. Paste this file into the first prompt of the new Claude conversation — it has everything needed.

## User preferences (from this session)

- Respond in **French**, code & comments in English
- Game is **Outerplane** (not Outerplane Wind etc.)
- JSONL for damage-lab observations (compact keys, optimized for AI reading, not human)
- Formula in `src/lib/damage/formula.ts` — keep it clean and documented
- No auto-quirks that aren't validated — the methodology is: enter pool=0, ratio reveals the quirk value

## Commands cheat sheet

```bash
# quick ratio check on current obs (run from project root):
node -e "
function computeDamage(i) {
  const C = 1000, bossBonus = 30, advAddBonus = 50, advMult = 1.20, disadvMult = 0.80, mageBonus = 12;
  let poolPct = i.dmgInc;
  if (i.class === 'Mage') poolPct += mageBonus;
  if (i.isBoss) poolPct += bossBonus;
  if (i.elem === 'adv') poolPct += advAddBonus;
  if (i.crit) poolPct += Math.max(0, i.chd - i.tCdmgRed - 100);
  const mod = 1 + poolPct/100;
  const mit = C/(C+(1-i.pen/100)*i.def);
  const drMult = 1 - i.tDmgRed/100;
  const elemMult = i.elem === 'adv' ? advMult : (i.elem === 'disadv' ? disadvMult : 1.0);
  return (i.df/1000) * i.atk * mod * mit * drMult * elemMult;
}
const obs = require('fs').readFileSync('data/admin/damage-lab-observations.jsonl','utf8').split('\n').filter(l=>l.trim()).map(JSON.parse);
obs.forEach((o,i) => { const calc = computeDamage(o); const ratio = o.obs/calc; console.log('L'+(i+1), 'ratio='+ratio.toFixed(4)); });
"
```
