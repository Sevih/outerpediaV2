import { existsSync, readdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { PATHS } from '../config';

// ---------------------------------------------------------------------------
// Scan public/images/4-Comics/{EN,JP,KR} and produce comics.json
// ---------------------------------------------------------------------------

const COMICS_DIR = join(process.cwd(), 'public/images/4-Comics');
const LANGS = ['EN', 'JP', 'KR'] as const;

export async function run(): Promise<string> {
  const result: Record<string, string[]> = {};
  let total = 0;

  for (const lang of LANGS) {
    const dir = join(COMICS_DIR, lang);
    if (!existsSync(dir)) {
      result[lang] = [];
      continue;
    }

    result[lang] = readdirSync(dir)
      .filter((f) => f.endsWith('.webp'))
      .map((f) => f.replace('.webp', ''))
      .sort();

    total += result[lang].length;
  }

  const outputPath = join(PATHS.generated, 'comics.json');
  writeFileSync(outputPath, JSON.stringify(result, null, 2));

  return `${total} comics (${LANGS.map((l) => `${l}: ${result[l].length}`).join(', ')})`;
}
