import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

const STORE_PATH = path.join(process.cwd(), 'data', 'admin', 'damage-lab-observations.jsonl')

export interface Observation {
  id: string
  ts: string                  // ISO timestamp
  char: string                // character name
  charId: string              // character ID
  class?: string              // attacker class (Attacker/Mage/Ranger/Defender/Priest)
  element?: string            // attacker element (Fire/Water/Earth/Light/Dark)
  slot: 'S1' | 'S2' | 'S3'
  df: number                  // damage factor (skill lvl 5)
  // attacker
  atk: number
  chd: number                 // crit damage %
  dmgInc: number              // damage increase %
  pen: number                 // penetration %
  // target
  def: number
  tCdmgRed: number            // target crit dmg reduction %
  tDmgRed: number             // target dmg reduction %
  elem: 'none' | 'adv' | 'disadv'
  isBoss?: boolean            // target is boss-type (enables PVE Boss +30% quirk)
  quirksDisabled?: boolean    // target disables all quirks (e.g. lvl 99 boss)
  // context + result
  crit: boolean
  obs: number                 // observed damage
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
