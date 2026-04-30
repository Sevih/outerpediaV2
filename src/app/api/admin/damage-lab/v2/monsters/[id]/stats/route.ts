import { NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'
import {
  resolveDungeonStats,
  applyCasterDebuffs,
  num,
  type StatBlock,
  type MonsterRow,
} from '@/lib/damage/v2/stats'

/**
 * GET /api/admin/damage-lab/v2/monsters/[id]/stats
 *
 * Computes the stat block for a monster at a given level via the audited v2
 * chain (`src/lib/damage/v2/stats.ts` → `f32.ts`).
 *
 * Forked from v1 (`/api/admin/monsters/[id]/stats`) so the f32 primitives flow
 * through the shared module instead of inlined copies. Behavior contract is
 * the same — single source of truth for the binary `CalcStat` /
 * `applyAdvantageRate` chain across both v2 stages and v2 monster routes.
 *
 * ── Query params ──────────────────────────────────────────────────────────
 *   level     — monster level (≥1). Defaults to 100. No upper cap (Joint
 *               Challenge content spawns at lv 120+; the linear extrapolation
 *               is empirically correct against in-game values).
 *   dungeonId — when provided, applies `SpawnAdvantageRate_*` from
 *               `DungeonTemplet`. Some boss-mode dungeons additionally
 *               override boss HP entirely (see overrides below).
 *   effDebuff — per-mille signed multiplier on EFF (e.g. −200 = −20%). Used
 *               by the lab to fold caster Awakening_Boss_Avoid_Down quirks.
 *   resDebuff — per-mille signed multiplier on RES.
 *
 * ── Boss HP overrides ─────────────────────────────────────────────────────
 *   EventBossDungeonTemplet.BossMonsterHP — Joint Challenge: CSV indexed by
 *     dungeonId's position in the DungeonID list.
 *   IrregularChaseTemplet.BossHP — single value matched on DungeonID + BossID.
 *   When an override applies it replaces formula+advantage HP entirely.
 */

const JSON2_DIR = path.join(process.cwd(), 'data', 'admin', 'json2')

// CT_NAMED_MONSTER excluded — in-game slot color flags it as Magic (blue), not
// Rare (red), so it isn't a true boss. Boss-only quirks shouldn't apply.
const BOSS_TYPES = new Set([
  'CT_BOSS_MONSTER',
  'CT_AREA_BOSS_MONSTER',
  'CT_SEASON_BOSS_MONSTER',
])

interface Contributor {
  source: string
  description: string
  fields: Partial<StatBlock>
}

// Strip zero-valued keys for compact contributor payloads.
function omitZero(s: StatBlock): Partial<StatBlock> {
  const out: Partial<StatBlock> = {}
  for (const [k, v] of Object.entries(s)) {
    if (typeof v === 'number' && v !== 0) (out as Record<string, number>)[k] = v
  }
  return out
}

// Min/Max snapshot for the contributors display — direct field reads (NOT
// interpolated) so the UI shows the raw scaling bounds. Single-Max stats use
// 0 as the implicit Min (binary's interpolation behavior).
function snapshot(row: MonsterRow, side: 'min' | 'max'): StatBlock {
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
    dmgRed: side === 'min' ? 0 : num(row.DMGReduceRate_Max) / 10,
    dmgInc: side === 'min' ? 0 : num(row.DamageBoost_Max)   / 10,
  }
}

// Floor int-display stats. Percent stats keep float precision (game shows them
// with a decimal). Mirrors the in-game UI rounding behavior.
function floorIntStats(s: StatBlock): StatBlock {
  return {
    ...s,
    atk: Math.floor(s.atk),
    def: Math.floor(s.def),
    hp:  Math.floor(s.hp),
    spd: Math.floor(s.spd),
    eff: Math.floor(s.eff),
    res: Math.floor(s.res),
  }
}

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
  const level = Number.isFinite(requestedLevel) ? Math.max(1, requestedLevel) : 100
  const effDebuff = effDebuffParam != null ? parseInt(effDebuffParam, 10) || 0 : 0
  const resDebuff = resDebuffParam != null ? parseInt(resDebuffParam, 10) || 0 : 0

  const [monsterRaw, dungeonRaw, eventBossRaw, irregularChaseRaw] = await Promise.all([
    fs.readFile(path.join(JSON2_DIR, 'MonsterTemplet.json'), 'utf-8'),
    dungeonIdParam ? fs.readFile(path.join(JSON2_DIR, 'DungeonTemplet.json'), 'utf-8') : Promise.resolve('[]'),
    dungeonIdParam ? fs.readFile(path.join(JSON2_DIR, 'EventBossDungeonTemplet.json'), 'utf-8') : Promise.resolve('[]'),
    dungeonIdParam ? fs.readFile(path.join(JSON2_DIR, 'IrregularChaseTemplet.json'), 'utf-8') : Promise.resolve('[]'),
  ])
  const monsters: MonsterRow[] = JSON.parse(monsterRaw)
  const row = monsters.find(r => r.ID === id)
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Per-mille `SpawnAdvantageRate_*` from `DungeonTemplet`. Missing fields → 0.
  let advantage = { atk: 0, def: 0, hp: 0, spd: 0 }
  if (dungeonIdParam) {
    const dungeons: MonsterRow[] = JSON.parse(dungeonRaw)
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

  // ── Compute the stat chain ──────────────────────────────────────────
  // Single-pass interpolate + advantage rate (one floor at the end) — matches
  // the binary's `get_MaxHP` / `get_Def` / `get_Atk` chain exactly.
  let final = resolveDungeonStats(row, level, advantage)

  // Boss HP override — EventBossDungeon (Joint Challenge) and IrregularChase.
  // Match BossID against the monster's ModelID (or ID as fallback) and verify
  // the dungeonId belongs to the entry. Replaces formula+advantage HP entirely.
  let bossHpOverride: { hp: number; source: 'eventBoss' | 'irregularChase' } | null = null
  if (dungeonIdParam) {
    const bossKey = row.ModelID || row.ID
    const matchesBoss = (entryBossId: string | undefined) =>
      entryBossId === bossKey || entryBossId === row.ID

    const events: MonsterRow[] = JSON.parse(eventBossRaw)
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
      const chases: MonsterRow[] = JSON.parse(irregularChaseRaw)
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
    final = { ...final, hp: bossHpOverride.hp }
  }

  // Caster-side EFF/RES debuffs (per-mille, additive in % points).
  final = applyCasterDebuffs(final, { eff: effDebuff, res: resDebuff })

  // Floor int stats for in-game-faithful display.
  final = floorIntStats(final)

  // ── Contributors view ──────────────────────────────────────────────
  const baseMin = snapshot(row, 'min')
  const baseMax = snapshot(row, 'max')
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
        atk: advantage.atk / 10,
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
