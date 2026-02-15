import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

const PROJECT_ROOT = process.cwd()
const V1_CHAR_DIR = path.join(PROJECT_ROOT, '..', 'outerpedia-clean', 'src', 'data', 'char')
const V2_CHAR_DIR = path.join(PROJECT_ROOT, 'data', 'char')
const V1_EE_FILE = path.join(PROJECT_ROOT, '..', 'outerpedia-clean', 'src', 'data', 'ee.json')
const V2_EE_FILE = path.join(PROJECT_ROOT, 'data', 'equipment', 'ee.json')
const VALIDATED_DIR = path.join(PROJECT_ROOT, 'data', 'character')

export async function GET() {
  try {
    // Read V1 EE
    const v1EE: Record<string, unknown> = JSON.parse(fs.readFileSync(V1_EE_FILE, 'utf-8'))

    // Read V2 EE
    let v2EE: Record<string, unknown> = {}
    if (fs.existsSync(V2_EE_FILE)) {
      v2EE = JSON.parse(fs.readFileSync(V2_EE_FILE, 'utf-8'))
    }

    // Read all V1 character files
    const v1Files = fs.readdirSync(V1_CHAR_DIR).filter(f => f.endsWith('.json'))

    const characters = v1Files.map(filename => {
      const slug = filename.replace('.json', '')
      const v1Path = path.join(V1_CHAR_DIR, filename)
      const v1 = JSON.parse(fs.readFileSync(v1Path, 'utf-8'))
      const id = v1.ID as string

      // Read V2 by ID
      let v2: Record<string, unknown> | null = null
      const v2Path = path.join(V2_CHAR_DIR, `${id}.json`)
      if (fs.existsSync(v2Path)) {
        v2 = JSON.parse(fs.readFileSync(v2Path, 'utf-8'))
      }

      // EE data
      const v1_ee = v1EE[slug] ?? null
      const v2_ee = v2EE[id] ?? null

      // Check if validated
      const validatedPath = path.join(VALIDATED_DIR, `${id}.json`)
      const validated = fs.existsSync(validatedPath)

      return {
        slug,
        id,
        name: v1.Fullname as string,
        v1,
        v2,
        v1_ee,
        v2_ee,
        validated,
      }
    })

    return NextResponse.json({ characters })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
