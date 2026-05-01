import { readdir, readFile } from 'fs/promises'
import { join } from 'path'
import { SCHEMA_VERSION, INPUTS, writeJsonMin } from './shared'
import { loadJson2 } from './raw-loader'
import { extractAwakeningBuffs, extractCharSkillBuffs, type BuffRow } from '../../../src/lib/damage/v2/extract-buffs'
import { extractEEBuffs } from '../../../src/lib/damage/v2/extract-ee'
import type { ApplicableBuff } from '../../../src/lib/damage/v2/buffs'

/**
 * Bake the buff catalog for the public damage calculator.
 *
 *   public/damage-calc/buffs/awakening.json   — shared catalog (~all awakening
 *     buffs). Loaded once on initial page boot, filtered client-side per
 *     selected char's element/class/subclass.
 *   public/damage-calc/buffs/{charId}.json    — char-specific (char_skill + EE)
 *     loaded lazily when the user picks an attacker.
 *
 * The split keeps total bake size under ~1 MB while making each per-char
 * fetch tiny (~5-15 KB). Awakening buffs apply across many chars based on
 * `appliesTo` (element/class/...) — duplicating them per char would inflate
 * the bake by ~10× for no runtime benefit.
 *
 * Core-fusion handling: a CF char's file includes its OWN EE buffs PLUS the
 * base char's EE buffs (CF chars in-game can wear either Exclusive Equipment).
 * The runtime's `eeCharId` plumbing then picks the right ones via
 * `b.source.charId === eeCharId`. Single fetch per char keeps the runtime
 * simple — no client-side merge needed.
 */

type Row = Record<string, string | undefined>

interface CharacterTempletRow {
  ID: string
  [key: string]: string | undefined
}

interface SkillLevelRow {
  ID?: string
  SkillID: string
  SkillLevel: string
  BuffID?: string
  DamageFactor?: string
}

interface CuratedCharacter {
  ID: string | number
  coreFusionId?: string
}

async function loadCfToBaseMap(): Promise<Map<string, string>> {
  const files = await readdir(INPUTS.characters)
  const cfToBase = new Map<string, string>()
  await Promise.all(
    files.filter(f => f.endsWith('.json')).map(async f => {
      try {
        const raw = await readFile(join(INPUTS.characters, f), 'utf-8')
        const c = JSON.parse(raw) as CuratedCharacter
        if (c.coreFusionId) cfToBase.set(String(c.coreFusionId), String(c.ID))
      } catch {
        // skip broken curated files
      }
    }),
  )
  return cfToBase
}

/**
 * Determine which char IDs the calculator picker exposes — same filter as
 * `build-chars.ts` (curated + at least one DamageFactor row). Recomputing
 * here keeps the builder independent of build-chars's output.
 */
async function loadPlayableCharIds(): Promise<Set<string>> {
  const [charTemplet, skillLevels, files] = await Promise.all([
    loadJson2<CharacterTempletRow[]>('CharacterTemplet.json'),
    loadJson2<SkillLevelRow[]>('CharacterSkillLevelTemplet.json'),
    readdir(INPUTS.characters),
  ])

  const curatedIds = new Set<string>()
  for (const f of files) {
    if (!f.endsWith('.json')) continue
    curatedIds.add(f.replace('.json', ''))
  }

  // A char is "playable in the calc" iff curated AND any of its S1/S2/S3
  // exposes a DamageFactor — same gate as build-chars. We don't need the
  // exact factors here, just the boolean.
  const skillsWithFactor = new Set<string>()
  for (const r of skillLevels) {
    if (!r.SkillID || r.DamageFactor == null) continue
    skillsWithFactor.add(r.SkillID)
  }
  const out = new Set<string>()
  for (const row of charTemplet) {
    if (!curatedIds.has(row.ID)) continue
    const slots = [row.Skill_1, row.Skill_2, row.Skill_3].filter((s): s is string => !!s)
    if (slots.some(s => skillsWithFactor.has(s))) out.add(row.ID)
  }
  return out
}

interface BuffsFile {
  _v: string
  charId: string
  /** char_skill + ee buffs applicable to this char (incl. base EE for CF chars). */
  buffs: ApplicableBuff[]
}

interface AwakeningFile {
  _v: string
  buffs: ApplicableBuff[]
}

export async function buildBuffs(): Promise<{ charFiles: number; awakeningCount: number; charBuffsCount: number }> {
  const [
    nodes,
    awakeningLevels,
    buffs,
    charRows,
    skillLvls,
    textRows,
    items,
    itemOpts,
    itemSpec,
    textItemRows,
    cfToBase,
    playableIds,
  ] = await Promise.all([
    loadJson2<Row[]>('CharacterAwakeningNodeTemplet.json'),
    loadJson2<Row[]>('CharacterAwakeningLevelTemplet.json'),
    loadJson2<Row[]>('BuffTemplet.json'),
    loadJson2<Row[]>('CharacterTemplet.json'),
    loadJson2<Row[]>('CharacterSkillLevelTemplet.json'),
    loadJson2<Row[]>('TextSystem.json'),
    loadJson2<Row[]>('ItemTemplet.json'),
    loadJson2<Row[]>('ItemOptionTemplet.json'),
    loadJson2<Row[]>('ItemSpecialOptionTemplet.json'),
    loadJson2<Row[]>('TextItem.json'),
    loadCfToBaseMap(),
    loadPlayableCharIds(),
  ])

  // Build the BuffRow projection once — both extractors consume the same shape.
  const buffRows: BuffRow[] = buffs.map(b => ({
    ID: b.ID, BuffID: b.BuffID, Level: b.Level, Type: b.Type,
    StatType: b.StatType, ApplyingType: b.ApplyingType, Value: b.Value,
    BuffConditionType: b.BuffConditionType, BuffConditionValue: b.BuffConditionValue,
    TargetType: b.TargetType, TargetSkillType: b.TargetSkillType,
    CallerSkillType: b.CallerSkillType, BuffCreateType: b.BuffCreateType,
  }))

  const textSystem = new Map<string, { English: string }>()
  for (const t of textRows) {
    if (t.ID) textSystem.set(t.ID, { English: t.English ?? '' })
  }

  const textItem = new Map<string, string>()
  for (const t of textItemRows) {
    if (t.ID) textItem.set(t.ID, t.English ?? '')
  }

  const awakening = extractAwakeningBuffs({
    nodes, levels: awakeningLevels, buffs: buffRows, textSystem,
  })

  const charSkill = extractCharSkillBuffs({
    characters: charRows.filter(r => r.ID).map(r => r as { ID: string } & Row),
    skillLevels: skillLvls.filter(r => r.SkillID).map(r => ({
      SkillID: r.SkillID!,
      SkillLevel: r.SkillLevel ?? '0',
      BuffID: r.BuffID,
    })),
    buffs: buffRows,
  })

  const ee = extractEEBuffs({
    items, itemOptions: itemOpts, itemSpecialOptions: itemSpec, textItem, buffs: buffRows,
  })

  // Bucket char_skill + ee by source.charId. Awakening goes to its own file.
  const byChar = new Map<string, ApplicableBuff[]>()
  for (const b of [...charSkill, ...ee]) {
    if (b.source.kind === 'awakening') continue   // shouldn't happen, defensive
    if (!playableIds.has(b.source.charId)) continue
    const arr = byChar.get(b.source.charId) ?? []
    arr.push(b)
    byChar.set(b.source.charId, arr)
  }

  // CF union: each CF char also receives the base char's EE buffs so the
  // runtime can offer "wear base EE" without a second fetch. The runtime
  // then disambiguates via `b.source.charId === eeCharId`.
  let charBuffsCount = 0
  const writes: Promise<void>[] = []

  for (const charId of playableIds) {
    const own = byChar.get(charId) ?? []
    const baseId = cfToBase.get(charId)
    let merged: ApplicableBuff[] = own
    if (baseId && baseId !== charId) {
      const baseEE = (byChar.get(baseId) ?? []).filter(b => b.source.kind === 'ee')
      if (baseEE.length) merged = [...own, ...baseEE]
    }
    const file: BuffsFile = { _v: SCHEMA_VERSION, charId, buffs: merged }
    charBuffsCount += merged.length
    writes.push(writeJsonMin(`buffs/${charId}.json`, file))
  }

  const awakeningFile: AwakeningFile = { _v: SCHEMA_VERSION, buffs: awakening }
  writes.push(writeJsonMin('buffs/awakening.json', awakeningFile))

  await Promise.all(writes)

  return {
    charFiles: playableIds.size,
    awakeningCount: awakening.length,
    charBuffsCount,
  }
}
