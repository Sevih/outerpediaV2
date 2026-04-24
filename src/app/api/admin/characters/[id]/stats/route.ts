import { NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'

const TEMPLET_PATH = path.join(process.cwd(), 'data', 'admin', 'json2', 'CharacterTemplet.json')

interface CharacterTempletRow {
  ID: string
  Atk_Max?: string
  Def_Max?: string
  HP_Max?: string
  Speed_Max?: string
  CriticalRate_Max?: string
  CriticalDMGRate_Max?: string
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params

  const raw = await fs.readFile(TEMPLET_PATH, 'utf-8')
  const rows = JSON.parse(raw) as CharacterTempletRow[]
  const row = rows.find(r => r.ID === id)

  if (!row) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  return NextResponse.json({
    id: row.ID,
    atkMax: parseInt(row.Atk_Max ?? '0', 10) || 0,
    defMax: parseInt(row.Def_Max ?? '0', 10) || 0,
    hpMax: parseInt(row.HP_Max ?? '0', 10) || 0,
    speedMax: parseInt(row.Speed_Max ?? '0', 10) || 0,
    critRateMax: (parseInt(row.CriticalRate_Max ?? '0', 10) || 0) / 10,
    chdMax: (parseInt(row.CriticalDMGRate_Max ?? '0', 10) || 0) / 10,
  })
}
