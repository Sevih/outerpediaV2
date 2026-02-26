'use client';

import Link from 'next/link';
import CharacterPortrait from '@/app/components/character/CharacterPortrait';
import { useI18n } from '@/lib/contexts/I18nContext';
import type { Lang } from '@/lib/i18n/config';
import { renderWithLineBreaks } from '@/lib/format-text';
import { characterIndex as characters, mapNamesToChars, type CharData } from '@/lib/character-client';
import { freeHeroesSources, customBannerPicks } from './recommendedCharacters';

export { renderWithLineBreaks, mapNamesToChars };
export type { CharData };

// Set of free hero names for quick lookup
export const freeHeroNames = new Set(
  freeHeroesSources.flatMap(source =>
    source.entries.flatMap(entry => entry.names)
  )
);

// Set of custom banner hero names
export const customBannerNames = new Set(
  customBannerPicks.flatMap(entry => entry.names)
);

// Flattened entries for free heroes table
export const flattenedFreeHeroesEntries = freeHeroesSources.flatMap(source =>
  source.entries.map(entry => ({
    source: source.source,
    names: entry.names,
    reason: entry.reason,
    pickType: entry.pickType,
  }))
);

// Get heroes not yet in custom banner (too recent)
export function getNotInCustomBannerChars(lang: Lang): CharData[] {
  const eligibleNames = Object.entries(characters)
    .filter(([, c]) => c.Rarity === 3)
    .filter(([, c]) => !c.tags.includes('limited'))
    .filter(([, c]) => !c.tags.includes('seasonal'))
    .filter(([, c]) => !c.tags.includes('collab'))
    .filter(([, c]) => !c.tags.includes('premium'))
    .filter(([, c]) => !c.Fullname.startsWith('Core Fusion'))
    .filter(([, c]) => !customBannerNames.has(c.Fullname))
    .filter(([, c]) => !freeHeroNames.has(c.Fullname))
    .map(([, c]) => c.Fullname);
  return mapNamesToChars(eligibleNames, lang);
}

export function CharacterGrid({ characters: chars, cols = 3 }: { characters: CharData[]; cols?: number }) {
  const { href } = useI18n();
  return (
    <div className={`grid grid-cols-1 sm:grid-cols-${cols} gap-1 w-fit`}>
      {chars.map(({ id, localizedName, slug }) => (
        <Link
          key={id}
          href={href(`/characters/${slug}`)}
          className="relative hover:z-10 transition-transform hover:scale-105 mr-0.5"
          title={localizedName}
        >
          <CharacterPortrait id={id} name={localizedName} size="sm" showIcons />
        </Link>
      ))}
    </div>
  );
}
