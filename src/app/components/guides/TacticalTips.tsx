'use client';

import { useI18n } from '@/lib/contexts/I18nContext';
import { lRec } from '@/lib/i18n/localize';
import parseText from '@/lib/parse-text';
import type { LangMap } from '@/types/common';
import type { TranslationKey } from '@/i18n/locales/en';

const TITLE_PRESETS = [
  'tactical', 'strategy', 'general', 'important', 'mechanics', 'phase1', 'phase2',
] as const;

type TitlePreset = (typeof TITLE_PRESETS)[number];

type TipSection = {
  title: TitlePreset | LangMap;
  tips: (string | LangMap)[];
};

type Props = {
  sections: TipSection[];
};

function isPreset(v: TitlePreset | LangMap): v is TitlePreset {
  return typeof v === 'string' && (TITLE_PRESETS as readonly string[]).includes(v);
}

export default function TacticalTips({ sections }: Props) {
  const { lang, t } = useI18n();

  function resolveTitle(title: TitlePreset | LangMap): string {
    if (isPreset(title)) {
      return t(`guides.tips.${title}` as TranslationKey);
    }
    return lRec(title, lang);
  }

  function resolveTip(tip: string | LangMap): string {
    return typeof tip === 'string' ? tip : lRec(tip, lang);
  }

  return (
    <div className="space-y-6">
      {sections.map((section, si) => (
        <div
          key={si}
          className="rounded-lg border border-sky-500/30 bg-sky-950/20 p-4"
        >
          <h4 className="mb-3 flex items-center gap-2">
            <svg className="h-5 w-5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 2a6 6 0 00-2 11.66V16a2 2 0 104 0v-2.34A6 6 0 0010 2zm0 2a4 4 0 011.54 7.69.75.75 0 00-.54.72V14H9v-1.59a.75.75 0 00-.54-.72A4 4 0 0110 4z" />
            </svg>
            {resolveTitle(section.title)}
          </h4>
          <ul className="space-y-2">
            {section.tips.map((tip, ti) => (
              <li key={ti} className="flex gap-2 text-sm leading-relaxed text-zinc-300">
                <span className="mt-1 text-sky-400">&#x2022;</span>
                <span>{parseText(resolveTip(tip))}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
