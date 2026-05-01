import { readdir, readFile } from 'fs/promises'
import { join } from 'path'
import { SCHEMA_VERSION, INPUTS, writeJsonMin } from './shared'
import { loadJson2, loadGenerated } from './raw-loader'

/**
 * Bake per-char transcend data for the public damage calculator.
 *
 *   public/damage-calc/transcend.json — single file keyed by charId:
 *     - tiers[]   : stat boosts (HP/ATK/DEF rate) + Burst level unlocks
 *     - teamBonuses : stat keys this char grants to allies via transcend
 *                     (extracted upstream in `characters-index` from curated text)
 *
 * The templet has 80 rows total: most chars share GENERIC rows
 * (`CharacterID=0`) keyed by `BasicStar` (the char's starting rarity).
 * A handful of chars (currently 8) have per-id overrides — when present,
 * they take precedence row-by-row.
 *
 * Variant paths (T4_1 / T4_2 / T5_1 / T5_2 / T5_3 in the curated text)
 * are NOT modeled here — the calc UI lets the user enter their actual
 * stats directly, so the per-tier base values are sufficient for the
 * Burst level gate + an informational tier picker. Variant modeling
 * belongs to the future "build optimizer" feature, not the calc.
 *
 * Rates are stored verbatim from the templet (permille — 100 = +10%).
 * The reducer divides by 1000 when applying.
 */

interface TranscendRow {
  ID?: string
  CharacterID?: string
  BasicStar?: string
  TransStar?: string
  RewardHPRate?: string
  RewardAtkRate?: string
  RewardDefRate?: string
  Burst2?: string
  Burst3?: string
}

interface CharacterListEntry {
  ID: string
  teamBonuses?: string[]
}

interface CuratedCharacter {
  ID: string | number
  Rarity?: number
  /**
   * For CF chars: id of the base char they originate from. Used to fall back
   * to the base char's BasicStar when CF chars don't carry their own
   * `Rarity` (they always do today, but this keeps the resolver robust).
   */
  baseCharId?: string
}

interface TranscendTier {
  transStar: number
  /** Per-mille — divide by 1000 to get the multiplier delta. */
  hpRate: number
  atkRate: number
  defRate: number
  burst2: boolean
  burst3: boolean
}

interface TranscendCharEntry {
  basicStar: number
  tiers: TranscendTier[]
  /**
   * Stat keys this char's transcend description names as ally-team bonuses
   * (parsed by `characters-index` from English text). Empty / absent for
   * chars with no team bonuses. Values are stat keys per `data/stats.json`.
   */
  teamBonuses?: string[]
}

interface TranscendFile {
  _v: string
  byChar: Record<string, TranscendCharEntry>
}

const num = (v: string | undefined) => parseInt(v ?? '0', 10) || 0
const bool = (v: string | undefined) => v === 'True'

function rowToTier(r: TranscendRow): TranscendTier {
  return {
    transStar: num(r.TransStar),
    hpRate:    num(r.RewardHPRate),
    atkRate:   num(r.RewardAtkRate),
    defRate:   num(r.RewardDefRate),
    burst2:    bool(r.Burst2),
    burst3:    bool(r.Burst3),
  }
}

async function loadCuratedRarities(): Promise<Map<string, number>> {
  const files = await readdir(INPUTS.characters)
  const out = new Map<string, number>()
  await Promise.all(
    files.filter(f => f.endsWith('.json')).map(async f => {
      try {
        const raw = await readFile(join(INPUTS.characters, f), 'utf-8')
        const c = JSON.parse(raw) as CuratedCharacter
        if (c.Rarity != null) out.set(String(c.ID), c.Rarity)
      } catch {
        // skip broken curated files
      }
    }),
  )
  return out
}

export async function buildTranscend(): Promise<{ chars: number; tiers: number }> {
  const [transcendRows, charList, raritiesById] = await Promise.all([
    loadJson2<TranscendRow[]>('CharacterTranscendentTemplet.json'),
    loadGenerated<CharacterListEntry[]>('characters-list.json'),
    loadCuratedRarities(),
  ])

  // Index 1: generic tiers per BasicStar (CharacterID === '0').
  const genericByStar = new Map<number, TranscendTier[]>()
  for (const r of transcendRows) {
    if (r.CharacterID !== '0') continue
    const star = num(r.BasicStar)
    const arr = genericByStar.get(star) ?? []
    arr.push(rowToTier(r))
    genericByStar.set(star, arr)
  }

  // Index 2: per-char override tiers.
  const overrideByChar = new Map<string, TranscendTier[]>()
  for (const r of transcendRows) {
    const cid = r.CharacterID
    if (!cid || cid === '0') continue
    const arr = overrideByChar.get(cid) ?? []
    arr.push(rowToTier(r))
    overrideByChar.set(cid, arr)
  }

  // Sort all tier arrays by transStar ascending — the UI iterates them in
  // tier order, and the merge step relies on ordered comparison.
  for (const arr of genericByStar.values()) {
    arr.sort((a, b) => a.transStar - b.transStar)
  }
  for (const arr of overrideByChar.values()) {
    arr.sort((a, b) => a.transStar - b.transStar)
  }

  // Index 3: teamBonuses per char from `characters-list.json`.
  const teamBonusesByChar = new Map<string, string[]>()
  for (const c of charList) {
    if (c.teamBonuses && c.teamBonuses.length > 0) {
      teamBonusesByChar.set(c.ID, c.teamBonuses)
    }
  }

  // Materialize per-char entries.
  // Iterate raritiesById so we cover every curated char (incl. CF variants
  // — they reuse their base star's generic tiers since they don't carry a
  // templet override of their own).
  const byChar: Record<string, TranscendCharEntry> = {}
  let tierCount = 0

  for (const [charId, basicStar] of raritiesById) {
    if (basicStar < 1) continue   // skip 0★ placeholders if any

    const override = overrideByChar.get(charId)
    const generic = genericByStar.get(basicStar) ?? []

    // When an override exists, replace generic rows tier-by-tier; missing
    // tiers fall through to generic. This handles partial overrides
    // gracefully (none observed today, but defensive).
    let tiers: TranscendTier[]
    if (override && override.length > 0) {
      const byStar = new Map<number, TranscendTier>()
      for (const t of generic) byStar.set(t.transStar, t)
      for (const t of override) byStar.set(t.transStar, t)
      tiers = Array.from(byStar.values()).sort((a, b) => a.transStar - b.transStar)
    } else {
      tiers = generic
    }

    if (tiers.length === 0) continue   // nothing to emit

    const entry: TranscendCharEntry = { basicStar, tiers }
    const teamBonuses = teamBonusesByChar.get(charId)
    if (teamBonuses) entry.teamBonuses = teamBonuses

    byChar[charId] = entry
    tierCount += tiers.length
  }

  const file: TranscendFile = { _v: SCHEMA_VERSION, byChar }
  await writeJsonMin('transcend.json', file)

  return { chars: Object.keys(byChar).length, tiers: tierCount }
}
