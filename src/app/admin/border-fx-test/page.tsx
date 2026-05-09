import fs from 'fs'
import path from 'path'
import BorderFxTestClient, { type CharRow } from './BorderFxTestClient'
import type { FxDescriptor } from '@/lib/fx/types'

interface ExtraRow {
  CharacterID: string
  ThumbnailEffect?: string
}
interface CharTempletRow {
  ID: string
  Type?: string
  Element?: string
  Class?: string
  BasicStar?: string
  NameID?: string
}
interface TextRow {
  ID: string
  English?: string
}

export default function BorderFxTestPage() {
  const json2 = path.join(process.cwd(), 'data', 'admin', 'json2')
  const fxDir = path.join(process.cwd(), 'data', 'admin', 'fx')

  const extra: ExtraRow[] = JSON.parse(fs.readFileSync(path.join(json2, 'CharacterExtraTemplet.json'), 'utf8'))
  const chars: CharTempletRow[] = JSON.parse(fs.readFileSync(path.join(json2, 'CharacterTemplet.json'), 'utf8'))
  const text: TextRow[] = JSON.parse(fs.readFileSync(path.join(json2, 'TextCharacter.json'), 'utf8'))

  // Load every available descriptor by effect name.
  const descriptors: Record<string, FxDescriptor> = {}
  for (const file of fs.readdirSync(fxDir)) {
    if (!file.endsWith('.json')) continue
    const desc: FxDescriptor = JSON.parse(fs.readFileSync(path.join(fxDir, file), 'utf8'))
    descriptors[desc.name] = desc
  }

  const charById = new Map(chars.filter((c) => c.Type === 'CT_PC').map((c) => [c.ID, c]))
  const textById = new Map(text.map((t) => [t.ID, t.English ?? '']))

  const titleCase = (s: string) => s.toLowerCase().replace(/^./, (c) => c.toUpperCase())
  const ELEM = (s?: string) => (s ? titleCase(s.replace('CET_', '')) : undefined)
  const CLS = (s?: string) => {
    if (!s) return undefined
    const t = titleCase(s.replace('CCT_', ''))
    if (t === 'Attacker') return 'Striker'
    if (t === 'Priest') return 'Healer'
    return t
  }

  const rows: CharRow[] = extra
    .filter((e) => e.ThumbnailEffect && descriptors[e.ThumbnailEffect])
    .map((e) => {
      const c = charById.get(e.CharacterID)
      const name = c?.NameID ? (textById.get(c.NameID) ?? e.CharacterID) : e.CharacterID
      return {
        id: e.CharacterID,
        name,
        effect: e.ThumbnailEffect ?? '',
        element: ELEM(c?.Element) as CharRow['element'],
        classType: CLS(c?.Class) as CharRow['classType'],
        rarity: parseInt(c?.BasicStar ?? '0', 10) || 3,
      }
    })
    .sort((a, b) => a.effect.localeCompare(b.effect) || a.id.localeCompare(b.id))

  return <BorderFxTestClient rows={rows} descriptors={descriptors} />
}
