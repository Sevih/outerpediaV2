import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

/**
 * Observations storage for the Damage Lab v2.
 *
 * Backed by an append-only JSONL file at `data/admin/damage-lab-observations-v2.jsonl`.
 * Separate from the v1 file by design (decision in PR roadmap, choice 5) — the
 * v1 obs (`damage-lab-observations.jsonl`) stay untouched, the operator
 * re-enters obs in v2 to validate the new pipeline.
 *
 * The schema below carries the full RecomputeContext source so a future fix
 * to the buff parser / formula auto-propagates without re-saving every row.
 *
 * Restricted to development.
 */

const STORE_PATH = path.join(process.cwd(), 'data', 'admin', 'damage-lab-observations-v2.jsonl')

export interface ObservationV2 {
  id: string
  ts: string                  // ISO timestamp
  // Caster identity
  charId: string
  charName: string
  charElement: string
  charClass: string
  charSubclass: string
  // Skill
  slot: 'S1' | 'S2' | 'S3'
  skillLevel: number
  df: number
  additionalAttackEnabled?: boolean
  additionalAttackRatio?: number
  // Caster inputs
  atk: number
  chd: number
  pen: number
  dmgInc: number
  applyQuirks: boolean
  extraStats?: Record<string, number>
  charFlags?: { umeActive?: boolean; sakuraActive?: boolean }
  /**
   * ATK scaling breakdown captured at save time — lets the obs-table replay
   * the calc with external buffs stacking additively against `pctBonus`
   * (matches in-game), instead of multiplicatively on the displayed ATK.
   * Optional: older obs without it fall back to linear `× (1 + buff/100)`.
   */
  atkScaling?: {
    baseMax: number
    flat: number
    pctBonus: number
    codexPct: number
    transcendPct: number
  }
  // Target inputs
  targetDef: number
  targetDmgRed: number
  targetCdmgRed: number
  targetHp?: number
  isBoss: boolean
  elem: 'none' | 'adv' | 'disadv'
  // Stage / dungeon metadata
  /** DungeonMode string (DM_*) — feeds `isAdventureLicenseMode`. */
  mode?: string
  /** User-facing label from /v2/stages — multiple labels can share the same `mode`. */
  modeLabel?: string
  stageId?: string
  stageName?: string
  monsterId?: string
  monsterName?: string
  monsterLvl?: number
  monsterElement?: string
  monsterClass?: string
  monsterType?: string
  // Pool-condition inputs (PR 4bis-aware: enemy_team_decrease isolated)
  ownerHpRate?: number
  targetHpRate?: number
  casterHpRate?: number
  ownerBuffCount?: number
  targetBuffCount?: number
  ownerDebuffCount?: number
  targetDebuffCount?: number
  targetBroken?: boolean
  killCountStack?: number
  teamBuffCount?: number
  teamDecreaseCount?: number
  enemyTeamDecreaseCount?: number
  inMonadGate?: boolean
  inTower?: boolean
  inPvp?: boolean
  // External buffs / boss mechanics state at save time
  externalBuffs?: Record<string, { active: boolean; value: number }>
  bossMechanics?: Record<string, { active: boolean; value?: number }>
  /**
   * Snapshot of the boss override (definitions + buff lists) at save time.
   * Required for `recomputeFromObs` — boss-mechanic effects evaluate from
   * each passive's raw `buffs`, and the override isn't refetched async at
   * obs-table render time. Older obs without it skip boss-mechanic deltas
   * (none have active mechanics so no regression).
   */
  bossOverride?: import('@/lib/damage/v2/boss-overrides').BossOverride | null
  // Result
  crit: boolean
  obs: number
  note?: string
  /** Calculated value at save time — for audit. */
  calculatedAtSave?: number
}

function readStore(): ObservationV2[] {
  if (!fs.existsSync(STORE_PATH)) return []
  const raw = fs.readFileSync(STORE_PATH, 'utf-8')
  return raw.split('\n')
    .filter(line => line.trim().length > 0)
    .map(line => JSON.parse(line) as ObservationV2)
}

function writeStore(observations: ObservationV2[]): void {
  fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true })
  const content = observations.map(o => JSON.stringify(o)).join('\n') + (observations.length ? '\n' : '')
  fs.writeFileSync(STORE_PATH, content, 'utf-8')
}

function appendObservation(o: ObservationV2): void {
  fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true })
  let prefix = ''
  if (fs.existsSync(STORE_PATH)) {
    const size = fs.statSync(STORE_PATH).size
    if (size > 0) {
      const fd = fs.openSync(STORE_PATH, 'r')
      const buf = Buffer.alloc(1)
      fs.readSync(fd, buf, 0, 1, size - 1)
      fs.closeSync(fd)
      if (buf[0] !== 0x0a) prefix = '\n'
    }
  }
  fs.appendFileSync(STORE_PATH, prefix + JSON.stringify(o) + '\n', 'utf-8')
}

function devGuard(): NextResponse | null {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  return null
}

export function GET() {
  const guard = devGuard()
  if (guard) return guard
  return NextResponse.json({ observations: readStore() })
}

export async function POST(req: NextRequest) {
  const guard = devGuard()
  if (guard) return guard
  const body = await req.json() as Partial<ObservationV2>
  if (!body.charId || !body.slot || body.df == null || body.obs == null) {
    return NextResponse.json({ ok: false, error: 'missing required fields' }, { status: 400 })
  }
  const o: ObservationV2 = {
    id: body.id ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    ts: body.ts ?? new Date().toISOString(),
    charId: body.charId,
    charName: body.charName ?? body.charId,
    charElement: body.charElement ?? '',
    charClass: body.charClass ?? '',
    charSubclass: body.charSubclass ?? '',
    slot: body.slot,
    skillLevel: body.skillLevel ?? 5,
    df: body.df,
    atk: body.atk ?? 0,
    chd: body.chd ?? 0,
    pen: body.pen ?? 0,
    dmgInc: body.dmgInc ?? 0,
    applyQuirks: body.applyQuirks ?? true,
    targetDef: body.targetDef ?? 0,
    targetDmgRed: body.targetDmgRed ?? 0,
    targetCdmgRed: body.targetCdmgRed ?? 0,
    isBoss: body.isBoss ?? false,
    elem: body.elem ?? 'none',
    crit: body.crit ?? false,
    obs: body.obs,
  }
  // Optional fields — only persist when meaningful.
  if (body.additionalAttackEnabled) o.additionalAttackEnabled = true
  if (body.additionalAttackRatio != null) o.additionalAttackRatio = body.additionalAttackRatio
  if (body.extraStats && Object.keys(body.extraStats).length > 0) o.extraStats = body.extraStats
  if (body.charFlags && Object.values(body.charFlags).some(v => v)) o.charFlags = body.charFlags
  if (body.targetHp != null && body.targetHp > 0) o.targetHp = body.targetHp
  for (const k of ['mode', 'modeLabel', 'stageId', 'stageName', 'monsterId', 'monsterName', 'monsterElement', 'monsterClass', 'monsterType'] as const) {
    const v = body[k]
    if (v) (o as unknown as Record<string, unknown>)[k] = v
  }
  if (body.monsterLvl != null) o.monsterLvl = body.monsterLvl
  if (body.note && body.note.trim()) o.note = body.note.trim()
  // Pool-condition inputs — preserve only the non-default ones.
  for (const k of [
    'ownerHpRate', 'targetHpRate', 'casterHpRate',
    'ownerBuffCount', 'targetBuffCount', 'ownerDebuffCount', 'targetDebuffCount',
    'killCountStack', 'teamBuffCount', 'teamDecreaseCount', 'enemyTeamDecreaseCount',
  ] as const) {
    const v = body[k]
    if (v != null && v !== 0) (o as unknown as Record<string, unknown>)[k] = v
  }
  for (const k of ['targetBroken', 'inMonadGate', 'inTower', 'inPvp'] as const) {
    if (body[k]) (o as unknown as Record<string, unknown>)[k] = true
  }
  if (body.externalBuffs && Object.values(body.externalBuffs).some(s => s.active)) {
    o.externalBuffs = body.externalBuffs
  }
  if (body.bossMechanics && Object.values(body.bossMechanics).some(s => s.active)) {
    o.bossMechanics = body.bossMechanics
    // Persist the override snapshot only when at least one mechanic is
    // active — otherwise the snapshot is dead weight (recomputeFromObs
    // wouldn't read it).
    if (body.bossOverride) o.bossOverride = body.bossOverride
  }
  if (body.atkScaling) o.atkScaling = body.atkScaling
  if (body.calculatedAtSave != null) o.calculatedAtSave = body.calculatedAtSave

  appendObservation(o)
  return NextResponse.json({ ok: true, observation: o })
}

export async function DELETE(req: NextRequest) {
  const guard = devGuard()
  if (guard) return guard
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ ok: false, error: 'missing id' }, { status: 400 })
  if (id === 'all') {
    writeStore([])
  } else {
    writeStore(readStore().filter(o => o.id !== id))
  }
  return NextResponse.json({ ok: true })
}
