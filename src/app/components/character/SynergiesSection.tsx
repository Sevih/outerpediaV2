'use client';

import { use } from 'react';
import Link from 'next/link';
import type { CharacterSynergies } from '@/types/character';
import { useI18n } from '@/lib/contexts/I18nContext';
import { l, lRec } from '@/lib/i18n/localize';
import parseText from '@/lib/parse-text';
import CharacterPortrait from './CharacterPortrait';
import { charIndexPromise, slugToIdPromise } from '@/lib/data/characters-client';

type Props = {
  synergies: CharacterSynergies;
};

export default function SynergiesSection({ synergies }: Props) {
  const { lang, t, href } = useI18n();
  const slugToId = use(slugToIdPromise);
  const characters = use(charIndexPromise);

  return (
    <section id="synergies">
      <h2 className="mb-4 text-2xl font-bold">
        {t('page.character.toc.synergies')}
      </h2>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {synergies.partner.map((group, i) => (
          <div
            key={i}
            className="card rounded-xl p-4"
          >
            {/* Partner heroes */}
            <div className="flex flex-wrap gap-3">
              {group.hero.map((entry, j) => {
                if (entry.startsWith('{')) {
                  return (
                    <span key={j} className="flex items-center text-sm">
                      {parseText(entry)}
                    </span>
                  );
                }

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
                    href={href(`/characters/${entry}`)}
                    className="flex items-center gap-2 rounded-lg bg-zinc-800/80 pr-3 transition-colors hover:bg-zinc-700/80"
                  >
                    <CharacterPortrait
                      id={id}
                      name={displayName}
                      size="sm"
                      showIcons
                    />
                    <span className="text-sm font-medium text-zinc-200">
                      {displayName}
                    </span>
                  </Link>
                );
              })}
            </div>

            {/* Reason */}
            <div className="mt-3 border-t border-white/5 pt-3">
              <p className="text-sm leading-relaxed text-zinc-300">
                {parseText(lRec(group.reason, lang) ?? '')}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
