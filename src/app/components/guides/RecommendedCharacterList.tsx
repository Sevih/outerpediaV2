'use client';

import { use } from 'react';
import Link from 'next/link';
import { useI18n } from '@/lib/contexts/I18nContext';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { l, lRec } from '@/lib/i18n/localize';
import parseText from '@/lib/parse-text';
import CharacterPortrait from '@/app/components/character/CharacterPortrait';
import { charIndexPromise, nameToIdPromise } from '@/lib/data/characters-client';
import type { LangMap } from '@/types/common';
import type { TranslationKey } from '@/i18n/locales/en';

type TitlePreset = 'default' | 'phase1' | 'phase2';

const PRESET_KEYS: Record<TitlePreset, TranslationKey> = {
  default: 'guides.recommended.title',
  phase1: 'guides.recommended.phase1',
  phase2: 'guides.recommended.phase2',
};

export type CharacterRecommendation = {
  names: string[];
  reason: string | LangMap;
};

type Props = {
  title?: TitlePreset | LangMap | false;
  entries: CharacterRecommendation[];
  /** When true, names[] contains character IDs instead of character names */
  idMode?: boolean;
};

export default function RecommendedCharacterList({
  title = 'default',
  entries,
  idMode = false,
}: Props) {
  const { lang, t, href } = useI18n();
  const nameMap = use(nameToIdPromise);
  const indexMap = use(charIndexPromise);
  const isDesktop = useMediaQuery('(min-width: 640px)');
  const portraitSize = isDesktop ? 'md' : 'sm';

  function resolveTitle(): string | null {
    if (title === false) return null;
    if (typeof title === 'string' && title in PRESET_KEYS) {
      return t(PRESET_KEYS[title as TitlePreset]);
    }
    if (typeof title === 'object') return lRec(title, lang);
    return t(PRESET_KEYS.default);
  }

  const heading = resolveTitle();

  return (
    <div className="space-y-4">
      {heading && (
        <h3>{heading}</h3>
      )}

      <div className="space-y-3">
        {entries.map((entry, i) => {
          const reason = typeof entry.reason === 'string'
            ? entry.reason
            : lRec(entry.reason, lang);

          const chars = entry.names.map((name) => {
            const charId = idMode ? name : nameMap[name];
            if (!charId) return null;
            const charData = indexMap[charId];
            const localizedName = charData ? l(charData, 'Fullname', lang) : name;
            const slug = (charData?.slug as string) ?? name.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
            return { name, charId, localizedName, slug };
          }).filter(Boolean) as { name: string; charId: string; localizedName: string; slug: string }[];

          return (
            <div
              key={i}
              className="card grid grid-cols-[auto_1fr] items-center gap-3 p-3"
            >
              {/* Character portraits — max 3 per row */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                {chars.map((c) => (
                  <Link key={c.name} href={href(`/characters/${c.slug}`)}>
                    <CharacterPortrait
                      id={c.charId}
                      name={c.localizedName}
                      size={portraitSize}
                      showIcons
                      className="transition-transform hover:scale-105"
                    />
                  </Link>
                ))}
              </div>

              {/* Names + reason */}
              <div>
                <p className="text-sm font-semibold text-cyan-300">
                  {chars.map((c, ci) => (
                    <span key={c.name}>
                      {ci > 0 && ', '}
                      <Link href={href(`/characters/${c.slug}`)} className="hover:underline">
                        {c.localizedName}
                      </Link>
                    </span>
                  ))}
                </p>
                <p className="text-sm leading-relaxed text-zinc-300">
                  {parseText(reason)}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
