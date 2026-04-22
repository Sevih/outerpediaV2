import nameSplits from '@data/name-splits.json';
import type { Lang } from '@/lib/i18n/config';

type NameParts = { prefix: string; name: string } | { prefix: null; name: string };

const splits = nameSplits as Record<string, Partial<Record<Exclude<Lang, 'en'>, string>>>;

/**
 * Split a character's localized fullname into prefix (title) and base name.
 * Scans known prefixes from name-splits.json and picks the longest match.
 * Returns { prefix, name } if the fullname starts with a known prefix, otherwise { prefix: null, name }.
 */
export function splitCharacterName(fullname: string, lang: Lang): NameParts {
  let best: { prefix: string; name: string } | null = null;

  for (const [enPrefix, translations] of Object.entries(splits)) {
    const prefix = lang === 'en' ? enPrefix : (translations[lang] || enPrefix);

    let name: string | null = null;
    if (fullname.startsWith(prefix + ' ')) {
      name = fullname.slice(prefix.length + 1);
    } else if (fullname.startsWith(prefix)) {
      const rest = fullname.slice(prefix.length).trim();
      if (rest) name = rest;
    }

    if (name && (!best || prefix.length > best.prefix.length)) {
      best = { prefix, name };
    }
  }

  return best ?? { prefix: null, name: fullname };
}
