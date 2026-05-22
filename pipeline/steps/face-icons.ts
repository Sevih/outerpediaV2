import { existsSync, readdirSync } from 'fs';
import { join } from 'path';
import { PATHS } from '../config';
import {
  generateFaceIcon,
  type FaceIconResult,
} from '../../src/app/api/admin/extractor-v3/_shared/face-icon';

// Build the square FaceIcon (FI_<id>.png) for every character/skin portrait on
// disk, reusing the extractor route's logic. Runs after character-skins so any
// freshly-copied skin portrait (CT_<modelNameID>.png) also gets its face icon.
//
// Generation derives the crop from the per-character RectTransform layout in
// `data/admin/face-icon-layout.json`. Ids missing from the layout are pulled
// from the Unity bundle via the datamine python extractor. With neither source
// present (typical prod deploy), nothing new can be produced — the committed
// FI_*.png already ship — so the step skips cleanly.
const PORTRAIT_DIR = PATHS.images.characters.portrait;
const LAYOUT_PATH = join(PATHS.adminJson2, '..', 'face-icon-layout.json');
const EXTRACTOR_SCRIPT = join(
  PATHS.datamineFiles, '..', 'ParserV3', 'extract_face_icons.py'
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
  // Graceful skip on the no-datamine path: a *new* icon needs either the
  // committed layout table or the datamine extractor to derive its crop.
  if (!existsSync(LAYOUT_PATH) && !existsSync(EXTRACTOR_SCRIPT)) {
    return 'skipped (no layout / no datamine)';
  }
  if (!existsSync(PORTRAIT_DIR)) {
    return 'skipped (no portraits)';
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
