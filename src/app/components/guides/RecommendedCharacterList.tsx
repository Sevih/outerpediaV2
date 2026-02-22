'use client';

import Link from 'next/link';
import { useI18n } from '@/lib/contexts/I18nContext';
import { l, lRec } from '@/lib/i18n/localize';
import parseText from '@/lib/parse-text';
import CharacterPortrait from '@/app/components/character/CharacterPortrait';
import nameToId from '@data/generated/characters-name-to-id.json';
import charIndex from '@data/generated/characters-index.json';
import type { LangMap } from '@/types/common';
import type { TranslationKey } from '@/i18n/locales/en';

const nameMap = nameToId as Record<string, string>;
const indexMap = charIndex as Record<string, Record<string, unknown>>;

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
};

export default function RecommendedCharacterList({
  title = 'default',
  entries,
}: Props) {
  const { lang, t } = useI18n();

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
            const charId = nameMap[name];
            if (!charId) return null;
            const entry = indexMap[charId];
            const localizedName = entry ? l(entry, 'Fullname', lang) : name;
            const slug = (entry?.slug as string) ?? name.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
            return { name, charId, localizedName, slug };
          }).filter(Boolean) as { name: string; charId: string; localizedName: string; slug: string }[];

          return (
            <div
              key={i}
              className="grid grid-cols-[auto_1fr] items-center gap-3 rounded-lg border border-white/5 bg-neutral-900/50 p-3"
            >
              {/* Character portraits — max 3 per row */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                {chars.map((c) => (
                  <Link key={c.name} href={`/${lang}/characters/${c.slug}`}>
                    <CharacterPortrait
                      id={c.charId}
                      name={c.localizedName}
                      size="sm"
                      showIcons
                      className="sm:h-16 sm:w-16 transition-transform hover:scale-105"
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
                      <Link href={`/${lang}/characters/${c.slug}`} className="hover:underline">
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
