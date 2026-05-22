/**
 * Batch-generate the square FaceIcon (FI_<id>.png) for every character that
 * has a portrait on disk. Reuses the same logic as the extractor route.
 *
 * Run: npx tsx scripts/generate-faceicons.ts
 */
import { readdirSync } from 'fs'
import { join } from 'path'
import { generateFaceIcon } from '../src/lib/face-icon'

const PORTRAIT_DIR = join(process.cwd(), 'public', 'images', 'characters', 'portrait')

function listCharacterIds(): string[] {
  const ids = new Set<string>()
  for (const f of readdirSync(PORTRAIT_DIR)) {
    const m = f.match(/^CT_(\d+)\.(webp|png)$/i)
    if (m) ids.add(m[1])
  }
  return [...ids].sort()
}

async function main() {
  const ids = listCharacterIds()
  console.log(`Found ${ids.length} portraits`)

  const counts = { generated: 0, exists: 0, 'no-portrait': 0, 'no-layout': 0 }
  const noLayout: string[] = []

  for (const [i, id] of ids.entries()) {
    const r = await generateFaceIcon(id)
    counts[r]++
    if (r === 'no-layout') noLayout.push(id)
    if ((i + 1) % 25 === 0 || i === ids.length - 1) {
      process.stdout.write(`  ${i + 1}/${ids.length}\r`)
    }
  }
  console.log()
  console.log(`Generated: ${counts.generated}  Exists: ${counts.exists}  No portrait: ${counts['no-portrait']}  No layout: ${counts['no-layout']}`)
  if (noLayout.length) console.log(`No layout for: ${noLayout.join(', ')}`)
}

main().catch(e => { console.error(e); process.exit(1) })
