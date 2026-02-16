import { readFile, readdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { PATHS } from '../config';
import { SUFFIX_LANGS } from '../../src/lib/i18n/config';

type RawCharacter = {
  ID: string;
  Fullname: string;
  Element: string;
  Class: string;
  Rarity: number;
  role: string;
  Chain_Type: string;
  tags?: string[];
  [key: string]: unknown;
};

export async function run() {
  const files = await readdir(PATHS.characters);
  const jsonFiles = files.filter(f => f.endsWith('.json'));

  const entries = await Promise.all(
    jsonFiles.map(async (file) => {
      const raw = await readFile(join(PATHS.characters, file), 'utf-8');
      const char: RawCharacter = JSON.parse(raw);
      const slug = file.replace('.json', '');

      const entry: Record<string, unknown> = {
        Fullname: char.Fullname,
        slug,
        Element: char.Element,
        Class: char.Class,
        Rarity: char.Rarity,
        role: char.role,
        Chain_Type: char.Chain_Type,
        tags: char.tags ?? [],
      };

      // Add localized Fullname suffixes
      for (const lang of SUFFIX_LANGS) {
        const key = `Fullname_${lang}`;
        const value = char[key];
        if (typeof value === 'string' && value.trim()) {
          entry[key] = value.trim();
        }
      }

      return { id: char.ID, entry, fullname: char.Fullname };
    })
  );

  // Sort by ID for stable output
  entries.sort((a, b) => a.id.localeCompare(b.id));

  // ID-keyed index: { "2000001": { Fullname, slug, Element, ... } }
  const index: Record<string, Record<string, unknown>> = {};
  for (const { id, entry } of entries) {
    index[id] = entry;
  }

  // Reverse map: English Fullname → ID
  const nameToId: Record<string, string> = {};
  for (const { id, fullname } of entries) {
    nameToId[fullname] = id;
  }

  const indexPath = join(PATHS.generated, 'characters-index.json');
  const namePath = join(PATHS.generated, 'characters-name-to-id.json');

  await Promise.all([
    writeFile(indexPath, JSON.stringify(index, null, 2)),
    writeFile(namePath, JSON.stringify(nameToId, null, 2)),
  ]);

  console.log(`  Generated ${entries.length} characters → ${indexPath}`);
  console.log(`  Generated name→id map → ${namePath}`);
}
