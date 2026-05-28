'use client';

import { useState } from 'react';
import type { CharacterProsCons } from '@/types/character';
import { useI18n } from '@/lib/contexts/I18nContext';
import { lRec } from '@/lib/i18n/localize';
import parseText from '@/lib/parse-text';

type Props = {
  prosCons: CharacterProsCons;
};

const COLLAPSED_COUNT = 4;

function Side({
  label,
  items,
  tone,
  sign,
  lang,
}: {
  label: string;
  items: CharacterProsCons['pros'];
  tone: string;
  sign: string;
  lang: ReturnType<typeof useI18n>['lang'];
}) {
  return (
    <div>
      <div className={`mb-2.5 font-mono text-[10px] font-semibold tracking-[0.2em] uppercase ${tone}`}>{label}</div>
      {items.length > 0 ? (
        <ul className="flex flex-col gap-1.5">
          {items.map((entry, i) => (
            <li key={i} className="grid grid-cols-[16px_1fr] gap-1.5 text-[13px] leading-snug text-zinc-300">
              <span className={`font-mono text-sm font-bold ${tone}`}>{sign}</span>
              <span className="first-letter:uppercase">{parseText(lRec(entry, lang) ?? '')}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm italic text-zinc-500">—</p>
      )}
    </div>
  );
}

export default function ProsConsSection({ prosCons }: Props) {
  const { lang, t } = useI18n();
  const [expanded, setExpanded] = useState(false);
  const { pros, cons } = prosCons;
  if (!pros.length && !cons.length) return null;

  const hidden =
    Math.max(0, pros.length - COLLAPSED_COUNT) + Math.max(0, cons.length - COLLAPSED_COUNT);
  const shownPros = expanded ? pros : pros.slice(0, COLLAPSED_COUNT);
  const shownCons = expanded ? cons : cons.slice(0, COLLAPSED_COUNT);

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-x-10 gap-y-5 md:grid-cols-2">
        <Side label={t('page.character.pros')} items={shownPros} tone="text-emerald-400" sign="+" lang={lang} />
        <Side label={t('page.character.cons')} items={shownCons} tone="text-red-400" sign="−" lang={lang} />
      </div>

      {hidden > 0 && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mx-auto inline-flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1 text-xs text-zinc-400 transition-colors hover:bg-white/5 hover:text-zinc-200"
        >
          {expanded
            ? t('page.character.pros_cons.show_less')
            : t('page.character.pros_cons.show_more', { count: String(hidden) })}
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`h-3.5 w-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`}
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
      )}
    </div>
  );
}
