import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

const STORE_PATH = path.join(process.cwd(), 'data', 'admin', 'damage-lab-observations.jsonl')

// Full no-gear stat block — same shape on caster (CharacterTemplet final) and
// target (MonsterTemplet at level + dungeon advantage). Percent fields encoded
// as % (e.g. 188 = 188%, not 1.88).
export interface StatBlock {
  atk: number
  def: number
  hp: number
  spd: number
  chc: number       // crit chance %
  chd: number       // crit dmg %
  pen: number       // penetration %
  dmgInc: number    // damage increase %
  dmgRed: number    // damage reduction %
  eff: number       // effectiveness (flat)
  res: number       // resilience (flat)
}

export interface Observation {
  id: string
  ts: string                  // ISO timestamp
  char: string                // character name
  charId: string              // character ID
  class?: string              // attacker class (Striker/Mage/Ranger/Defender/Healer)
  element?: string            // attacker element (Fire/Water/Earth/Light/Dark)
  slot: 'S1' | 'S2' | 'S3'
  skillLevel?: number         // 1..5 (the DamageFactor index that was used)
  df: number                  // damage factor (the actual numeric value at skillLevel)
  // attacker — flat fields here are the EFFECTIVE values fed to the formula:
  //   atk    = post-scaling effective ATK (SWAP replaces, ADD adds on top)
  //   dmgInc = stat-typed dmgInc + conditional pool quirks (BT_DMG)
  // The full no-gear caster block lives in `caster`; SWAP/ADD scaling info too,
  // so observations stay reproducible if the formula evolves.
  atk: number
  chd: number                 // crit damage %
  dmgInc: number              // effective damage increase % (stat + pool quirks)
  pen: number                 // penetration %
  // target — flat fields are the values fed to the formula (incl. dungeon
  // advantage and caster-side debuff). Full block + metadata in `target`.
  def: number
  tCdmgRed: number            // target crit dmg reduction %
  tDmgRed: number             // target dmg reduction %
  elem: 'none' | 'adv' | 'disadv'
  isBoss?: boolean            // target is boss-type (enables PVE Boss +30% quirk)
  quirksDisabled?: boolean    // target disables all quirks (e.g. lvl 99 boss)
  // context + result
  crit: boolean
  // Set when the user marked the test as having triggered the skill's conditional
  // additional attack (e.g. Luna's Barrier-driven extra hit). The recompute logic
  // multiplies the listed DF by `additionalAttackRatio` to derive the extra
  // damage component. Absent / false → no contribution.
  additionalAttack?: boolean
  additionalAttackRatio?: number   // snapshot of the per-skill ratio at save time
  obs: number                 // observed damage
  note?: string
  // Target origin — set when the target was loaded from game data (MonsterTemplet)
  monsterId?: string
  monsterName?: string
  monsterLvl?: number
  monsterType?: string        // CT_BOSS_MONSTER / CT_NAMED_MONSTER / CT_MONSTER / ...
  tClass?: string             // target class (Striker/Ranger/Defender...)
  tElement?: string           // target element
  stageId?: string            // DungeonTemplet.ID
  stageName?: string
  mode?: string               // raw DungeonMode (e.g. DM_RAID_1)
  // Full caster snapshot — raw no-gear stats (no scaling applied), config used
  // to compute them, and the scaling rule the character has. Optional for
  // backward compat with pre-snapshot observations.
  caster?: {
    stats: StatBlock              // raw API stats at the time
    transcendStar: number
    codexLevel: number
    applyQuirks: boolean
    effectiveAtk: number          // value actually fed to the formula
    poolBonus: number             // sum of conditional BT_DMG quirks (% added to dmgInc)
    scaling?: {
      swap?: { stat: string; valuePerMille: number }
      add?:  { stat: string; valuePerMille: number }[]
    }
  }
  // Full target snapshot — stats post dungeon-advantage and caster debuff,
  // plus the per-mille adjustments themselves so we can recompute the raw
  // monster stats if needed.
  target?: {
    stats: StatBlock
    type: string                  // CT_*_MONSTER
    advantageRate?: { atk: number; def: number; hp: number; spd: number }    // per-mille, signed
    casterDebuff?: { eff: number; res: number }                                // per-mille, signed
  }
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
    char: body.char!,
    charId: body.charId!,
    slot: body.slot!,
    df: body.df!,
    atk: body.atk!,
    chd: body.chd ?? 0,
    dmgInc: body.dmgInc ?? 0,
    pen: body.pen ?? 0,
    def: body.def!,
    tCdmgRed: body.tCdmgRed ?? 0,
    tDmgRed: body.tDmgRed ?? 0,
    elem: body.elem ?? 'none',
    isBoss: body.isBoss ?? false,
    quirksDisabled: body.quirksDisabled ?? false,
    crit: body.crit ?? false,
    obs: body.obs!,
  }
  if (body.class) o.class = body.class
  if (body.element) o.element = body.element
  if (body.skillLevel != null) o.skillLevel = body.skillLevel
  if (body.additionalAttack) o.additionalAttack = true
  if (body.additionalAttackRatio != null) o.additionalAttackRatio = body.additionalAttackRatio
  if (body.note && body.note.trim()) o.note = body.note.trim()
  if (body.monsterId) o.monsterId = body.monsterId
  if (body.monsterName) o.monsterName = body.monsterName
  if (body.monsterLvl != null) o.monsterLvl = body.monsterLvl
  if (body.monsterType) o.monsterType = body.monsterType
  if (body.tClass) o.tClass = body.tClass
  if (body.tElement) o.tElement = body.tElement
  if (body.stageId) o.stageId = body.stageId
  if (body.stageName) o.stageName = body.stageName
  if (body.mode) o.mode = body.mode
  if (body.caster) o.caster = body.caster
  if (body.target) o.target = body.target
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
