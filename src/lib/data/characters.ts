import { readFile, readdir } from 'fs/promises';
import { join } from 'path';
import type { Character, CharacterIndex } from '@/types/character';

const CHARS_DIR = join(process.cwd(), 'data/character');
const INDEX_PATH = join(process.cwd(), 'data/generated/characters-index.json');

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

/** Get the character index (lightweight list for filtering/listing) */
export async function getCharacterIndex(): Promise<CharacterIndex[]> {
  const raw = await readFile(INDEX_PATH, 'utf-8');
  return JSON.parse(raw) as CharacterIndex[];
}
