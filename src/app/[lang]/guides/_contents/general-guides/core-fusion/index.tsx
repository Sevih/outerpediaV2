'use client';

import { useMemo } from 'react';
import GuideTemplate from '@/app/components/guides/GuideTemplate';
import { useI18n } from '@/lib/contexts/I18nContext';
import { lRec } from '@/lib/i18n/localize';
import type { LangMap } from '@/types/common';
import DATA from '@data/core_fusion_data.json';

import {
  type HeroReview,
  LABELS,
  UnlockPrioritySection,
  HeroCard,
} from './helpers';

const heading: LangMap = {
  en: 'Core Fusion',
  jp: 'コアフュージョン',
  kr: '코어 퓨전',
  zh: '核心融合',
};

export default function CoreFusionGuide() {
  const { lang } = useI18n();

  const entries = useMemo(() => {
    const list = DATA as HeroReview[];
    return [...list].sort((a, b) => a.name.localeCompare(b.name));
  }, []);

  return (
    <GuideTemplate
      title={lRec(heading, lang)}
      introduction={lRec(LABELS.intro, lang)}
    >
      <UnlockPrioritySection lang={lang} />

      {entries.length === 0 ? (
        <div className="rounded-md border border-neutral-700 p-6 text-sm text-neutral-300">
          {lRec(LABELS.noEntries, lang)}
        </div>
      ) : (
        <div className="grid gap-6">
          {entries.map((h) => (
            <HeroCard key={h.name} h={h} lang={lang} />
          ))}
        </div>
      )}
    </GuideTemplate>
  );
}
