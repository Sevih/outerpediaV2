'use client';

import Link from 'next/link';
import type { CharacterSynergies } from '@/types/character';
import type { CharacterIndex } from '@/types/character';
import { useI18n } from '@/lib/contexts/I18nContext';
import { l, lRec } from '@/lib/i18n/localize';
import parseText from '@/lib/parse-text';
import CharacterPortrait from './CharacterPortrait';
import slugToIdMap from '@data/generated/characters-slug-to-id.json';
import charIndex from '@data/generated/characters-index.json';

const slugToId = slugToIdMap as Record<string, string>;
const characters = charIndex as Record<string, CharacterIndex>;

type Props = {
  synergies: CharacterSynergies;
};

export default function SynergiesSection({ synergies }: Props) {
  const { lang, t } = useI18n();

  return (
    <section id="synergies">
      <h2 className="mb-4 text-2xl font-bold">
        {t('page.character.toc.synergies')}
      </h2>

      <div className="space-y-3">
        {synergies.partner.map((group, i) => (
          <div
            key={i}
            className="flex flex-col gap-3 rounded-xl border border-white/10 bg-zinc-900/60 p-4 sm:flex-row sm:items-start sm:gap-4"
          >
            {/* Partner heroes */}
            <div className="flex shrink-0 flex-wrap gap-2">
              {group.hero.map((entry, j) => {
                // Inline tag (e.g. {C/Mage}) — render via parseText
                if (entry.startsWith('{')) {
                  return (
                    <span key={j} className="flex items-center text-sm">
                      {parseText(entry)}
                    </span>
                  );
                }

                // Regular character slug
                const id = slugToId[entry];
                const char = id ? characters[id] : null;

                if (!char || !id) {
                  return (
                    <span key={j} className="text-sm text-red-400">{entry}</span>
                  );
                }

                const displayName = l(char, 'Fullname', lang);

                return (
                  <Link
                    key={j}
                    href={`/${lang}/characters/${entry}`}
                    className="flex items-center gap-1.5 rounded-lg bg-zinc-800/80 px-2 py-1 transition-colors hover:bg-zinc-700/80"
                  >
                    <CharacterPortrait id={id} name={displayName} size="xs" />
                    <span className="text-sm font-medium text-zinc-200">
                      {displayName}
                    </span>
                  </Link>
                );
              })}
            </div>

            {/* Reason */}
            <p className="text-sm leading-relaxed text-zinc-400">
              {parseText(lRec(group.reason, lang) ?? '')}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
