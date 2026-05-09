import fs from 'fs'
import path from 'path'
import { execFileSync } from 'child_process'
import sharp from 'sharp'

// Build the square FaceIcon used in formation/inventory/etc by applying the
// per-character RectTransform layout from the FaceIcon prefab bundle to the
// portrait already on disk. Coordinates come from
// data/admin/face-icon-layout.json (extracted via extract_face_icons.py).

interface FaceIconVariant {
  frame: { w: number; h: number }
  character: { x: number; y: number; w: number; h: number; scale: [number, number] }
}
type FaceIconLayout = Record<string, Record<string, FaceIconVariant>>

const PORTRAIT_DIR = path.join(process.cwd(), 'public', 'images', 'characters', 'portrait')
const FACEICON_DIR = path.join(process.cwd(), 'public', 'images', 'characters', 'faceicon')
const LAYOUT_PATH = path.join(process.cwd(), 'data', 'admin', 'face-icon-layout.json')
const EXTRACTOR_SCRIPT = path.join(process.cwd(), 'datamine', 'ParserV3', 'extract_face_icons.py')

const PORTRAIT_EXTS = ['webp', 'png'] as const

export type FaceIconResult = 'generated' | 'exists' | 'no-portrait' | 'no-layout'

function findPortrait(id: string): string | null {
  for (const ext of PORTRAIT_EXTS) {
    const p = path.join(PORTRAIT_DIR, `CT_${id}.${ext}`)
    if (fs.existsSync(p)) return p
  }
  return null
}

function loadLayout(): FaceIconLayout {
  try { return JSON.parse(fs.readFileSync(LAYOUT_PATH, 'utf-8')) }
  catch { return {} }
}

function refreshLayout(id: string): FaceIconLayout {
  // Pull fresh prefab data for this id from the Unity bundle, persisting to
  // the shared cache. Silently swallows failures (bundle may not be local).
  try {
    execFileSync('python', [EXTRACTOR_SCRIPT, id], { cwd: process.cwd(), stdio: 'pipe' })
  } catch {
    /* fall through with stale layout */
  }
  return loadLayout()
}

export async function generateFaceIcon(id: string): Promise<FaceIconResult> {
  const dest = path.join(FACEICON_DIR, `FI_${id}.png`)
  if (fs.existsSync(dest)) return 'exists'

  const portraitPath = findPortrait(id)
  if (!portraitPath) return 'no-portrait'

  let layout = loadLayout()
  let spec = layout[id]?.Thumbnail
  if (!spec) {
    layout = refreshLayout(id)
    spec = layout[id]?.Thumbnail
  }
  if (!spec) return 'no-layout'

  const fw = Math.round(spec.frame.w)
  const fh = Math.round(spec.frame.h)
  const cw = Math.max(1, Math.round(spec.character.w * spec.character.scale[0]))
  const ch = Math.max(1, Math.round(spec.character.h * spec.character.scale[1]))
  // Frame center + Unity offset, with Y flipped for image coords.
  const left = Math.round(fw / 2 + spec.character.x - cw / 2)
  const top = Math.round(fh / 2 - spec.character.y - ch / 2)

  // Visible window of the resized portrait inside the frame mask.
  const visLeft = Math.max(0, left)
  const visTop = Math.max(0, top)
  const visRight = Math.min(fw, left + cw)
  const visBottom = Math.min(fh, top + ch)
  const visW = visRight - visLeft
  const visH = visBottom - visTop
  if (visW <= 0 || visH <= 0) return 'no-layout'

  const portraitClip = await sharp(portraitPath)
    .resize(cw, ch, { fit: 'fill', kernel: 'lanczos3' })
    .extract({ left: visLeft - left, top: visTop - top, width: visW, height: visH })
    .toBuffer()

  fs.mkdirSync(path.dirname(dest), { recursive: true })
  await sharp({
    create: { width: fw, height: fh, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([{ input: portraitClip, left: visLeft, top: visTop }])
    .png()
    .toFile(dest)

  return 'generated'
}
