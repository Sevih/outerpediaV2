import { readFile, readdir } from 'fs/promises';
import { join } from 'path';
import type { Character, CharacterIndexMap, CharacterListEntry, CharacterNameToIdMap, CharacterProfile } from '@/types/character';

const CHARS_DIR = join(process.cwd(), 'data/character');
const RECO_DIR = join(process.cwd(), 'data/reco');
const PROFILES_PATH = join(process.cwd(), 'data/character-profiles.json');
const INDEX_PATH = join(process.cwd(), 'data/generated/characters-index.json');
const NAME_TO_ID_PATH = join(process.cwd(), 'data/generated/characters-name-to-id.json');
const LIST_PATH = join(process.cwd(), 'data/generated/characters-list.json');

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

/** Get enriched character list with buff/debuff data for filtering (pre-generated) */
export async function getCharactersForList(): Promise<CharacterListEntry[]> {
  const raw = await readFile(LIST_PATH, 'utf-8');
  return JSON.parse(raw) as CharacterListEntry[];
}

/** Get equipment recommendations for a character by slug (ID) */
export async function getCharacterReco(slug: string): Promise<Record<string, unknown> | null> {
  try {
    const raw = await readFile(join(RECO_DIR, `${slug}.json`), 'utf-8');
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** Get a character's profile (bio, story) by ID */
export async function getCharacterProfile(id: string): Promise<CharacterProfile | null> {
  try {
    const raw = await readFile(PROFILES_PATH, 'utf-8');
    const profiles = JSON.parse(raw) as Record<string, CharacterProfile>;
    return profiles[id] ?? null;
  } catch {
    return null;
  }
}
