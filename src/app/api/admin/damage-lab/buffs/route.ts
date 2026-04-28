/**
 * GET /api/admin/damage-lab/buffs
 *
 * Unified buff list — every modifier that can affect a damage calc, in one
 * flat array. Replaces the legacy pair (`/quirks` for Awakening, `/characters`
 * for char-specific scaling + boss bonuses) with a single source of truth.
 *
 * Output:
 *   {
 *     buffs: ApplicableBuff[]        // Awakening + char-specific damage buffs
 *   }
 *
 * Char *meta* (name, class, element, transcend bonuses, skill DamageFactors,
 * additional-attack ratio) still lives in `/api/admin/damage-lab/characters` —
 * those aren't buffs and have their own consumers (UI roster, scaling display).
 *
 * The page-side reducer (`applyBuffs`) takes this list + a context and folds
 * it into the inputs `computeDamage` expects. See `src/lib/damage/buffs.ts`.
 */
import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

import {
  extractAwakeningBuffs, extractCharSkillBuffs,
} from '../_shared/extract-buffs'
import type { ApplicableBuff } from '@/lib/damage/buffs'

const JSON2_DIR = path.join(process.cwd(), 'data', 'admin', 'json2')

type Row = Record<string, string | undefined>

function loadJson<T>(file: string): T {
  return JSON.parse(fs.readFileSync(path.join(JSON2_DIR, file), 'utf-8'))
}

// In-process cache. The underlying JSON files are static at runtime; rebuilding
// the buff list per request would re-parse ~5 MB of game data each time.
let cache: ApplicableBuff[] | null = null

function build(): ApplicableBuff[] {
  if (cache) return cache

  const nodes      = loadJson<Row[]>('CharacterAwakeningNodeTemplet.json')
  const levels     = loadJson<Row[]>('CharacterAwakeningLevelTemplet.json')
  const buffs      = loadJson<Row[]>('BuffTemplet.json')
  const charRows   = loadJson<Row[]>('CharacterTemplet.json')
  const skillLvls  = loadJson<Row[]>('CharacterSkillLevelTemplet.json')
  const textRows   = loadJson<Row[]>('TextSystem.json')

  // Index TextSystem by ID for O(1) lookup of localized strings.
  const textSystem = new Map<string, { English: string }>()
  for (const t of textRows) {
    if (t.ID) textSystem.set(t.ID, { English: t.English ?? '' })
  }

  const awakening = extractAwakeningBuffs({
    nodes, levels, buffs, textSystem,
  })

  // Char rows have ID + Skill_N keys; cast for the extractor's narrower shape.
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

  cache = [...awakening, ...charSkill]
  return cache
}

export async function GET() {
  return NextResponse.json({ buffs: build() })
}
