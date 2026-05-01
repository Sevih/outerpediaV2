import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import {
  extractAwakeningBuffs, extractCharSkillBuffs,
} from '@/lib/damage/v2/extract-buffs'
import { extractEEBuffs } from '@/lib/damage/v2/extract-ee'
import type { ApplicableBuff } from '@/lib/damage/v2/buffs'

/**
 * GET /api/admin/damage-lab/v2/extract-buffs
 *
 * Audited buff extraction for the lab v2 — emits `ApplicableBuff[]` from the
 * awakening tree + char skills + BuffTemplet, with explicit per-`BT_DMG_*`
 * mapping (see `damage-lab-v2-spec.md` §2 + UI spec §3.3).
 *
 * Key fix vs v1:
 *   - `BT_DMG_ENEMY_TEAM_DECREASE` (type 94) → `enemy_team_decrease` poolCond.
 *     v1 collapsed it onto `team_decrease` (= MY_TEAM, allies); PR 4bis disasm
 *     of `FindBuffEnemyTeamDecreaseDamageRate` (VA 0x2639194) confirmed the
 *     multiplier source is the count of dead/missing ENEMIES, not allies.
 *
 * Restricted to development.
 */

const JSON2_DIR = path.join(process.cwd(), 'data', 'admin', 'json2')

type Row = Record<string, string | undefined>

function loadJson<T>(file: string): T {
  return JSON.parse(fs.readFileSync(path.join(JSON2_DIR, file), 'utf-8'))
}

// In-process cache — JSON files are static at runtime; rebuilding per request
// would re-parse ~5 MB of game data each time.
let cache: ApplicableBuff[] | null = null

function build(): ApplicableBuff[] {
  if (cache) return cache

  const nodes      = loadJson<Row[]>('CharacterAwakeningNodeTemplet.json')
  const levels     = loadJson<Row[]>('CharacterAwakeningLevelTemplet.json')
  const buffs      = loadJson<Row[]>('BuffTemplet.json')
  const charRows   = loadJson<Row[]>('CharacterTemplet.json')
  const skillLvls  = loadJson<Row[]>('CharacterSkillLevelTemplet.json')
  const textRows   = loadJson<Row[]>('TextSystem.json')
  const items      = loadJson<Row[]>('ItemTemplet.json')
  const itemOpts   = loadJson<Row[]>('ItemOptionTemplet.json')
  const itemSpec   = loadJson<Row[]>('ItemSpecialOptionTemplet.json')
  const textItemRows = loadJson<Row[]>('TextItem.json')

  const textItem = new Map<string, string>()
  for (const t of textItemRows) {
    if (t.ID) textItem.set(t.ID, t.English ?? '')
  }

  const textSystem = new Map<string, { English: string }>()
  for (const t of textRows) {
    if (t.ID) textSystem.set(t.ID, { English: t.English ?? '' })
  }

  const awakening = extractAwakeningBuffs({
    nodes, levels, buffs, textSystem,
  })

  const charSkill = extractCharSkillBuffs({
    characters: charRows.filter(r => r.ID).map(r => r as { ID: string } & Row),
    skillLevels: skillLvls.filter(r => r.SkillID).map(r => ({
      SkillID: r.SkillID!,
      SkillLevel: r.SkillLevel ?? '0',
      BuffID: r.BuffID,
    })),
    buffs: buffs.map(b => ({
      ID: b.ID, BuffID: b.BuffID, Level: b.Level, Type: b.Type,
      StatType: b.StatType, ApplyingType: b.ApplyingType, Value: b.Value,
      BuffConditionType: b.BuffConditionType, BuffConditionValue: b.BuffConditionValue,
      TargetType: b.TargetType, TargetSkillType: b.TargetSkillType,
      CallerSkillType: b.CallerSkillType, BuffCreateType: b.BuffCreateType,
    })),
  })

  const ee = extractEEBuffs({
    items, itemOptions: itemOpts, itemSpecialOptions: itemSpec, textItem,
    buffs: buffs.map(b => ({
      ID: b.ID, BuffID: b.BuffID, Level: b.Level, Type: b.Type,
      StatType: b.StatType, ApplyingType: b.ApplyingType, Value: b.Value,
      BuffConditionType: b.BuffConditionType, BuffConditionValue: b.BuffConditionValue,
      TargetType: b.TargetType, TargetSkillType: b.TargetSkillType,
      CallerSkillType: b.CallerSkillType, BuffCreateType: b.BuffCreateType,
    })),
  })

  cache = [...awakening, ...charSkill, ...ee]
  return cache
}

export function GET() {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  return NextResponse.json({ buffs: build() })
}
