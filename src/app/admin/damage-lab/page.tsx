'use client'

import Image from 'next/image'
import { useEffect, useMemo, useRef, useState } from 'react'
import CharacterPortrait from '@/app/components/character/CharacterPortrait'
import MonsterPortrait from '@/app/components/character/MonsterPortrait'
import { applyBuffs, type ApplicableBuff, type BuffContext, type ReducedBuffs } from '@/lib/damage/buffs'
import { recompute, detectElementRelation, type RecomputeContext } from '@/lib/damage/recompute'
import { STAR_ICONS, starRowForLevel } from '@/lib/stars'
import statsJson from '@data/stats.json'

// Stats icon registry — keyed by short stat name (matches data/stats.json).
const STATS = statsJson as Record<string, { label: string; icon: string }>
function statIconSrc(key: string): string | null {
  const entry = STATS[key]
  return entry ? `/images/ui/effect/${entry.icon}` : null
}
// ST_* (datamine) → stats.json key. Used for the secondary-scaling labels and
// the auto-mode monster readout.
const ST_TO_KEY: Record<string, string> = {
  ST_ATK: 'ATK', ST_DEF: 'DEF', ST_HP: 'HP', ST_SPEED: 'SPD',
  ST_CRITICAL_RATE: 'CHC', ST_CRITICAL_DMG_RATE: 'CHD',
  ST_PIERCE_POWER_RATE: 'PEN%',
  ST_BUFF_CHANCE: 'EFF', ST_BUFF_RESIST: 'RES',
  ST_DMG_BOOST: 'DMG UP%', ST_DMG_REDUCE_RATE: 'DMG RED%',
}

function StatIcon({ stat, size = 18 }: { stat: string; size?: number }) {
  const src = statIconSrc(stat)
  if (!src) return null
  return (
    <Image
      src={src}
      alt={stat}
      width={size}
      height={size}
      className="object-contain"
      title={STATS[stat]?.label ?? stat}
    />
  )
}

const LS_FORM_KEY = 'damage-lab-form-v9'
const AUTO_SAVE_DEBOUNCE_MS = 1500

interface PersistedForm {
  characterId: string
  atk: string; chdPct: string; penPct: string; dmgIncPct: string
  def: string; tgtCdmgRedPct: string; tgtDmgRedPct: string
  elemental: 'none' | 'adv' | 'disadv'
  isBoss: boolean
  slot: 'first' | 'second' | 'ultimate'; crit: boolean
  skillLevel?: number
  note: string
  C: string; ratioDivisor: string
  // Target origin from stage picker
  modeLabel: string
  stageId: string
  monsterKey: string  // `${monsterId}@${level}` — identifies a monster row within a stage
  // Character quirks
  transcendStar: number        // TransStar numeric (3, 4, 5, 6, 7, 8, 9 depending on BasicStar)
  applyQuirks: boolean         // master toggle for applying all gift/awakening quirks (stats + pool)
  heroCodexLevel: number       // player's Hero Codex progression level (0..11; 0 = no codex)
  extraScale?: Record<string, string>  // secondary scaling stats (ST_DEF/ST_HP/ST_SPEED/ST_CRITICAL_RATE) when the char scales on them
  // Target mode
  targetMode?: 'auto' | 'manual'  // auto: stats fetched from /api/admin/monsters/:id/stats. manual: user types values in.
  targetLevel?: number            // monster level used in auto mode (1..100); seeded from the stage spawn but overridable
  // Per-char hardcoded-override flags. UI surfaces a toggle per relevant char.
  umeActive?: boolean             // Ame-specific: Ume state (priority gain) — gates S1 ADD
  sakuraActive?: boolean          // Ame-specific: Sakura state (elem superiority) — gates S1 REPLACE-on-adv
}

interface SkillData {
  damageFactors: (number | null)[]
  // Skill-internal additional attack proportion derived from CharacterDamageTemplet.
  // Typical case: Luna's Barrier-triggered extra hit (ratio 0.30 = +30% DF). null
  // when the skill has no conditional sub-attack rows.
  additionalAttackRatio: number | null
}

// Transcend level progression per BasicStar. Each entry is a UI label + the
// numeric TransStar in CharacterTranscendentTemplet + the `levelId` key the
// stars helper consumes (`starRowForLevel('5_2')` → the 6-icon row including
// placeholder grays). For BasicStar 1/2 the levelId matches the label; for
// BasicStar 3 the labels collapse `4_1/4_2` to `4/4+` while the levelId stays
// in canonical form.
//   BasicStar 1: 1 → 2 → 3 → 4 → 6 → 9   (labels 1/2/3/4/5/6)
//   BasicStar 2: 2 → 3 → 4 → 6 → 9       (labels 2/3/4/5/6)
//   BasicStar 3: 3 → 4 → 5 → 6 → 7 → 8 → 9  (labels 3/4/4+/5/5+/5++/6)
interface TranscendOption { label: string; levelId: string; transStar: number }
function getTranscendOptions(basicStar: number): TranscendOption[] {
  if (basicStar === 1) {
    return [1, 2, 3, 4, 6, 9].map((t, i) => {
      const k = String(i + 1)
      return { label: k, levelId: k, transStar: t }
    })
  }
  if (basicStar === 2) {
    return [2, 3, 4, 6, 9].map((t, i) => {
      const k = String(i + 2)
      return { label: k, levelId: k, transStar: t }
    })
  }
  // basicStar === 3
  return [
    { label: '3',   levelId: '3',   transStar: 3 },
    { label: '4',   levelId: '4_1', transStar: 4 },
    { label: '4+',  levelId: '4_2', transStar: 5 },
    { label: '5',   levelId: '5_1', transStar: 6 },
    { label: '5+',  levelId: '5_2', transStar: 7 },
    { label: '5++', levelId: '5_3', transStar: 8 },
    { label: '6',   levelId: '6',   transStar: 9 },
  ]
}

// Scaling info derived client-side from the unified buffs list (not part of the
// characters API). See `useCharScaling` below — it filters allBuffs to the
// char_skill source for the active char and groups the entries by effect kind.
interface ScalingEntry { stat: string; valuePerMille: number }
interface CharacterScaling {
  swap: ScalingEntry | null                                                  // BT_SWAP_STAT_ATTACK — replaces ATK
  add: ScalingEntry[]                                                        // BT_DMG_OWNER_STAT — bonus on top of ATK
  special: { kind: 'lost_hp' | 'target_stat'; stat: string; valuePerMille: number }[]
}

interface CharacterEntry {
  id: string
  name: string
  element: string
  class: string
  subClass: string
  // Core-fusion source character (ID 2000xxx). For these derivatives, S1/S2 icons
  // live under the original ID; only S3 (Ultimate) uses the fusion's own ID.
  originalCharacter?: string
  basicStar: number                   // 1 / 2 / 3 — drives transcend progression
  atkMax: number                      // lvl 100 base (no gear/evo/awaken)
  chdMax: number                      // %
  critRateMax: number                 // %
  skills: {
    first: SkillData | null
    second: SkillData | null
    ultimate: SkillData | null
  }
}

// Short display name for ST_* enums, used by the scaling readout.
const STAT_LABEL: Record<string, string> = {
  ST_ATK: 'ATK', ST_DEF: 'DEF', ST_HP: 'HP', ST_SPEED: 'SPD',
  ST_CRITICAL_RATE: 'CHC', ST_CRITICAL_DMG_RATE: 'CHD',
  ST_PIERCE_POWER_RATE: 'PEN',
  ST_BUFF_CHANCE: 'EFF', ST_BUFF_RESIST: 'RES',
  ST_DMG_BOOST: 'DMG↑', ST_DMG_REDUCE_RATE: 'DMG↓',
  ST_HP_LOST: 'HP lost',
}
function statLabel(s: string): string { return STAT_LABEL[s] ?? s.replace(/^ST_/, '') }

// Response shape of /api/admin/characters/:id/stats. `final` is the fully-resolved
// no-gear stat block (ATK/DEF/HP/CHC/CHD/PEN/DMG Inc/DMG Red/EFF/RES/SPD) at the
// requested transcendStar / codexLevel / disabledNodeIds configuration.
interface ApiStatsFinal {
  atk: number; def: number; hp: number; spd: number
  chc: number; chd: number; pen: number
  dmgInc: number; dmgRed: number
  eff: number; res: number
}
interface ApiStatsResponse {
  meta: { id: string; basicStar: number; transcendStar: number; codexLevel: number }
  final: ApiStatsFinal
}

// Response shape of /api/admin/monsters/:id/stats — same flat StatBlock shape as
// the character endpoint, plus an `isBoss` flag (sourced from MonsterTemplet.Type)
// and a `advantageRate` block when a dungeonId was provided.
interface ApiMonsterStatsResponse {
  meta: {
    id: string
    type: string | null
    class: string | null
    element: string | null
    basicStar: number
    isBoss: boolean
    level: number
    dungeonId: string | null
    advantageRate: { atk: number; def: number; hp: number; spd: number }   // per-mille, signed
    casterDebuff: { eff: number; res: number }                              // per-mille, signed (from PVE quirks)
  }
  final: {
    atk: number; def: number; hp: number; spd: number
    chc: number; chd: number; pen: number
    dmgInc: number; dmgRed: number
    eff: number; res: number
  }
}

// Mirror of the observations route's Observation type — minimal save schema
// holding only what `recompute()` needs to derive damage from the live buffs
// list. No derived totals, no buff snapshots: the formula gets re-applied
// every render.
interface Observation {
  id: string
  ts: string
  // Caster identity (drives buff applicability + display).
  charId: string
  charName: string
  charElement: string
  charClass: string
  charSubclass: string
  // Skill
  slot: 'S1' | 'S2' | 'S3'
  skillLevel: number
  df: number
  additionalAttack?: boolean
  additionalAttackRatio?: number
  // Caster inputs — raw user-typed values that feed the formula directly.
  atk: number
  chd: number
  pen: number
  dmgInc: number
  applyQuirks: boolean
  extraStats?: Record<string, number>
  // Per-char hardcoded-override flags (see `src/lib/damage/char-overrides.ts`).
  charFlags?: { umeActive?: boolean; sakuraActive?: boolean }
  // Target inputs
  targetDef: number
  targetDmgRed: number
  targetCdmgRed: number
  // Target HP — needed by chars whose damage scales on it (BT_DMG_TARGET_STAT).
  // Validated: Noa S2 (+3% × HP sub-attack). Optional because most chars don't use it.
  targetHp?: number
  isBoss: boolean
  elem: 'none' | 'adv' | 'disadv'
  // Mode metadata — `mode` drives the AdvLicense gate; the rest is display-only.
  mode?: string
  stageId?: string
  stageName?: string
  // Target metadata (set when loaded from game data)
  monsterId?: string
  monsterName?: string
  monsterLvl?: number
  monsterElement?: string
  monsterClass?: string
  monsterType?: string
  // Result
  crit: boolean
  obs: number
  note?: string
}

interface StageMonster {
  monsterId: string
  faceIconId: string                 // FaceIconID — keys MT_{faceIconId}.webp portrait
  name: string
  type: string
  isBoss: boolean
  class: string
  element: string
  subClass: string
  basicStar: number                  // 1/2/3 — drives star overlay on the portrait
  level: number
  defMin: number
  defMax: number
  drMax: number
  atkMin: number
  atkMax: number
  hpMin: number
  hpMax: number
  defAtLevel: number
  drPctAtLevel: number
  atkAtLevel: number
  hpAtLevel: number
  position: number
  slot: number
}

interface WaveEntry {
  position: number                  // 0/1/2 — SpawnID_Pos index, sequenced as Fight 1/2/3 in-game
  monsters: StageMonster[]
}
interface StageEntry {
  id: string
  name: string
  chapter: string | null            // DM_NORMAL only — null for other modes
  season: number | null             // DM_NORMAL only
  episodeNum: number | null         // DM_NORMAL only
  stageNum: number | null           // DM_NORMAL only — index of stage inside (season, episodeNum)
  recommendLevel: number
  waves: WaveEntry[]
}

// monsterKey format `${position}@${monsterId}@${level}` — the position prefix
// disambiguates the same monster appearing across waves (e.g. an Acid-Spewer
// in Wave 1, 2 and 3 of S1-EP10-1) so the selection ring lands on a single
// portrait instead of all three. Helpers keep call sites compact.
function makeMonsterKey(wave: WaveEntry, m: StageMonster): string {
  return `${wave.position}@${m.monsterId}@${m.level}`
}
function findMonsterByKey(stage: StageEntry | null, key: string): { wave: WaveEntry; monster: StageMonster } | null {
  if (!stage) return null
  for (const w of stage.waves) {
    for (const m of w.monsters) if (makeMonsterKey(w, m) === key) return { wave: w, monster: m }
  }
  return null
}

// Parse a stage entry into { dungeonName, stagePart }. Order of resolution:
//   1. Story (`season` + `episodeNum` set):
//        dungeonName = "EP {episodeNum}: {chapter}" (e.g. "EP 1: Outer City")
//        stagePart   = "{episodeNum}-{stageNum}"   (e.g. "1-3")
//   2. "<base> (Stage N)"            → e.g. "Unidentified Chimera (Stage 1)"
//   3. "<base> NF"                   → e.g. "Skyward Tower 1F"
//   4. "<base> (Normal|Hard|...)"    → e.g. "Iron Stretcher (Normal)"
//   5. fallback: the stage name itself becomes its own dungeon (no split).
function parseDungeonStage(stage: StageEntry): { dungeonName: string; stagePart: string } {
  if (stage.season != null && stage.episodeNum != null) {
    const dungeonName = stage.chapter
      ? `EP ${stage.episodeNum}: ${stage.chapter}`
      : `EP ${stage.episodeNum}`
    const stagePart = stage.stageNum != null
      ? `${stage.episodeNum}-${stage.stageNum}`
      : stage.name
    return { dungeonName, stagePart }
  }
  const n = stage.name
  let m: RegExpMatchArray | null
  if ((m = n.match(/^(.+?)\s+\(Stage\s*(\d+)\)\s*$/)))     return { dungeonName: m[1], stagePart: `Stage ${m[2]}` }
  if ((m = n.match(/^(.+?)\s+(\d+)F\s*$/)))                return { dungeonName: m[1], stagePart: `${m[2]}F` }
  if ((m = n.match(/^(.+?)\s+\((Normal|Hard|Very Hard)\)\s*$/i))) return { dungeonName: m[1], stagePart: m[2] }
  return { dungeonName: n, stagePart: n }
}

interface ModeEntry {
  mode: string
  label: string
  stages: StageEntry[]
}

// ─── Mode hierarchy (manual taxonomy) ─────────────────────────────────
//
// The damage-lab API returns a flat list of modes, each keyed by the resolved
// localized label (e.g. "Earth Tower", "Adventure", "Special Request: Ecology
// Study"). The user wants the picker grouped into a 2-level hierarchy that
// matches the in-game UI categories. Since this taxonomy is not exposed by the
// datamine, we hardcode it here.
//
// `rawMode` matches DungeonTemplet.DungeonMode. `labelMatch` is an optional
// regex run against the resolved English label to disambiguate modes that
// share a raw key (e.g. DM_NORMAL → Normal vs Hard, DM_TOWER_ELEMENT → 5
// elements). `display` is the label shown in the sub-mode dropdown.
interface SubMode { rawMode: string; labelMatch?: RegExp; display: string }
interface ModeCategory { category: string; modes: SubMode[] }

const MODE_GROUPS: ModeCategory[] = [
  {
    category: 'Special Request',
    modes: [
      { rawMode: 'DM_RAID_1', display: 'Ecology Study (Armor)' },
      { rawMode: 'DM_RAID_2', display: 'Identification (Weapon)' },
    ],
  },
  {
    category: 'Adventure License',
    modes: [
      { rawMode: 'DM_ADVENTURE_MISSION',   display: 'Weekly Conquest' },
      { rawMode: 'DM_ADVENTURE_CHALLENGE', display: 'Promotion' },
    ],
  },
  {
    category: 'Story',
    modes: [
      { rawMode: 'DM_NORMAL', labelMatch: /normal/i, display: 'Normal' },
      { rawMode: 'DM_NORMAL', labelMatch: /hard/i,   display: 'Hard' },
    ],
  },
  {
    category: 'Skyward Towers',
    modes: [
      { rawMode: 'DM_TOWER',           display: 'Normal' },
      { rawMode: 'DM_TOWER_HARD',      display: 'Hard' },
      { rawMode: 'DM_TOWER_VERY_HARD', display: 'Very Hard' },
    ],
  },
  {
    category: 'Elemental Towers',
    modes: [
      { rawMode: 'DM_TOWER_ELEMENT', labelMatch: /earth/i, display: 'Earth' },
      { rawMode: 'DM_TOWER_ELEMENT', labelMatch: /water/i, display: 'Water' },
      { rawMode: 'DM_TOWER_ELEMENT', labelMatch: /fire/i,  display: 'Fire' },
      { rawMode: 'DM_TOWER_ELEMENT', labelMatch: /light/i, display: 'Light' },
      { rawMode: 'DM_TOWER_ELEMENT', labelMatch: /dark/i,  display: 'Dark' },
    ],
  },
  {
    category: 'Irregular Extermination',
    modes: [
      { rawMode: 'DM_IRREGULAR_CHASE',      display: 'Pursuit' },
      { rawMode: 'DM_IRREGULAR_INFILTRATE', display: 'Infiltration' },
    ],
  },
  {
    category: 'Temporary Mode',
    modes: [
      { rawMode: 'DM_GUILD_RAID_MAIN_BOSS', display: 'Guild Raid' },
      { rawMode: 'DM_GUILD_RAID_SUB_BOSS',  display: 'Guild Raid' },
      { rawMode: 'DM_WORLD_BOSS',           display: 'World Boss' },
      { rawMode: 'DM_EVENT_BOSS',           display: 'Joint Challenge' },
    ],
  },
]

// Resolve a ModeEntry → (category, subDisplay). Returns null when the mode
// doesn't fit any defined group (e.g. DM_RAID_1/2 — currently unmapped).
function classifyMode(entry: ModeEntry): { category: string; sub: string } | null {
  for (const group of MODE_GROUPS) {
    for (const m of group.modes) {
      if (m.rawMode !== entry.mode) continue
      if (m.labelMatch && !m.labelMatch.test(entry.label)) continue
      return { category: group.category, sub: m.display }
    }
  }
  return null
}

type SlotKey = 'first' | 'second' | 'ultimate'
type SlotTag = 'S1' | 'S2' | 'S3'
const SLOT_LABELS: Record<SlotKey, SlotTag> = { first: 'S1', second: 'S2', ultimate: 'S3' }

const NUMBER_INPUT = 'w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-right text-sm text-zinc-100 focus:border-blue-500 focus:outline-none'

function num(v: string | undefined | null, fallback = 0): number {
  if (v == null) return fallback
  const n = parseFloat(v.replace(',', '.'))
  return Number.isFinite(n) ? n : fallback
}

export default function DamageLabPage() {
  // Data
  const [characters, setCharacters] = useState<CharacterEntry[]>([])
  const [observations, setObservations] = useState<Observation[]>([])
  const [modes, setModes] = useState<ModeEntry[]>([])
  const [heroCodexLevel, setHeroCodexLevel] = useState<number>(11)  // default to max (fully unlocked codex)
  const [loading, setLoading] = useState(true)

  // Target picker (Mode → Stage → Monster)
  const [modeLabel, setModeLabel] = useState('')
  const [stageId, setStageId] = useState('')
  const [monsterKey, setMonsterKey] = useState('')  // `${monsterId}@${level}`

  // Character quirks (user-controllable, auto-set from context)
  const [transcendStar, setTranscendStar] = useState<number>(9)  // default to max (BasicStar-3 path tops at 9)
  const [applyQuirks, setApplyQuirks] = useState<boolean>(true)
  // Unified buff list — Awakening + char-specific damage modifiers in one
  // schema. Replaces the legacy `applicableQuirks` + per-skill `bossDmgPct` +
  // per-char `scaling` math at the consumption site (see `reducedBuffs` below).
  const [allBuffs, setAllBuffs] = useState<ApplicableBuff[]>([])

  // Fetched stats from /api/admin/characters/[id]/stats (re-fetched on character /
  // transcend / codex / quirk toggle changes). `final` is the prefill source.
  const [apiStats, setApiStats] = useState<ApiStatsResponse | null>(null)

  // Secondary scaling stats — populated for characters whose scaling involves
  // stats other than ATK (BT_SWAP_STAT_ATTACK + BT_DMG_OWNER_STAT). Indexed by
  // ST_* key. Auto-filled from the API result, manually overridable per stat.
  const [extraScale, setExtraScale] = useState<Record<string, string>>({})

  // Target panel mode. Auto = picker + API-fetched stats (read-only display);
  // Manual = free-form inputs (existing behavior). State vars (def/tgtDmgRedPct/
  // isBoss) feed the formula in both modes — auto mode just writes them via the
  // API, manual mode lets the user type.
  const [targetMode, setTargetMode] = useState<'auto' | 'manual'>('auto')
  const [targetLevel, setTargetLevel] = useState<number>(100)
  const [apiMonsterStats, setApiMonsterStats] = useState<ApiMonsterStatsResponse | null>(null)

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
  // Target HP — only used by chars with BT_DMG_TARGET_STAT scaling (Noa S2 etc.).
  // Auto-prefilled from the monster API when in auto mode; not surfaced as an
  // editable field in manual mode (yet — add a Field if a manual-only test needs it).
  const [tgtHp, setTgtHp] = useState('0')
  // Metadata tags (NOT used by formula — just attached to observation for later analysis)
  const [elemental, setElemental] = useState<'none' | 'adv' | 'disadv'>('none')
  const [isBoss, setIsBoss] = useState(false)

  // Skill — slot picks first/second/ultimate, skillLevel picks 1..5 (the
  // DamageFactor used by the formula scales with skillLevel).
  const [slot, setSlot] = useState<SlotKey>('first')
  const [skillLevel, setSkillLevel] = useState<number>(5)

  // Result
  const [crit, setCrit] = useState(false)
  // Skill-internal additional attack toggle. Only meaningful for skills whose
  // CharacterDamageTemplet rows include conditional sub-attacks (currentSkill
  // .additionalAttackRatio !== null). UI auto-shows the toggle; the trigger is
  // empirical (Luna = Barrier active, etc.) so the user picks it themselves.
  const [additionalAttack, setAdditionalAttack] = useState(false)
  // Per-char hardcoded-override flags surfaced as UI toggles. Currently only
  // Ame uses these (Ume / Sakura states on her S1, mutually exclusive in-game
  // but the UI lets the user toggle each independently for testing).
  const [umeActive, setUmeActive] = useState(false)
  const [sakuraActive, setSakuraActive] = useState(false)
  const [observed, setObserved] = useState('')
  const [note, setNote] = useState('')

  // Formula constants (tunable)
  const [C, setC] = useState('1000')
  const [ratioDivisor, setRatioDivisor] = useState('1000')
  // ARM f32 emulation — when on, every intermediate `*`/`+`/`-`/`/` is wrapped
  // with Math.fround AND BT_DMG_TARGET_STAT folds into mod (binary-faithful path).
  // Off by default to preserve legacy f64 calc values used in saved obs ratios.
  const [f32Arithmetic, setF32Arithmetic] = useState(false)

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
      fetch('/api/admin/damage-lab/buffs').then(r => r.json()),
    ]).then(([chars, obs, st, bf]) => {
      setCharacters(chars.characters ?? [])
      setObservations(obs.observations ?? [])
      setModes(st.modes ?? [])
      setAllBuffs(bf.buffs ?? [])
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
        if (p.slot != null) setSlot(p.slot)
        if (p.crit != null) setCrit(p.crit)
        if (typeof p.skillLevel === 'number' && p.skillLevel >= 1 && p.skillLevel <= 5) setSkillLevel(p.skillLevel)
        if (p.note != null) setNote(p.note)
        if (p.C != null) setC(p.C)
        if (p.ratioDivisor != null) setRatioDivisor(p.ratioDivisor)
        if (p.modeLabel != null) setModeLabel(p.modeLabel)
        if (p.stageId != null) setStageId(p.stageId)
        if (p.monsterKey != null) setMonsterKey(p.monsterKey)
        if (typeof p.transcendStar === 'number') setTranscendStar(p.transcendStar)
        if (typeof p.applyQuirks === 'boolean') setApplyQuirks(p.applyQuirks)
        if (typeof p.heroCodexLevel === 'number') setHeroCodexLevel(p.heroCodexLevel)
        if (p.extraScale && typeof p.extraScale === 'object') setExtraScale(p.extraScale)
        if (p.targetMode === 'auto' || p.targetMode === 'manual') setTargetMode(p.targetMode)
        if (typeof p.targetLevel === 'number') setTargetLevel(p.targetLevel)
        if (typeof p.umeActive === 'boolean') setUmeActive(p.umeActive)
        if (typeof p.sakuraActive === 'boolean') setSakuraActive(p.sakuraActive)
      }
    } catch { /* ignore corrupt storage */ }
    formHydrated.current = true
  }, [])

  useEffect(() => {
    if (!formHydrated.current) return
    const p: PersistedForm = {
      characterId, atk, chdPct, penPct, dmgIncPct,
      def, tgtCdmgRedPct, tgtDmgRedPct, elemental,
      isBoss,
      slot, crit, skillLevel, note, C, ratioDivisor,
      modeLabel, stageId, monsterKey,
      transcendStar, applyQuirks,
      heroCodexLevel,
      extraScale,
      targetMode, targetLevel,
      umeActive, sakuraActive,
    }
    try { localStorage.setItem(LS_FORM_KEY, JSON.stringify(p)) } catch { /* quota etc. */ }
  }, [characterId, atk, chdPct, penPct, dmgIncPct,
      def, tgtCdmgRedPct, tgtDmgRedPct, elemental,
      isBoss,
      slot, crit, skillLevel, note, C, ratioDivisor,
      modeLabel, stageId, monsterKey,
      transcendStar, applyQuirks, heroCodexLevel, extraScale,
      targetMode, targetLevel,
      umeActive, sakuraActive])

  const selectedChar = useMemo(
    () => characters.find(c => c.id === characterId) ?? null,
    [characters, characterId]
  )

  // (Legacy `applicableQuirks` derivation removed — the unified buff reducer
  // (`reducedBuffs`) now handles per-char applicability filtering via the
  // `appliesTo` field on each ApplicableBuff entry.)

  // When switching to a different character, snap `transcendStar` to a value that
  // exists in the new char's progression (otherwise e.g. saved TransStar 7 for a
  // 3★ char becomes invalid on a 2★ char). Picks the highest option ≤ current, or
  // the max option. Same pattern for a missing char (defaults to 9 = max).
  const transcendOptions = useMemo(
    () => selectedChar ? getTranscendOptions(selectedChar.basicStar) : [],
    [selectedChar],
  )
  useEffect(() => {
    if (!transcendOptions.length) return
    const valid = transcendOptions.some(o => o.transStar === transcendStar)
    if (valid) return
    const best = [...transcendOptions].reverse().find(o => o.transStar <= transcendStar)
      ?? transcendOptions[transcendOptions.length - 1]
    setTranscendStar(best.transStar)
  }, [transcendOptions, transcendStar])

  // Fetch the validated stats block whenever character / transcend / codex / quirks
  // toggle changes. The route returns the full contributor breakdown plus `final` —
  // the fully-resolved no-gear stat block we use as prefill source.
  useEffect(() => {
    if (!selectedChar) { setApiStats(null); return }
    const params = new URLSearchParams()
    params.set('transcendStar', String(transcendStar))
    params.set('codexLevel', String(heroCodexLevel))
    if (!applyQuirks) params.set('disableAllGifts', '1')
    let cancelled = false
    fetch(`/api/admin/characters/${selectedChar.id}/stats?${params.toString()}`)
      .then(r => r.json())
      .then((data: ApiStatsResponse) => { if (!cancelled) setApiStats(data) })
      .catch(() => { if (!cancelled) setApiStats(null) })
    return () => { cancelled = true }
  }, [selectedChar, transcendStar, heroCodexLevel, applyQuirks])

  const effectiveBase = useMemo(() => {
    if (!apiStats?.final) return { atk: 0, def: 0, hp: 0, spd: 0, chd: 0, pen: 0, critRate: 0, dmgInc: 0 }
    const f = apiStats.final
    return {
      atk: f.atk, def: f.def, hp: f.hp, spd: f.spd,
      chd: Math.round(f.chd * 10) / 10,
      pen: Math.round(f.pen * 10) / 10,
      critRate: Math.round(f.chc * 10) / 10,
      // Caster's stat-typed DMG↑ (gear / EE / Awakening_*_DMG_UP). Auto-feeds
      // dmgIncPct; conditional BT_DMG quirks are added separately via poolBonus
      // — different buff types, no double-count.
      dmgInc: Math.round(f.dmgInc * 100) / 100,
    }
  }, [apiStats])

  // Stat key → numeric value from the current API result. Used to prefill the
  // secondary scaling stat inputs and to render their badges.
  function statApiValue(stat: string): number {
    const f = apiStats?.final
    if (!f) return 0
    switch (stat) {
      case 'ST_ATK': return f.atk
      case 'ST_DEF': return f.def
      case 'ST_HP':  return f.hp
      case 'ST_SPEED': return f.spd
      case 'ST_CRITICAL_RATE':     return Math.round(f.chc * 10) / 10
      case 'ST_CRITICAL_DMG_RATE': return Math.round(f.chd * 10) / 10
      case 'ST_PIERCE_POWER_RATE': return Math.round(f.pen * 10) / 10
      case 'ST_DMG_BOOST':         return Math.round(f.dmgInc * 10) / 10
      case 'ST_DMG_REDUCE_RATE':   return Math.round(f.dmgRed * 10) / 10
      case 'ST_BUFF_CHANCE': return f.eff
      case 'ST_BUFF_RESIST': return f.res
      default: return 0
    }
  }

  // Char-specific scaling info — derived client-side from the unified buff list.
  // Filters allBuffs to the char_skill source for the selected char, then groups
  // entries by effect kind (swap / add / special). Replaces the server-decoded
  // CharacterEntry.scaling field that used to live on the characters API.
  const charScaling = useMemo<CharacterScaling | null>(() => {
    if (!selectedChar) return null
    const out: CharacterScaling = { swap: null, add: [], special: [] }
    for (const b of allBuffs) {
      if (b.source.kind !== 'char_skill' || b.source.charId !== selectedChar.id) continue
      const stat = b.effect.statRef ?? ''
      const valuePerMille = b.effect.amount
      switch (b.effect.target) {
        case 'scaling_swap':
          if (!out.swap || valuePerMille > out.swap.valuePerMille) {
            out.swap = { stat, valuePerMille }
          }
          break
        case 'scaling_add_pct':
        case 'scaling_add_flat':
          if (!out.add.some(a => a.stat === stat && a.valuePerMille === valuePerMille)) {
            out.add.push({ stat, valuePerMille })
          }
          break
        case 'pool_cond':
          // Conditional pool buffs (BT_DMG_OWNER_LOST_HP_RATE, BT_DMG_TARGET_BREAK,
          // BT_DMG_OWNER_BUFF, …). Surface as informational scaling entries so
          // the user can see the char has a contextual modifier; the actual
          // contribution is computed by the reducer when context flags are set.
          if (b.effect.poolCond === 'owner_lost_hp' || b.effect.poolCond === 'caster_lost_hp') {
            out.special.push({ kind: 'lost_hp', stat: 'ST_HP_LOST', valuePerMille: valuePerMille * 10 })
          }
          break
        case 'scaling_target_stat':
          out.special.push({ kind: 'target_stat', stat, valuePerMille })
          break
      }
    }
    return out
  }, [allBuffs, selectedChar])

  // List of secondary scaling stats the selected char actually uses (for SWAP +
  // ADD entries; `special` is informational and doesn't gain an input).
  const scalingStatKeys = useMemo<string[]>(() => {
    if (!charScaling) return []
    const set = new Set<string>()
    if (charScaling.swap) set.add(charScaling.swap.stat)
    for (const a of charScaling.add) set.add(a.stat)
    set.delete('ST_ATK')  // ATK is already covered by the primary input
    return Array.from(set)
  }, [charScaling])

  // Auto-fill ATK / CHD / PEN + secondary scaling stats whenever the API-computed
  // final stats change (char switch, transcend, codex, quirk toggle). Key-diff ref
  // gates the first post-hydration render so saved fields aren't clobbered on F5
  // — but only when there's actually a saved value to protect (otherwise the
  // form lands empty when localStorage is fresh, e.g. after an LS_FORM_KEY bump).
  useEffect(() => {
    if (!formHydrated.current) return
    if (!selectedChar || !apiStats) return
    const key = `${selectedChar.id}/${transcendStar}/${heroCodexLevel}/${effectiveBase.atk}/${effectiveBase.chd}/${effectiveBase.pen}/${effectiveBase.dmgInc}`
    const prev = prevAtkKeyRef.current
    prevAtkKeyRef.current = key
    if (prev === null) {
      const isPristine = atk === '' && chdPct === '' && penPct === '' && dmgIncPct === ''
      if (!isPristine) return
    } else if (prev === key) return
    setAtk(String(effectiveBase.atk))
    setChdPct(String(effectiveBase.chd))
    setPenPct(String(effectiveBase.pen))
    setDmgIncPct(String(effectiveBase.dmgInc))
    // Refresh only the keys this char actually uses; preserve unrelated keys
    // (so a user-edited DEF for one char isn't wiped when switching to a char
    // that doesn't use DEF).
    if (scalingStatKeys.length > 0) {
      setExtraScale(prev => {
        const next = { ...prev }
        for (const stat of scalingStatKeys) next[stat] = String(statApiValue(stat))
        return next
      })
    }
    // statApiValue closure captures apiStats — included via [apiStats] dep.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedChar, transcendStar, heroCodexLevel, apiStats, effectiveBase, scalingStatKeys])

  // When the user picks a DIFFERENT character, reset any unchecked quirks but honor
  // each quirk's enabledByDefault flag (e.g. ADVENTURE_LICENSE is off by default).
  const selectedMode = useMemo(
    () => modes.find(m => m.label === modeLabel) ?? null,
    [modes, modeLabel]
  )

  // Group fetched modes into the manual taxonomy. Categories with no matching
  // modes are filtered out so empty optgroups don't render.
  const groupedModes = useMemo(() => {
    const groups = new Map<string, { category: string; entries: { sub: string; mode: ModeEntry }[] }>()
    for (const m of modes) {
      const c = classifyMode(m)
      if (!c) continue
      const g = groups.get(c.category) ?? { category: c.category, entries: [] }
      g.entries.push({ sub: c.sub, mode: m })
      groups.set(c.category, g)
    }
    // Preserve MODE_GROUPS declaration order rather than alphabetizing.
    return MODE_GROUPS.map(g => groups.get(g.category)).filter(Boolean) as Array<{ category: string; entries: { sub: string; mode: ModeEntry }[] }>
  }, [modes])

  // Category lives in its own state so clearing the sub-mode (modeLabel='')
  // doesn't collapse the cascade back to "no category". On hydration we infer
  // it from the saved modeLabel — that way reloading the page restores the
  // user's picker context.
  const [categoryName, setCategoryName] = useState('')
  const categoryHydratedRef = useRef(false)
  useEffect(() => {
    if (categoryHydratedRef.current) return
    if (modes.length === 0) return
    categoryHydratedRef.current = true
    if (!modeLabel) return
    const m = modes.find(mm => mm.label === modeLabel)
    if (!m) return
    const c = classifyMode(m)
    if (c) setCategoryName(c.category)
  }, [modes, modeLabel])

  const selectedCategoryEntries = useMemo(
    () => groupedModes.find(g => g.category === categoryName)?.entries ?? [],
    [groupedModes, categoryName],
  )
  const selectedStage = useMemo(
    () => selectedMode?.stages.find(s => s.id === stageId) ?? null,
    [selectedMode, stageId]
  )

  // Group stages of the current mode by their parsed dungeon name. When all
  // stages share the same dungeon (e.g. tower floors), the Dungeon select is
  // hidden and stages are picked directly. For story mode each dungeon is one
  // episode of a season — `season` is recorded so the UI can filter by it.
  const dungeonsForMode = useMemo(() => {
    if (!selectedMode) return [] as Array<{ name: string; season: number | null; episodeNum: number | null; stages: StageEntry[] }>
    const groups = new Map<string, { name: string; season: number | null; episodeNum: number | null; stages: StageEntry[] }>()
    for (const s of selectedMode.stages) {
      const { dungeonName } = parseDungeonStage(s)
      const g = groups.get(dungeonName) ?? { name: dungeonName, season: s.season ?? null, episodeNum: s.episodeNum ?? null, stages: [] }
      g.stages.push(s)
      groups.set(dungeonName, g)
    }
    return Array.from(groups.values()).sort((a, b) => {
      // Story dungeons sort by episode number; everything else alphabetically.
      if (a.episodeNum != null && b.episodeNum != null) return a.episodeNum - b.episodeNum
      return a.name.localeCompare(b.name)
    })
  }, [selectedMode])

  // Story-only: list of seasons present in the current mode + current selection.
  const isStoryMode = useMemo(
    () => selectedMode?.stages.some(s => s.season != null) ?? false,
    [selectedMode],
  )
  const seasonsForMode = useMemo(() => {
    if (!isStoryMode || !selectedMode) return [] as number[]
    const set = new Set<number>()
    for (const s of selectedMode.stages) if (s.season != null) set.add(s.season)
    return Array.from(set).sort((a, b) => a - b)
  }, [isStoryMode, selectedMode])
  const [storySeason, setStorySeason] = useState<number | null>(null)
  const storySeasonHydratedRef = useRef(false)
  useEffect(() => {
    if (storySeasonHydratedRef.current) return
    if (!selectedMode || !stageId) return
    const stage = selectedMode.stages.find(s => s.id === stageId)
    if (!stage) return
    storySeasonHydratedRef.current = true
    if (stage.season != null) setStorySeason(stage.season)
  }, [selectedMode, stageId])

  // For story mode, restrict dungeons to the selected season. Non-story modes
  // see the full dungeon list.
  const filteredDungeons = useMemo(() => {
    if (!isStoryMode) return dungeonsForMode
    if (storySeason == null) return [] as typeof dungeonsForMode
    return dungeonsForMode.filter(d => d.season === storySeason)
  }, [dungeonsForMode, isStoryMode, storySeason])

  // Dungeon name lives in its own state (mirrors the categoryName pattern) so
  // clearing the stage doesn't collapse the cascade. Hydrated once from the
  // saved stageId.
  const [dungeonName, setDungeonName] = useState('')
  const dungeonHydratedRef = useRef(false)
  useEffect(() => {
    if (dungeonHydratedRef.current) return
    if (!selectedMode || !stageId) return
    const stage = selectedMode.stages.find(s => s.id === stageId)
    if (!stage) return
    dungeonHydratedRef.current = true
    setDungeonName(parseDungeonStage(stage).dungeonName)
  }, [selectedMode, stageId])

  const selectedDungeonStages = useMemo(
    () => dungeonsForMode.find(d => d.name === dungeonName)?.stages ?? [],
    [dungeonsForMode, dungeonName],
  )
  const selectedMonster = useMemo(
    () => findMonsterByKey(selectedStage ?? null, monsterKey)?.monster ?? null,
    [selectedStage, monsterKey]
  )

  // Auto-detect element advantage/disadvantage when both attacker and target elements
  // are known (char loaded + monster loaded from stage). Same seed-then-fire ref
  // pattern so saved values aren't clobbered on hydration. ELEMENT_ADV covers both
  // the Fire/Water/Earth trio and the Light↔Dark mutual advantage (see ELEMENT_ADV
  // for the empirical basis).
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

  // When the user picks a monster, set the target level (used by the API
  // fetch below as a query param). In MANUAL mode we also seed DEF/DR/isBoss
  // from the stages route's pre-computed values so the user has something
  // sensible to edit. In AUTO mode we deliberately skip those — the API fetch
  // overwrites them anyway with the post-advantage values, and writing twice
  // creates a race where a fast F5 (or save) between the sync write and the
  // async API resolve persists the stage-precompute (pre-advantage) values
  // instead of the API's correct ones.
  function applyMonster(m: StageMonster) {
    setTargetLevel(m.level)
    if (targetMode === 'auto') return
    // Store full float precision — the formula's residual is bounded by input
    // precision, and 4-decimal truncation costs ~0.00005% per stat (negligible
    // alone but accumulates through the pipeline). String(value) preserves the
    // JS default representation up to ~17 significant digits.
    setDef(String(m.defAtLevel))
    setTgtDmgRedPct(String(m.drPctAtLevel))
    // Manual mode HP: raw level-scaled (no dungeon HpRate applied — that lives
    // only in the auto-mode /api/admin/monsters route). Good enough for
    // BT_DMG_TARGET_STAT testing on stages without HpRate; for stages with one
    // (e.g. raids), prefer auto mode.
    setTgtHp(String(m.hpAtLevel))
    setIsBoss(m.isBoss)
  }

  function handleSelectCategory(category: string) {
    // Switching category invalidates downstream selections.
    setCategoryName(category)
    setModeLabel('')
    setStorySeason(null)
    setDungeonName('')
    setStageId('')
    setMonsterKey('')
    if (!category) return
    // If only one sub-mode in the category, pre-select it (saves a click).
    const group = groupedModes.find(g => g.category === category)
    if (group && group.entries.length === 1) setModeLabel(group.entries[0].mode.label)
  }
  function handleSelectMode(label: string) {
    setModeLabel(label)
    setStorySeason(null)
    setDungeonName('')
    setStageId('')
    setMonsterKey('')
  }
  function handleSelectSeason(seasonStr: string) {
    const s = seasonStr === '' ? null : parseInt(seasonStr, 10)
    setStorySeason(Number.isFinite(s as number) ? (s as number) : null)
    setDungeonName('')
    setStageId('')
    setMonsterKey('')
  }
  // Pick the wave that contains the boss (or the last wave as fallback) and
  // return the first monster to highlight when a stage gets auto-selected.
  // Story stages put the boss in Wave 3; Tower/Raid stages have a single wave.
  function pickInitialMonster(stage: StageEntry): { wave: WaveEntry; monster: StageMonster } | null {
    for (const w of stage.waves) {
      const boss = w.monsters.find(m => m.isBoss)
      if (boss) return { wave: w, monster: boss }
    }
    const last = stage.waves[stage.waves.length - 1]
    if (last && last.monsters.length > 0) return { wave: last, monster: last.monsters[0] }
    return null
  }
  function handleSelectDungeon(name: string) {
    setDungeonName(name)
    setStageId('')
    setMonsterKey('')
    if (!name) return
    // If only one stage in the dungeon, pre-select it.
    const dungeon = dungeonsForMode.find(d => d.name === name)
    if (dungeon && dungeon.stages.length === 1) {
      const s = dungeon.stages[0]
      setStageId(s.id)
      const pick = pickInitialMonster(s)
      if (pick) {
        setMonsterKey(makeMonsterKey(pick.wave, pick.monster))
        applyMonster(pick.monster)
      }
    }
  }
  function handleSelectStage(id: string) {
    setStageId(id)
    const stage = selectedMode?.stages.find(s => s.id === id)
    if (!stage) { setMonsterKey(''); return }
    const pick = pickInitialMonster(stage)
    if (pick) {
      setMonsterKey(makeMonsterKey(pick.wave, pick.monster))
      applyMonster(pick.monster)
    } else {
      setMonsterKey('')
    }
  }
  function handleSelectMonster(key: string) {
    setMonsterKey(key)
    const found = findMonsterByKey(selectedStage ?? null, key)
    if (found) applyMonster(found.monster)
  }
  function clearTargetPicker() {
    setCategoryName('')
    setModeLabel('')
    setStorySeason(null)
    setDungeonName('')
    setStageId('')
    setMonsterKey('')
  }

  const currentSkill = selectedChar?.skills[slot] ?? null
  const damageFactor = currentSkill?.damageFactors[skillLevel - 1] ?? null

  // Adventure License gating — the paid awakening tier (`licence_Awakening_*`)
  // only fires inside the two DM_ADVENTURE_* modes. Every other category
  // (Special Request raids, Story, Towers, Guild Raid, …) suppresses them.
  const inAdventureLicense = useMemo(
    () => selectedMode != null && classifyMode(selectedMode)?.category === 'Adventure License',
    [selectedMode],
  )

  // Apply the unified buff reducer for the current caster context. Used to
  // surface the active buffs in the UI breakdown AND to feed the monster-fetch
  // effect with caster-side debuffs (eff/res). The full damage calc lives in
  // `computation` below — both call into the same buff reducer (pure / cheap).
  const reducedBuffs = useMemo<ReducedBuffs | null>(() => {
    if (!selectedChar) return null
    const statValues: Record<string, number> = { ST_ATK: num(atk) }
    for (const [k, v] of Object.entries(extraScale)) statValues[k] = num(v)
    const ctx: BuffContext = {
      charId: selectedChar.id,
      charElement: selectedChar.element,
      charClass: selectedChar.class,
      charSubclass: (selectedChar.subClass ?? '').toUpperCase(),
      slot: SLOT_LABELS[slot],
      isBoss, crit, elem: elemental,
      applyQuirks,
      inAdventureLicense,
      baseAtk: num(atk),
      statValues,
    }
    const relevant = allBuffs.filter(b =>
      b.source.kind === 'awakening' || (b.source.kind === 'char_skill' && b.source.charId === selectedChar.id)
    )
    return applyBuffs(relevant, ctx)
  }, [allBuffs, selectedChar, slot, isBoss, crit, elemental, applyQuirks, inAdventureLicense, atk, extraScale])

  const monsterDebuffs = useMemo(
    () => ({
      eff: reducedBuffs?.monsterEffPermille ?? 0,
      res: reducedBuffs?.monsterResPermille ?? 0,
    }),
    [reducedBuffs?.monsterEffPermille, reducedBuffs?.monsterResPermille],
  )

  // Auto mode: fetch the validated monster stats whenever the target monster /
  // stage / level changes, then mirror them into the formula state vars
  // (def/tgtDmgRedPct/isBoss). The stage's id is the DungeonTemplet ID — passing
  // it lets the route apply the dungeon's SpawnAdvantageRate_* multipliers.
  // Boss EFF/RES debuffs from PVE quirks ride along as effDebuff/resDebuff.
  useEffect(() => {
    if (targetMode !== 'auto') { setApiMonsterStats(null); return }
    // Force CDMG RED to 0 as soon as we enter auto mode (regardless of monster
    // selection). Monsters don't have this stat and any stale manual value
    // would otherwise persist into auto-mode formula calls.
    setTgtCdmgRedPct('0')
    if (!selectedMonster) { setApiMonsterStats(null); return }
    const params = new URLSearchParams({ level: String(targetLevel) })
    if (selectedStage?.id) params.set('dungeonId', selectedStage.id)
    if (monsterDebuffs.eff) params.set('effDebuff', String(monsterDebuffs.eff))
    if (monsterDebuffs.res) params.set('resDebuff', String(monsterDebuffs.res))
    let cancelled = false
    fetch(`/api/admin/monsters/${selectedMonster.monsterId}/stats?${params.toString()}`)
      .then(r => r.json())
      .then((data: ApiMonsterStatsResponse) => {
        if (cancelled || !data?.final) return
        setApiMonsterStats(data)
        // Full float precision (see comment in applyMonster above). The route
        // already floors integer stats (ATK/DEF/HP/SPD/EFF/RES) to match in-game
        // display, but percent stats (DR/CHC/CHD/PEN/DMG↑) are kept as floats —
        // we want to propagate that precision intact, no `.toFixed(N)` truncation.
        setDef(String(data.final.def))
        setTgtDmgRedPct(String(data.final.dmgRed))
        // HP — needed by BT_DMG_TARGET_STAT chars (Noa S2 et al). Floored by the
        // route to match in-game display; passing as String preserves it intact.
        setTgtHp(String(data.final.hp))
        setIsBoss(data.meta.isBoss)
        // Monsters have no CDMG_REDUCE stat in MonsterTemplet — force to 0 in auto
        // mode. Otherwise a stale value typed in manual mode persists silently
        // (the input is hidden in auto so the user has no way to clear it).
        setTgtCdmgRedPct('0')
      })
      .catch(() => { if (!cancelled) setApiMonsterStats(null) })
    return () => { cancelled = true }
    // monsterDebuffs is a fresh-identity object on every render but the values
    // (eff/res) only change when applyQuirks/applicableQuirks/isBoss changes.
    // Depend on the primitive values directly to avoid refetching on each
    // toggle of a condition that doesn't actually move the numbers.
  }, [targetMode, selectedMonster, selectedStage, targetLevel, monsterDebuffs.eff, monsterDebuffs.res])

  // Live damage calc — feeds `recompute()` with form state. The result holds
  // the final number (`calculated`), the formula breakdown (pool / mit / DR /
  // elem / additional / extra components — for the UI panel), and the reduced
  // buff state (active buffs list + per-target deltas) shared with `reducedBuffs`
  // above. Both memos call into the same reducer; cost is negligible.
  const computation = useMemo(() => {
    if (!selectedChar || damageFactor == null) return null
    const extras: Record<string, number> = {}
    for (const [k, v] of Object.entries(extraScale)) extras[k] = num(v)
    const ctx: RecomputeContext = {
      charId: selectedChar.id,
      charElement: selectedChar.element,
      charClass: selectedChar.class,
      charSubclass: selectedChar.subClass ?? '',
      slot: SLOT_LABELS[slot],
      damageFactor,
      additionalAttackRatio: (additionalAttack && currentSkill?.additionalAttackRatio != null && currentSkill.additionalAttackRatio > 0)
        ? currentSkill.additionalAttackRatio : undefined,
      atk: num(atk),
      chd: num(chdPct),
      pen: num(penPct),
      dmgInc: num(dmgIncPct),
      applyQuirks,
      extraStats: extras,
      targetDef: num(def),
      targetDmgRed: num(tgtDmgRedPct),
      targetCdmgRed: num(tgtCdmgRedPct),
      targetHp: num(tgtHp) || undefined,
      isBoss,
      elem: elemental,
      crit,
      mode: selectedMode?.mode,
      charFlags: { umeActive, sakuraActive },
      C: num(C, 1000),
      ratioDivisor: num(ratioDivisor, 1000),
      f32arithmetic: f32Arithmetic,
    }
    return recompute(ctx, allBuffs)
  }, [selectedChar, damageFactor, slot, atk, chdPct, penPct, dmgIncPct, def,
      tgtDmgRedPct, tgtCdmgRedPct, tgtHp, isBoss, elemental, crit, applyQuirks,
      extraScale, selectedMode, additionalAttack, currentSkill, allBuffs, C, ratioDivisor,
      umeActive, sakuraActive, f32Arithmetic])

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

    // Build extraStats from the form's extraScale state, narrowing to numeric values.
    const extras: Record<string, number> = {}
    for (const [k, v] of Object.entries(extraScale)) {
      const n = num(v)
      if (Number.isFinite(n) && n !== 0) extras[k] = n
    }

    // Raw save schema — all formula-feeding values are stored verbatim. The
    // recompute path re-applies live buffs via `recompute()`, so any future
    // fix to the buff parser auto-propagates to existing obs without re-saving.
    const payload: Omit<Observation, 'id' | 'ts'> = {
      charId: selectedChar.id,
      charName: selectedChar.name,
      charElement: selectedChar.element,
      charClass: selectedChar.class,
      charSubclass: selectedChar.subClass ?? '',
      slot: SLOT_LABELS[slot],
      skillLevel,
      df: damageFactor,
      atk: num(atk),
      chd: num(chdPct),
      pen: num(penPct),
      dmgInc: num(dmgIncPct),
      applyQuirks,
      targetDef: num(def),
      targetDmgRed: num(tgtDmgRedPct),
      targetCdmgRed: num(tgtCdmgRedPct),
      ...(num(tgtHp) > 0 ? { targetHp: num(tgtHp) } : {}),
      isBoss,
      elem: elemental,
      crit,
      obs: observedNum,
      ...(Object.keys(extras).length > 0 ? { extraStats: extras } : {}),
      ...(umeActive || sakuraActive ? {
        charFlags: {
          ...(umeActive ? { umeActive: true } : {}),
          ...(sakuraActive ? { sakuraActive: true } : {}),
        },
      } : {}),
      ...(additionalAttack && currentSkill?.additionalAttackRatio != null
        ? { additionalAttack: true, additionalAttackRatio: currentSkill.additionalAttackRatio }
        : {}),
      ...(note.trim() ? { note: note.trim() } : {}),
      ...(selectedMode ? { mode: selectedMode.mode } : {}),
      ...(selectedStage ? { stageId: selectedStage.id, stageName: selectedStage.name } : {}),
      ...(selectedMonster ? {
        monsterId: selectedMonster.monsterId,
        monsterName: selectedMonster.name,
        monsterLvl: selectedMonster.level,
        monsterType: selectedMonster.type,
        monsterElement: selectedMonster.element,
        monsterClass: selectedMonster.class,
      } : {}),
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
  }, [observed, characterId, slot, skillLevel, crit, atk, chdPct,
      penPct, dmgIncPct,
      def, tgtCdmgRedPct, tgtDmgRedPct, elemental,
      isBoss, note,
      // Config that affects the saved snapshot (caster / target blocks)
      transcendStar, heroCodexLevel, applyQuirks, extraScale,
      targetMode, targetLevel, monsterKey, stageId,
      umeActive, sakuraActive])

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
    const ctx: RecomputeContext = {
      charId: o.charId,
      charElement: o.charElement,
      charClass: o.charClass,
      charSubclass: o.charSubclass,
      slot: o.slot,
      damageFactor: o.df,
      additionalAttackRatio: (o.additionalAttack && o.additionalAttackRatio != null && o.additionalAttackRatio > 0)
        ? o.additionalAttackRatio : undefined,
      atk: o.atk,
      chd: o.chd,
      pen: o.pen,
      dmgInc: o.dmgInc,
      applyQuirks: o.applyQuirks,
      extraStats: o.extraStats,
      targetDef: o.targetDef,
      targetDmgRed: o.targetDmgRed,
      targetCdmgRed: o.targetCdmgRed,
      targetHp: o.targetHp,
      isBoss: o.isBoss,
      elem: o.elem,
      crit: o.crit,
      mode: o.mode,
      charFlags: o.charFlags,
      C: num(C, 1000),
      ratioDivisor: num(ratioDivisor, 1000),
    }
    const r = recompute(ctx, allBuffs)
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
          <div className="space-y-3 text-sm">
            {/* Portrait + name + selector */}
            <div className="flex items-start gap-3">
              {selectedChar ? (
                <CharacterPortrait
                  id={selectedChar.id}
                  size="lg"
                  showIcons
                  showStars
                />
              ) : (
                <div className="flex h-24 w-24 items-center justify-center rounded-lg border border-dashed border-zinc-700 bg-zinc-900/40 text-[10px] text-zinc-600">
                  no char
                </div>
              )}
              <div className="min-w-0 flex-1 space-y-1">
                {selectedChar && (
                  <>
                    <div className="truncate text-base font-semibold text-zinc-100">{selectedChar.name}</div>
                    <div className="text-[11px] text-zinc-500">
                      {selectedChar.element} · {selectedChar.class}{selectedChar.subClass && selectedChar.subClass !== 'NONE' ? ` / ${selectedChar.subClass}` : ''}
                    </div>
                  </>
                )}
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
              </div>
            </div>
            {selectedChar && (
              <div className="space-y-1.5 rounded bg-zinc-900/60 px-2 py-1.5 text-[11px] font-mono text-zinc-500">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2">
                    <span className="text-zinc-600">Lv100:</span>
                    <span className="flex items-center gap-1"><StatIcon stat="ATK" size={14} /> {selectedChar.atkMax}</span>
                    <span className="flex items-center gap-1"><StatIcon stat="CHD" size={14} /> {selectedChar.chdMax}%</span>
                    <span className="flex items-center gap-1"><StatIcon stat="CHC" size={14} /> {selectedChar.critRateMax}%</span>
                  </span>
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
                {(() => {
                  const idx = transcendOptions.findIndex(o => o.transStar === transcendStar)
                  const safeIdx = idx >= 0 ? idx : 0
                  const last = transcendOptions.length - 1
                  const progressPct = last > 0 ? (safeIdx / last) * 100 : 100
                  const currentOpt = transcendOptions[safeIdx]
                  const stars = currentOpt ? starRowForLevel(currentOpt.levelId) : []
                  return (
                    <div className="space-y-1.5 border-t border-zinc-800/70 pt-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-zinc-400">Transcendance <span className="text-zinc-600">({selectedChar.basicStar}★ base)</span></span>
                        <span className="font-mono text-zinc-300">Lv {currentOpt?.label ?? '—'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => transcendOptions[safeIdx - 1] && setTranscendStar(transcendOptions[safeIdx - 1].transStar)}
                          disabled={safeIdx <= 0}
                          className="flex h-5 w-5 items-center justify-center rounded bg-zinc-700 text-xs text-white hover:bg-zinc-600 disabled:cursor-not-allowed disabled:opacity-40"
                          aria-label="Previous"
                        >&minus;</button>
                        <div className="relative h-1.5 grow overflow-hidden rounded-full bg-zinc-700">
                          <div
                            className="absolute left-0 top-0 h-full bg-yellow-500 transition-all duration-200"
                            style={{ width: `${progressPct}%` }}
                          />
                          <input
                            type="range"
                            min={0}
                            max={last}
                            value={safeIdx}
                            onChange={e => {
                              const i = Number(e.target.value)
                              if (transcendOptions[i]) setTranscendStar(transcendOptions[i].transStar)
                            }}
                            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                            aria-label="Transcendence level"
                          />
                        </div>
                        <button
                          onClick={() => transcendOptions[safeIdx + 1] && setTranscendStar(transcendOptions[safeIdx + 1].transStar)}
                          disabled={safeIdx >= last}
                          className="flex h-5 w-5 items-center justify-center rounded bg-zinc-700 text-xs text-white hover:bg-zinc-600 disabled:cursor-not-allowed disabled:opacity-40"
                          aria-label="Next"
                        >+</button>
                        <div className="flex shrink-0 gap-px">
                          {stars.map((color, i) => (
                            <Image
                              key={i}
                              src={STAR_ICONS[color]}
                              alt=""
                              width={12}
                              height={12}
                              className="object-contain"
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  )
                })()}
                <label className="flex items-center justify-between gap-2 border-t border-zinc-800/70 pt-1.5">
                  <span className="text-zinc-400">Hero Codex <span className="text-zinc-600">(global roster bonus)</span></span>
                  <select
                    value={heroCodexLevel}
                    onChange={e => setHeroCodexLevel(parseInt(e.target.value, 10))}
                    className="rounded border border-zinc-700 bg-zinc-900 px-1.5 py-0.5 text-[11px] font-mono text-zinc-100"
                  >
                    {Array.from({ length: 12 }, (_, i) => i).map(l => (
                      <option key={l} value={l}>Lv.{l}</option>
                    ))}
                  </select>
                </label>
                <label className="flex items-center justify-between gap-2 border-t border-zinc-800/70 pt-1.5">
                  <span className="text-zinc-400">Apply quirks <span className="text-zinc-600">(element/class/subclass gifts + pool buffs)</span></span>
                  <input
                    type="checkbox"
                    checked={applyQuirks}
                    onChange={e => setApplyQuirks(e.target.checked)}
                  />
                </label>
              </div>
            )}
            {selectedChar && charScaling && (
              <div className="space-y-2 rounded border border-zinc-800/70 bg-zinc-950/30 p-2">
                <div className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                  Scaling stats
                  {charScaling.swap && (
                    <span className="ml-2 rounded bg-amber-900/40 px-1.5 py-0.5 font-mono text-[10px] text-amber-300">
                      {statLabel(charScaling.swap.stat)} ×{(charScaling.swap.valuePerMille / 1000).toFixed(2)} swap
                    </span>
                  )}
                </div>
                {!charScaling.swap && (
                  <Field stat="ATK" value={atk} onChange={setAtk} />
                )}
                {scalingStatKeys.map(stat => {
                  // Find the corresponding scaling badge text — SWAP wins over ADD
                  // when both reference the same stat (rare but possible).
                  const swap = charScaling.swap?.stat === stat ? charScaling.swap : null
                  const add  = charScaling.add.find(a => a.stat === stat)
                  const badge = swap
                    ? `×${(swap.valuePerMille / 1000).toFixed(2)} swap`
                    : add ? `+${(add.valuePerMille / 10).toFixed(1)}%` : ''
                  return (
                    <Field
                      key={stat}
                      stat={ST_TO_KEY[stat] ?? statLabel(stat)}
                      suffix={badge}
                      value={extraScale[stat] ?? ''}
                      onChange={v => setExtraScale(prev => ({ ...prev, [stat]: v }))}
                    />
                  )
                })}
                {charScaling.special.map((s, i) => (
                  <div key={i} className="px-1 text-xs text-zinc-500">
                    <span className="text-amber-400">+{(s.valuePerMille / 10).toFixed(1)}%</span>{' '}
                    {s.kind === 'lost_hp' ? 'caster lost-HP' : `target ${statLabel(s.stat)}`}
                  </div>
                ))}
              </div>
            )}
            <div className="space-y-2 rounded border border-zinc-800/70 bg-zinc-950/30 p-2">
              <div className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Damage stats</div>
              <Field stat="CHD" value={chdPct} onChange={setChdPct} />
              <Field stat="PEN%" value={penPct} onChange={setPenPct} />
              <Field stat="DMG UP%" value={dmgIncPct} onChange={setDmgIncPct} />
            </div>
            <div className="space-y-2 rounded border border-zinc-800/70 bg-zinc-950/30 p-2">
              <div className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Skill</div>
              <div className="flex items-center gap-3">
                <div className="flex gap-2">
                  {(['first', 'second', 'ultimate'] as SlotKey[]).map(s => {
                    // Skill_{First|Second|Ultimate}_{charId}.webp — naming convention
                    // shared with the in-game UI. Falls back to a label-only button
                    // when no character is picked yet.
                    // Core-fusion derivatives (ID 2700xxx) reuse the *original* char's
                    // S1/S2 icons; only S3 (Ultimate) uses their own ID.
                    const slotName = s === 'first' ? 'First' : s === 'second' ? 'Second' : 'Ultimate'
                    const iconCharId = selectedChar
                      ? (s !== 'ultimate' && selectedChar.originalCharacter ? selectedChar.originalCharacter : selectedChar.id)
                      : null
                    const iconSrc = iconCharId ? `/images/characters/skills/Skill_${slotName}_${iconCharId}.webp` : null
                    const active = slot === s
                    return (
                      <button
                        key={s}
                        onClick={() => setSlot(s)}
                        title={`${SLOT_LABELS[s]} (${slotName})`}
                        className={`relative h-12 w-12 overflow-hidden rounded-lg transition ${
                          active
                            ? 'border-2 border-blue-400 ring-2 ring-blue-400/50'
                            : 'opacity-70 hover:opacity-100'
                        }`}
                      >
                        {iconSrc ? (
                          <Image
                            src={iconSrc}
                            alt={SLOT_LABELS[s]}
                            width={48}
                            height={48}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <span className={`flex h-full w-full items-center justify-center text-xs ${active ? 'text-blue-300' : 'text-zinc-400'}`}>
                            {SLOT_LABELS[s]}
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
                <div className="ml-auto flex flex-col items-end gap-1">
                  <span className="text-[10px] uppercase tracking-wider text-zinc-500">Skill level</span>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map(lvl => {
                      const df = currentSkill?.damageFactors[lvl - 1]
                      const available = df != null
                      const active = skillLevel === lvl
                      return (
                        <button
                          key={lvl}
                          onClick={() => available && setSkillLevel(lvl)}
                          disabled={!available}
                          title={available ? `lv ${lvl} · DF ${df}` : `lv ${lvl} unavailable`}
                          className={`h-7 w-7 rounded text-xs font-mono transition ${
                            active
                              ? 'bg-blue-600/40 text-blue-200 ring-1 ring-blue-400'
                              : available
                                ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                                : 'bg-zinc-900 text-zinc-700 cursor-not-allowed'
                          }`}
                        >{lvl}</button>
                      )
                    })}
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between border-t border-zinc-800 pt-2">
                <span className="text-xs text-zinc-500">DamageFactor</span>
                <span className={`font-mono text-sm ${damageFactor != null ? 'text-zinc-100' : 'text-zinc-600'}`}>
                  {damageFactor ?? '—'}
                </span>
              </div>
              <label className="flex items-center gap-2 pt-1">
                <input type="checkbox" checked={crit} onChange={e => setCrit(e.target.checked)} />
                <span className="text-sm">Crit hit</span>
              </label>
              {currentSkill?.additionalAttackRatio != null && currentSkill.additionalAttackRatio > 0 && (
                <label className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    checked={additionalAttack}
                    onChange={e => setAdditionalAttack(e.target.checked)}
                  />
                  <span className="text-sm">
                    Additional attack
                    <span className="ml-1 text-[10px] text-zinc-500">
                      (+{(currentSkill.additionalAttackRatio * 100).toFixed(0)}% DF · trigger condition is char-specific)
                    </span>
                  </span>
                </label>
              )}
              {/* Ame-specific: Ume / Sakura states gate her S1 conditional hits.
                  Set by her S3 cast (Ume if target HP > 90%, Sakura otherwise).
                  Mutually exclusive in-game; the UI lets the user toggle each
                  for testing. Each maps to a different override behavior — see
                  `src/lib/damage/char-overrides.ts`. */}
              {selectedChar?.id === '2000065' && slot === 'first' && (
                <div className="space-y-1 pt-1">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={umeActive}
                      onChange={e => setUmeActive(e.target.checked)}
                    />
                    <span className="text-sm">
                      Ume active
                      <span className="ml-1 text-[10px] text-zinc-500">
                        (target HP &gt; 90% on S3 cast · priority gain)
                      </span>
                    </span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={sakuraActive}
                      onChange={e => setSakuraActive(e.target.checked)}
                    />
                    <span className="text-sm">
                      Sakura active
                      <span className="ml-1 text-[10px] text-zinc-500">
                        (target HP &lt; 90% on S3 cast · element superiority on S1)
                      </span>
                    </span>
                  </label>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Target */}
        <section className="space-y-4">
          <div className="rounded border border-zinc-800 bg-zinc-900/40 p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">Target</h2>
              <div className="flex gap-1 rounded border border-zinc-700 bg-zinc-950/50 p-0.5 text-[11px]">
                {(['auto', 'manual'] as const).map(m => (
                  <button
                    key={m}
                    onClick={() => setTargetMode(m)}
                    className={`rounded px-2 py-0.5 ${targetMode === m ? 'bg-blue-600/30 text-blue-300' : 'text-zinc-500 hover:text-zinc-300'}`}
                  >{m === 'auto' ? 'Auto (API)' : 'Manual'}</button>
                ))}
              </div>
            </div>
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
                <span className="mb-1 block text-xs text-zinc-500">Category</span>
                <select
                  value={categoryName}
                  onChange={e => handleSelectCategory(e.target.value)}
                  className="w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm text-zinc-100"
                >
                  <option value="">— select —</option>
                  {groupedModes.map(g => (
                    <option key={g.category} value={g.category}>{g.category}</option>
                  ))}
                </select>
              </label>
              {categoryName && selectedCategoryEntries.length > 1 && (
                <label className="block">
                  <span className="mb-1 block text-xs text-zinc-500">Mode</span>
                  <select
                    value={modeLabel}
                    onChange={e => handleSelectMode(e.target.value)}
                    className="w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm text-zinc-100"
                  >
                    <option value="">— select —</option>
                    {selectedCategoryEntries.map(e => (
                      <option key={e.mode.label} value={e.mode.label}>{e.sub} ({e.mode.stages.length})</option>
                    ))}
                  </select>
                </label>
              )}
              {selectedMode && isStoryMode && seasonsForMode.length > 1 && (
                <label className="block">
                  <span className="mb-1 block text-xs text-zinc-500">Season</span>
                  <select
                    value={storySeason ?? ''}
                    onChange={e => handleSelectSeason(e.target.value)}
                    className="w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm text-zinc-100"
                  >
                    <option value="">— select —</option>
                    {seasonsForMode.map(s => (
                      <option key={s} value={s}>Season {s}</option>
                    ))}
                  </select>
                </label>
              )}
              {selectedMode && filteredDungeons.length > 1 && (!isStoryMode || storySeason != null) && (
                <label className="block">
                  <span className="mb-1 block text-xs text-zinc-500">{isStoryMode ? 'Episode' : 'Dungeon'} ({filteredDungeons.length})</span>
                  <select
                    value={dungeonName}
                    onChange={e => handleSelectDungeon(e.target.value)}
                    className="w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm text-zinc-100"
                  >
                    <option value="">— select —</option>
                    {filteredDungeons.map(d => (
                      <option key={d.name} value={d.name}>{d.name} ({d.stages.length})</option>
                    ))}
                  </select>
                </label>
              )}
              {selectedMode && (filteredDungeons.length === 1 || (dungeonName && selectedDungeonStages.length > 1)) && (() => {
                const rawStages = filteredDungeons.length === 1 ? filteredDungeons[0].stages : selectedDungeonStages
                // Story stages must be sorted by stageNum so 10-10/10-11/10-12/10-13
                // come out in order; the API's recommendLevel-based sort can shuffle
                // them when consecutive stages share a level. Other modes keep the
                // API order (already sorted by recommendLevel + name).
                const stages = isStoryMode
                  ? [...rawStages].sort((a, b) => (a.stageNum ?? 0) - (b.stageNum ?? 0))
                  : rawStages
                return (
                  <label className="block">
                    <span className="mb-1 block text-xs text-zinc-500">Stage ({stages.length})</span>
                    <select
                      value={stageId}
                      onChange={e => handleSelectStage(e.target.value)}
                      className="w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm text-zinc-100"
                    >
                      <option value="">— select —</option>
                      {stages.map(s => {
                        const { stagePart } = parseDungeonStage(s)
                        // Append the stage's storyline title in parens for story
                        // (where it carries info: "9-1 (The Rage of the Demibeasts)").
                        // Skip for tower/raid/etc. where `name` is just "<dungeon> <stagePart>".
                        const suffix = isStoryMode && s.name && s.name !== stagePart ? ` (${s.name})` : ''
                        return (
                          <option key={s.id} value={s.id}>
                            {s.recommendLevel > 0 ? `[Lv${s.recommendLevel}] ` : ''}{stagePart}{suffix}
                          </option>
                        )
                      })}
                    </select>
                  </label>
                )
              })()}
              {selectedStage && selectedStage.waves.length > 0 && (
                <div className="space-y-2">
                  {selectedStage.waves.map((w, i) => (
                    <div key={w.position}>
                      <span className="mb-1 block text-xs text-zinc-500">
                        Fight {i + 1} ({w.monsters.length})
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {w.monsters.map(m => {
                          const key = makeMonsterKey(w, m)
                          const isSelected = monsterKey === key
                          return (
                            <button
                              key={key}
                              type="button"
                              onClick={() => handleSelectMonster(key)}
                              title={`${m.isBoss ? '★ ' : ''}Lv${m.level} · ${m.name} (${m.element}/${m.class})`}
                              className={`relative rounded-lg outline-none transition ${isSelected ? '' : 'opacity-60 hover:opacity-100'}`}
                            >
                              <MonsterPortrait
                                faceIconId={m.faceIconId}
                                name={m.name}
                                element={m.element}
                                classType={m.class}
                                type={m.type}
                                basicStar={m.basicStar}
                                level={m.level}
                                isBoss={m.isBoss}
                                size="md"
                                showIcons
                                showLevel
                              />
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {selectedMonster && (
                <div className="rounded bg-zinc-900/60 px-2 py-1.5 text-[11px] font-mono text-zinc-400">
                  <div>{selectedMonster.name} · {selectedMonster.type}{selectedMonster.subClass && selectedMonster.subClass !== 'NONE' ? ` · ${selectedMonster.subClass}` : ''}</div>
                  <div className="text-zinc-600">spawn lv {selectedMonster.level} · {selectedMonster.element} / {selectedMonster.class}</div>
                </div>
              )}
            </div>
            {targetMode === 'auto' ? (
              <div className="space-y-2 text-sm">
                {apiMonsterStats ? (
                  <div className="rounded border border-zinc-800/70 bg-zinc-950/30 p-2 font-mono text-[11px] text-zinc-400">
                    {(() => {
                      const r = apiMonsterStats.meta.advantageRate
                      const parts: string[] = []
                      if (r.atk) parts.push(`ATK ${r.atk > 0 ? '+' : ''}${(r.atk / 10).toFixed(1)}%`)
                      if (r.def) parts.push(`DEF ${r.def > 0 ? '+' : ''}${(r.def / 10).toFixed(1)}%`)
                      if (r.hp)  parts.push(`HP ${r.hp  > 0 ? '+' : ''}${(r.hp  / 10).toFixed(1)}%`)
                      if (r.spd) parts.push(`SPD ${r.spd > 0 ? '+' : ''}${(r.spd / 10).toFixed(1)}%`)
                      if (parts.length === 0) return null
                      return (
                        <div className="mb-1 rounded bg-amber-900/20 px-1.5 py-0.5 text-[10px] text-amber-400">
                          dungeon malus: {parts.join(' · ')}
                        </div>
                      )
                    })()}
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                      <div className="flex items-center justify-between gap-2"><StatIcon stat="ATK" size={16} /><span className="text-zinc-200">{apiMonsterStats.final.atk.toFixed(0)}</span></div>
                      <div className="flex items-center justify-between gap-2"><StatIcon stat="DEF" size={16} /><span className="text-zinc-200">{apiMonsterStats.final.def.toFixed(1)}</span></div>
                      <div className="flex items-center justify-between gap-2"><StatIcon stat="HP" size={16} /><span className="text-zinc-200">{apiMonsterStats.final.hp.toFixed(0)}</span></div>
                      <div className="flex items-center justify-between gap-2"><StatIcon stat="SPD" size={16} /><span className="text-zinc-200">{apiMonsterStats.final.spd.toFixed(0)}</span></div>
                      <div className="flex items-center justify-between gap-2"><StatIcon stat="CHC" size={16} /><span className="text-zinc-200">{apiMonsterStats.final.chc.toFixed(1)}%</span></div>
                      <div className="flex items-center justify-between gap-2"><StatIcon stat="CHD" size={16} /><span className="text-zinc-200">{apiMonsterStats.final.chd.toFixed(1)}%</span></div>
                      <div className="flex items-center justify-between gap-2"><StatIcon stat="CDMG RED%" size={16} /><span className="text-zinc-200">{num(tgtCdmgRedPct).toFixed(2)}%</span></div>
                      <div className="flex items-center justify-between gap-2"><StatIcon stat="PEN%" size={16} /><span className="text-zinc-200">{apiMonsterStats.final.pen.toFixed(1)}%</span></div>
                      <div className="flex items-center justify-between gap-2"><StatIcon stat="DMG UP%" size={16} /><span className="text-zinc-200">{apiMonsterStats.final.dmgInc.toFixed(2)}%</span></div>
                      <div className="flex items-center justify-between gap-2"><StatIcon stat="DMG RED%" size={16} /><span className="text-zinc-200">{apiMonsterStats.final.dmgRed.toFixed(2)}%</span></div>
                      <div className="flex items-center justify-between gap-2"><StatIcon stat="EFF" size={16} /><span className="text-zinc-200">{apiMonsterStats.final.eff.toFixed(0)}</span></div>
                      <div className="flex items-center justify-between gap-2"><StatIcon stat="RES" size={16} /><span className="text-zinc-200">{apiMonsterStats.final.res.toFixed(0)}</span></div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded border border-zinc-800/70 bg-zinc-950/30 p-2 text-center text-xs text-zinc-600">
                    {selectedMonster ? 'fetching…' : 'pick a monster'}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2 text-sm">
                <Field stat="DEF" value={def} onChange={setDef} />
                <Field stat="HP" value={tgtHp} onChange={setTgtHp} />
                <Field stat="CDMG RED%" value={tgtCdmgRedPct} onChange={setTgtCdmgRedPct} />
                <Field stat="DMG RED%" value={tgtDmgRedPct} onChange={setTgtDmgRedPct} />
              </div>
            )}
            {targetMode === 'manual' && (
              <div className="mt-3 space-y-2 border-t border-zinc-800 pt-3 text-sm">
                <label className="block">
                  <span className="mb-1 block text-xs text-zinc-500">
                    Elemental (×1.20 if adv on the rock-paper-scissors trio or Light↔Dark; +50% pool only on Fire/Water/Earth via quirk)
                  </span>
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
              </div>
            )}
          </div>

        </section>

        {/* Computation + Save */}
        <section className="space-y-4">
          <div className="rounded border border-zinc-800 bg-zinc-900/40 p-4">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-400">Formula constants</h2>
            <div className="space-y-2 text-sm">
              <Field label="C (denominator)" value={C} onChange={setC} />
              <Field label="Ratio divisor (DF / x)" value={ratioDivisor} onChange={setRatioDivisor} />
              <label className="flex items-center gap-2 text-xs text-zinc-300 pt-2">
                <input type="checkbox" checked={f32Arithmetic} onChange={e => setF32Arithmetic(e.target.checked)} />
                <span>ARM f32 emulator (binary-faithful BT_DMG_TARGET_STAT)</span>
              </label>
              <p className="text-[11px] text-zinc-500 leading-snug pl-5">
                Wraps every <code>*/+/−//</code> with <code>Math.fround</code> and folds <code>BT_DMG_TARGET_STAT</code>
                into <code>mod</code> with int truncation (matches binary). Closes ~15% of the residual on Noa S2 obs;
                remaining gap is below the precision we can extract from libil2cpp without runtime instrumentation.
              </p>
            </div>
            <div className="mt-3 text-xs text-zinc-500 border-t border-zinc-800 pt-3 leading-relaxed">
              Formula: <span className="font-mono text-zinc-400">Dmg = (DF/{ratioDivisor}) × ATK × (1 + pool/100) × {C}/({C} + (1−PEN)×DEF) × (1 − DR×dr_factor/100) × elem_mult</span>
              <br/>pool = DMG Inc + (+30 if boss) + (CHD−CDmgRed−100 if crit). Adv +50% add comes from Awakening_Element_Dmg quirk via poolBonus.
              <br/>dr_factor = 0.5 if crit, else 0.75 if boss, else 1.0.  elem_mult = 1.20 if adv, 0.80 if disadv, else 1.0.
            </div>
          </div>

          <div className="rounded border border-zinc-800 bg-zinc-900/40 p-4">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-400">Result</h2>
            {computation ? (
              <div className="space-y-1 font-mono text-xs text-zinc-400">
                {/* Active buffs (from the unified reducer) — every Awakening
                    and char-specific buff whose trigger fired for the current
                    context (slot / boss / crit / elem). Includes amount + req
                    so the user can audit "is this buff supposed to fire?". */}
                {computation.reduced.active.length > 0 && (
                  <>
                    <div className="text-zinc-300">Active buffs (from /buffs API):</div>
                    {computation.reduced.active.map((b, idx) => {
                      const sign = b.effect.amount >= 0 ? '+' : ''
                      const label = b.source.kind === 'awakening'
                        ? (b.ui?.name ?? b.source.nodeId)
                        : `char ${b.source.charId} ${b.source.buffId}`
                      const unit = b.effect.unit === '%' ? '%' : (b.effect.unit === 'permille' ? '‰' : '')
                      return (
                        <div key={idx} className="pl-2 text-cyan-400">
                          {sign}{b.effect.amount}{unit} {b.effect.target} <span className="text-zinc-600">({label})</span>
                        </div>
                      )
                    })}
                  </>
                )}
                {/* Formula-side derivations (crit add, DR scaling, elem mult) —
                    these aren't buffs, they're formula effects driven by the
                    context. Skipped when their contribution is 0. */}
                {computation.breakdown.quirks.length > 0 && (
                  <>
                    <div className="text-zinc-300 pt-1 border-t border-zinc-800">Formula effects:</div>
                    {computation.breakdown.quirks.map((q, idx) => (
                      <div key={idx} className="pl-2 text-green-400">+ {q.name}: {q.value}</div>
                    ))}
                  </>
                )}
                <div className="pt-1 border-t border-zinc-800">Pool: +{computation.breakdown.poolPct.toFixed(1)}% → ×{computation.breakdown.mod.toFixed(3)}</div>
                <div>Mitigation: ×{computation.breakdown.mitigation.toFixed(4)}</div>
                <div>Elem mult: ×{computation.breakdown.elemMult.toFixed(2)}</div>
                <div className="border-t border-zinc-800 pt-1 text-lg text-zinc-100">
                  {/* Math.floor matches the binary's `fcvtms` (= round toward −∞) at the
                      end of CalcDamage. Default toFixed(0) does Math.round which is +1
                      off for ~half the obs. */}
                  Calc: <span className="font-bold">{Math.floor(computation.calculated)}</span>
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
                  <th className="px-2 py-2 text-right" title="Insertion order in the JSONL (1-indexed)">#</th>
                  {/* Caster block */}
                  <th className="px-2 py-2 text-left">Caster</th>
                  <th className="px-2 py-2 text-center">Skill</th>
                  <th className="px-2 py-2 text-right border-l border-zinc-800">
                    <div className="inline-flex items-center gap-1" title="Effective ATK (post-SWAP/ADD scaling)">
                      <StatIcon stat="ATK" size={14} /><span className="text-zinc-400">eff</span>
                    </div>
                  </th>
                  <th className="px-2 py-2 text-right" title="Critical Damage %"><StatIcon stat="CHD" size={14} /></th>
                  <th className="px-2 py-2 text-right" title="Effective pool % (DMG Inc stat + quirks via poolBonus)">
                    <div className="inline-flex items-center gap-1">
                      <StatIcon stat="DMG UP%" size={14} /><span className="text-zinc-400">pool</span>
                    </div>
                  </th>
                  <th className="px-2 py-2 text-right" title="Penetration %"><StatIcon stat="PEN%" size={14} /></th>
                  {/* Target block */}
                  <th className="px-2 py-2 text-left border-l border-zinc-800">Target</th>
                  <th className="px-2 py-2 text-right" title="Target DEF"><StatIcon stat="DEF" size={14} /></th>
                  <th className="px-2 py-2 text-right" title="Target DMG RED %"><StatIcon stat="DMG RED%" size={14} /></th>
                  {/* Context flags */}
                  <th className="px-2 py-2 text-center border-l border-zinc-800">Flags</th>
                  {/* Result */}
                  <th className="px-2 py-2 text-right border-l border-zinc-800">Obs</th>
                  <th className="px-2 py-2 text-right">Calc</th>
                  <th className="px-2 py-2 text-right" title="Observed / Calculated">Δ</th>
                  <th className="px-2 py-2 text-left">Note</th>
                  <th className="px-2 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {observations.slice().reverse().map((o, idx, arr) => {
                  const { calc, ratio } = recomputeWithCurrentConstants(o)
                  const good = Math.abs(ratio - 1) <= 0.02
                  const medium = !good && Math.abs(ratio - 1) <= 0.05
                  // Test number = 1-based position in the JSONL insertion order.
                  // We display newest-first, so reverse the index back to recover it.
                  const testNum = arr.length - idx
                  // Target's CDMG RED is virtually always 0 in auto mode (monsters
                  // don't have this stat) — surface it as a small badge only when
                  // a manual-mode test typed in a non-zero value, otherwise hide.
                  const showCdmgRed = o.targetCdmgRed && o.targetCdmgRed !== 0
                  return (
                    <tr key={o.id} className="border-b border-zinc-800/50 align-top hover:bg-zinc-800/30">
                      <td className="px-2 py-1.5 text-right font-mono text-zinc-500">{testNum}</td>
                      {/* Caster: portrait + name + element/class */}
                      <td className="px-2 py-1.5">
                        <div className="flex items-center gap-2">
                          {o.charId ? (
                            <CharacterPortrait id={o.charId} size="xs" />
                          ) : (
                            <div className="h-8 w-8 rounded bg-zinc-800/40" />
                          )}
                          <div className="min-w-0">
                            <div className="truncate text-zinc-100">{o.charName}</div>
                            {(o.charElement || o.charClass) && (
                              <div className="text-[10px] text-zinc-500">
                                {[o.charElement, o.charClass].filter(Boolean).join(' · ')}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      {/* Skill: slot + level */}
                      <td className="px-2 py-1.5 text-center">
                        <div className="font-mono text-zinc-100">{o.slot}</div>
                        {o.skillLevel != null && (
                          <div className="text-[10px] text-zinc-500">Lv{o.skillLevel}</div>
                        )}
                      </td>
                      {/* Caster stats */}
                      <td className="px-2 py-1.5 text-right font-mono border-l border-zinc-800/50">{o.atk.toFixed(0)}</td>
                      <td className="px-2 py-1.5 text-right font-mono">{o.chd.toFixed(1)}%</td>
                      <td className="px-2 py-1.5 text-right font-mono">{o.dmgInc.toFixed(1)}%</td>
                      <td className="px-2 py-1.5 text-right font-mono">{o.pen.toFixed(1)}%</td>
                      {/* Target name + level */}
                      <td className="px-2 py-1.5 border-l border-zinc-800/50">
                        {o.monsterName ? (
                          <div className="min-w-0">
                            <div className="truncate text-zinc-100">{o.monsterName}</div>
                            <div className="text-[10px] text-zinc-500">
                              {o.monsterLvl != null ? `Lv${o.monsterLvl}` : ''}
                              {o.monsterElement ? ` · ${o.monsterElement}` : ''}
                              {o.monsterClass ? ` · ${o.monsterClass}` : ''}
                            </div>
                          </div>
                        ) : (
                          <span className="text-zinc-600">—</span>
                        )}
                      </td>
                      <td className="px-2 py-1.5 text-right font-mono">{o.targetDef.toFixed(0)}</td>
                      <td className="px-2 py-1.5 text-right font-mono">
                        {o.targetDmgRed.toFixed(1)}%
                        {showCdmgRed && (
                          <div className="text-[10px] text-zinc-500" title="Target CDMG RED %">
                            CDR {o.targetCdmgRed.toFixed(1)}%
                          </div>
                        )}
                      </td>
                      {/* Flags */}
                      <td className="px-2 py-1.5 text-center border-l border-zinc-800/50">
                        <div className="inline-flex items-center gap-1 text-[10px] font-mono">
                          {o.crit && <span className="rounded bg-amber-900/40 px-1 text-amber-300" title="Critical hit">crit</span>}
                          {o.elem === 'adv' && <span className="rounded bg-green-900/40 px-1 text-green-300" title="Element advantage">adv</span>}
                          {o.elem === 'disadv' && <span className="rounded bg-red-900/40 px-1 text-red-300" title="Element disadvantage">dis</span>}
                          {o.isBoss && <span className="rounded bg-purple-900/40 px-1 text-purple-300" title="Boss target">boss</span>}
                          {o.additionalAttack && (
                            <span
                              className="rounded bg-cyan-900/40 px-1 text-cyan-300"
                              title={`Skill-internal additional attack triggered${o.additionalAttackRatio != null ? ` (+${(o.additionalAttackRatio * 100).toFixed(0)}% DF)` : ''}`}
                            >+atk</span>
                          )}
                          {!o.crit && o.elem === 'none' && !o.isBoss && !o.additionalAttack && <span className="text-zinc-700">—</span>}
                        </div>
                      </td>
                      {/* Result */}
                      <td className="px-2 py-1.5 text-right font-mono text-zinc-100 border-l border-zinc-800/50">{o.obs.toFixed(0)}</td>
                      <td className="px-2 py-1.5 text-right font-mono text-zinc-400">{Math.floor(calc)}</td>
                      <td className={`px-2 py-1.5 text-right font-mono ${good ? 'text-green-400' : medium ? 'text-amber-400' : 'text-red-400'}`}>
                        {ratio.toFixed(4)}
                      </td>
                      <td className="max-w-45 px-2 py-1.5 truncate text-zinc-500" title={o.note ?? ''}>{o.note ?? ''}</td>
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

// `stat` swaps the text label for the canonical stat icon (with title tooltip
// for the full label). `label` is still used for non-stat inputs (formula
// constants, observed damage). When both are passed, icon wins and label is
// shown as a small suffix.
function Field({ stat, label, suffix, value, onChange }: {
  stat?: string
  label?: string
  suffix?: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <label className="flex items-center justify-between gap-2">
      <span className="flex items-center gap-1 text-xs text-zinc-500">
        {stat
          ? <StatIcon stat={stat} size={20} />
          : <span>{label}</span>}
        {suffix && <span className="text-[10px] text-zinc-600">{suffix}</span>}
      </span>
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
