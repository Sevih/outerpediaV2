import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { postProcess, serializeCharacter, mergeSkillSuperset } from '../transform'

const PROJECT_ROOT = process.cwd()
const V1_CHAR_DIR = path.join(PROJECT_ROOT, '..', 'outerpedia-clean', 'src', 'data', 'char')
const V2_CHAR_DIR = path.join(PROJECT_ROOT, 'data', 'char')
const V2_EE_FILE = path.join(PROJECT_ROOT, 'data', 'equipment', 'ee.json')
const VALIDATED_DIR = path.join(PROJECT_ROOT, 'data', 'character')
const VALIDATED_EE_FILE = path.join(VALIDATED_DIR, 'ee.json')

const V1_MERGE_FIELDS = ['tags'] as const

export async function POST() {
  try {
    fs.mkdirSync(VALIDATED_DIR, { recursive: true })

    // Build V1 id->data mapping
    const v1Map: Record<string, Record<string, unknown>> = {}
    const v1Files = fs.readdirSync(V1_CHAR_DIR).filter(f => f.endsWith('.json'))
    for (const file of v1Files) {
      const v1Data = JSON.parse(fs.readFileSync(path.join(V1_CHAR_DIR, file), 'utf-8'))
      const id = v1Data.ID as string
      if (id) {
        v1Map[id] = v1Data
      }
    }

    // Copy all V2 character files with V1 merge
    const v2Files = fs.readdirSync(V2_CHAR_DIR).filter(f => f.endsWith('.json'))
    let count = 0

    for (const file of v2Files) {
      const id = file.replace('.json', '')
      const v2Data = JSON.parse(fs.readFileSync(path.join(V2_CHAR_DIR, file), 'utf-8'))

      // Merge V1 fields (tags + skill buff/debuff superset)
      const v1Data = v1Map[id]
      if (v1Data) {
        for (const field of V1_MERGE_FIELDS) {
          if (field in v1Data && v1Data[field] != null) {
            v2Data[field] = v1Data[field]
          }
        }
        Object.assign(v2Data, mergeSkillSuperset(v2Data, v1Data))
      }

      // Post-process: reorder localized keys, remove redundant true_desc
      const processed = postProcess(v2Data)

      const dest = path.join(VALIDATED_DIR, file)
      fs.writeFileSync(dest, serializeCharacter(processed), 'utf-8')
      count++
    }

    // Copy full EE file
    if (fs.existsSync(V2_EE_FILE)) {
      const v2EE = JSON.parse(fs.readFileSync(V2_EE_FILE, 'utf-8'))
      fs.writeFileSync(VALIDATED_EE_FILE, JSON.stringify(v2EE, null, 2), 'utf-8')
    }

    return NextResponse.json({ success: true, count })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
