/**
 * Build the character -> skins (costumes) mapping from the raw game tables.
 *
 * Thin wrapper around the pipeline step: forces a regeneration regardless of the
 * stamp. In a normal build the `character-skins` pipeline step runs this logic
 * automatically (with graceful skip + stamp caching) — use this script only to
 * regenerate on demand.
 *
 * Reads:  data/admin/json2/{CostumeTemplet,TextCharacter}.json
 * Writes: data/character-skins.json  ({ "<characterId>": [ { ...skin }, ... ] })
 *
 * Run: npx tsx scripts/generate-character-skins.ts
 */
import { existsSync } from 'fs'
import { PATHS } from '../pipeline/config'
import { buildCharacterSkins, writeCharacterSkins, copyMissingPortraits } from '../pipeline/steps/character-skins'

function main() {
  if (!existsSync(PATHS.adminJson2)) {
    console.error(`No json2 found at ${PATHS.adminJson2} — datamine required to (re)generate.`)
    process.exit(1)
  }

  const data = buildCharacterSkins()
  writeCharacterSkins(data)

  const totalChars = Object.keys(data).length
  const totalSkins = Object.values(data).reduce((n, s) => n + s.length, 0)
  console.log(`Wrote ${totalChars} characters / ${totalSkins} skins -> data/character-skins.json`)

  const { copied, noSource } = copyMissingPortraits(data)
  console.log(`Portraits: ${copied} copied${noSource.length ? `, ${noSource.length} with no source (${noSource.join(', ')})` : ''}`)
}

main()
