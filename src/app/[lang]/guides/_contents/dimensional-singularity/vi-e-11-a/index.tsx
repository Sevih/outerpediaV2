'use client';

import GuideTemplate from '@/app/components/guides/GuideTemplate';
import BossDisplay from '@/app/components/guides/BossDisplay';
import { useI18n } from '@/lib/contexts/I18nContext';
import { lRec } from '@/lib/i18n/localize';
import type { Boss } from '@/types/boss';
import type { LangMap } from '@/types/common';

import strings from './strings.json';
import boss60000009 from '@data/boss/60000009.json';

const STRINGS = strings as Record<string, LangMap>;

const preloadedBosses: Record<string, Boss> = {
  '60000009': boss60000009 as unknown as Boss,
};

export default function VIE11AGuide() {
  const { lang } = useI18n();

  return (
    <GuideTemplate
      title={lRec(STRINGS.title, lang)}
      introduction={lRec(STRINGS.intro, lang)}
      updating
    >
      <BossDisplay
        bossName="VI=E-11-A"
        modeKey="Dimensional Singularity"
        defaultBossId="60000009"
        preloadedBosses={preloadedBosses}
      />
    </GuideTemplate>
  );
}
