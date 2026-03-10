'use client';

import { useCallback, useMemo, useState } from 'react';
import Image from 'next/image';
import GuideTemplate from '@/app/components/guides/GuideTemplate';
import Tabs from '@/app/components/ui/Tabs';
import { useI18n } from '@/lib/contexts/I18nContext';
import { lRec } from '@/lib/i18n/localize';
import type { LangMap } from '@/types/common';
import DATA from '@data/premium_limited_data.json';

import {
  type TabKey,
  type PremiumLimitedData,
  TAB_CONFIG,
  LABELS,
  PremiumPullingOrder,
  HeroCard,
} from './helpers';

const TAB_KEYS: TabKey[] = TAB_CONFIG.map(t => t.key);

const heading: LangMap = { en: "Premium & Limited", jp: "プレミアム＆限定", kr: "프리미엄 & 한정", zh: "高级与限定" };

export default function PremiumLimitedGuide() {
  const { lang } = useI18n();
  const [selected, setSelected] = useState<TabKey>('Premium');
  const onChange = useCallback((v: string) => setSelected(v as TabKey), []);

  const entries = useMemo(() => {
    const list = (DATA as PremiumLimitedData)[selected] ?? [];
    return [...list].sort((a, b) => a.name.localeCompare(b.name));
  }, [selected]);

  const tabLabels = TAB_CONFIG.map((tab) => (
    <span key={tab.key} className="flex items-center gap-2">
      <Image src={tab.icon} alt={tab.key} width={24} height={24} className="object-contain" />
      {tab.key}
    </span>
  ));

  return (
    <GuideTemplate
      title={lRec(heading, lang)}
      introduction={lRec(LABELS.intro, lang)}
    >
      <Tabs
        items={TAB_KEYS}
        labels={tabLabels}
        value={selected}
        onChange={onChange}
        hashPrefix="tab"
        className="justify-center"
      />

      {selected === 'Premium' && <PremiumPullingOrder lang={lang} />}

      {entries.length === 0 ? (
        <div className="rounded-md border border-neutral-700 p-6 text-sm text-neutral-300">
          {lRec(LABELS.noEntries, lang).replace('{tab}', selected)}
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
