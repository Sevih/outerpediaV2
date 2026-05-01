# Damage Lab v2 — Spec de redémarrage

Document de référence pour rebuilder le compartment `/admin/damage-lab` proprement
à partir de zéro avec le contexte technique consolidé. **Seules les informations
validées** (par disasm binaire ou par obs empiriques convergentes) sont incluses.
Les hypothèses non confirmées sont en section dédiée à la fin.

Toolchain : Next.js 15 (App Router), TypeScript, React, Tailwind v4. Données
datamine IL2CPP dans `data/admin/json2/*.json`. Binaire ARM64 disassemblé via
Capstone (scripts `scripts/disasm_*.py`).

---

## 1. Formule de dégâts (validée bit-for-bit)

Reverse-engineered de `CFormula.CalcDamage` (VA `0x2B53EC8`) et de son helper
inner `g__CalcDamage|17_0` (VA `0x2B54660`).

### Pipeline f32 (chaque étape wrappée Math.fround)

```
mit          = C / (C + (1 − PEN/1000) × DEF − PEN_flat)
rate         = base_pool   (= 1.0 normal, CHD/1000 sur crit)
rate        += additionalSum   (somme des BT_DMG/quirks attaquant)
rate        -= reduceSum        (somme des BT_DMG_REDUCE défenseur)
rate        += DMG_BOOST/1000   (gear stat attaquant)
rate        -= DR/1000           (gear stat défenseur)
rate         = max(rate, 0.30)   (rateMin, "Cap on Maximum Reduction")

dmg          = ATK × (skillFactor/1000) × (DF/1000) × mit × rate
            × (markingActive ? 1.15 : 1.0)   (BT_MARKING sur défenseur)
            × elem_mult                       (1.20 adv / 0.80 disadv / 1.0 sinon)
            × (missed ? 0.5 : 1.0)            (MISSED_DAMAGE_RATE)
            × (1 − finalReduce/100)           (BT_DMG_REDUCE_FINAL agrégat MAX)

final        = max(1, floor(dmg))   (fcvtms toward −∞)
```

### Constantes binaires (.rodata)

| VA | Valeur | Usage |
|---|---|---|
| `0x1033D78` | `−0.0010000000474974513f` | Per-mille décodeur négatif (DR/CDR/DMG_REDUCE) |
| `0x1034038` | `+0.0010000000474974513f` | Per-mille décodeur positif (CHD/DMG/BT_DMG) |
| `0x1034064` | `1.149999976158142f` | Multiplicateur BT_MARKING (×1.15) |
| `0x1034074` | `0.30000001192092896f` | rateMin (cap −70% damage reduction) |
| `0x1033E14` | `0.800000011920929f` | Multiplicateur disadv (×0.80) |
| `0x1033E70` | `1.2000000476837158f` | Multiplicateur adv (×1.20) |

Constante intégrée :
- `1000.0f` = cap permille (`fminnm s1, s1, 1000.0`) sur `BT_DMG_TARGET_STAT`
- `99.0f` (= `0x42c60000`) = diviseur level interp (`CalcStat`)
- `MISSED_DAMAGE_RATE` = `0.5` (GameConfigTemplet entry, val 500 perm)

### Conversion finale int

`frintm` (floor toward −∞) + `fcvtms` puis `csinc` pour `max(1, w)`. **Jamais
`Math.round`** — toujours `Math.floor`.

### Calc stat à un niveau donné (`CFormula.CalcStat` VA `0x2B52D24`)

```ts
function interpolate(min: number, max: number, level: number): number {
  if (level <= 1) return min
  if (level >= 100) return max
  const diff = Math.fround(max - min)
  const div  = Math.fround(diff / 99)
  const mul  = Math.fround(div * (level - 1))
  const sum  = Math.fround(mul + min)
  return Math.floor(sum)
}
```

### Formule master `CalcFinalStat` (VA `0x2B52E28`)

```
final = floor(
  baseValue × ArchiveStatRate / 1000 +
  (BuffValueRate + 1000) × (
    ((sumValues) × (1000 + sumRates)) / 1000
    + ItemOptionValue + BuffValue
  ) / 1000
)
```

Pour les monstres : `sumValues = baseValue`, `sumRates = SpawnAdvantageRate`,
autres args = 0. Validé sur Amadeus St2 : `22453 = floor(52707 × 426 / 1000)`.

---

## 2. Buff types (handlers binaires confirmés)

Disas effectué en PR 4bis (RE chore) — chaque type ci-dessous a été tracé
dans le binaire et son multiplicateur extrait depuis le code ARM64.

### Pool additif attaquant (`FindBuffAdditionalDamage` VA `0x2637548`)

Pipeline générique (incremental f32 add) :
```
contrib = (value × multiplier) × 0.001    // f32, .rodata 0x1034038
accumulator = f32(accumulator + contrib)
```

| Type # | Hex | Nom | Multiplicateur | VA dispatch |
|---|---|---|---|---|
| 83  | 0x53 | `BT_DMG`                    | 1                               | 0x26376b4 |
| 84  | 0x54 | `BT_DMG_OWNER_LOST_HP_RATE` | `max(0, 1 − ownerHpRate)`       | 0x26376f8 |
| 85  | 0x55 | `BT_DMG_TARGET_LOST_HP_RATE`| `max(0, 1 − targetHpRate)`      | 0x2637744 |
| 86  | 0x56 | `BT_DMG_OWNER_STAT`         | `min(floor(ownerStat × val/1000), 1000)` (scaling chain) | 0x26377b4 |
| 87  | 0x57 | `BT_DMG_TARGET_STAT`        | `min(floor(targetStat × val/1000), 1000)` (scaling chain) | 0x263781c |
| 88  | 0x58 | `BT_DMG_OWNER_BUFF`         | `ownerBuffCount` (`GetBuffCount(owner, side=0)`)  | 0x2637938 |
| 89  | 0x59 | `BT_DMG_TARGET_BUFF`        | `targetBuffCount` (side=0)      | 0x2637988 |
| 90  | 0x5a | `BT_DMG_OWNER_DEBUFF`       | `ownerDebuffCount` (side=1)     | 0x26379dc |
| 91  | 0x5b | `BT_DMG_TARGET_DEBUFF`      | `targetDebuffCount` (side=1)    | 0x2637a2c |
| 95  | 0x5f | `BT_DMG_TARGET_BREAK`       | `target.RageManager.IsBreak ? 1 : 0` | 0x2637a94 |
| 96  | 0x60 | `BT_DMG_TO_BOSS`            | `target.CharData.Type > 3 ? 1 : 0` (boss types ≥ 4) | 0x2637af0 |
| 97  | 0x61 | `BT_DMG_KILL_COUNT_STACK`   | **1** (le stack n'est PAS dans la formule — la value est mise à jour externalement par le runtime selon kill count) | 0x2637b50 |
| 98  | 0x62 | `BT_DMG_NOT_CRITICAL`       | `target.SkillRecord.DamageRateType ∈ {1, 3} ? 1 : 0` (= non-crit) | 0x2637b90 |
| 99  | 0x63 | `BT_DMG_PVP_CONTENT`        | `CDungeonScene.IsPvp ? 1 : 0`   | 0x2637c04 |
| 100 | 0x64 | `BT_DMG_CASTER_STAT`        | `min(floor(caster.CharData.GetStatValuePermille(...)), 1000)` — alias de 86 mais utilise le caster d'origine du buff (`buff[0x18]`), pas l'owner courant | 0x26378a0 |
| 101 | 0x65 | `BT_DMG_CASTER_LOST_HP_RATE`| `max(0, 1 − casterHpRate)` (caster d'origine) | 0x2637c84 |
| 102 | 0x66 | `BT_DMG_OWNER_TEAM_BUFF`    | `Σ teamMember.GetBuffList(side=0).Count` (somme sur l'équipe du caster du buff) | 0x2637d0c |
| 103 | 0x67 | `BT_DMG_MY_TEAM_DECREASE`   | analogue à 102 (pattern team-iterate sur caster d'origine) | 0x2637e20 |
| 104 | 0x68 | `BT_DMG_MONADGATE_CONTENT`  | `CDungeonScene.IsMonadGate ? 1 : 0` | 0x2637f18 |
| 105 | 0x69 | `BT_DMG_TOWER_CONTENT`      | `CDungeonScene.IsTower ? 1 : 0` | 0x2637fec |

**Types absents de FindBuffAdditionalDamage** : 92 (0x5c), 93 (0x5d), 94 (0x5e), 106 (0x6a). Le type 94 a son propre handler (voir ci-dessous). Les types 92/93 ne semblent pas avoir d'implémentation damage-related.

### `BT_DMG_TARGET_STAT` (87) — chain f32 exact

Handler inline à VA `0x2637824` :
```ts
const PER_MILLE_F32 = Math.fround(0.001)            // .rodata 0x1034038
const statF32 = Math.fround(targetStatValue)        // ex: ST_HP MaxHP
const valF32  = Math.fround(buffTemplet.Value)      // ex: 30
const step1   = Math.fround(statF32 * PER_MILLE_F32)
const step2   = Math.fround(step1 * valF32)
const result  = Math.floor(step2)                    // = GetStatValuePermille
const capped  = Math.min(result, 1000)
const contrib = Math.fround(capped * PER_MILLE_F32)
accumulator   = Math.fround(accumulator + contrib)
```

Routes `ST_HP` → `CCharacterData.get_MaxHP()` (VA `0x27358DC`). Le `MaxHPRate`
(offset `0x100` de `CCharacterData`) est par défaut `1.0` (`ResetMaxHPRate` VA
`0x263A0B4` + `.ctor` VA `0x27376E0`).

### Type 94 `BT_DMG_ENEMY_TEAM_DECREASE` — handler dédié

Handler : **`FindBuffEnemyTeamDecreaseDamageRate` VA `0x2639194`**.
Wrapper appelant : **`CFormula.AddCheckEnemyTeamDecreaseDamageRate` VA `0x2B53E80`**.
Caller : **`CCharacterBattle.UseSkill` (offset +0xBE8 = `0x262E838`)**.

Contrairement aux types du dispatch principal, le type 94 vit dans une fonction
*séparée* et est intégré au `SkillRecord.fDamageRate` *après* `CheckDamageRate`
plutôt qu'avant. Pipeline :

```
// Inside UseSkill, AFTER CFormula.CheckDamageRate populates fDamageRate :
w28 = count of valid (= alive, non-destroyed) members on the *enemy* team
w23 = 4 − w28                            // = number of dead/missing enemies
fDamageRate = SkillRecord.fDamageRate    // current rate after CheckDamageRate

call AddCheckEnemyTeamDecreaseDamageRate(caster, w23, &fDamageRate):
  s0 = FindBuffEnemyTeamDecreaseDamageRate(caster)
                                          // sums Σ value × 0.001 over caster's
                                          // type-94 buffs
  fDamageRate += s0 × float(w23)          // multiplied by dead-enemy count

SkillRecord.fDamageRate = fDamageRate    // store back
```

**Multiplicateur effectif = nombre d'ennemis morts/manquants sur l'équipe adverse** (max team = 4).

Garde d'activation (en plus du test `CheckAvailable`) :
- skill `TargetTeamType == 3` (skill cible les ennemis)
- `SkillRecord.fDamageRate > 0` (skill de dégâts)
- `SkillRecord.DamageRateType - 1 < 3` (types de dégâts standard)

Pour Maxwell `2000028_1_3` Value=100 : contribution = `0.1 × deadEnemyCount` au pool de damage rate. Ex: 3 ennemis morts → +30% pool.

**Important pour la lab UI** : le type 94 doit être plombé avec un input "deadEnemyCount" (par défaut 0). v2 reducer doit être étendu pour appliquer ce multiplicateur sur les buffs de type 94.

### Réduction défenseur (`FindBuffDamageReduce` VA `0x2638638`)

Pipeline : accumulateur **entier** (somme des permille), multiplié par 0.001 à la fin.
Soustrait du rate avec le décodeur négatif `−0.001` (.rodata `0x1033D78`).

| Type # | Hex | Nom | Multiplicateur | VA dispatch |
|---|---|---|---|---|
| 107 | 0x6b | `BT_DMG_REDUCE`                  | 1                                 | 0x263876c |
| 110 | 0x6e | `BT_DMG_REDUCE_MY_TEAM_INCREASE` | `aliveTeamCount − 1` (count des alliés vivants moins soi) | 0x2638820 |
| 145 | 0x91 | `BT_STEALTHED`                   | 1 (handler simple, voir disas)    | 0x26387cc |

Note : type 110 itère le team du caster du buff via `GetTeam`, compte les `IsAlive`,
soustrait 1 (exclut soi-même), multiplie le permille par ce count avant ajout au cumul.

### Final reduce (`GetBuffDamgeFinalReduce` VA `0x2638ADC`)

Pipeline **MAX** (pas somme) — itère et garde la plus grande contribution.

| Type # | Hex | Nom | Multiplicateur | VA dispatch |
|---|---|---|---|---|
| 111 | 0x6f | `BT_DMG_REDUCE_FINAL`                       | 1                          | 0x2638c4c |
| 112 | 0x70 | `BT_DMG_REDUCE_FINAL_MY_TEAM_INCREASE`      | `aliveTeamCount − 1`       | 0x2638cbc |
| 113 | 0x71 | `BT_DMG_REDUCE_FINAL_WITH_OUT_FIRST_SKILL`  | gated sur "first skill"    | 0x2638dc0 |

Pattern type 111 (binaire à 0x2638c64) :
```
s9 = *acc                       // current accumulator (= max so far)
s0 = value × 0.001              // candidate
if s9 < s0:                     // if candidate larger
  *acc = s0                     // keep new max
  buff.MarkUsedHitOverThisSkill()
```

Appliqué multiplicativement comme `× (1 − finalReduce/100)` après le pool, élément, etc.

### Element rate (`GetElementeryDamageRate` VA `0x2B53C74`)

Logique element :
```
attacker_elem ≤ 2 (Earth/Water/Fire) ET target_elem ≤ 2 → cycle rps
attacker_elem > 2 (Light/Dark) OU target_elem > 2 → branche L/D
```

Branche L/D (`0x2B53DB4`) :
```
if attacker_elem < 3 → return 1.0   (attaquant F/W/E vs target L/D)
if target_elem ≤ 2 → return 1.0      (attaquant L/D vs target F/W/E)
if attacker_elem == target_elem → return 1.0   (Light vs Light, Dark vs Dark)
else → 1.20   (L↔D mutual adv ; FindBuffElementSuperiority peut booster
              au-delà via type 92/93, cf §7.5)
```

**Confirmé** : Light↔Dark donne ×1.20 (validé empiriquement, cf §1).
Same-elem L/D donne ×1.0. Le passif awakening
`Awakening_Element_Dmg_Dark_Light_10` (cf §3) est **séparé** et empile
+30% au pool en plus de ce multiplicateur élémentaire.

### Element enum (`CHARACTER_ELEMENT_TYPE`)

| Valeur | Élément |
|---|---|
| 0 | EARTH |
| 1 | WATER |
| 2 | FIRE |
| 3 | LIGHT |
| 4 | DARK |

Cycle rps : `Fire > Earth > Water > Fire`. **Light ↔ Dark : avantage
mutuel** au multiplicateur élémentaire (×1.20 dans les deux sens).
Validé empiriquement (Maxwell Dark → Ars Nova Light × 3 obs, Skadi Light
→ Amadeus Dark × 5 obs, ratio 1.000).

⚠️ À ne pas confondre avec le passif awakening
`Awakening_Element_Dmg_Dark_Light_10` (cf §3) qui ajoute **+30% pool**
(`BT_DMG`, `BuffConditionType: NONE`) **sur toute cible** indépendamment
de l'élément. Les deux mécanismes coexistent et empilent : L attacker
vs D defender = ×1.20 elem mult **ET** +30% pool ; L attacker vs F/W/E
defender = ×1.0 elem mult **mais** +30% pool quand même.

### Subclass enum

| Valeur | Subclass |
|---|---|
| 1 | ATTACKER |
| 2 | BRUISER |
| 3 | WIZARD |
| 4 | ENCHANTER |
| 5 | VANGUARD |
| 6 | TACTICIAN |
| 7 | SWEEPER |
| 8 | PHALANX |
| 9 | RELIEVER |
| 10 | SAGE |

### Class enum

| Valeur | Class |
|---|---|
| 1 | Defender |
| 2 | Attacker |
| 3 | Ranger |
| 4 | Mage |
| 5 | Priest |

---

## 3. Awakening quirks (validés)

Walk de `CharacterAwakeningNodeTemplet` + `CharacterAwakeningLevelTemplet` →
buffs dans `BuffTemplet`. Chaque node a un `AwakeningApplyType` qui filtre quels
chars reçoivent le buff (`AAT_ELEMENTAL` / `AAT_CLASS` / `AAT_SUBCLASS` / etc.)
et un `AwakeningLevelGroupID` qui indexe la chaîne de buffs progressifs.

### Boss damage (`Awakening_Boss_Dmg_10`)
- Type `BT_DMG_TO_BOSS` (96), Value=`300` (= +30%)
- Apply : `AAT_PVE` (tous chars en PVE)
- Condition : cible `boss` (intrinsèque au type 96)
- BuffID confirmé dans `BuffTemplet` (ID 682 dans la version actuelle)

### Class Mage (`MAGE_PASSIVE_3_10`)
- Type `BT_DMG` (83), Value=`120` (= +12%)
- Apply : `AAT_CLASS=4` (Mage)
- Condition : `NONE` (toujours actif)
- Node : `JOB02_MAIN`, group `20201`

### Light/Dark element main (`Awakening_Element_Dmg_Dark_Light_10`)
- Type `BT_DMG` (83), Value=`300` (= +30%)
- Apply : `AAT_ELEMENTAL=3` (Light, group 10401) **OU** `AAT_ELEMENTAL=4` (Dark, group 10501)
- Condition : `NONE` (toujours actif, "When attacking an enemy of any element")
- Description in-game : *"Light Main Node: When attacking an enemy of any element, increases damage dealt by 30%"*

### Earth/Water/Fire element main (`Awakening_Element_Dmg_10`)
- Type `BT_DMG` (83), Value=`500` (= +50%)
- Apply : `AAT_ELEMENTAL ∈ {0,1,2}` (groups 10101/10201/10301)
- Condition : `ATTACKER_ELEMENT_WIN` (uniquement sur target adv)

### Boss debuffs (`Awakening_Boss_*_Down_X`)
- Type `BT_STAT_PREMIUM` négatif sur ST_BUFF_RESIST / ST_BUFF_CHANCE
- Réorienté côté défenseur (boss reçoit `monster_res` / `monster_eff` debuff)
- Apply : `AAT_PVE`, condition : cible boss

---

## 4. Cas char-specific (validés)

### Ame (`2000065`)

**S1** : `dfMultiplier = 0.5` (validé sur 8 obs unbuffed boss×elem×crit, ratio
`0.50 ± 0.01`). Le facteur 0.5 n'apparaît dans aucun row du datamine ; c'est de
la logique game-code spécifique à sa stance Ume/Sakura.

Conditionnel S1 :
- `umeActive` : alternate hit ADD à `mainDF × 2.0` (validé 5 obs ratio `1.000 ± 0.007`)
- `sakuraActive` :
  - `replaceOnAdv=true` : sur target adv, alternate REPLACE main à `× 1.0` total
  - sinon : ADD comme Ume

Limitation connue : Sakura+crit non-adv fire à `~1.83×` au lieu de `2.0×`
(shortfall 5-6%, 3 obs). Suspect d'interaction `BT_DMG_ELEMENT_SUPERIORITY`
avec crit DR pierce. Acceptable as-is.

### Noa (`2000022`)

**S2** : scaling `BT_DMG_TARGET_STAT` (BuffID `2000022_2_2` Level 5, Value=30).
Add component séparé via `min(floor(targetHP × 30 / 1000), 1000) × 0.001` ajouté
au pool. Validé sur 11 obs (boss × stages × crit/no-crit) ratio ±0.013% sur
basic, +0.10% résiduel localisé sur target_stat (cause inconnue, voir §6).

---

## 5. Schémas de données

### Pipeline conceptuel
```
DATAMINE (JSON)
   │
   │  walk awakening tree + char skills + buff templet
   ▼
EXTRACTOR (server)        →  ApplicableBuff[]
   │
   │  filter par char/awakening, apply triggers (boss/crit/adv/etc.)
   ▼
REDUCER (client)          →  ReducedBuffs { mainAtk, addAtk, chdBonus, penBonus, poolPct, ... }
   │
   │  feed into formula
   ▼
FORMULA                    →  DamageBreakdown { mainCalc, extraCalc, additionalCalc, calculated }
```

### `ApplicableBuff` — schéma minimum unifié

```ts
{
  id: string                          // unique (ex: "awak:121", "char:2000022:S2:2000022_2_2")
  source: { kind: 'awakening' | 'char_skill', ... }
  appliesTo: { kind: 'class'|'element'|'subclass'|'pve'|'all', value: string|null }
  effect: {
    target: 'pool' | 'pool_cond' | 'atk_pct' | 'atk_flat' | 'chd' | 'pen'
          | 'crit_rate' | 'monster_eff' | 'monster_res'
          | 'scaling_swap' | 'scaling_add_pct' | 'scaling_add_flat'
          | 'scaling_target_stat'
    poolCondition?: PoolCondition     // si target='pool_cond'
    statKey?: string                   // ST_HP / ST_DEF / ST_CRITICAL_RATE etc. (pour scaling)
    amount: number                     // valeur signée (% pour pool, perm pour scaling, etc.)
    unit: '%' | 'permille' | 'flat'
  }
  trigger: {
    requires: 'always' | 'boss' | 'crit' | 'adv' | 'disadv' | 'neutral'
    callerSlots: 'all' | ('S1'|'S2'|'S3')[]   // skill que le buff gate
  }
  ui?: { name, desc, defaultEnabled, maxLevel }
}
```

### `RecomputeContext` — input formula

```ts
{
  // Caster identity
  charId, charElement, charClass, charSubclass
  // Skill
  slot: 'S1'|'S2'|'S3'
  damageFactor: number                 // listed DF du SkillLevelTemplet
  additionalAttackRatio?: number        // si skill a sub-attack conditionnel
  // Caster stats (raw, post-gear/awakening déjà appliqué via API)
  atk, chd, pen, dmgInc
  applyQuirks: boolean
  extraStats?: Record<ST_*, number>     // pour scaling secondaire (HP, DEF, etc.)
  // Target stats
  targetDef, targetDmgRed, targetCdmgRed, targetHp?
  isBoss, elem: 'none'|'adv'|'disadv'
  crit: boolean
  mode?: string                          // dungeon mode pour AdvLicense gate
  monsterId?: string                     // pour boss-overrides lookup
  // Char-specific flags
  charFlags?: { umeActive, sakuraActive, ... }
  // External toggles (UI)
  externalBuffs?: Record<string, { active, value }>
  bossMechanics?: Record<string, { active, value }>
  // Constantes (tunables debug)
  C, ratioDivisor
  f32arithmetic, debugSteps: boolean
}
```

---

## 6. UI — design retours d'expérience

L'UI v1 est un patchwork. v2 doit être conçue avec ces principes dès le départ :

### Layout principal (3 colonnes desktop, stacked mobile)

1. **Attacker** : portrait + selector + champs ATK/CHD/PEN/DMG↑ + skill slot (S1/S2/S3) + skill level + crit toggle + per-char flags conditionnels (Ame Ume/Sakura)
2. **Target** : monster picker (Mode → Stage → Monster) auto-fetched stats, mode manual permet d'overrider
3. **Formula constants & Result** : C, ratioDivisor, f32 toggle, debug toggle, computed damage display, breakdown (pool/mit/elem/etc.), active buffs list

### Sections globales

4. **Buffs/Debuffs toggles** (sous la grille principale, full-width) :
   - Attacker buffs (statBoosts génériques ATK/PEN/CHC/CHD/EFF avec input éditable)
   - Attacker debuffs (statReduction)
   - Target buffs (DEF buff)
   - Target debuffs (DEF break — Tamara case)
5. **Boss-specific mechanics** (visible uniquement si target boss matchant `boss-overrides.ts`) :
   - Liste de toggles spécifiques au boss avec valeur multiplicateur éditable
   - Chaque toggle applique un mult final sur le damage
6. **Observations table** :
   - Toutes les obs sauvées avec recompute live (calc + Δ obs/calc)
   - Color-code : ratio ±2% green, ±5% amber, sinon red
   - Save observation depuis le panneau Result

### Persistence
- Form state en `localStorage` (clé versionnée `damage-lab-form-vX`)
- Obs sauvées via API `/api/admin/damage-lab/observations` (JSONL côté serveur)

### Debug panel
- f32 step trace (chaque opération intermédiaire avec valeur)
- Back-calculation depuis l'obs (deduit le permille requis pour matcher)
- Active buffs avec contribution effective

---

## 7. À investiguer (non confirmé)

Liste des questions ouvertes — **NE PAS** encoder avant validation empirique.

1. **Amadeus St4+ "Prelude of the Waning Crescent"** — passif boss (skill
   `132405/132408/132410/132411` selon stage). Buffs attachés identifiés
   (`5_2/6/7/8/10/11/12/armor_common_*`) mais l'effet net sur damage taken par
   élément attaquant pas validé contre obs. Description in-game :
   *"Decreases damage taken from Fire/Water/Earth, increases from Light/Dark"*.

2. **Amadeus Enrage (HP < 30%)** — buff "Reduced Damage Taken" se déclenche.
   Valeur exacte non identifiée dans BuffTemplet (à chercher via condition
   `OWNER_HPRATE_UNDER` ou similaire).

3. **Noa S2 `BT_DMG_TARGET_STAT` résiduel +0.10%** — calc 673 permille vs obs
   ~670 sur 2 obs. Tout le pipeline f32 est validé bit-for-bit, MaxHP=22453
   confirmé via Cheat Engine sur LDPlayer. Cause non identifiée — possiblement
   un détail runtime qu'on ne voit pas en statique. Acceptable as-is.

4. **Multi-hit dispatch — résiduel ±0.2% sur skills à `MaxHitCount > 1`**.
   Confirmé empiriquement sur 5 obs :
   - Maxwell S1 Amadeus (3 hits) : calc 2789 vs obs 2786 → 0.999 (+3)
   - Maxwell S1 Ars Nova adv (3 hits) : calc 4610 vs obs 4605 → 0.999 (+5)
   - Maxwell S1 Ars Nova adv crit (3 hits) : 6444 vs 6437 → 0.999 (+7)
   - Skadi S2 Amadeus crit adv (3+7+7 hits) : 3959 vs 3967 → 1.002 (-8)
   - Skadi S1, S3 et Maxwell S2 (single-hit ou MultiHit=False) : 1.000 ✓

   Toutes les obs **single-hit** matchent exactement (ratio 1.000) → la
   chaîne single-shot est binary-faithful. La dérive multi-hit est
   proportionnelle au damage avec sign indéterminé (+ pour Maxwell, − pour
   Skadi) selon la distribution `MaxHitCount` des sub-attacks.

   **Disasm trail** :
   - `CFormula.CalcDamage` (`0x2B53EC8`) est mono-shot — son helper interne
     `g__CalcDamage|17_0` (`0x2B54660`) implémente la chaîne f32 complète
     `ATK × DF×0.001 × (other_factors) × mit × rate × elem × marking ×
     missed × (1-finalReduce)` avec un seul `frintm` + `fcvtms` à la fin.
     **Pas de boucle multi-hit dans CalcDamage**.
   - Scan du binaire entier (52 MB de `.text`) : **0 instruction `BL #0x2B53EC8`**
     (zéro appel direct compile-time). Une seule occurrence du pointeur
     `0x2B53EC8` à `file_offset 0xb64d20` dans la table de méthodes IL2CPP →
     **tous les appels passent par dispatch virtuel `BLR Xn`**, inaccessibles
     sans symboliser `global-metadata.dat`.
   - Conséquence : la dispatch multi-hit vit dans `CCharacterBattle.UseSkill`
     (ou un orchestrateur en amont) et s'appuie sur des appels indirects.
     Sans symbol resolution IL2CPP, on ne peut pas tracer la boucle per-hit.

   **Hypothèse la plus probable** (non confirmée — nécessite Frida runtime
   ou Il2CppDumper full pass) : `UseSkill` lit `CharacterDamageTemplet.MaxHitCount`,
   écrit `SkillRecord.fDamageRate = floor(original_DF / MaxHitCount)` avant
   chaque appel CalcDamage, chacun calculant son per-hit damage avec
   DF=floor(1190/3)=396 et flooring à 928 → total 2784 (Δ -2 vs obs). Une
   distribution résiduelle [396, 397, 397] donnerait 928+930+930 = 2788
   (Δ +2). **Aucune distribution simple ne reproduit exactement 2786** sans
   règle de tie-breaking spécifique au runtime.

   Pour fermer ce dernier ULP il faudrait :
   1. Dumper `global-metadata.dat` avec Il2CppDumper pour résoudre les
      symbol mappings (méthode → VA + class hierarchy)
   2. Localiser `CCharacterBattle.UseSkill.MultiHitDispatch` (ou équivalent)
      dans le code symbolifié
   3. Hook Frida runtime sur `SkillRecord.fDamageRate` avant chaque appel
      CalcDamage pour observer les valeurs effectives

   **Décision** : accepté comme limite documentée. **Précision modèle :
   ±0.0% sur single-hit (binary-exact), ±0.2% sur multi-hit**. Sign et
   magnitude dépendent du layout `MaxHitCount` (Maxwell 3 hits → +0.11%,
   Skadi S2 17 hits → −0.2%). Suffisant pour comparaison/ranking mais
   pas pour prédiction au pixel.

5. **Types `BT_DMG_ELEMENT_SUPERIORITY` (92) et `BT_DMG_ELEMENT_ENCHANT` (93)
   non modélisés** — RE chore PR 4ter, **partial**.

   Disasm `CFormula.GetElementeryDamageRate` (VA `0x2B53C74`) :
   ```
   if FindBuffElementSuperiority(caster):       // VA 0x262D294, scan type 92
       sum = FindBuffElementDamageRate(caster)  // VA 0x2639004, sum type 93 values
       rate = 1.20 + (sum × 0.001)               // base 1.20 from rodata 0x1033E70
   else:
       rate = standard RPS check (×1.20 / 1.0 / 0.80) + L↔D mutual adv
   ```

   Donc :
   - **Type 92 (BT_DMG_ELEMENT_SUPERIORITY)** : marker buff qui force le path
     "superiority" (équivalent à forcer adv ×1.20).
   - **Type 93 (BT_DMG_ELEMENT_ENCHANT)** : ajoute son value (per-mille) à la
     rate elem AU-DESSUS de 1.20 base.

   Ame S1 a buff `2000065_1_4` type 92 avec
   `BuffConditionType: CASTER_HAS_BUFF, BuffConditionValue: 55`. Empiriquement
   le gate fire pour Sakura uniquement (Ume non-adv match parfait 1.000, Sakura
   non-adv non-crit dérive +1%, Sakura non-adv crit dérive -5%).

   **Mystère** : `BuffConditionValue=55` dans `BUFF_TYPE` enum = `BT_DOT_BLEED`.
   Mais Ame ne porte pas DOT_BLEED. Cette valeur 55 doit donc être un autre
   enum (probablement un `BUFF_GROUP_ID` ou un index custom pour Ame) qu'on ne
   peut pas résoudre statiquement. Le comportement effectif du buff 92 dépend
   de cette résolution.

   **Aussi non résolu** : `CBattleManager.ProcessDamage` (~`0x22A6118`)
   branche sur Ume (140) vs Sakura (141) avant CalcDamage et charge des
   skill templates différents via static fields (`[0x545D478]` Ume /
   `[0x545D498]` Sakura). La variante `2000065_Skill_1_5_B` (DF=1100, vs
   `_5` à 100) est une variante Sakura du dernier hit.

   **À faire pour fermer** :
   1. Frida hook sur `FindBuffElementSuperiority` pour observer la sémantique
      de la valeur 55 en runtime.
   2. Hook `CBattleManager.ProcessDamage` pour observer quels skills sont
      réellement chargés en Sakura mode.
   3. Une fois le gate connu, ajouter type 92/93 à `extract-buffs.ts` :
      ```ts
      effect: { target: 'elem_superiority' }   // marker
      effect: { target: 'elem_enchant_permille', amount: value }
      ```
      Reducer accumule, formula utilise rate alternatif quand actif.

6. **Sakura non-adv résiduel (post-§7.5)** — limite empirique tant que §7.5
   n'est pas résolu. Stop-gap actuel : `empiricalMult` dans `char-overrides.ts`
   (`nonCrit: 1.010`, `crit: 0.948`) ramène les obs Ame dans tolérance.
   - Ume non-adv : ratio 1.000 ✓ (exact)
   - Sakura non-adv non-crit : avant correction 1.010-1.016, après ≈1.000
   - Sakura non-adv crit : avant correction 0.942-0.951, après ≈1.000

---

## 8. VAs binaires utiles (pour future RE)

```
0x2B53EC8  CFormula.CalcDamage
0x2B54660  CFormula.<CalcDamage>g__CalcDamage|17_0
0x2B53518  CFormula.CheckDamageRate
0x2B53C74  CFormula.GetElementeryDamageRate
0x2B52D24  CFormula.CalcStat
0x2B52E28  CFormula.CalcFinalStat
0x2637548  CCharacterBattle.FindBuffAdditionalDamage
0x2638638  CCharacterBattle.FindBuffDamageReduce
0x2638ADC  CCharacterBattle.GetBuffDamgeFinalReduce
0x2639004  CCharacterBattle.FindBuffElementDamageRate
0x262D294  CCharacterBattle.FindBuffElementSuperiority
0x2639BB8  CCharacterBattle.GetAttackStat
0x262109C  CCharacterBattle.FindBuffByType
0x2622740  CCharacterBattle.get_SkillRecord
0x2737274  CCharacterData.GetStatValuePermille
0x273717C  CCharacterData.GetStatValue
0x27358DC  CCharacterData.get_MaxHP
0x2735E94  CCharacterData.get_Def
0x27362E0  CCharacterData.get_PiercePowerRate
0x2736204  CCharacterData.get_PiercePower
0x2728574  CCharacter.get_SkillManager
0x2439588  CSkillManager.GetSkillFactor
0x263A0B4  CCharacterBattle.ResetMaxHPRate
0x27376E0  CCharacterData..ctor (init MaxHPRate=1.0)
0x22A6420  CBattleManager.ProcessDamage (CalcDamage caller)
0x2732D38  CSkillRecord.get_DamageRate
```

Scripts disasm : `scripts/disasm_funcs.py <VA> [count]`,
`scripts/disasm_buff_handlers.py`, `scripts/disasm_prologue.py`.

Binaire : `C:/Users/Sevih/Downloads/Il2CppDumper-net7-win-v6.7.46/libil2cpp.so`,
script.json + dump.cs au même endroit.

---

## 9. État actuel & roadmap

### ✅ Implémenté (PR 1-9)
- Pipeline calc rebuild dans `src/lib/damage/v2/` (`recompute.ts`, `f32.ts`,
  `formula.ts`, `buffs.ts`, `external-buffs.ts`, `char-overrides.ts`)
- API v2 : `/api/admin/damage-lab/v2/{chars,monsters,observations,...}`,
  `/api/admin/characters/:id/stats` avec `meta.scaling.{atk,def,hp}` pour
  buff stacking additif
- UI v2 sous `src/app/admin/damage-lab/v2/` découpée en composants
  (Attacker/Target/BuffsToggles/Result/ObsTable + MonsterPicker/CharPicker/
  PerCharFlags/BossMechanicsPanel embedded), state via `useReducer` +
  persistence localStorage hydratée post-mount (évite hydration mismatch SSR)
- Validation : 21/21 obs dans tolérance (17 perfect 1.000, 4 multi-hit
  ±0.2%), stats regression OK
- `interpolateRated` single-floor + ATK scaling breakdown intégrés
- Type 94 `BT_DMG_ENEMY_TEAM_DECREASE` complet (handler dédié)
- Char-overrides v2 avec `empiricalMult` (stop-gap Sakura non-adv)

### À faire — chantiers ouverts

1. **Boss-overrides Amadeus** — calibrer Prelude St4+ et Enrage (HP<30%)
   sur obs ciblées. Cf §7.1-2.

2. **PR 4ter (RE chore deferred)** — résoudre `BuffConditionValue=55`
   (Frida hook) puis modéliser `BT_DMG_ELEMENT_SUPERIORITY` (92) et
   `BT_DMG_ELEMENT_ENCHANT` (93) proprement. Une fois fait, retirer
   `empiricalMult` dans `char-overrides.ts`. Cf §7.5-6.

3. **Multi-hit dispatch** — RE chore (~1-2 jours) pour fermer le ±0.2%
   résiduel sur `MaxHitCount > 1`. Nécessite Il2CppDumper full pass +
   Frida runtime hook. Cf §7.4. **Décision actuelle : accepté comme
   limite documentée.**

### Inputs damage à intégrer (post-chantiers ci-dessus)

Identifiés en review Discord (2026-04-30) — 4 sources non encore plombées :

4. **Break state** — multiplicateur global "damage taken on break" côté
   target (à vérifier dans `RageManager`/`ProcessDamage`). UI : toggle
   "Target is broken" sur TargetPanel. *Modélisation simple.*

5. **Guild HP buff** — perk guilde, multiplicateur flat sur HP caster
   (impacte les scalings `BT_DMG_OWNER_STAT` qui lisent ST_HP).
   UI : input single "Guild HP bonus %". *Modélisation simple.*

6. **Transcend from party** — bonus party-wide des alliés
   (`CharacterTranscendTemplet` + `ApplyType` party). Probablement
   `BT_STAT_PREMIUM` flat sur ATK/HP. UI : 3 alliés + niveau transcend.

7. **Gear passives** — set effects (2/4/6 pieces) + passifs individuels
   non couverts par les stats raw (pool/poolCond des sets type Lifesteal,
   Counter). Extraction `EquipmentTemplet`/`EquipmentSetTemplet` à ajouter
   dans `extract-buffs.ts` côté `kind: 'gear_passive'`. UI loadout requis.

Priorité suggérée : **4 + 5** d'abord (scalaires simples), **6 + 7** ensuite
(extraction datamine + UI loadout).
