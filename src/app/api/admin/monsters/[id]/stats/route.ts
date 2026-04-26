import { NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'

/**
 * GET /api/admin/monsters/:id/stats
 *
 * Computes the stat block for a monster at a given level. Mirrors
 * /api/admin/characters/:id/stats in shape so the damage-lab UI can swap
 * targets and casters through the same contract.
 *
 * Restricted to development (returns 403 in prod).
 *
 * ── Data sources ──────────────────────────────────────────────────────────
 *   MonsterTemplet (data/admin/json2/MonsterTemplet.json) — all monster
 *     definitions including Min/Max bounds for every scalable stat.
 *
 * ── Query params ──────────────────────────────────────────────────────────
 *   level     — monster level (≥1). Defaults to 100. Levels above 100 are
 *               supported (Special Request, late-game content) and the formula
 *               extrapolates linearly: stat(lv120) = Min + (Max−Min) × 119/99
 *               ≈ Max × 1.20 when Min ≪ Max. Empirically validated against
 *               Masterless Guardian id 404400162 at lv 120.
 *   dungeonId — when provided, the route applies the dungeon's
 *               SpawnAdvantageRate_{Atk,Def,HP,Spd} (per-mille, signed)
 *               to the interpolated stats: `stat × (1 + rate/1000)`.
 *               Empirical match: monster 401300101 in dungeon 100101 has
 *               HP rate −248 → HP_Min 298 × 0.752 = 224 (matches in-game).
 *               Some boss-mode dungeons additionally override the boss HP entirely:
 *                 • EventBossDungeonTemplet.BossMonsterHP (Joint Challenge) — CSV
 *                   indexed by dungeonId's position in the DungeonID list. Empirical
 *                   match: boss 4176152 (ModelID 4076102) in dungeon 90500200 reads
 *                   HP 2,000,000 (index 2 of "25000,250000,2000000").
 *                 • IrregularChaseTemplet.BossHP (Irregular Chase) — single value,
 *                   matched on DungeonID + BossID. Empirical match: boss 51202002
 *                   (ModelID 4013072) in dungeon 72000013 reads HP 879,780.
 *               When an override applies, it replaces the formula+advantage HP value.
 *   effDebuff — per-mille signed multiplier on EFF (e.g. −200 = −20%). Used
 *               by the damage-lab to fold the player's PVE Awakening_Boss_Avoid_Down
 *               quirks into the displayed boss EFF.
 *   resDebuff — per-mille signed multiplier on RES (e.g. −200 = −20%). Mirrors
 *               the player's PVE Awakening_Boss_Buff_RESIST_Down quirks.
 *
 * ── Formula ───────────────────────────────────────────────────────────────
 * Each Min/Max stat pair scales linearly with level:
 *   stat(lvl) = Min + (Max − Min) × (lvl − 1) / 99
 * Single-Max stats (DMGReduceRate_Max, DamageBoost_Max) interpolate from 0
 * (matches the empirical scaling used by /api/admin/damage-lab/stages).
 * Then the dungeon advantage rate (when supplied) is applied to ATK/DEF/HP/SPD.
 *
 * ── Value encoding rules ──────────────────────────────────────────────────
 *   Per-mille (÷10 → %): CriticalRate, CriticalDMGRate, PiercePowerRate,
 *                        DMGReduceRate, DamageBoost
 *   Flat:                Atk, Def, HP, Speed, BuffChance (EFF), BuffResist (RES)
 *
 * ── Response shape ────────────────────────────────────────────────────────
 *   {
 *     meta: { id, type, race, class, subclass, element, basicStar, isBoss,
 *             level, levelClamped },
 *     contributors: [
 *       { source: 'baseMin' , fields: StatBlock },  // raw lv 1 stats
 *       { source: 'baseMax' , fields: StatBlock },  // raw lv 100 stats
 *     ],
 *     final: StatBlock,                             // interpolated at level
 *   }
 */

const JSON2_DIR = path.join(process.cwd(), 'data', 'admin', 'json2')

// CT_NAMED_MONSTER excluded — the in-game slot color flags it as Magic (blue),
// not Rare (red), so it isn't a true boss. Boss-only quirks shouldn't apply.
const BOSS_TYPES = new Set([
  'CT_BOSS_MONSTER',
  'CT_AREA_BOSS_MONSTER',
  'CT_SEASON_BOSS_MONSTER',
])

type Row = Record<string, string>

interface StatBlock {
  atk: number
  def: number
  hp: number
  spd: number
  chc: number         // Critical Chance (%)
  chd: number         // Critical Damage (%)
  pen: number         // Penetration (%)
  dmgInc: number      // Damage Increase (%)
  dmgRed: number      // Damage Reduction (%)
  eff: number         // Effectiveness (raw)
  res: number         // Resilience   (raw)
}

interface Contributor {
  source: string
  description: string
  fields: Partial<StatBlock>
}

// ── Helpers ────────────────────────────────────────────────────────────

function num(v: string | undefined): number {
  if (!v) return 0
  const p = parseInt(v, 10)
  return Number.isFinite(p) ? p : 0
}

// Linear scaling: stat(lvl) = Min + (Max − Min) × (lvl − 1) / 99.
// Past lv 100 the formula extrapolates rather than clamping (Joint Challenge
// content goes up to lv 120+). Same baseline as /api/admin/damage-lab/stages
// but without the upper cap.
function interpolate(min: number, max: number, level: number): number {
  if (level <= 1) return min
  return min + (max - min) * (level - 1) / 99
}

// Strip zero-valued keys for compact contributor payloads.
function omitZero(s: StatBlock): Partial<StatBlock> {
  const out: Partial<StatBlock> = {}
  for (const [k, v] of Object.entries(s)) {
    if (typeof v === 'number' && v !== 0) (out as Record<string, number>)[k] = v
  }
  return out
}

// Pull the Min/Max snapshot for a monster row. Returns the raw value at the
// requested side ('min' or 'max') for every modeled stat — percent stats
// are decoded ÷10 to match in-game display.
function snapshot(row: Row, side: 'min' | 'max'): StatBlock {
  const s = side === 'min' ? '_Min' : '_Max'
  return {
    atk: num(row[`Atk${s}`]),
    def: num(row[`Def${s}`]),
    hp:  num(row[`HP${s}`]),
    spd: num(row[`Speed${s}`]),
    eff: num(row[`BuffChance${s}`]),
    res: num(row[`BuffResist${s}`]),
    chc: num(row[`CriticalRate${s}`])    / 10,
    chd: num(row[`CriticalDMGRate${s}`]) / 10,
    pen: num(row[`PiercePowerRate${s}`]) / 10,
    // Single-Max stats: when fetching `min`, they're effectively 0.
    dmgRed: side === 'min' ? 0 : num(row.DMGReduceRate_Max) / 10,
    dmgInc: side === 'min' ? 0 : num(row.DamageBoost_Max)   / 10,
  }
}

// Compute the resolved stat block at the given level.
function resolveAtLevel(row: Row, level: number): StatBlock {
  const I = (a: number, b: number) => interpolate(a, b, level)
  return {
    atk:    I(num(row.Atk_Min),             num(row.Atk_Max)),
    def:    I(num(row.Def_Min),             num(row.Def_Max)),
    hp:     I(num(row.HP_Min),              num(row.HP_Max)),
    spd:    I(num(row.Speed_Min),           num(row.Speed_Max)),
    eff:    I(num(row.BuffChance_Min),      num(row.BuffChance_Max)),
    res:    I(num(row.BuffResist_Min),      num(row.BuffResist_Max)),
    chc:    I(num(row.CriticalRate_Min),    num(row.CriticalRate_Max))    / 10,
    chd:    I(num(row.CriticalDMGRate_Min), num(row.CriticalDMGRate_Max)) / 10,
    pen:    I(num(row.PiercePowerRate_Min), num(row.PiercePowerRate_Max)) / 10,
    dmgRed: I(0,                            num(row.DMGReduceRate_Max))   / 10,
    dmgInc: I(0,                            num(row.DamageBoost_Max))     / 10,
  }
}

// ── Handler ────────────────────────────────────────────────────────────

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const { id } = await params

  const url = new URL(request.url)
  const levelParam     = url.searchParams.get('level')
  const dungeonIdParam = url.searchParams.get('dungeonId')
  const effDebuffParam = url.searchParams.get('effDebuff')
  const resDebuffParam = url.searchParams.get('resDebuff')
  const requestedLevel = levelParam != null ? parseInt(levelParam, 10) : 100
  // Floor at 1 (level 0 makes no sense). No upper cap — Joint Challenge and
  // late-game content spawn monsters at lv 120+; the linear extrapolation is
  // empirically correct against in-game values.
  const level = Number.isFinite(requestedLevel) ? Math.max(1, requestedLevel) : 100
  const effDebuff = effDebuffParam != null ? parseInt(effDebuffParam, 10) || 0 : 0
  const resDebuff = resDebuffParam != null ? parseInt(resDebuffParam, 10) || 0 : 0

  const [monsterRaw, dungeonRaw, eventBossRaw, irregularChaseRaw] = await Promise.all([
    fs.readFile(path.join(JSON2_DIR, 'MonsterTemplet.json'), 'utf-8'),
    dungeonIdParam ? fs.readFile(path.join(JSON2_DIR, 'DungeonTemplet.json'), 'utf-8') : Promise.resolve('[]'),
    dungeonIdParam ? fs.readFile(path.join(JSON2_DIR, 'EventBossDungeonTemplet.json'), 'utf-8') : Promise.resolve('[]'),
    dungeonIdParam ? fs.readFile(path.join(JSON2_DIR, 'IrregularChaseTemplet.json'), 'utf-8') : Promise.resolve('[]'),
  ])
  const monsters: Row[] = JSON.parse(monsterRaw)
  const row = monsters.find(r => r.ID === id)
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Per-mille signed advantage rates pulled from DungeonTemplet (when dungeonId
  // is supplied). Missing fields default to 0 (no adjustment).
  let advantage = { atk: 0, def: 0, hp: 0, spd: 0 }
  if (dungeonIdParam) {
    const dungeons: Row[] = JSON.parse(dungeonRaw)
    const d = dungeons.find(r => r.ID === dungeonIdParam)
    if (d) {
      advantage = {
        atk: num(d.SpawnAdvantageRate_Atk),
        def: num(d.SpawnAdvantageRate_Def),
        hp:  num(d.SpawnAdvantageRate_HP),
        spd: num(d.SpawnAdvantageRate_Spd),
      }
    }
  }

  const baseMin = snapshot(row, 'min')
  const baseMax = snapshot(row, 'max')
  const final   = resolveAtLevel(row, level)
  // Apply dungeon advantage rate (per-mille). Only ATK/DEF/HP/SPD have rate
  // columns; EFF/RES/CHC/CHD/PEN/DR/DMG↑ are unaffected by the dungeon table.
  final.atk = final.atk * (1 + advantage.atk / 1000)
  final.def = final.def * (1 + advantage.def / 1000)
  final.hp  = final.hp  * (1 + advantage.hp  / 1000)
  final.spd = final.spd * (1 + advantage.spd / 1000)
  // Some boss-mode dungeons override boss HP entirely — formula+advantage HP
  // doesn't apply. Match BossID against the monster's ModelID (or ID as fallback)
  // and verify the dungeonId belongs to the entry. Sources checked:
  //   • EventBossDungeonTemplet (Joint Challenge): DungeonID is a CSV; pull
  //     BossMonsterHP at dungeonId's index.
  //   • IrregularChaseTemplet: single DungeonID per row, single BossHP value.
  let bossHpOverride: { hp: number; source: 'eventBoss' | 'irregularChase' } | null = null
  if (dungeonIdParam) {
    const bossKey = row.ModelID || row.ID
    const matchesBoss = (entryBossId: string | undefined) =>
      entryBossId === bossKey || entryBossId === row.ID

    const events: Row[] = JSON.parse(eventBossRaw)
    for (const e of events) {
      if (!matchesBoss(e.BossID)) continue
      const dungeonIds = (e.DungeonID ?? '').split(',')
      const idx = dungeonIds.indexOf(dungeonIdParam)
      if (idx === -1) continue
      const overrideHp = num((e.BossMonsterHP ?? '').split(',')[idx])
      if (overrideHp > 0) {
        bossHpOverride = { hp: overrideHp, source: 'eventBoss' }
        break
      }
    }

    if (!bossHpOverride) {
      const chases: Row[] = JSON.parse(irregularChaseRaw)
      for (const c of chases) {
        if (c.DungeonID !== dungeonIdParam) continue
        if (!matchesBoss(c.BossID)) continue
        const overrideHp = num(c.BossHP)
        if (overrideHp > 0) {
          bossHpOverride = { hp: overrideHp, source: 'irregularChase' }
          break
        }
      }
    }
  }
  if (bossHpOverride) {
    final.hp = bossHpOverride.hp
  }
  // Apply caster-side EFF/RES debuff quirks (per-mille). Empirically these
  // stack additively in % points, not multiplicatively (validated on monster
  // 401300101 with 4 unlocked PVE nodes summing to −200‰: 53 × 0.80 = 42.4 → 42).
  final.eff = final.eff * (1 + effDebuff / 1000)
  final.res = final.res * (1 + resDebuff / 1000)
  // The in-game UI floors integer stats (ATK/DEF/HP/SPD/EFF/RES). Standard
  // rounding (.toFixed) overshoots by 1 for fractional results > 0.5 — e.g.
  // 305675.997 (HP) round-displays as 305676, but the game shows 305675.
  // Percent stats (CHC/CHD/PEN/DR/DMG↑) keep their float precision since the
  // game shows them with a decimal.
  final.atk = Math.floor(final.atk)
  final.def = Math.floor(final.def)
  final.hp  = Math.floor(final.hp)
  final.spd = Math.floor(final.spd)
  final.eff = Math.floor(final.eff)
  final.res = Math.floor(final.res)

  const contributors: Contributor[] = [
    {
      source: 'baseMin',
      description: 'MonsterTemplet *_Min — stats at lv 1 (lower bound of the linear scale)',
      fields: omitZero(baseMin),
    },
    {
      source: 'baseMax',
      description: 'MonsterTemplet *_Max — stats at lv 100 (upper bound; single-Max stats use 0 as Min)',
      fields: omitZero(baseMax),
    },
  ]
  const hasAdvantage = advantage.atk || advantage.def || advantage.hp || advantage.spd
  if (dungeonIdParam && hasAdvantage) {
    contributors.push({
      source: 'dungeonAdvantage',
      description: `DungeonTemplet ${dungeonIdParam} SpawnAdvantageRate_* — per-mille multiplier on ATK/DEF/HP/SPD`,
      fields: {
        atk: advantage.atk / 10,  // express as % for the contributor view
        def: advantage.def / 10,
        hp:  advantage.hp  / 10,
        spd: advantage.spd / 10,
      },
    })
  }
  if (effDebuff || resDebuff) {
    contributors.push({
      source: 'casterDebuff',
      description: 'Awakening boss-EFF/RES debuff quirks pushed by the damage-lab client (per-mille)',
      fields: {
        eff: effDebuff / 10,
        res: resDebuff / 10,
      },
    })
  }
  if (bossHpOverride) {
    const sourceTemplet =
      bossHpOverride.source === 'eventBoss'
        ? 'EventBossDungeonTemplet.BossMonsterHP'
        : 'IrregularChaseTemplet.BossHP'
    contributors.push({
      source: 'bossHpOverride',
      description: `${sourceTemplet} — replaces formula HP for boss in dungeon ${dungeonIdParam}`,
      fields: { hp: bossHpOverride.hp },
    })
  }

  return NextResponse.json({
    meta: {
      id: row.ID,
      type: row.Type ?? null,
      race: row.Race ?? null,
      class: row.Class ?? null,
      subclass: row.SubClass ?? null,
      element: row.Element ?? null,
      basicStar: num(row.BasicStar),
      isBoss: BOSS_TYPES.has(row.Type ?? ''),
      level,
      levelClamped: requestedLevel !== level,
      dungeonId: dungeonIdParam,
      advantageRate: advantage,
      casterDebuff: { eff: effDebuff, res: resDebuff },
    },
    contributors,
    final,
  })
}
