'use client';

import { useCallback, useState } from 'react';
import GuideTemplate from '@/app/components/guides/GuideTemplate';
import Tabs from '@/app/components/ui/Tabs';
import { useI18n } from '@/lib/contexts/I18nContext';
import { lRec } from '@/lib/i18n/localize';
import type { LangMap } from '@/types/common';

import {
  LABELS,
  CategoryOverviewSection,
  HowItWorksSection,
  PrioritySection,
  EarlyGameExampleSection,
  FAQSection,
} from './helpers';

const TAB_KEYS = ['guide', 'faq'] as const;
type TabKey = typeof TAB_KEYS[number];

const TAB_LABELS: Record<TabKey, LangMap> = {
  guide: { en: 'Guide', jp: 'ガイド', kr: '가이드', zh: '指南' },
  faq: LABELS.faq,
};

export default function QuirkGuide() {
  const { lang } = useI18n();
  const [tab, setTab] = useState<TabKey>('guide');
  const onChange = useCallback((v: string) => setTab(v as TabKey), []);

  const intro = lRec(LABELS.introP1, lang) + '\n' + lRec(LABELS.introP2, lang);

  return (
    <GuideTemplate
      title={lRec(LABELS.title, lang)}
      introduction={intro}
    >
      <Tabs
        items={[...TAB_KEYS]}
        labels={TAB_KEYS.map(k => lRec(TAB_LABELS[k], lang))}
        value={tab}
        onChange={onChange}
        hashPrefix="tab"
        className="justify-center"
      />

      <div className="mt-6 space-y-8">
        {tab === 'guide' && <>
          <section>
            <h2>{lRec(LABELS.categoryOverview, lang)}</h2>
            <CategoryOverviewSection lang={lang} />
          </section>

          <section>
            <h2>{lRec(LABELS.howItWorks, lang)}</h2>
            <HowItWorksSection lang={lang} />
          </section>

          <section>
            <h2>{lRec(LABELS.upgradingPriority, lang)}</h2>
            <PrioritySection lang={lang} />
            <div className="mt-6">
              <h4>{lRec(LABELS.earlyGameExample, lang)}</h4>
              <EarlyGameExampleSection lang={lang} />
            </div>
          </section>
        </>}

        {tab === 'faq' && <FAQSection lang={lang} />}
      </div>
    </GuideTemplate>
  );
}
