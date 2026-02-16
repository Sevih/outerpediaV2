import { readFile, readdir } from 'fs/promises';
import { join } from 'path';
import type { Character, CharacterIndexMap, CharacterNameToIdMap } from '@/types/character';

const CHARS_DIR = join(process.cwd(), 'data/character');
const INDEX_PATH = join(process.cwd(), 'data/generated/characters-index.json');
const NAME_TO_ID_PATH = join(process.cwd(), 'data/generated/characters-name-to-id.json');

/** Get a single character by slug */
export async function getCharacter(slug: string): Promise<Character | null> {
  try {
    const raw = await readFile(join(CHARS_DIR, `${slug}.json`), 'utf-8');
    return JSON.parse(raw) as Character;
  } catch {
    return null;
  }
}

/** Get all character slugs */
export async function getCharacterSlugs(): Promise<string[]> {
  const files = await readdir(CHARS_DIR);
  return files
    .filter(f => f.endsWith('.json'))
    .map(f => f.replace('.json', ''));
}

/** Get the ID-keyed character index */
export async function getCharacterIndex(): Promise<CharacterIndexMap> {
  const raw = await readFile(INDEX_PATH, 'utf-8');
  return JSON.parse(raw) as CharacterIndexMap;
}

/** Get the English Fullname → ID reverse map */
export async function getCharacterNameToId(): Promise<CharacterNameToIdMap> {
  const raw = await readFile(NAME_TO_ID_PATH, 'utf-8');
  return JSON.parse(raw) as CharacterNameToIdMap;
}
