import charIndex from '@data/generated/characters-index.json';
import nameToId from '@data/generated/characters-name-to-id.json';
import type { CharacterIndex } from '@/types/character';
import type { Lang } from '@/lib/i18n/config';
import { l } from '@/lib/i18n/localize';

export const characterIndex = charIndex as Record<string, CharacterIndex>;
export const characterNameToId = nameToId as Record<string, string>;

export function getCharByName(name: string): { id: string; char: CharacterIndex } | undefined {
  const id = characterNameToId[name];
  if (!id) return undefined;
  const char = characterIndex[id];
  if (!char) return undefined;
  return { id, char };
}

export type CharData = {
  id: string;
  char: CharacterIndex;
  localizedName: string;
  slug: string;
};

export function mapNamesToChars(names: string[], lang: Lang): CharData[] {
  return names
    .map(name => {
      const result = getCharByName(name);
      if (!result) return null;
      return {
        ...result,
        localizedName: l(result.char, 'Fullname', lang),
        slug: result.char.slug,
      };
    })
    .filter(Boolean) as CharData[];
}
