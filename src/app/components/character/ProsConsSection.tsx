'use client';

import type { CharacterProsCons } from '@/types/character';
import { useI18n } from '@/lib/contexts/I18nContext';
import { lRec } from '@/lib/i18n/localize';
import parseText from '@/lib/parse-text';

type Props = {
  prosCons: CharacterProsCons;
};

export default function ProsConsSection({ prosCons }: Props) {
  const { lang, t } = useI18n();

  const { pros, cons } = prosCons;
  if (!pros.length && !cons.length) return null;

  return (
    <section id="pros-cons">
      <h2 className="mb-4 text-2xl font-bold">{t('page.character.toc.pros_cons')}</h2>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Pros */}
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/20 p-4">
          <h3 className="mb-3 text-lg font-semibold text-emerald-400 after:hidden">
            {t('page.character.pros')}
          </h3>
          {pros.length > 0 ? (
            <ul className="space-y-2">
              {pros.map((entry, i) => (
                <li key={i} className="flex gap-2 text-sm leading-relaxed text-zinc-300">
                  <span className="mt-0.5 shrink-0 text-emerald-400">+</span>
                  <span>{parseText(lRec(entry, lang) ?? '')}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm italic text-zinc-500">—</p>
          )}
        </div>

        {/* Cons */}
        <div className="rounded-xl border border-red-500/20 bg-red-950/20 p-4">
          <h3 className="mb-3 text-lg font-semibold text-red-400 after:hidden">
            {t('page.character.cons')}
          </h3>
          {cons.length > 0 ? (
            <ul className="space-y-2">
              {cons.map((entry, i) => (
                <li key={i} className="flex gap-2 text-sm leading-relaxed text-zinc-300">
                  <span className="mt-0.5 shrink-0 text-red-400">−</span>
                  <span>{parseText(lRec(entry, lang) ?? '')}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm italic text-zinc-500">—</p>
          )}
        </div>
      </div>
    </section>
  );
}
