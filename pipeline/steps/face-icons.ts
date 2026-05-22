import { existsSync, readdirSync } from 'fs';
import { join } from 'path';
import { PATHS } from '../config';

// Build the square FaceIcon (FI_<id>.png) for every character/skin portrait on
// disk, reusing the extractor route's logic. Runs after character-skins so any
// freshly-copied skin portrait (CT_<modelNameID>.png) also gets its face icon.
//
// Generation derives the crop from the per-character RectTransform layout in
// `data/admin/face-icon-layout.json`. Ids missing from the layout are pulled
// from the Unity bundle via the datamine python extractor. With neither source
// present (typical prod deploy), nothing new can be produced — the committed
// FI_*.png already ship — so the step skips cleanly.
//
// The generator itself lives under the admin API tree, which is excluded from
// build/prod deploys, so it is imported lazily (after the guards) and the step
// skips gracefully when the module is absent.
type FaceIconResult = 'generated' | 'exists' | 'no-portrait' | 'no-layout';

const PORTRAIT_DIR = PATHS.images.characters.portrait;
const LAYOUT_PATH = join(PATHS.adminJson2, '..', 'face-icon-layout.json');
const EXTRACTOR_SCRIPT = join(
  PATHS.datamineFiles, '..', 'ParserV3', 'extract_face_icons.py'
);
const GENERATOR_MODULE = join(
  process.cwd(), 'src', 'app', 'api', 'admin', 'extractor-v3', '_shared', 'face-icon.ts'
);

function listCharacterIds(): string[] {
  const ids = new Set<string>();
  for (const f of readdirSync(PORTRAIT_DIR)) {
    const m = f.match(/^CT_(\d+)\.(webp|png)$/i);
    if (m) ids.add(m[1]);
  }
  return [...ids].sort();
}

export async function run(): Promise<string> {
  // Graceful skips on the no-datamine / build path (in source-availability order).
  if (!existsSync(LAYOUT_PATH) && !existsSync(EXTRACTOR_SCRIPT)) {
    return 'skipped (no layout / no datamine)';
  }
  if (!existsSync(PORTRAIT_DIR)) {
    return 'skipped (no portraits)';
  }
  if (!existsSync(GENERATOR_MODULE)) {
    return 'skipped (no generator module)';
  }

  // Lazy load: the module (and its sharp dep) may be absent on build/prod.
  let generateFaceIcon: (id: string) => Promise<FaceIconResult>;
  try {
    ({ generateFaceIcon } = (await import(
      '../../src/app/api/admin/extractor-v3/_shared/face-icon'
    )) as { generateFaceIcon: (id: string) => Promise<FaceIconResult> });
  } catch {
    return 'skipped (generator unavailable)';
  }

  const ids = listCharacterIds();
  const counts: Record<FaceIconResult, number> = {
    generated: 0,
    exists: 0,
    'no-portrait': 0,
    'no-layout': 0,
  };

  for (const id of ids) {
    counts[await generateFaceIcon(id)]++;
  }

  if (counts.generated === 0) {
    return `up to date (${counts.exists} icons)`;
  }

  const noLayout = counts['no-layout'] ? `, ${counts['no-layout']} no-layout` : '';
  return `${counts.generated} generated, ${counts.exists} existing${noLayout}`;
}
