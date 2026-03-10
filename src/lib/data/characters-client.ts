import type { CharacterIndex } from '@/types/character';

export const charIndexPromise = import('@data/generated/characters-index.json')
  .then(m => m.default as Record<string, CharacterIndex>);

export const nameToIdPromise = import('@data/generated/characters-name-to-id.json')
  .then(m => m.default as Record<string, string>);

export const slugToIdPromise = import('@data/generated/characters-slug-to-id.json')
  .then(m => m.default as Record<string, string>);
