# Damage Lab v2 — UI Specification

Spec UI complète pour la v2 de `/admin/damage-lab/v2`. Pendant tout le rebuild,
la v1 (`/admin/damage-lab`) reste intacte. Ce document est la cible que les PRs
6 à 9 implémentent (cf. `damage-lab-v2-spec.md` §10 — roadmap).

Référence pipeline calc : voir `damage-lab-v2-spec.md` §1 à §5.

---

## 1. Objectifs

### Goals
- UI reconçue from-scratch — la v1 fait 2424 lignes avec 46 `useState`, ingérable.
- Layout desktop / mobile responsive, pensé dès le départ.
- État unifié dans un reducer unique, persisté en `localStorage` versionné v2.
- Une seule pipeline calc (drop du toggle `f32arithmetic`).
- Composants typés, props interfaces explicites.
- Capacité à comparer obs sauvée vs recompute live (couleur ratio).

### Non-goals
- Pas de partage de code/route/lib avec la v1 (compartimenté, voir spec v2 §0).
- Pas de port automatique des obs v1 — l'opérateur re-saisit pour valider la pipeline v2.
- Pas de feature parity bit-for-bit avec la v1 — uniquement ce qui est validé en empirique ou via disasm.

---

## 2. Layout

### Desktop (≥ md, 3 colonnes)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Header: Damage Lab v2  [pipeline f32 binary-faithful] [reset form]         │
├─────────────────┬─────────────────────┬─────────────────────────────────────┤
│ AttackerPanel   │ TargetPanel         │ ResultPanel                         │
│                 │                     │                                     │
│ Portrait        │ Mode dropdown       │ Computed: 1 234 567                 │
│ Char selector   │ Stage dropdown      │  ├ main      :   …                  │
│ ATK / CHD / PEN │ Monster picker      │  ├ extra     :   …                  │
│ DMG↑            │ Element             │  └ additional:   …                  │
│ Skill slot      │ DEF (auto/manual)   │                                     │
│ Skill level     │ DR / CDR            │ Breakdown details (collapsible) :   │
│ Crit toggle     │ HP (boss only)      │  - mit, rate (cap), elem, marking   │
│ Add-attack tog. │ isBoss flag         │  - reduced.* (pool/chd/pen)         │
│ Per-char flags  │                     │  - debugSteps[] f32 trace           │
│ (Ame Ume/Saku.) │ ──────────────────  │                                     │
│                 │ Constants           │ Active buffs list                   │
│ ──────────────  │ C : 1000            │  ├ awak:Mage_pass …                 │
│ Quirks toggle   │ ratioDivisor : 1000 │  └ char:Noa:S2 …                    │
│                 │                     │                                     │
│                 │                     │ [Save observation]                  │
├─────────────────┴─────────────────────┴─────────────────────────────────────┤
│ BuffsTogglesPanel (full width)                                              │
│  ┌───────────────────┬──────────────┬──────────────────┬──────────────────┐│
│  │ Attacker buffs    │ Atkr debuffs │ Target buffs     │ Target debuffs   ││
│  │ ATK +30 [✓] [30]  │ ATK -30 [ ]  │ DEF +50 [ ]      │ DEF -50 [✓] [50] ││
│  │ PEN +30 [ ] [30]  │ …            │                  │                  ││
│  │ CHC +50 [ ]       │              │                  │                  ││
│  │ CHD +50 [ ]       │              │                  │                  ││
│  │ EFF +100 [ ]      │              │                  │                  ││
│  └───────────────────┴──────────────┴──────────────────┴──────────────────┘│
├─────────────────────────────────────────────────────────────────────────────┤
│ BossMechanicsPanel (full width, visible si target boss)                     │
│  ┌────────────────────────────────────────────────────────────────────────┐│
│  │ Amadeus                                                                ││
│  │  ✓ Prelude of Waning Crescent (St4+)        × 0.80                     ││
│  │  □ Enrage (HP < 30%)                         × 0.70                    ││
│  └────────────────────────────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────────────────────────────┤
│ ObsTable (full width)                                                       │
│  ┌────┬──────────┬────────┬──────┬──────────┬──────────┬───────┬───────┐   │
│  │ id │ caster   │ target │ slot │ obs      │ calc     │ Δ     │ ratio │   │
│  ├────┼──────────┼────────┼──────┼──────────┼──────────┼───────┼───────┤   │
│  │ 1  │ Stella   │ Amad…  │ S2   │  734 213 │  734 150 │   −63 │ 1.000 │   │
│  │ 2  │ Maxwell  │ Amad…  │ S3   │1 234 567 │1 100 000 │−135 K │ 0.891 │   │
│  └────┴──────────┴────────┴──────┴──────────┴──────────┴───────┴───────┘   │
│  Color: ratio ∈ [0.98, 1.02] green, [0.95, 1.05] amber, sinon red           │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Mobile (< md, stacked)

Ordre vertical : Header → AttackerPanel → TargetPanel → ResultPanel →
BuffsTogglesPanel (accordéon, fermé par défaut) → BossMechanicsPanel
(si applicable) → ObsTable.

ObsTable : scroll horizontal sur mobile, pas de masquage de colonnes.

---

## 3. Composants

### 3.1 `AttackerPanel`

```ts
interface AttackerPanelProps {
  state: AttackerState
  charCatalog: CharSummary[]
  onChange: (action: AttackerAction) => void
}

interface CharSummary {
  id: string
  name: string
  element: 'Earth' | 'Water' | 'Fire' | 'Light' | 'Dark'
  class: string                  // 'Defender' | 'Attacker' | 'Ranger' | 'Mage' | 'Priest'
  subclass: string               // ATTACKER, BRUISER, WIZARD, … (cf. spec v2 §2)
  portraitUrl: string
}

interface AttackerState {
  charId: string
  slot: SlotTag                  // 'S1' | 'S2' | 'S3'
  skillLevel: number             // 1..15, default 5
  atk: number                    // raw user-typed
  chd: number                    // %
  pen: number                    // %
  dmgInc: number                 // %
  crit: boolean
  applyQuirks: boolean           // applique awakening quirks (boss +30, mage +12, adv +50…)
  additionalAttackEnabled: boolean   // toggle pour skills à sub-attack conditionnel
  charFlags: CharFlags           // flags per-char (Ame: umeActive, sakuraActive, …)
  extraStats: Record<string, number>   // ST_HP, ST_DEF, ST_CRITICAL_RATE pour scaling secondaire
}
```

**Comportement**
- Char selector : autocomplete avec portrait, filtrable par nom / élément / class.
- Switch char : reset `charFlags`, `extraStats`, `slot='S1'`, `skillLevel=5`, `additionalAttackEnabled=false`.
- Switch slot : reset `skillLevel=5`, `additionalAttackEnabled=false`.
- Per-char flags : carte affichée conditionnellement — la liste de flags exposés est dérivée de `getCharOverride(charId, slot).conditionals[].flag` (source de vérité = `char-overrides.ts` v2).
- ATK/CHD/PEN/DMG↑ : input numérique avec parse strict (NaN → précédente valeur conservée, jamais propagé au reducer).
- "Reset stats" : repart sur sentinelles documentées (ATK 10000, CHD 50, PEN 50, DMG↑ 0).

### 3.2 `TargetPanel`

```ts
interface TargetPanelProps {
  state: TargetState
  modes: ModeOption[]
  stages: StageOption[]            // chargés sur changement de mode
  monsters: MonsterOption[]        // chargés sur changement de stage
  onChange: (action: TargetAction) => void
}

interface ModeOption    { id: string; label: string }
interface StageOption   { id: string; label: string }
interface MonsterOption { id: string; name: string; element: string; isBoss: boolean }

interface TargetState {
  mode: string
  stageId: string | null
  monsterId: string | null
  monsterName: string | null
  element: string                // copié au moment de la sélection
  isBoss: boolean
  // Stats — auto-fetched ; override possible
  def: number
  dmgRed: number                 // %
  cdmgRed: number                // %
  hp: number | null              // requis pour BT_DMG_TARGET_STAT (Noa S2)
  // Flags : true = valeur courante vient de l'API ; false = édit manuelle
  statsAuto: { def: boolean; dmgRed: boolean; cdmgRed: boolean; hp: boolean }
  // Constantes formula (tunables debug)
  C: number                      // default 1000
  ratioDivisor: number           // default 1000
}
```

**Comportement**
- Cascade Mode → Stage → Monster ; chaque sélection charge la liste suivante via API.
- Auto-fill stats : appel `/api/admin/damage-lab/v2/monsters/[id]/stats?stageId=...`, sets `statsAuto.* = true`.
- Édit manuelle d'une stat : `statsAuto.X = false` (visuel : badge "manual" sur le champ).
- Bouton "re-auto" : re-fetch depuis l'API et reset `statsAuto.* = true`.
- Section "Constants" collapsible (avancé) — défauts 1000/1000.
- HP visible/requis uniquement si `isBoss=true` (pour les non-boss, target_stat scaling n'est pas validé).

### 3.3 `BuffsTogglesPanel`

```ts
interface BuffsTogglesPanelProps {
  catalog: ExternalBuffDef[]
  state: Record<string, ExternalBuffState>
  onToggle:      (id: string, active: boolean) => void
  onValueChange: (id: string, value: number) => void
}
```

**Comportement**
- 4 colonnes : Attacker buffs / Attacker debuffs / Target buffs / Target debuffs (groupes basés sur `def.side` × `def.direction`).
- Chaque ligne : checkbox + label + input numérique (signed pct ; valeur initiale = `defaultValue`, peut être overridée par l'opérateur).
- Désactivé visuel quand `active=false` (input grisé mais éditable pour preset avant activation).
- Mobile : 1 colonne par section, sections collapsibles.

### 3.4 `BossMechanicsPanel`

```ts
interface BossMechanicsPanelProps {
  override: BossOverride | null   // null = panneau caché
  state: Record<string, BossMechanicState>
  onToggle:      (id: string, active: boolean) => void
  onValueChange: (id: string, value: number) => void
}
```

**Comportement**
- Affiché uniquement si `override !== null` (résolu par `getBossOverride(target.monsterId)`).
- Header : nom du boss.
- Liste de mécaniques : checkbox + label + input numérique (multiplicateur, default `defaultValue`).
- Tooltip sur chaque mécanique avec la description longue (`BossMechanicDef.description`).

### 3.5 `ResultPanel`

```ts
interface ResultPanelProps {
  result: RecomputeResult | null     // null si form incomplet
  ctx: RecomputeContext              // pour Save observation
  showDebug: boolean
  onToggleDebug: (on: boolean) => void
  onSaveObs: (obs: NewObservation) => Promise<void>
}

interface NewObservation {
  observed: number
  note?: string
  // Le reste est dérivé de `ctx` côté API
}
```

**Sections internes**
- **Computed value** : nombre principal, format groupé (`1 234 567`).
- **Breakdown components** : main / extra / additional (3 colonnes desktop, stacked mobile).
- **Pipeline detail** (collapsible, ouvert si `showDebug`) :
  - mit, rate (avant cap), rate (après cap rateMin=0.30), elemMult, markingMult, finalReducePct.
  - reduced.* : poolPct, chdBonus, penBonus, addAtkNoPool, addAtkNoPoolPermille.
  - debugSteps[] : trace f32 chronologique reducer + formula.
- **Active buffs** : liste compacte (id + value contributive).
- **[Save observation]** : ouvre un dialog inline avec input `observed` + optionnel `note`. Désactivé si `result == null` ou `ctx.charId == ''`.

### 3.6 `ObsTable`

```ts
interface ObsTableProps {
  obs: SavedObservation[]
  recompute: (ctx: RecomputeContext) => RecomputeResult
  onLoadIntoForm: (obs: SavedObservation) => void
  onDelete:       (id: string) => void
}

interface SavedObservation {
  id: string                       // uuid
  createdAt: string                // ISO
  observed: number
  note?: string
  ctx: RecomputeContext            // tout le contexte source — recompute déterministe
  calculatedAtSave: number         // cache au moment de la save (audit)
}
```

**Comportement**
- Recompute live de chaque ligne : `recompute(obs.ctx).calculated` → Δ = obs − calc, ratio = obs / calc.
- Color-code : ratio ∈ [0.98, 1.02] green, [0.95, 1.05] amber, sinon red.
- Click sur ligne : `onLoadIntoForm(obs)` repopule attacker + target + buffs depuis `obs.ctx`.
- Bouton supprimer (avec confirm).
- Filtres optionnels (top de table) : par charId / monsterId / slot.
- Tri : par défaut `createdAt` desc.

---

## 4. State global (reducer)

```ts
interface FormState {
  attacker: AttackerState
  target: TargetState
  externalBuffs: Record<string, ExternalBuffState>
  bossMechanics: Record<string, BossMechanicState>
  ui: { showDebug: boolean }
}

type FormAction =
  // Attacker
  | { type: 'attacker/patch';        patch: Partial<AttackerState> }
  | { type: 'attacker/setChar';      charId: string }       // reset charFlags + extraStats + slot/skillLevel + addAtk
  | { type: 'attacker/setSlot';      slot: SlotTag }        // reset skillLevel + addAtk
  | { type: 'attacker/setFlag';      flag: keyof CharFlags; value: boolean }
  // Target
  | { type: 'target/setMode';        mode: string }                // reset stage/monster
  | { type: 'target/setStage';       stageId: string }             // reset monster
  | { type: 'target/setMonster';     monster: MonsterOption }      // reset isBoss/element + auto-fill prêt
  | { type: 'target/autoFillStats';  stats: { def: number; dmgRed: number; cdmgRed: number; hp: number | null } }
  | { type: 'target/manualEditStat'; field: 'def'|'dmgRed'|'cdmgRed'|'hp'; value: number }
  | { type: 'target/setConstants';   C?: number; ratioDivisor?: number }
  // Buffs/debuffs externes
  | { type: 'externalBuff/toggle';     id: string; active: boolean }
  | { type: 'externalBuff/setValue';   id: string; value: number }
  // Boss mechanics
  | { type: 'bossMechanic/toggle';     id: string; active: boolean }
  | { type: 'bossMechanic/setValue';   id: string; value: number }
  | { type: 'bossMechanic/init';       override: BossOverride | null }   // déclenché par target/setMonster
  // UI
  | { type: 'ui/toggleDebug' }
  // Form-level
  | { type: 'form/loadFromObs'; obs: SavedObservation }
  | { type: 'form/reset' }
```

### Default state

```ts
function makeDefaultFormState(): FormState {
  return {
    attacker: {
      charId: '', slot: 'S1', skillLevel: 5,
      atk: 10000, chd: 50, pen: 50, dmgInc: 0,
      crit: false, applyQuirks: true,
      additionalAttackEnabled: false,
      charFlags: {}, extraStats: {},
    },
    target: {
      mode: '', stageId: null, monsterId: null, monsterName: null,
      element: '', isBoss: false,
      def: 1000, dmgRed: 0, cdmgRed: 0, hp: null,
      statsAuto: { def: true, dmgRed: true, cdmgRed: true, hp: true },
      C: 1000, ratioDivisor: 1000,
    },
    externalBuffs: makeDefaultExternalBuffsState(),
    bossMechanics: {},   // rempli par bossMechanic/init quand monster sélectionné
    ui: { showDebug: false },
  }
}
```

---

## 5. Mapping `FormState` → `RecomputeContext`

```ts
function buildRecomputeCtx(
  state: FormState,
  char: CharSummary,
  skillData: { damageFactor: number; additionalAttackRatio?: number },
): RecomputeContext {
  return {
    // Identité
    charId:       state.attacker.charId,
    charElement:  char.element,
    charClass:    char.class,
    charSubclass: char.subclass,
    // Skill
    slot:                  state.attacker.slot,
    damageFactor:          skillData.damageFactor,
    additionalAttackRatio: state.attacker.additionalAttackEnabled
      ? skillData.additionalAttackRatio
      : undefined,
    // Caster inputs
    atk:         state.attacker.atk,
    chd:         state.attacker.chd,
    pen:         state.attacker.pen,
    dmgInc:      state.attacker.dmgInc,
    applyQuirks: state.attacker.applyQuirks,
    extraStats:  state.attacker.extraStats,
    // Target inputs
    targetDef:     state.target.def,
    targetDmgRed:  state.target.dmgRed,
    targetCdmgRed: state.target.cdmgRed,
    targetHp:      state.target.hp ?? undefined,
    isBoss:        state.target.isBoss,
    elem:          detectElementRelation(char.element, state.target.element),
    crit:          state.attacker.crit,
    mode:          state.target.mode,
    monsterId:     state.target.monsterId ?? undefined,
    // Char-specific
    charFlags: state.attacker.charFlags,
    // Constantes
    C:            state.target.C,
    ratioDivisor: state.target.ratioDivisor,
    // Toggles externes
    externalBuffs: state.externalBuffs,
    bossMechanics: state.bossMechanics,
    // Pas de f32arithmetic — toujours actif en v2
    // debugSteps : toujours produit côté pipeline ; l'UI affiche selon ui.showDebug
  }
}
```

---

## 6. Persistence

### `localStorage`
- Clé : `damage-lab-form-v2`.
- Format : `{ version: 2, state: FormState }`.
- Lecture : si `version !== 2` ou parse fail → ignore et repart sur defaults.
- Sauve : sur chaque action du reducer (debounced 200 ms).
- Pas de migration depuis `damage-lab-form-v1` — la v2 démarre avec defaults.

### Observations API
- `GET    /api/admin/damage-lab/v2/observations`            → `SavedObservation[]`
- `POST   /api/admin/damage-lab/v2/observations`            → save (génère `id`, `createdAt`, `calculatedAtSave`)
- `DELETE /api/admin/damage-lab/v2/observations/[id]`
- Backend : append-only JSONL `data/admin/damage-lab-observations-v2.jsonl`
- Pas de migration depuis v1 — l'opérateur re-saisit les obs validées en v2.

---

## 7. UX rules

1. **Computed value visible at all times** — pas de bouton "Calculate". Action reducer → `ResultPanel` re-render.
2. **Auto-fill non-destructive** — si `statsAuto.X = false`, un re-fetch ne l'écrase pas sans clic explicite "re-auto".
3. **Per-char flags** — uniquement visibles si le char a des `conditionals` dans `char-overrides.ts`. Carte cachée sinon.
4. **Boss mechanics** — section masquée tant que `getBossOverride(monsterId) == null`.
5. **Debug toggle** — ouvre breakdown détaillé + f32 trace. Off par défaut, persisté dans `ui.showDebug`.
6. **Save obs** — bouton désactivé si `observed <= 0` ou `result == null`.
7. **Mobile** — pas de masquage de fonctionnalité, seulement reflow + sections collapsibles.
8. **Erreurs API** — banner inline non-bloquant ; le form reste utilisable avec stats éditées manuellement.

---

## 8. Découpage composants → fichiers

```
src/app/admin/damage-lab/v2/
  page.tsx                           # entry, monte le reducer, pose le layout
  _components/
    AttackerPanel.tsx
    TargetPanel.tsx
    BuffsTogglesPanel.tsx
    BossMechanicsPanel.tsx
    ResultPanel.tsx
    ObsTable.tsx
    CharPicker.tsx                   # autocomplete char (utilisé par AttackerPanel)
    MonsterPicker.tsx                # cascade mode/stage/monster (utilisé par TargetPanel)
    PerCharFlags.tsx                 # rend dynamiquement les flags du char courant
  _state/
    reducer.ts                       # FormState + actions + reducer fn
    persistence.ts                   # localStorage load/save versionné
    selectors.ts                     # buildRecomputeCtx(state, char, skillData)
  _api/
    chars.ts                         # GET helper /v2/chars
    monsters.ts                      # GET helpers /v2/stages, /v2/monsters/[id]/stats
    skills.ts                        # GET helper /v2/skills/[id]?level=N (DF + addAttack ratio)
    observations.ts                  # CRUD obs helper
```

---

## 9. Questions ouvertes (à valider avant PR 6)

1. **Char catalog** : nouveau `/api/admin/damage-lab/v2/chars` ou réutiliser un endpoint existant (la v1 doit déjà avoir un loader) ? À pinpointer en PR 2 quand on scaffold.
2. **Skill DF lookup** : actuellement la v1 fetch comment le `damageFactor` ? À auditer en PR 2 ; possiblement nouveau `/api/admin/damage-lab/v2/skills/[id]?level=N` qui renvoie `{ damageFactor, additionalAttackRatio }`.
3. **Per-char flags catalog** : pour l'instant uniquement Ame. Proposition : les flags vivent dans `char-overrides.ts` v2 et l'UI les déduit du `CharOverride.conditionals[].flag` (pas de duplication). Si un char a des flags hors conditionals (ex: scaling toggle), on étend l'API du module.
4. **Filtres ObsTable** : par charId / monsterId / slot dès la v2 ? Je propose oui — coût minime, gain réel quand la table grossit.
5. **CharPicker scope** : tous les chars du datamine ou seulement ceux qui ont au moins une obs / un override ? Proposition : tous, ordre alpha, avec un filtre élément en topbar.
6. **`extraStats` UI** : actuellement champ générique pour ST_HP/ST_DEF/ST_CRITICAL_RATE. v2 → on l'expose comment dans `AttackerPanel` ? Je propose un dépliant "Secondary stats" avec uniquement les ST_* nécessaires au char courant (déduit des buffs `scaling_*` du char dans `extract-buffs.ts`).
