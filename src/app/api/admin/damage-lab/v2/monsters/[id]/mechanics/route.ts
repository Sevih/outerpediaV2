import { NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'
import { extractMonsterPassives, type MonsterMechanics } from '@/lib/damage/v2/extract-monster'

/**
 * GET /api/admin/damage-lab/v2/monsters/[id]/mechanics
 *
 * Returns the structured list of damage-relevant passive buffs for the
 * given monster — driven entirely by the datamine
 * (`MonsterTemplet` → `MonsterSkillTemplet` → `MonsterSkillLevelTemplet` →
 * `BuffTemplet`). No hardcoded boss lookup.
 *
 * Consumed by `BossMechanicsPanel` to surface per-passive toggles so the
 * operator can dial in empirical multipliers when the buff effect isn't
 * yet plumbed through the formula reducer.
 *
 * Restricted to development.
 */

const JSON2_DIR = path.join(process.cwd(), 'data', 'admin', 'json2')

type Row = Record<string, string | undefined>

interface Cache {
  monsters: Row[]
  skills: Row[]
  skillLevels: Row[]
  buffs: Row[]
  textSkill: Row[]
}
let cache: Cache | null = null

async function loadJson<T>(file: string): Promise<T> {
  const buf = await fs.readFile(path.join(JSON2_DIR, file), 'utf-8')
  return JSON.parse(buf)
}

async function loadAll(): Promise<Cache> {
  if (cache) return cache
  const [monsters, skills, skillLevels, buffs, textSkill] = await Promise.all([
    loadJson<Row[]>('MonsterTemplet.json'),
    loadJson<Row[]>('MonsterSkillTemplet.json'),
    loadJson<Row[]>('MonsterSkillLevelTemplet.json'),
    loadJson<Row[]>('BuffTemplet.json'),
    loadJson<Row[]>('TextSkill.json'),
  ])
  cache = { monsters, skills, skillLevels, buffs, textSkill }
  return cache
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse<MonsterMechanics | { error: string } | { passives: [] }>> {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await ctx.params
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const data = await loadAll()
  const result = extractMonsterPassives({
    monsterId: id,
    monsters: data.monsters,
    skills: data.skills,
    skillLevels: data.skillLevels,
    buffs: data.buffs,
    textSkill: data.textSkill,
  })

  if (!result) {
    return NextResponse.json({ error: `Monster ${id} not found` }, { status: 404 })
  }
  return NextResponse.json(result)
}
