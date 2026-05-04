import { SCHEMA_VERSION, writeJsonMin } from './shared'
import { loadJson2 } from './raw-loader'
import {
  resolveDungeonStats, type AdvantageRates, type MonsterRow, type StatBlock,
} from '../../../src/lib/damage/v2/stats'
import {
  loadLocationTables,
  resolveModeLabelDict,
  resolveTextDict,
  SUPPORTED_DUNGEON_MODES,
  type LangDict,
} from './_location'

/**
 * Bake the target catalog for the public damage calculator.
 *
 *   public/damage-calc/monsters.json — hierarchical Mode → Stage → Wave →
 *                                      Monster tree (mirrors the admin
 *                                      Damage Lab v2 stages endpoint).
 *
 * ── Source of truth ─────────────────────────────────────────────────────
 *   `DungeonTemplet`        — one row per stage (per difficulty)
 *   `DungeonSpawnTemplet`   — wave/slot → monster mapping
 *   `MonsterTemplet`        — monster meta + raw scaling bounds
 *   `TextSystem`/`TextCharacter` — multi-lang labels (en/jp/kr/zh)
 *   `EventBossDungeonTemplet` / `IrregularChaseTemplet` — per-stage boss-HP overrides
 *
 * ── Why we ditched the curated `data/boss/*.json` source ────────────────
 *   The admin-style hierarchy needs wave structure + per-stage chapter /
 *   season / episode metadata that the curated boss files don't carry.
 *   Re-reading json2 directly gets us the exact same data the admin
 *   Damage Lab uses, with bit-exact stat parity (same `resolveDungeonStats`
 *   from `src/lib/damage/v2/stats.ts`). Mode + stage labels are localized
 *   via `resolveTextDict` (TextSystem) so the picker stays multi-lang.
 *
 * ── Stat block ──────────────────────────────────────────────────────────
 *   Each monster carries the FULL `StatBlock` at its spawn level — single
 *   source of truth shared with the admin's `/monsters/[id]/stats` route.
 *   Joint Challenge / Pursuit Operation bosses get their HP overridden by
 *   the per-stage hardcoded value from EventBossDungeon / IrregularChase.
 */

type Row = Record<string, string | undefined>

/** Stage / wave / monster meta — shape matches the admin stages route. */

interface MonsterEntry {
  monsterId: string
  /** FaceIconID — drives the portrait at `/images/characters/boss/portrait/MT_{faceIconId}.webp`. */
  faceIconId: string
  name: LangDict
  type: string
  isBoss: boolean
  /** In-game class label (Attacker/Defender/Mage/Ranger/Priest/Healer). */
  class: string
  element: string
  subClass: string
  basicStar: number
  /** Spawn level for this monster in this stage. AL stages bake one
   *  StageEntry per tier — the level here matches the tier's monsterLevel. */
  level: number
  /** Full stat block at this monster's level (with dungeon advantage + HP overrides). */
  stats: StatBlock
  /** Wave index (`SpawnID_Pos{position}` in DungeonTemplet). */
  position: number
  /** Slot within the spawn group (0..3 — `ID0`/`ID1`/`ID2`/`ID3`). */
  slot: number
}

/**
 * Adventure License level tier — one entry per playable AL Level for a stage.
 * `monsterLevel` scales every monster in the wave; `bossHp` overrides only
 * the boss's HP after stat resolution. `advantage` is the per-tier ATK/DEF/SPD
 * rate boost (per-mille — empty rate = 0); HP has no per-tier rate, scaling
 * happens via `monsterLevel` + the per-tier `bossHp` override on bosses.
 * Stages outside DM_ADVENTURE_* ship a single StageEntry as usual.
 */
interface AlLevelTier {
  alLevel: number
  monsterLevel: number
  bossHp: number | null
  advantage: AdvantageRates
}

interface WaveEntry {
  position: number
  monsters: MonsterEntry[]
}

interface StageEntry {
  /** Stable identifier — `DungeonTemplet.ID` for plain stages,
   *  `${dungeonId}@al${alLevel}` for the per-AL-Level expansion. */
  id: string
  /** Stage display name (LangDict). For story this is the storyline title. */
  name: LangDict
  /** Story chapter / area name (LangDict). null for non-story modes. */
  chapter: LangDict | null
  /** Story season (1+). null for non-story. */
  season: number | null
  /** Story episode number. null for non-story. */
  episodeNum: number | null
  /** Story per-episode stage number — assigned in the post-pass. null for non-story. */
  stageNum: number | null
  /** Recommended level — `DungeonTemplet.RecommandLevel` for plain stages,
   *  the per-tier `monsterLevel` for AL stages so the picker sorts by
   *  difficulty within an AL dungeon. */
  recommendLevel: number
  waves: WaveEntry[]
  /**
   * Adventure License level (1..10) when this stage is the per-tier
   * expansion of a DM_ADVENTURE_MISSION / DM_ADVENTURE_CHALLENGE dungeon.
   * Undefined for plain stages. The picker UI suffixes the label with
   * "AL Lv {alLevel}" so users pick the difficulty inline.
   */
  alLevel?: number
}

interface ModeEntry {
  /** Raw `DungeonMode` token (DM_TOWER_HARD, DM_NORMAL, …). */
  mode: string
  /** Localized mode label (LangDict). */
  label: LangDict
  stages: StageEntry[]
}

interface MonstersFile {
  _v: string
  modes: ModeEntry[]
}

/** Override-row shapes. */
interface EventBossDungeonRow extends Row {
  BossID?: string
  DungeonID?: string         // CSV
  BossMonsterHP?: string     // CSV indexed by DungeonID position
}
interface IrregularChaseRow extends Row {
  BossID?: string
  DungeonID?: string
  BossHP?: string
}

// ── Constants ─────────────────────────────────────────────────────────

// `CT_NAMED_MONSTER` is intentionally excluded — the in-game slot color
// flags it as Magic (blue) rather than Rare (red), so it's a tougher named
// mob and not the stage boss.
const BOSS_TYPES = new Set([
  'CT_BOSS_MONSTER',
  'CT_AREA_BOSS_MONSTER',
  'CT_SEASON_BOSS_MONSTER',
])

const CLASS_LABEL: Record<string, string> = {
  CCT_ATTACKER: 'Attacker',
  CCT_MAGE:     'Mage',
  CCT_RANGER:   'Ranger',
  CCT_DEFENDER: 'Defender',
  CCT_PRIEST:   'Priest',
  CCT_HEALER:   'Healer',
}
const ELEMENT_LABEL: Record<string, string> = {
  CET_FIRE:  'Fire',
  CET_WATER: 'Water',
  CET_EARTH: 'Earth',
  CET_LIGHT: 'Light',
  CET_DARK:  'Dark',
}

const num = (v: string | undefined) => parseInt(v ?? '0', 10) || 0

// ── HP override resolution ─────────────────────────────────────────────

/**
 * Build dungeonId → override-HP maps. The override tables key on the BASE
 * boss templet's BossID, but each dungeon entry in the CSV pins one
 * specific (BossID, DungeonID) → HP — so once we expand the CSV, the
 * dungeonId alone is enough to look up the override.
 *
 * Returns separate maps so callers can introspect which source applied.
 */
function buildOverrideMaps(eventBoss: EventBossDungeonRow[], irregularChase: IrregularChaseRow[]) {
  const eventBossHpByDungeon = new Map<string, number>()
  for (const e of eventBoss) {
    if (!e.DungeonID || !e.BossMonsterHP) continue
    const dIds = e.DungeonID.split(',')
    const hps  = e.BossMonsterHP.split(',')
    for (let i = 0; i < dIds.length; i++) {
      const hp = num(hps[i])
      if (hp > 0) eventBossHpByDungeon.set(dIds[i].trim(), hp)
    }
  }
  const irregularChaseHpByDungeon = new Map<string, number>()
  for (const c of irregularChase) {
    if (!c.DungeonID || !c.BossHP) continue
    const hp = num(c.BossHP)
    if (hp > 0) irregularChaseHpByDungeon.set(c.DungeonID, hp)
  }
  return { eventBossHpByDungeon, irregularChaseHpByDungeon }
}

/** AdventureDungeonTemplet row — one entry per (Group, Level) pairing. */
interface AdventureDungeonRow extends Row {
  GroupID?: string
  Level?: string
  DungeonID?: string
  DungeonLevel?: string
  BossHP?: string
  /** Per-mille rate boost on monster ATK at this AL tier. */
  SpawnAdvantageRate_Atk?: string
  /** Per-mille rate boost on monster DEF at this AL tier. */
  SpawnAdvantageRate_Def?: string
  /** Per-mille rate boost on monster SPD at this AL tier. */
  SpawnAdvantageRate_Spd?: string
}

/**
 * Build dungeonId → AL Level tier list. The same dungeon can appear in
 * multiple AdventureGroups (Mission groups overlap on shared levels —
 * group 1 covers Lv1-3, group 2 Lv2-4, etc.), so we dedupe on
 * `(dungeonId, alLevel)` keeping the first occurrence (params are stable
 * across groups for a given level). Sorted by alLevel ascending.
 */
function buildAlTierMap(rows: AdventureDungeonRow[]): Map<string, AlLevelTier[]> {
  const out = new Map<string, AlLevelTier[]>()
  const seen = new Set<string>()  // `${dungeonId}@${alLevel}`
  for (const r of rows) {
    const dungeonId = r.DungeonID
    const alLevel = num(r.Level)
    if (!dungeonId || alLevel <= 0) continue
    const key = `${dungeonId}@${alLevel}`
    if (seen.has(key)) continue
    seen.add(key)
    const monsterLevel = num(r.DungeonLevel)
    const bossHp = num(r.BossHP)
    // Per-tier ATK/DEF/SPD advantage. Empirically these REPLACE the parent
    // DungeonTemplet's `SpawnAdvantageRate_*` (which are unset for AL
    // dungeons) — verified against Ksai Lv 10 in-game (5639 base × 1.9 =
    // 10714 ATK / 2626 × 1.9 = 4989 DEF / 169 × 1.2 = 202 SPD). HP has no
    // per-tier rate; bosses use `BossHP` and minions use level scaling.
    const advantage: AdvantageRates = {
      atk: num(r.SpawnAdvantageRate_Atk),
      def: num(r.SpawnAdvantageRate_Def),
      spd: num(r.SpawnAdvantageRate_Spd),
      hp:  0,
    }
    const list = out.get(dungeonId) ?? []
    list.push({ alLevel, monsterLevel, bossHp: bossHp > 0 ? bossHp : null, advantage })
    out.set(dungeonId, list)
  }
  for (const list of out.values()) {
    list.sort((a, b) => a.alLevel - b.alLevel)
  }
  return out
}

// ── Stage-num post-pass (story only) ───────────────────────────────────

/**
 * For story (`DM_NORMAL`) bucket, assign per-episode `stageNum` from the
 * trailing 2-digit suffix of the dungeon ID (e.g. 100912 → stage 12).
 * Falls back to position-in-group when the suffix doesn't match — keeps
 * filtered/skipped stages from breaking the visible "9-N" sequence.
 */
function assignStageNumbers(modes: ModeEntry[]): void {
  for (const bucket of modes) {
    if (bucket.mode !== 'DM_NORMAL') continue
    const groups = new Map<string, StageEntry[]>()
    for (const s of bucket.stages) {
      if (s.season == null || s.episodeNum == null) continue
      const key = `${s.season}/${s.episodeNum}`
      const arr = groups.get(key) ?? []
      arr.push(s)
      groups.set(key, arr)
    }
    for (const list of groups.values()) {
      list.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }))
      list.forEach((s, i) => {
        const m = s.id.match(/(\d{2})$/)
        s.stageNum = m ? parseInt(m[1], 10) : i + 1
      })
    }
  }
}

// ── Public entrypoint ──────────────────────────────────────────────────

export async function buildMonsters(): Promise<{ stages: number; modes: number }> {
  // Load every templet we need in parallel. `loadLocationTables()` is
  // synchronous (uses `loadTable` from extractor-v3) — call it after the
  // raw reads complete to avoid touching the same files twice.
  const [
    dungeonRows, spawnRows, monsterRows, textCharacterRows,
    eventBossRows, irregularChaseRows, adventureDungeonRows,
  ] = await Promise.all([
    loadJson2<Row[]>('DungeonTemplet.json'),
    loadJson2<Row[]>('DungeonSpawnTemplet.json'),
    loadJson2<Row[]>('MonsterTemplet.json'),
    loadJson2<Row[]>('TextCharacter.json'),
    loadJson2<EventBossDungeonRow[]>('EventBossDungeonTemplet.json'),
    loadJson2<IrregularChaseRow[]>('IrregularChaseTemplet.json'),
    loadJson2<AdventureDungeonRow[]>('AdventureDungeonTemplet.json'),
  ])

  // Indexes for O(1) lookup. Stricter `Record<string, string>` typing on
  // the text index (the location module's `Row`) — our local `Row` allows
  // undefined values; cast is safe because the resolvers only read fields.
  const monsterIndex = new Map<string, Row>()
  for (const r of monsterRows) if (r.ID) monsterIndex.set(r.ID, r)

  const textCharIndex = new Map<string, Record<string, string>>()
  for (const r of textCharacterRows) if (r.ID) textCharIndex.set(r.ID, r as Record<string, string>)

  // Pre-group spawn rows by GroupID — each dungeon's `SpawnID_Pos*` lists
  // GroupIDs that fan out to one or more spawn rows here.
  const spawnRowsByGroup = new Map<string, Row[]>()
  for (const s of spawnRows) {
    if (!s.GroupID) continue
    const arr = spawnRowsByGroup.get(s.GroupID) ?? []
    arr.push(s)
    spawnRowsByGroup.set(s.GroupID, arr)
  }

  // Pipeline-local location module — loads TextSystem + AreaTemplet via the
  // same `loadJson2` cache the rest of the pipeline uses, so the second read
  // here is essentially free.
  const loc = await loadLocationTables()

  const { eventBossHpByDungeon, irregularChaseHpByDungeon } = buildOverrideMaps(eventBossRows, irregularChaseRows)
  const alTiersByDungeon = buildAlTierMap(adventureDungeonRows)

  // ── Build mode buckets ────────────────────────────────────────────
  const byMode = new Map<string, ModeEntry>()
  let totalStages = 0

  for (const d of dungeonRows) {
    const mode = d.DungeonMode ?? ''
    if (!SUPPORTED_DUNGEON_MODES.includes(mode)) continue
    if (!d.ID) continue

    // Resolve mode label (LangDict) — depends on the area's group type for
    // story. `resolveModeLabelDict` returns null when no canonical label
    // exists (e.g. an event mode the table doesn't cover yet).
    const areaRow = d.AreaID ? loc.areaIndex.get(d.AreaID) : undefined
    const labelDict = resolveModeLabelDict(
      mode,
      areaRow?.AreaGroupType ?? null,
      d.NameID ?? null,
      loc.textSystemIndex,
    )
    if (!labelDict) continue

    // Spawn-rate per-mille (atk/def/hp/spd). Default to 0 when missing.
    const advantage = {
      atk: num(d.SpawnAdvantageRate_Atk),
      def: num(d.SpawnAdvantageRate_Def),
      hp:  num(d.SpawnAdvantageRate_HP),
      spd: num(d.SpawnAdvantageRate_Spd),
    }

    // Stage-level HP override (Joint Challenge / Pursuit). Applied to the
    // boss monster(s) in the stage's waves below.
    const overrideHp =
      eventBossHpByDungeon.get(d.ID) ?? irregularChaseHpByDungeon.get(d.ID) ?? null

    // Adventure License tiers for this dungeon. When set, the dungeon expands
    // into one StageEntry per tier (each with its own monster stats baked at
    // the tier's monsterLevel + boss HP override).
    const alTiers = alTiersByDungeon.get(d.ID) ?? null

    // Stage display name (LangDict). Falls back to the dungeon ID. Story
    // metadata is only meaningful for DM_NORMAL.
    const stageName = d.NameID ? resolveTextDict(d.NameID, loc.textSystemIndex) : { en: d.ID, jp: '', kr: '', zh: '' }
    let chapter: LangDict | null = null
    let season: number | null = null
    let episodeNum: number | null = null
    if (mode === 'DM_NORMAL' && areaRow) {
      if (areaRow.NameID) {
        const c = resolveTextDict(areaRow.NameID, loc.textSystemIndex)
        if (c.en) chapter = c
      }
      season     = num(areaRow.SeasonID)   || null
      episodeNum = num(areaRow.EpisodeNum) || null
    }

    /**
     * Build the wave list for this dungeon at a target monster level. AL
     * stages call this once per tier (with the tier's `monsterLevel`,
     * `alBossHp`, and per-tier `advantageOverride`); plain stages call it
     * once with `null` everywhere so the dungeon-level `advantage` and
     * spawn-level scaling apply. Stage `overrideHp` (EventBoss /
     * IrregularChase) always takes precedence over AL `bossHp` — the
     * curated event table is more specific when both exist.
     */
    const buildWaves = (
      atLevel: number | null,
      alBossHp: number | null,
      advantageOverride: AdvantageRates | null,
    ): WaveEntry[] => {
      const effectiveAdvantage = advantageOverride ?? advantage
      const waves: WaveEntry[] = []
      for (let position = 0; position < 3; position++) {
        const raw = d[`SpawnID_Pos${position}`]
        if (!raw) continue

        const monsters: MonsterEntry[] = []
        const seen = new Set<string>()

        for (const gid of raw.split(',').map(x => x.trim()).filter(Boolean)) {
          const rows = spawnRowsByGroup.get(gid)
          if (!rows) continue
          for (const row of rows) {
            for (let slot = 0; slot < 4; slot++) {
              const mid = row[`ID${slot}`]
              if (!mid || mid === '0') continue
              const spawnLevel = num(row[`Level${slot}`])
              // For AL stages the per-tier monsterLevel applies to every
              // monster in the wave; for plain stages we use the spawn level.
              const level = atLevel ?? spawnLevel
              const dedupe = `${mid}@${level}`
              if (seen.has(dedupe)) continue
              seen.add(dedupe)

              const tmpl = monsterIndex.get(mid)
              if (!tmpl) continue

              const type = tmpl.Type ?? ''
              const isBoss = BOSS_TYPES.has(type)
              const elementKey = tmpl.Element ?? ''
              const classKey = tmpl.Class ?? ''
              const nameId = tmpl.NameID ?? `${mid}_Name`

              let stats = resolveDungeonStats(tmpl as unknown as MonsterRow, level, effectiveAdvantage)
              if (isBoss) {
                if (overrideHp != null)    stats = { ...stats, hp: overrideHp }
                else if (alBossHp != null) stats = { ...stats, hp: alBossHp }
              }

              monsters.push({
                monsterId: mid,
                faceIconId: tmpl.FaceIconID ?? mid,
                name: resolveTextDict(nameId, textCharIndex),
                type,
                isBoss,
                class: CLASS_LABEL[classKey] ?? classKey,
                element: ELEMENT_LABEL[elementKey] ?? elementKey,
                subClass: tmpl.SubClass ?? '',
                basicStar: num(tmpl.BasicStar),
                level,
                stats,
                position,
                slot,
              })
            }
          }
        }

        if (monsters.length === 0) continue
        monsters.sort((a, b) => {
          if (a.isBoss !== b.isBoss) return a.isBoss ? -1 : 1
          if (a.level !== b.level) return b.level - a.level
          return (a.name.en || '').localeCompare(b.name.en || '')
        })
        waves.push({ position, monsters })
      }
      return waves
    }

    const bucketKey = `${mode}|${labelDict.en}`
    const bucket = byMode.get(bucketKey) ?? { mode, label: labelDict, stages: [] }

    if (alTiers) {
      // AL dungeon → one StageEntry per tier. Composite id keeps each tier
      // addressable independently; `recommendLevel` = `monsterLevel` so the
      // picker sorts naturally by difficulty within an AL dungeon.
      for (const tier of alTiers) {
        const waves = buildWaves(tier.monsterLevel, tier.bossHp, tier.advantage)
        if (waves.length === 0) continue
        bucket.stages.push({
          id: `${d.ID}@al${tier.alLevel}`,
          name: stageName,
          chapter,
          season,
          episodeNum,
          stageNum: null,
          recommendLevel: tier.monsterLevel,
          waves,
          alLevel: tier.alLevel,
        })
        totalStages++
      }
    } else {
      const waves = buildWaves(null, null, null)
      if (waves.length === 0) continue
      bucket.stages.push({
        id: d.ID,
        name: stageName,
        chapter,
        season,
        episodeNum,
        stageNum: null,
        recommendLevel: num(d.RecommandLevel),
        waves,
      })
      totalStages++
    }

    byMode.set(bucketKey, bucket)
  }

  const modes: ModeEntry[] = Array.from(byMode.values())

  // Story stages: assign per-episode stageNum from the dungeon ID suffix.
  assignStageNumbers(modes)

  // Sort: stages within a mode by (recommendLevel asc, name asc); modes by EN label.
  for (const m of modes) {
    m.stages.sort((a, b) => {
      if (a.recommendLevel !== b.recommendLevel) return a.recommendLevel - b.recommendLevel
      return (a.name.en || '').localeCompare(b.name.en || '')
    })
  }
  modes.sort((a, b) => (a.label.en || '').localeCompare(b.label.en || ''))

  const file: MonstersFile = { _v: SCHEMA_VERSION, modes }
  await writeJsonMin('monsters.json', file)

  return { stages: totalStages, modes: modes.length }
}
