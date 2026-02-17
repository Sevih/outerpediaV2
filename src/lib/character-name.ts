import nameSplits from '@data/name-splits.json';
import type { Lang } from '@/lib/i18n/config';

type NameParts = { prefix: string; name: string } | { prefix: null; name: string };

const splits = nameSplits as Record<string, Record<Lang, string>>;

/**
 * Split a character's localized fullname into prefix (title) and base name.
 * Uses the official ShowNickName data from the datamine.
 * Returns { prefix, name } if the character has a displayed title, otherwise { prefix: null, name }.
 */
export function splitCharacterName(id: string, fullname: string, lang: Lang): NameParts {
  const entry = splits[id];
  if (!entry) return { prefix: null, name: fullname };

  const prefix = entry[lang] || entry.en;
  if (!prefix) return { prefix: null, name: fullname };

  // Strip prefix from fullname — handle "Prefix Name" (space) and "PrefixName" (no space, JP/ZH)
  if (fullname.startsWith(prefix + ' ')) {
    return { prefix, name: fullname.slice(prefix.length + 1) };
  }
  if (fullname.startsWith(prefix)) {
    const rest = fullname.slice(prefix.length).trim();
    if (rest) return { prefix, name: rest };
  }

  // Fallback: can't split, return full name
  return { prefix: null, name: fullname };
}
