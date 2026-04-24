'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { computeDamage, type DamageInputs } from '@/lib/damage/formula'

const LS_FORM_KEY = 'damage-lab-form-v7'
const AUTO_SAVE_DEBOUNCE_MS = 1500
const SKILL_LEVEL = 5  // all observations at skill lvl 5

interface PersistedForm {
  characterId: string
  atk: string; chdPct: string; penPct: string; dmgIncPct: string
  def: string; tgtCdmgRedPct: string; tgtDmgRedPct: string
  elemental: 'none' | 'adv' | 'disadv'
  isBoss: boolean; quirksDisabled: boolean
  slot: 'first' | 'second' | 'ultimate'; crit: boolean
  note: string
  C: string; ratioDivisor: string
  // Target origin from stage picker
  modeLabel: string
  stageId: string
  monsterKey: string  // `${monsterId}@${level}` — identifies a monster row within a stage
  // Character quirks
  transcendLevel: TranscendLevel
  disabledQuirkIds: string[]  // nodeIds the user has unticked; all applicable quirks are ON by default
  heroCodexLevel: number  // player's Hero Codex progression level (1..11)
}

interface SkillData {
  skillId: string
  damageFactors: (number | null)[]
}

type TranscendLevel = '0' | '3' | '4_1' | '4_2' | '5_1' | '5_2' | '5_3' | '6'
const TRANSCEND_LEVELS: TranscendLevel[] = ['0', '3', '4_1', '4_2', '5_1', '5_2', '5_3', '6']
const TRANSCEND_LABELS: Record<TranscendLevel, string> = {
  '0': 'Lv0', '3': 'Lv3', '4_1': 'Lv4-1', '4_2': 'Lv4-2',
  '5_1': 'Lv5-1', '5_2': 'Lv5-2', '5_3': 'Lv5-3', '6': 'Lv6',
}

interface CharacterEntry {
  id: string
  name: string
  element: string
  class: string
  subClass: string
  atkMax: number                      // lvl 100 base (no gear/evo/awaken)
  defMax: number
  hpMax: number
  chdMax: number                      // %
  critRateMax: number                 // %
  transcendAtkBonus: Record<TranscendLevel, number>
  evolutionBonuses: {
    atkFlat: number
    defFlat: number
    hpFlat: number
    critRateFlat: number
    critDmgFlat: number
  }
  classPassive: {
    atkPct: number; atkFlat: number
    defPct: number; defFlat: number
    hpPct: number;  hpFlat: number
    chdPct: number
    critRatePct: number
    penPct: number
    poolPct: number
  }
  skills: {
    first: SkillData | null
    second: SkillData | null
    ultimate: SkillData | null
  }
}

// Outerplane rock-paper-scissors element matrix.
// Fire > Earth > Water > Fire. Light/Dark are handled as neutral here since the
// formula doesn't yet model their separate +30% rule; user can toggle adv/disadv manually.
const ELEMENT_ADV: Record<string, string> = { Fire: 'Earth', Earth: 'Water', Water: 'Fire' }
function detectElementRelation(attacker: string, target: string): 'adv' | 'disadv' | 'none' {
  if (!attacker || !target || attacker === target) return 'none'
  if (ELEMENT_ADV[attacker] === target) return 'adv'
  if (ELEMENT_ADV[target] === attacker) return 'disadv'
  return 'none'
}

interface QuirkEffect {
  target: 'pool' | 'atk' | 'chd' | 'pen' | 'critRate'
  unit: '%' | 'flat'
  amount: number
  requires?: 'adv' | 'disadv' | 'neutral' | 'crit' | 'boss' | null
}
interface QuirkEntry {
  nodeId: string
  group: 'ELEMENTAL' | 'JOB' | 'UTILITY' | 'PVE' | 'ADVENTURE_LICENSE'
  name: string
  desc: string
  maxLevel: number
  enabledByDefault: boolean
  appliesTo: { kind: 'element' | 'class' | 'subclass' | 'none'; value: string | null }
  source: {
    buffId: string; buffType: string; statType: string
    applyingType: string; value: number; condition: string; optionType: string
  }
  effect: QuirkEffect | null
}

interface Observation {
  id: string
  ts: string
  char: string
  charId: string
  class?: string
  element?: string
  slot: 'S1' | 'S2' | 'S3'
  df: number
  atk: number
  chd: number
  dmgInc: number            // full additive pool % (gear + passives + quirks user believes)
  pen: number
  def: number
  tCdmgRed: number
  tDmgRed: number
  elem: 'none' | 'adv' | 'disadv'
  isBoss?: boolean
  quirksDisabled?: boolean
  crit: boolean
  obs: number
  note?: string
  // Target origin (set when loaded from game data)
  monsterId?: string
  monsterName?: string
  monsterLvl?: number
  tClass?: string
  tElement?: string
  stageId?: string
  stageName?: string
  mode?: string
}

interface StageMonster {
  monsterId: string
  name: string
  type: string
  isBoss: boolean
  class: string
  element: string
  subClass: string
  level: number
  defMin: number
  defMax: number
  drMax: number
  atkMin: number
  atkMax: number
  defAtLevel: number
  drPctAtLevel: number
  atkAtLevel: number
  position: number
  slot: number
}

interface StageEntry {
  id: string
  name: string
  recommendLevel: number
  monsters: StageMonster[]
}

interface ModeEntry {
  mode: string
  label: string
  stages: StageEntry[]
}

type SlotKey = 'first' | 'second' | 'ultimate'
type SlotTag = 'S1' | 'S2' | 'S3'
const SLOT_LABELS: Record<SlotKey, SlotTag> = { first: 'S1', second: 'S2', ultimate: 'S3' }

const NUMBER_INPUT = 'w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-right text-sm text-zinc-100 focus:border-blue-500 focus:outline-none'

function num(v: string, fallback = 0): number {
  const n = parseFloat(v.replace(',', '.'))
  return Number.isFinite(n) ? n : fallback
}

export default function DamageLabPage() {
  // Data
  const [characters, setCharacters] = useState<CharacterEntry[]>([])
  const [observations, setObservations] = useState<Observation[]>([])
  const [modes, setModes] = useState<ModeEntry[]>([])
  const [heroCodexLevels, setHeroCodexLevels] = useState<{ level: number; atkPct: number; defPct: number; hpPct: number }[]>([])
  const [heroCodexLevel, setHeroCodexLevel] = useState<number>(11)  // default to max (fully unlocked codex)
  const [loading, setLoading] = useState(true)

  // Target picker (Mode → Stage → Monster)
  const [modeLabel, setModeLabel] = useState('')
  const [stageId, setStageId] = useState('')
  const [monsterKey, setMonsterKey] = useState('')  // `${monsterId}@${level}`

  // Character quirks (user-controllable, auto-set from context)
  const [transcendLevel, setTranscendLevel] = useState<TranscendLevel>('6')
  const [disabledQuirkIds, setDisabledQuirkIds] = useState<Set<string>>(new Set())
  const [allQuirks, setAllQuirks] = useState<QuirkEntry[]>([])

  // Attacker
  const [characterId, setCharacterId] = useState('')
  const [atk, setAtk] = useState('')
  const [chdPct, setChdPct] = useState('')
  const [penPct, setPenPct] = useState('0')
  const [dmgIncPct, setDmgIncPct] = useState('0')

  // Target
  const [def, setDef] = useState('')
  const [tgtCdmgRedPct, setTgtCdmgRedPct] = useState('0')
  const [tgtDmgRedPct, setTgtDmgRedPct] = useState('0')
  // Metadata tags (NOT used by formula — just attached to observation for later analysis)
  const [elemental, setElemental] = useState<'none' | 'adv' | 'disadv'>('none')
  const [isBoss, setIsBoss] = useState(false)
  const [quirksDisabled, setQuirksDisabled] = useState(false)

  // Skill (always level 5 per convention)
  const [slot, setSlot] = useState<SlotKey>('first')
  const skillLevel = SKILL_LEVEL

  // Result
  const [crit, setCrit] = useState(false)
  const [observed, setObserved] = useState('')
  const [note, setNote] = useState('')

  // Formula constants (tunable)
  const [C, setC] = useState('1000')
  const [ratioDivisor, setRatioDivisor] = useState('1000')

  const [saveStatus, setSaveStatus] = useState<'idle' | 'pending' | 'saving' | 'saved' | 'error'>('idle')
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const formHydrated = useRef(false)
  const prevAtkKeyRef = useRef<string | null>(null)
  const prevElemKeyRef = useRef<string | null>(null)

  useEffect(() => {
    Promise.all([
      fetch('/api/admin/damage-lab/characters').then(r => r.json()),
      fetch('/api/admin/damage-lab/observations').then(r => r.json()),
      fetch('/api/admin/damage-lab/stages').then(r => r.json()),
      fetch('/api/admin/damage-lab/quirks').then(r => r.json()),
    ]).then(([chars, obs, st, qk]) => {
      setCharacters(chars.characters ?? [])
      setObservations(obs.observations ?? [])
      setModes(st.modes ?? [])
      setAllQuirks(qk.quirks ?? [])
      setHeroCodexLevels(chars.heroCodexLevels ?? [])
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_FORM_KEY)
      if (raw) {
        const p = JSON.parse(raw) as Partial<PersistedForm>
        if (p.characterId != null) setCharacterId(p.characterId)
        if (p.atk != null) setAtk(p.atk)
        if (p.chdPct != null) setChdPct(p.chdPct)
        if (p.penPct != null) setPenPct(p.penPct)
        if (p.dmgIncPct != null) setDmgIncPct(p.dmgIncPct)
        if (p.def != null) setDef(p.def)
        if (p.tgtCdmgRedPct != null) setTgtCdmgRedPct(p.tgtCdmgRedPct)
        if (p.tgtDmgRedPct != null) setTgtDmgRedPct(p.tgtDmgRedPct)
        if (p.elemental != null) setElemental(p.elemental)
        if (p.isBoss != null) setIsBoss(p.isBoss)
        if (p.quirksDisabled != null) setQuirksDisabled(p.quirksDisabled)
        if (p.slot != null) setSlot(p.slot)
        if (p.crit != null) setCrit(p.crit)
        if (p.note != null) setNote(p.note)
        if (p.C != null) setC(p.C)
        if (p.ratioDivisor != null) setRatioDivisor(p.ratioDivisor)
        if (p.modeLabel != null) setModeLabel(p.modeLabel)
        if (p.stageId != null) setStageId(p.stageId)
        if (p.monsterKey != null) setMonsterKey(p.monsterKey)
        if (p.transcendLevel != null) setTranscendLevel(p.transcendLevel)
        if (Array.isArray(p.disabledQuirkIds)) setDisabledQuirkIds(new Set(p.disabledQuirkIds))
        if (typeof p.heroCodexLevel === 'number') setHeroCodexLevel(p.heroCodexLevel)
      }
    } catch { /* ignore corrupt storage */ }
    formHydrated.current = true
  }, [])

  useEffect(() => {
    if (!formHydrated.current) return
    const p: PersistedForm = {
      characterId, atk, chdPct, penPct, dmgIncPct,
      def, tgtCdmgRedPct, tgtDmgRedPct, elemental,
      isBoss, quirksDisabled,
      slot, crit, note, C, ratioDivisor,
      modeLabel, stageId, monsterKey,
      transcendLevel, disabledQuirkIds: Array.from(disabledQuirkIds),
      heroCodexLevel,
    }
    try { localStorage.setItem(LS_FORM_KEY, JSON.stringify(p)) } catch { /* quota etc. */ }
  }, [characterId, atk, chdPct, penPct, dmgIncPct,
      def, tgtCdmgRedPct, tgtDmgRedPct, elemental,
      isBoss, quirksDisabled,
      slot, crit, note, C, ratioDivisor,
      modeLabel, stageId, monsterKey,
      transcendLevel, disabledQuirkIds, heroCodexLevel])

  const selectedChar = useMemo(
    () => characters.find(c => c.id === characterId) ?? null,
    [characters, characterId]
  )

  // Filter gift nodes to those applicable to the selected character.
  // Applicability is defined by the node's appliesTo kind/value vs the character's
  // element / class / subclass. "none" (utility/PVE/adv-license) applies to everyone.
  const applicableQuirks = useMemo<QuirkEntry[]>(() => {
    if (!selectedChar) return []
    const charEl = selectedChar.element
    const charCls = selectedChar.class
    const charSub = (selectedChar.subClass ?? '').toUpperCase()
    return allQuirks.filter(q => {
      switch (q.appliesTo.kind) {
        case 'element':  return q.appliesTo.value === charEl
        case 'class':    return q.appliesTo.value === charCls
        case 'subclass': return q.appliesTo.value === charSub
        case 'none':     return true
      }
    })
  }, [allQuirks, selectedChar])

  // Sum unconditional stat quirks (ATK/CHD/PEN/Crit Rate) from enabled applicable
  // quirks. These feed into the prefill because the in-game character screen already
  // shows them baked into the displayed stats (so we want auto-fill to match).
  const statQuirkBonuses = useMemo(() => {
    const bonus = {
      atkPct: 0, atkFlat: 0,
      chdPct: 0, chdFlat: 0,
      penPct: 0, penFlat: 0,
      crPct: 0,  crFlat: 0,
    }
    for (const q of applicableQuirks) {
      if (disabledQuirkIds.has(q.nodeId)) continue
      const e = q.effect
      if (!e) continue
      if (e.requires) continue  // conditional: only applies in combat, not to displayed stats
      const isRate = e.unit === '%'
      if (e.target === 'atk')      isRate ? bonus.atkPct += e.amount : bonus.atkFlat += e.amount
      else if (e.target === 'chd') isRate ? bonus.chdPct += e.amount : bonus.chdFlat += e.amount
      else if (e.target === 'pen') isRate ? bonus.penPct += e.amount : bonus.penFlat += e.amount
      else if (e.target === 'critRate') isRate ? bonus.crPct += e.amount : bonus.crFlat += e.amount
    }
    return bonus
  }, [applicableQuirks, disabledQuirkIds])

  // Effective base stats at the current transcend level + active unconditional stat quirks.
  // Pattern: (base + flat adds) × (1 + transcend%) × (1 + sum of stat% quirks).
  // For CHD / PEN / CritRate, rates add as percentage points (not multiplicative),
  // matching how the in-game screen displays them.
  const heroCodex = useMemo(() => heroCodexLevels.find(l => l.level === heroCodexLevel) ?? { atkPct: 0, defPct: 0, hpPct: 0 }, [heroCodexLevels, heroCodexLevel])

  const effectiveBase = useMemo(() => {
    if (!selectedChar) return { atk: 0, def: 0, hp: 0, chd: 0, pen: 0, critRate: 0 }
    const t = selectedChar.transcendAtkBonus?.[transcendLevel] ?? 0
    const evo = selectedChar.evolutionBonuses
    const cp = selectedChar.classPassive
    // Empirically validated on **Rin** (3★, Striker, no class ATK passive): the game
    // scales the base Atk_Max differently from evolution/gift flats. Hero Codex applies
    // ONLY to statMax; transcend + class passive + quirks apply to both.
    //
    //   stat = statMax × (1 + trans + codex + classPct + quirkPct)
    //        + evoFlat × (1 + trans + classPct + quirkPct)
    //        + giftFlat × (1 + trans + classPct + quirkPct)
    //
    // Validated:
    //   Rin ATK: 930 × 1.40 + 169 × 1.30 = 1521 (user 1520, off −1) ✓
    //   Rin HP:  3481 × 1.40 + 403 × 1.30 = 5397 (user 5397, EXACT) ✓
    //   Tio ATK (w/ 200 gift): 624 × 1.40 + 200 × 1.30 = 1133 (user 1133, EXACT) ✓
    function calcStat(statMax: number, evoFlat: number, cpFlat: number, quirkFlat: number, cpPct: number, quirkPct: number, extraCodexOnlyOnBase: number): number {
      const onBase = t + extraCodexOnlyOnBase + cpPct + quirkPct
      const onEvo  = t + cpPct + quirkPct
      return Math.floor(statMax * (1 + onBase / 100) + (evoFlat + cpFlat + quirkFlat) * (1 + onEvo / 100))
    }
    const atk = calcStat(selectedChar.atkMax, evo.atkFlat, cp.atkFlat, statQuirkBonuses.atkFlat, cp.atkPct, statQuirkBonuses.atkPct, heroCodex.atkPct)
    const def = calcStat(selectedChar.defMax, evo.defFlat, cp.defFlat, 0,                        cp.defPct, 0,                       heroCodex.defPct)
    const hp  = calcStat(selectedChar.hpMax,  evo.hpFlat,  cp.hpFlat,  0,                        cp.hpPct,  0,                       heroCodex.hpPct)
    // CHD / Crit Rate / PEN: additive percentage points (already per-mille ÷10 from APIs).
    const chd = selectedChar.chdMax + evo.critDmgFlat + cp.chdPct + statQuirkBonuses.chdPct + statQuirkBonuses.chdFlat
    const pen = cp.penPct + statQuirkBonuses.penPct + statQuirkBonuses.penFlat
    const critRate = selectedChar.critRateMax + evo.critRateFlat + cp.critRatePct + statQuirkBonuses.crPct + statQuirkBonuses.crFlat
    return {
      atk, def, hp,
      chd: Math.round(chd * 10) / 10,
      pen: Math.round(pen * 10) / 10,
      critRate: Math.round(critRate * 10) / 10,
    }
  }, [selectedChar, transcendLevel, statQuirkBonuses, heroCodex])

  // Auto-fill ATK / CHD / PEN with lvl 100 + transcend + stat-quirk values when the user
  // switches characters, transcend, OR toggles a quirk (enabling it to reflect in the
  // prefilled stats). Key-diff ref gates the first post-hydration render so saved fields
  // aren't clobbered on F5 / page load.
  useEffect(() => {
    if (!formHydrated.current) return
    if (!selectedChar) return
    const key = `${selectedChar.id}/${transcendLevel}/${effectiveBase.atk}/${effectiveBase.chd}/${effectiveBase.pen}`
    const prev = prevAtkKeyRef.current
    prevAtkKeyRef.current = key
    if (prev === null) return
    if (prev === key) return
    setAtk(String(effectiveBase.atk))
    setChdPct(String(effectiveBase.chd))
    setPenPct(String(effectiveBase.pen))
  }, [selectedChar, transcendLevel, effectiveBase])

  // When the user picks a DIFFERENT character, reset any unchecked quirks but honor
  // each quirk's enabledByDefault flag (e.g. ADVENTURE_LICENSE is off by default).
  const prevCharForResetRef = useRef<string | null>(null)
  useEffect(() => {
    if (!formHydrated.current) return
    const id = selectedChar?.id ?? ''
    const prev = prevCharForResetRef.current
    prevCharForResetRef.current = id
    if (prev === null || prev === id) return
    const off = new Set<string>()
    for (const q of applicableQuirks) if (!q.enabledByDefault) off.add(q.nodeId)
    setDisabledQuirkIds(off)
  }, [selectedChar, applicableQuirks])

  // First-time init (no saved disabledQuirkIds in localStorage): auto-disable every
  // quirk marked `enabledByDefault: false` (ADVENTURE_LICENSE nodes). Runs once when
  // allQuirks first becomes populated. Subsequent toggles persist via LS.
  const quirksInitializedRef = useRef(false)
  useEffect(() => {
    if (!formHydrated.current) return
    if (quirksInitializedRef.current) return
    if (allQuirks.length === 0) return
    quirksInitializedRef.current = true
    if (disabledQuirkIds.size > 0) return  // user already has saved toggles
    const off = new Set<string>()
    for (const q of allQuirks) if (!q.enabledByDefault) off.add(q.nodeId)
    if (off.size > 0) setDisabledQuirkIds(off)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allQuirks])

  const selectedMode = useMemo(
    () => modes.find(m => m.label === modeLabel) ?? null,
    [modes, modeLabel]
  )
  const selectedStage = useMemo(
    () => selectedMode?.stages.find(s => s.id === stageId) ?? null,
    [selectedMode, stageId]
  )
  const selectedMonster = useMemo(
    () => selectedStage?.monsters.find(m => `${m.monsterId}@${m.level}` === monsterKey) ?? null,
    [selectedStage, monsterKey]
  )

  // Auto-detect element advantage/disadvantage when both attacker and target elements
  // are known (char loaded + monster loaded from stage). Same seed-then-fire ref
  // pattern so saved values aren't clobbered on hydration.
  useEffect(() => {
    if (!formHydrated.current) return
    const tgtElement = selectedMonster?.element ?? ''
    const srcElement = selectedChar?.element ?? ''
    const key = `${srcElement}>${tgtElement}`
    const prev = prevElemKeyRef.current
    prevElemKeyRef.current = key
    if (prev === null) return
    if (prev === key) return
    if (!srcElement || !tgtElement) return
    setElemental(detectElementRelation(srcElement, tgtElement))
  }, [selectedChar, selectedMonster])

  // When the user picks a monster, auto-fill DEF / DR / isBoss from the computed stats.
  // Editable afterwards — the user can still tweak manually.
  function applyMonster(m: StageMonster) {
    setDef(m.defAtLevel.toFixed(4))
    setTgtDmgRedPct(m.drPctAtLevel.toFixed(4))
    setIsBoss(m.isBoss)
  }

  function handleSelectMode(label: string) {
    setModeLabel(label)
    setStageId('')
    setMonsterKey('')
  }
  function handleSelectStage(id: string) {
    setStageId(id)
    const stage = selectedMode?.stages.find(s => s.id === id)
    // Auto-pick the first boss if any, otherwise the first monster
    const first = stage?.monsters.find(m => m.isBoss) ?? stage?.monsters[0]
    if (first) {
      const key = `${first.monsterId}@${first.level}`
      setMonsterKey(key)
      applyMonster(first)
    } else {
      setMonsterKey('')
    }
  }
  function handleSelectMonster(key: string) {
    setMonsterKey(key)
    const m = selectedStage?.monsters.find(mm => `${mm.monsterId}@${mm.level}` === key)
    if (m) applyMonster(m)
  }
  function clearTargetPicker() {
    setModeLabel('')
    setStageId('')
    setMonsterKey('')
  }

  const currentSkill = selectedChar?.skills[slot] ?? null
  const damageFactor = currentSkill?.damageFactors[skillLevel - 1] ?? null

  // Whether a quirk's condition is satisfied by the current formula state.
  // A null `requires` (unconditional) always matches.
  function conditionMatches(requires: QuirkEffect['requires']): boolean {
    if (!requires) return true
    if (requires === 'adv')     return elemental === 'adv'
    if (requires === 'disadv')  return elemental === 'disadv'
    if (requires === 'neutral') return elemental === 'none'
    if (requires === 'crit')    return crit
    if (requires === 'boss')    return isBoss
    return false
  }

  // Aggregate pool contributions (BT_DMG / ST_DMG_BOOST) from all enabled applicable
  // quirks whose condition currently matches. Stat-type quirks (ST_ATK, ST_CRITICAL_DMG_RATE,
  // ST_PIERCE_POWER_RATE) are displayed informationally but NOT auto-applied — the user's
  // in-game ATK/CHD/PEN already include those stat bonuses from their unlocked gift tree.
  const { poolBonus, activeQuirks } = useMemo(() => {
    let bonus = 0
    const active: QuirkEntry[] = []
    for (const q of applicableQuirks) {
      if (disabledQuirkIds.has(q.nodeId)) continue
      if (!q.effect) continue
      if (!conditionMatches(q.effect.requires)) continue
      if (q.effect.target === 'pool' && q.effect.unit === '%') {
        bonus += q.effect.amount
        active.push(q)
      }
    }
    return { poolBonus: bonus, activeQuirks: active }
  }, [applicableQuirks, disabledQuirkIds, elemental, crit, isBoss])

  const computation = useMemo(() => {
    if (damageFactor == null) return null
    const effectiveDmgInc = num(dmgIncPct) + poolBonus
    const inputs: DamageInputs = {
      atk: num(atk),
      damageFactor,
      chdPct: num(chdPct),
      penPct: num(penPct),
      dmgIncPct: effectiveDmgInc,
      crit,
      // charClass intentionally blank — the Mage +12% now comes from the quirks data
      // (MAGE_PASSIVE_3_10 via JOB02 MAIN) rather than the formula's hardcoded branch.
      charClass: '',
      def: num(def),
      cdmgRedPct: num(tgtCdmgRedPct),
      dmgRedPct: num(tgtDmgRedPct),
      isBoss,
      elem: elemental,
      C: num(C, 1000),
      ratioDivisor: num(ratioDivisor, 1000),
    }
    return computeDamage(inputs)
  }, [atk, damageFactor, chdPct, penPct, dmgIncPct, poolBonus, crit, def, tgtCdmgRedPct, tgtDmgRedPct, isBoss, elemental, C, ratioDivisor])

  const observedNum = observed.trim() === '' ? null : num(observed)
  const ratio = computation && observedNum != null && computation.calculated > 0
    ? observedNum / computation.calculated
    : null

  const matchBadge = ratio == null ? null :
    Math.abs(ratio - 1) <= 0.02
      ? <span className="rounded bg-green-900/40 px-2 py-0.5 text-xs text-green-400">match ±2%</span>
      : Math.abs(ratio - 1) <= 0.05
        ? <span className="rounded bg-amber-900/40 px-2 py-0.5 text-xs text-amber-400">off ±5%</span>
        : <span className="rounded bg-red-900/40 px-2 py-0.5 text-xs text-red-400">mismatch</span>

  async function saveObservation() {
    if (!selectedChar || damageFactor == null || observedNum == null) return
    setSaveStatus('saving')
    const payload: Omit<Observation, 'id' | 'ts'> = {
      char: selectedChar.name,
      charId: selectedChar.id,
      class: selectedChar.class,
      element: selectedChar.element,
      slot: SLOT_LABELS[slot],
      df: damageFactor,
      atk: num(atk),
      chd: num(chdPct),
      dmgInc: num(dmgIncPct),
      pen: num(penPct),
      def: num(def),
      tCdmgRed: num(tgtCdmgRedPct),
      tDmgRed: num(tgtDmgRedPct),
      elem: elemental,
      isBoss,
      quirksDisabled,
      crit,
      obs: observedNum,
      ...(note.trim() ? { note: note.trim() } : {}),
      ...(selectedMonster ? {
        monsterId: selectedMonster.monsterId,
        monsterName: selectedMonster.name,
        monsterLvl: selectedMonster.level,
        tClass: selectedMonster.class,
        tElement: selectedMonster.element,
      } : {}),
      ...(selectedStage ? {
        stageId: selectedStage.id,
        stageName: selectedStage.name,
      } : {}),
      ...(selectedMode ? { mode: selectedMode.mode } : {}),
    }
    try {
      const res = await fetch('/api/admin/damage-lab/observations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (data.ok) {
        setObservations(prev => [...prev, data.observation])
        setObserved('')
        setNote('')
        setSaveStatus('saved')
        setTimeout(() => setSaveStatus(s => (s === 'saved' ? 'idle' : s)), 2000)
      } else {
        setSaveStatus('error')
      }
    } catch {
      setSaveStatus('error')
    }
  }

  const canAutoSave = !!selectedChar && damageFactor != null && observedNum != null
  useEffect(() => {
    if (autoSaveTimer.current) { clearTimeout(autoSaveTimer.current); autoSaveTimer.current = null }
    if (!canAutoSave) { setSaveStatus(s => (s === 'pending' ? 'idle' : s)); return }
    setSaveStatus('pending')
    autoSaveTimer.current = setTimeout(() => { saveObservation() }, AUTO_SAVE_DEBOUNCE_MS)
    return () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [observed, characterId, slot, crit, atk, chdPct,
      penPct, dmgIncPct,
      def, tgtCdmgRedPct, tgtDmgRedPct, elemental,
      isBoss, quirksDisabled, note])

  async function deleteObservation(id: string) {
    await fetch(`/api/admin/damage-lab/observations?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
    setObservations(prev => prev.filter(o => o.id !== id))
  }

  async function clearAll() {
    if (!confirm('Delete ALL observations?')) return
    await fetch('/api/admin/damage-lab/observations?id=all', { method: 'DELETE' })
    setObservations([])
  }

  function exportJson() {
    const content = observations.map(o => JSON.stringify(o)).join('\n') + (observations.length ? '\n' : '')
    const blob = new Blob([content], { type: 'application/x-ndjson' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `damage-lab-observations-${new Date().toISOString().slice(0, 10)}.jsonl`
    a.click()
    URL.revokeObjectURL(url)
  }

  function recomputeWithCurrentConstants(o: Observation): { calc: number; ratio: number } {
    const r = computeDamage({
      atk: o.atk,
      damageFactor: o.df,
      chdPct: o.chd,
      penPct: o.pen,
      dmgIncPct: o.dmgInc,
      crit: o.crit,
      charClass: o.class,
      def: o.def,
      cdmgRedPct: o.tCdmgRed,
      dmgRedPct: o.tDmgRed,
      isBoss: o.isBoss ?? false,
      elem: o.elem,
      C: num(C, 1000),
      ratioDivisor: num(ratioDivisor, 1000),
    })
    return { calc: r.calculated, ratio: r.calculated > 0 ? o.obs / r.calculated : 0 }
  }

  if (loading) return <div className="text-zinc-500">Loading…</div>

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold">Damage Lab</h1>
        <span className="text-xs text-zinc-500">Skeleton formula · no auto-quirks · enter the full additive pool manually</span>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Attacker */}
        <section className="rounded border border-zinc-800 bg-zinc-900/40 p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-400">Attacker</h2>
          <div className="space-y-2 text-sm">
            <label className="block">
              <span className="mb-1 block text-xs text-zinc-500">Character</span>
              <select
                value={characterId}
                onChange={e => setCharacterId(e.target.value)}
                className="w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm text-zinc-100"
              >
                <option value="">— select —</option>
                {characters.map(c => (
                  <option key={c.id} value={c.id}>{c.name} ({c.element} / {c.class})</option>
                ))}
              </select>
            </label>
            {selectedChar && (
              <div className="space-y-1.5 rounded bg-zinc-900/60 px-2 py-1.5 text-[11px] font-mono text-zinc-500">
                <div className="flex items-center justify-between gap-2">
                  <span>Lv100 base: ATK {selectedChar.atkMax} · CHD {selectedChar.chdMax}% · Crit {selectedChar.critRateMax}%</span>
                  <button
                    onClick={() => {
                      setAtk(String(effectiveBase.atk))
                      setChdPct(String(effectiveBase.chd))
                      setPenPct(String(effectiveBase.pen))
                    }}
                    className="text-zinc-600 hover:text-blue-400"
                    title="Reset ATK / CHD / PEN to current transcend + stat-quirk values"
                  >reset</button>
                </div>
                <label className="flex items-center justify-between gap-2 border-t border-zinc-800/70 pt-1.5">
                  <span className="text-zinc-400">Transcendance</span>
                  <select
                    value={transcendLevel}
                    onChange={e => setTranscendLevel(e.target.value as TranscendLevel)}
                    className="rounded border border-zinc-700 bg-zinc-900 px-1.5 py-0.5 text-[11px] font-mono text-zinc-100"
                  >
                    {TRANSCEND_LEVELS.map(lvl => {
                      const bonus = selectedChar.transcendAtkBonus[lvl] ?? 0
                      return (
                        <option key={lvl} value={lvl}>
                          {TRANSCEND_LABELS[lvl]}{bonus > 0 ? ` (+${bonus}%)` : ''}
                        </option>
                      )
                    })}
                  </select>
                </label>
                <div className="text-zinc-600">
                  Effective: ATK {effectiveBase.atk} · CHD {effectiveBase.chd}%
                  {effectiveBase.pen > 0 ? ` · PEN ${effectiveBase.pen}%` : ''}
                  {effectiveBase.critRate !== selectedChar.critRateMax ? ` · Crit ${effectiveBase.critRate}%` : ''}
                </div>
                {heroCodexLevels.length > 0 && (
                  <label className="flex items-center justify-between gap-2 border-t border-zinc-800/70 pt-1.5">
                    <span className="text-zinc-400">Hero Codex <span className="text-zinc-600">(global roster bonus)</span></span>
                    <select
                      value={heroCodexLevel}
                      onChange={e => setHeroCodexLevel(parseInt(e.target.value, 10))}
                      className="rounded border border-zinc-700 bg-zinc-900 px-1.5 py-0.5 text-[11px] font-mono text-zinc-100"
                    >
                      {heroCodexLevels.map(l => (
                        <option key={l.level} value={l.level}>
                          Lv.{l.level} (+{l.atkPct}% ATK · +{l.defPct}% DEF · +{l.hpPct}% HP)
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </div>
            )}
            {selectedChar && applicableQuirks.length > 0 && (
              <div className="space-y-1.5 rounded bg-zinc-900/60 p-2 text-[11px]">
                <div className="flex items-center justify-between text-zinc-400">
                  <span className="font-semibold uppercase tracking-wider">
                    Gift quirks <span className="text-zinc-600">({applicableQuirks.length})</span>
                  </span>
                  <span className="font-mono text-zinc-500">
                    pool +{poolBonus.toFixed(1)}% · {activeQuirks.length}/{applicableQuirks.length} on
                  </span>
                </div>
                <div className="max-h-64 space-y-0.5 overflow-y-auto border-t border-zinc-800/70 pt-1.5">
                  {applicableQuirks.map(q => {
                    const enabled = !disabledQuirkIds.has(q.nodeId)
                    const condOK = q.effect ? conditionMatches(q.effect.requires) : true
                    const active = enabled && condOK && q.effect?.target === 'pool' && q.effect.unit === '%'
                    const statOnly = q.effect && q.effect.target !== 'pool'
                    const unsupported = !q.effect
                    return (
                      <label
                        key={q.nodeId}
                        className={`flex items-start gap-2 rounded px-1 py-1 hover:bg-zinc-800/40 ${enabled ? '' : 'opacity-40'}`}
                      >
                        <input
                          type="checkbox"
                          checked={enabled}
                          onChange={e => {
                            setDisabledQuirkIds(prev => {
                              const next = new Set(prev)
                              if (e.target.checked) next.delete(q.nodeId)
                              else next.add(q.nodeId)
                              return next
                            })
                          }}
                          className="mt-0.5"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1">
                            <span className="truncate font-semibold text-zinc-300">{q.name}</span>
                            <span className="rounded bg-zinc-800/80 px-1 font-mono text-[9px] text-zinc-500">{q.group}</span>
                            {q.effect?.requires && (
                              <span className="rounded bg-amber-900/30 px-1 font-mono text-[9px] text-amber-400">on {q.effect.requires}</span>
                            )}
                            {active && <span className="rounded bg-green-900/30 px-1 font-mono text-[9px] text-green-400">+{q.effect!.amount}% pool</span>}
                            {enabled && !condOK && <span className="rounded bg-zinc-700/40 px-1 font-mono text-[9px] text-zinc-500">waiting</span>}
                            {statOnly && <span className="rounded bg-blue-900/30 px-1 font-mono text-[9px] text-blue-400">{q.effect!.target} {q.effect!.amount}{q.effect!.unit}</span>}
                            {unsupported && <span className="rounded bg-red-900/20 px-1 font-mono text-[9px] text-red-400/70">unmapped</span>}
                          </div>
                          <div className="truncate text-[10px] text-zinc-500" title={q.desc}>{q.desc}</div>
                        </div>
                      </label>
                    )
                  })}
                </div>
                <div className="border-t border-zinc-800/70 pt-1 text-[10px] text-zinc-600 leading-snug">
                  <span className="text-blue-400">stat</span> badges are informational — the user&apos;s ATK/CHD/PEN fields already reflect those bonuses from the unlocked gift tree. Only <span className="text-green-400">pool</span> quirks are auto-added to the pool.
                </div>
              </div>
            )}
            <Field label="ATK" value={atk} onChange={setAtk} />
            <Field label="Crit DMG %" value={chdPct} onChange={setChdPct} />
            <Field label="Penetration %" value={penPct} onChange={setPenPct} />
            <Field label="DMG Inc %" value={dmgIncPct} onChange={setDmgIncPct} />
          </div>
        </section>

        {/* Target + Skill */}
        <section className="space-y-4">
          <div className="rounded border border-zinc-800 bg-zinc-900/40 p-4">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-400">Target</h2>
            <div className="mb-3 space-y-2 rounded border border-zinc-800/70 bg-zinc-950/30 p-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Load from game</span>
                {(modeLabel || stageId || monsterKey) && (
                  <button
                    onClick={clearTargetPicker}
                    className="text-xs text-zinc-600 hover:text-red-400"
                  >clear</button>
                )}
              </div>
              <label className="block">
                <span className="mb-1 block text-xs text-zinc-500">Mode ({modes.length})</span>
                <select
                  value={modeLabel}
                  onChange={e => handleSelectMode(e.target.value)}
                  className="w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm text-zinc-100"
                >
                  <option value="">— select —</option>
                  {modes.map(m => (
                    <option key={m.label} value={m.label}>{m.label} ({m.stages.length})</option>
                  ))}
                </select>
              </label>
              {selectedMode && (
                <label className="block">
                  <span className="mb-1 block text-xs text-zinc-500">Stage ({selectedMode.stages.length})</span>
                  <select
                    value={stageId}
                    onChange={e => handleSelectStage(e.target.value)}
                    className="w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm text-zinc-100"
                  >
                    <option value="">— select —</option>
                    {selectedMode.stages.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.recommendLevel > 0 ? `[Lv${s.recommendLevel}] ` : ''}{s.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {selectedStage && selectedStage.monsters.length > 0 && (
                <label className="block">
                  <span className="mb-1 block text-xs text-zinc-500">Monster ({selectedStage.monsters.length})</span>
                  <select
                    value={monsterKey}
                    onChange={e => handleSelectMonster(e.target.value)}
                    className="w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm text-zinc-100"
                  >
                    <option value="">— select —</option>
                    {selectedStage.monsters.map(m => {
                      const key = `${m.monsterId}@${m.level}`
                      return (
                        <option key={key} value={key}>
                          {m.isBoss ? '★ ' : ''}Lv{m.level} · {m.name} ({m.element}/{m.class})
                        </option>
                      )
                    })}
                  </select>
                </label>
              )}
              {selectedMonster && (
                <div className="rounded bg-zinc-900/60 px-2 py-1.5 text-[11px] font-mono text-zinc-400">
                  <div>Lv {selectedMonster.level} · {selectedMonster.type}{selectedMonster.subClass && selectedMonster.subClass !== 'NONE' ? ` · ${selectedMonster.subClass}` : ''}</div>
                  <div>DEF: {selectedMonster.defAtLevel.toFixed(1)} <span className="text-zinc-600">(min {selectedMonster.defMin} / max {selectedMonster.defMax})</span></div>
                  <div>DR: {selectedMonster.drPctAtLevel.toFixed(2)}% <span className="text-zinc-600">(raw max {selectedMonster.drMax})</span></div>
                  <div className="text-zinc-600">ATK est: {selectedMonster.atkAtLevel.toFixed(0)}</div>
                </div>
              )}
            </div>
            <div className="space-y-2 text-sm">
              <Field label="DEF" value={def} onChange={setDef} />
              <Field label="Crit DMG Reduc %" value={tgtCdmgRedPct} onChange={setTgtCdmgRedPct} />
              <Field label="DMG Reduction %" value={tgtDmgRedPct} onChange={setTgtDmgRedPct} />
              <label className="block pt-2 border-t border-zinc-800">
                <span className="mb-1 block text-xs text-zinc-500">Elemental (auto-applies +50 add & ×1.20 mult if adv)</span>
                <select
                  value={elemental}
                  onChange={e => setElemental(e.target.value as 'none' | 'adv' | 'disadv')}
                  className="w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm text-zinc-100"
                >
                  <option value="none">None (neutral)</option>
                  <option value="adv">Advantage</option>
                  <option value="disadv">Disadvantage</option>
                </select>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={isBoss} onChange={e => setIsBoss(e.target.checked)} />
                <span className="text-xs text-zinc-500">Boss-type target (auto-applies +30% quirk)</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={quirksDisabled} onChange={e => setQuirksDisabled(e.target.checked)} />
                <span className="text-xs text-zinc-500">Quirks disabled on target (metadata tag, not yet used)</span>
              </label>
            </div>
          </div>

          <div className="rounded border border-zinc-800 bg-zinc-900/40 p-4">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-400">Skill</h2>
            <div className="mb-3 flex gap-2">
              {(['first', 'second', 'ultimate'] as SlotKey[]).map(s => (
                <button
                  key={s}
                  onClick={() => setSlot(s)}
                  className={`rounded px-3 py-1 text-sm ${slot === s ? 'bg-blue-600/30 text-blue-300' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'}`}
                >{SLOT_LABELS[s]}</button>
              ))}
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-500">Level (fixed)</span>
                <span className="font-mono text-sm text-zinc-400">lvl {SKILL_LEVEL}</span>
              </div>
              <div className="flex items-center justify-between border-t border-zinc-800 pt-2">
                <span className="text-xs text-zinc-500">DamageFactor</span>
                <span className={`font-mono text-sm ${damageFactor != null ? 'text-zinc-100' : 'text-zinc-600'}`}>
                  {damageFactor ?? '—'}
                </span>
              </div>
              {currentSkill && (
                <div className="text-xs text-zinc-500">Skill ID: {currentSkill.skillId} · progression: {currentSkill.damageFactors.map(v => v ?? '–').join(' / ')}</div>
              )}
              <label className="flex items-center gap-2 pt-2">
                <input type="checkbox" checked={crit} onChange={e => setCrit(e.target.checked)} />
                <span className="text-sm">Crit hit</span>
              </label>
            </div>
          </div>
        </section>

        {/* Computation + Save */}
        <section className="space-y-4">
          <div className="rounded border border-zinc-800 bg-zinc-900/40 p-4">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-400">Formula constants</h2>
            <div className="space-y-2 text-sm">
              <Field label="C (denominator)" value={C} onChange={setC} />
              <Field label="Ratio divisor (DF / x)" value={ratioDivisor} onChange={setRatioDivisor} />
            </div>
            <div className="mt-3 text-xs text-zinc-500 border-t border-zinc-800 pt-3 leading-relaxed">
              Formula: <span className="font-mono text-zinc-400">Dmg = (DF/{ratioDivisor}) × ATK × (1 + pool/100) × {C}/({C} + (1−PEN)×DEF) × (1 − targetDR/100) × adv_mult</span>
              <br/>pool = DMG Inc + (+30 if boss) + (+50 if adv) + (CHD−CDmgRed−100 if crit). adv_mult = 1.20 if adv, else 1.0.
            </div>
          </div>

          <div className="rounded border border-zinc-800 bg-zinc-900/40 p-4">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-400">Result</h2>
            {computation ? (
              <div className="space-y-1 font-mono text-xs text-zinc-400">
                <div className="text-zinc-300">Active quirks (auto-applied):</div>
                {computation.quirks.length > 0 ? (
                  computation.quirks.map((q, idx) => (
                    <div key={idx} className="pl-2 text-green-400">+ {q.name}: {q.value}</div>
                  ))
                ) : (
                  <div className="pl-2 text-zinc-600">(none)</div>
                )}
                <div className="pt-1 border-t border-zinc-800">Pool: +{computation.poolPct.toFixed(1)}% → ×{computation.mod.toFixed(3)}</div>
                <div>Mitigation: ×{computation.mitigation.toFixed(4)}</div>
                <div>Target DR: ×{computation.targetDrMult.toFixed(4)}</div>
                <div>Elem mult: ×{computation.elemMult.toFixed(2)}</div>
                <div className="border-t border-zinc-800 pt-1 text-lg text-zinc-100">
                  Calc: <span className="font-bold">{computation.calculated.toFixed(0)}</span>
                </div>
              </div>
            ) : (
              <div className="text-sm text-zinc-600">Select a character + skill level</div>
            )}

            <div className="mt-4 space-y-2 border-t border-zinc-800 pt-3 text-sm">
              <Field label="Observed damage" value={observed} onChange={setObserved} />
              {ratio != null && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-500">Obs/Calc</span>
                  <span className="font-mono">{ratio.toFixed(4)}</span>
                  {matchBadge}
                </div>
              )}
              <label className="block">
                <span className="mb-1 block text-xs text-zinc-500">Note</span>
                <input
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  className="w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm text-zinc-100"
                  placeholder="e.g. baseline, +23% vs Earth, boss lvl20"
                />
              </label>
              <div className="mt-2 flex items-center justify-between gap-2">
                <div className="text-xs">
                  {saveStatus === 'pending' && <span className="text-amber-400">auto-save in {(AUTO_SAVE_DEBOUNCE_MS / 1000).toFixed(1)}s…</span>}
                  {saveStatus === 'saving' && <span className="text-blue-400">saving…</span>}
                  {saveStatus === 'saved' && <span className="text-green-400">✓ saved</span>}
                  {saveStatus === 'error' && <span className="text-red-400">save error</span>}
                  {saveStatus === 'idle' && <span className="text-zinc-600">fill observed to auto-save</span>}
                </div>
                <button
                  onClick={() => {
                    if (autoSaveTimer.current) { clearTimeout(autoSaveTimer.current); autoSaveTimer.current = null }
                    saveObservation()
                  }}
                  disabled={!canAutoSave || saveStatus === 'saving'}
                  className="rounded bg-blue-600/80 px-3 py-1 text-xs font-medium text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-600"
                >
                  Save now
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Observations table */}
      <section className="rounded border border-zinc-800 bg-zinc-900/40 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
            Observations ({observations.length})
          </h2>
          <div className="flex gap-2">
            <button onClick={exportJson} className="rounded bg-zinc-800 px-3 py-1 text-xs hover:bg-zinc-700">Export JSON</button>
            <button onClick={clearAll} className="rounded bg-red-900/30 px-3 py-1 text-xs text-red-400 hover:bg-red-900/50">Clear all</button>
          </div>
        </div>
        {observations.length === 0 ? (
          <div className="py-4 text-center text-sm text-zinc-600">No observations yet</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-zinc-500">
                <tr className="border-b border-zinc-800">
                  <th className="px-2 py-2 text-left">Character</th>
                  <th className="px-2 py-2 text-left">Skill</th>
                  <th className="px-2 py-2 text-right border-l border-zinc-800">ATK</th>
                  <th className="px-2 py-2 text-right">CHD</th>
                  <th className="px-2 py-2 text-right">DMG Inc</th>
                  <th className="px-2 py-2 text-right">PEN</th>
                  <th className="px-2 py-2 text-right border-l border-zinc-800">DEF</th>
                  <th className="px-2 py-2 text-right">CDMG Red</th>
                  <th className="px-2 py-2 text-right">DMG Red</th>
                  <th className="px-2 py-2 text-center border-l border-zinc-800">Crit</th>
                  <th className="px-2 py-2 text-center">Elem</th>
                  <th className="px-2 py-2 text-center">Boss</th>
                  <th className="px-2 py-2 text-center">Q.off</th>
                  <th className="px-2 py-2 text-right border-l border-zinc-800">Observed</th>
                  <th className="px-2 py-2 text-right">Calc (live)</th>
                  <th className="px-2 py-2 text-right">Obs/Calc</th>
                  <th className="px-2 py-2 text-left">Note</th>
                  <th className="px-2 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {observations.slice().reverse().map(o => {
                  const { calc, ratio } = recomputeWithCurrentConstants(o)
                  const good = Math.abs(ratio - 1) <= 0.02
                  const medium = !good && Math.abs(ratio - 1) <= 0.05
                  return (
                    <tr key={o.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                      <td className="px-2 py-1.5 text-zinc-100">{o.char}</td>
                      <td className="px-2 py-1.5">{o.slot}</td>
                      <td className="px-2 py-1.5 text-right border-l border-zinc-800/50">{o.atk}</td>
                      <td className="px-2 py-1.5 text-right">{o.chd}%</td>
                      <td className="px-2 py-1.5 text-right">{o.dmgInc}%</td>
                      <td className="px-2 py-1.5 text-right">{o.pen}%</td>
                      <td className="px-2 py-1.5 text-right border-l border-zinc-800/50">{o.def}</td>
                      <td className="px-2 py-1.5 text-right">{o.tCdmgRed}%</td>
                      <td className="px-2 py-1.5 text-right">{o.tDmgRed}%</td>
                      <td className="px-2 py-1.5 text-center border-l border-zinc-800/50">{o.crit ? '✓' : ''}</td>
                      <td className="px-2 py-1.5 text-center">{o.elem === 'adv' ? '+' : o.elem === 'disadv' ? '−' : '='}</td>
                      <td className="px-2 py-1.5 text-center">{o.isBoss ? '✓' : ''}</td>
                      <td className="px-2 py-1.5 text-center text-amber-400">{o.quirksDisabled ? '✓' : ''}</td>
                      <td className="px-2 py-1.5 text-right font-mono text-zinc-100 border-l border-zinc-800/50">{o.obs}</td>
                      <td className="px-2 py-1.5 text-right font-mono">{calc.toFixed(0)}</td>
                      <td className={`px-2 py-1.5 text-right font-mono ${good ? 'text-green-400' : medium ? 'text-amber-400' : 'text-red-400'}`}>
                        {ratio.toFixed(4)}
                      </td>
                      <td className="px-2 py-1.5 text-zinc-500">{o.note ?? ''}</td>
                      <td className="px-2 py-1.5 text-right">
                        <button onClick={() => deleteObservation(o.id)} className="text-zinc-600 hover:text-red-400">×</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex items-center justify-between gap-2">
      <span className="text-xs text-zinc-500">{label}</span>
      <input
        type="text"
        inputMode="decimal"
        value={value}
        onChange={e => onChange(e.target.value)}
        className={NUMBER_INPUT}
      />
    </label>
  )
}
