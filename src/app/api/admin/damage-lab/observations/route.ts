import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

const STORE_PATH = path.join(process.cwd(), 'data', 'admin', 'damage-lab-observations.jsonl')

// Minimal observation schema — only what's needed to recompute damage from the
// live buff list + the formula constants. No derived totals, no buff snapshots:
// `recompute()` re-derives everything every render, so a fix to the buff parser
// auto-propagates to every saved obs without re-saving.
export interface Observation {
  id: string
  ts: string                  // ISO timestamp

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
  // Set when the user marked the test as having triggered the skill's
  // conditional sub-attack (e.g. Luna's Barrier). The recompute path multiplies
  // `df` by `additionalAttackRatio` to produce the extra hit's DF.
  additionalAttack?: boolean
  additionalAttackRatio?: number

  // Caster inputs — user-typed values that feed the formula directly.
  // No buff augmentation: live buffs are layered on top by `recompute()`.
  atk: number
  chd: number
  pen: number
  dmgInc: number
  applyQuirks: boolean
  extraStats?: Record<string, number>   // ST_* → numeric, for secondary scaling stats
  // Per-char hardcoded-override flags (see `src/lib/damage/char-overrides.ts`).
  // Example: Ame's `umeActive` / `sakuraActive` toggle her S1 alternate hit.
  // Optional because most chars don't have any flags.
  charFlags?: { umeActive?: boolean; sakuraActive?: boolean }

  // Target inputs (user-fed; auto mode prefills from monster API).
  targetDef: number
  targetDmgRed: number
  targetCdmgRed: number
  // Target HP — needed by chars whose damage scales on it (BT_DMG_TARGET_STAT).
  // Validated: Noa S2 (+3% × HP sub-attack). Optional because most chars don't use it.
  targetHp?: number
  isBoss: boolean
  elem: 'none' | 'adv' | 'disadv'

  // Mode metadata — `mode` drives the Adventure License gate; the rest is
  // display-only.
  mode?: string
  stageId?: string
  stageName?: string

  // Target metadata — set when loaded from game data (auto target picker).
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

function readStore(): Observation[] {
  if (!fs.existsSync(STORE_PATH)) return []
  const raw = fs.readFileSync(STORE_PATH, 'utf-8')
  return raw.split('\n')
    .filter(line => line.trim().length > 0)
    .map(line => JSON.parse(line) as Observation)
}

function writeStore(observations: Observation[]) {
  fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true })
  const content = observations.map(o => JSON.stringify(o)).join('\n') + (observations.length ? '\n' : '')
  fs.writeFileSync(STORE_PATH, content, 'utf-8')
}

function appendObservation(o: Observation) {
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

export async function GET() {
  return NextResponse.json({ observations: readStore() })
}

export async function POST(req: NextRequest) {
  const body = await req.json() as Partial<Observation>
  const o: Observation = {
    id: body.id ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    ts: body.ts ?? new Date().toISOString(),
    charId: body.charId!,
    charName: body.charName!,
    charElement: body.charElement ?? '',
    charClass: body.charClass ?? '',
    charSubclass: body.charSubclass ?? '',
    slot: body.slot!,
    skillLevel: body.skillLevel ?? 5,
    df: body.df!,
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
    obs: body.obs!,
  }
  if (body.additionalAttack) o.additionalAttack = true
  if (body.additionalAttackRatio != null) o.additionalAttackRatio = body.additionalAttackRatio
  if (body.extraStats && Object.keys(body.extraStats).length > 0) o.extraStats = body.extraStats
  if (body.charFlags && Object.values(body.charFlags).some(v => v)) o.charFlags = body.charFlags
  if (body.targetHp != null && body.targetHp > 0) o.targetHp = body.targetHp
  if (body.mode) o.mode = body.mode
  if (body.stageId) o.stageId = body.stageId
  if (body.stageName) o.stageName = body.stageName
  if (body.monsterId) o.monsterId = body.monsterId
  if (body.monsterName) o.monsterName = body.monsterName
  if (body.monsterLvl != null) o.monsterLvl = body.monsterLvl
  if (body.monsterElement) o.monsterElement = body.monsterElement
  if (body.monsterClass) o.monsterClass = body.monsterClass
  if (body.monsterType) o.monsterType = body.monsterType
  if (body.note && body.note.trim()) o.note = body.note.trim()
  appendObservation(o)
  return NextResponse.json({ ok: true, observation: o })
}

export async function DELETE(req: NextRequest) {
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
