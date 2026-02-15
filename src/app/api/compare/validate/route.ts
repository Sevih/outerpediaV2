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

// Fields to merge from V1 into V2
const V1_MERGE_FIELDS = ['tags', 'hasCoreFusion', 'coreFusionId'] as const

function mergeV1Fields(v2Data: Record<string, unknown>, slug: string): Record<string, unknown> {
  const v1Path = path.join(V1_CHAR_DIR, `${slug}.json`)
  if (!fs.existsSync(v1Path)) return v2Data

  const v1Data = JSON.parse(fs.readFileSync(v1Path, 'utf-8'))
  let merged: Record<string, unknown> = { ...v2Data }

  for (const field of V1_MERGE_FIELDS) {
    if (field in v1Data && v1Data[field] != null) {
      merged[field] = v1Data[field]
    }
  }

  // Merge skill buff/debuff when V1 is superset of V2
  merged = mergeSkillSuperset(merged, v1Data)

  return merged
}

export async function POST(req: Request) {
  try {
    const { id, slug } = await req.json()

    if (!id || typeof id !== 'string') {
      return NextResponse.json({ error: 'Missing or invalid id' }, { status: 400 })
    }

    fs.mkdirSync(VALIDATED_DIR, { recursive: true })

    // Read V2 character JSON
    const sourcePath = path.join(V2_CHAR_DIR, `${id}.json`)
    if (!fs.existsSync(sourcePath)) {
      return NextResponse.json({ error: `V2 file not found: ${id}.json` }, { status: 404 })
    }

    const v2Data = JSON.parse(fs.readFileSync(sourcePath, 'utf-8'))

    // Merge V1 fields (tags) into V2 data
    const merged = slug ? mergeV1Fields(v2Data, slug) : v2Data

    // Post-process: reorder localized keys, remove redundant true_desc
    const processed = postProcess(merged)

    // Write processed result with proper key ordering
    const destPath = path.join(VALIDATED_DIR, `${id}.json`)
    fs.writeFileSync(destPath, serializeCharacter(processed), 'utf-8')

    // Copy EE entry if exists
    let eeCopied = false
    if (fs.existsSync(V2_EE_FILE)) {
      const v2EE = JSON.parse(fs.readFileSync(V2_EE_FILE, 'utf-8'))
      if (v2EE[id]) {
        let validatedEE: Record<string, unknown> = {}
        if (fs.existsSync(VALIDATED_EE_FILE)) {
          validatedEE = JSON.parse(fs.readFileSync(VALIDATED_EE_FILE, 'utf-8'))
        }
        validatedEE[id] = v2EE[id]
        fs.writeFileSync(VALIDATED_EE_FILE, JSON.stringify(validatedEE, null, 2), 'utf-8')
        eeCopied = true
      }
    }

    return NextResponse.json({ success: true, eeCopied })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
