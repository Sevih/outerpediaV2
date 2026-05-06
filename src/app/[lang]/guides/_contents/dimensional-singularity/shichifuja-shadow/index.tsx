'use client';

import GuideTemplate from '@/app/components/guides/GuideTemplate';
import BossDisplay from '@/app/components/guides/BossDisplay';
import { useI18n } from '@/lib/contexts/I18nContext';
import { lRec } from '@/lib/i18n/localize';
import type { Boss } from '@/types/boss';
import type { LangMap } from '@/types/common';

import strings from './strings.json';
import boss60000008 from '@data/boss/60000008.json';

const STRINGS = strings as Record<string, LangMap>;

const preloadedBosses: Record<string, Boss> = {
  '60000008': boss60000008 as unknown as Boss,
};

export default function ShichifujaShadowGuide() {
  const { lang } = useI18n();

  return (
    <GuideTemplate
      title={lRec(STRINGS.title, lang)}
      introduction={lRec(STRINGS.intro, lang)}
      updating
    >
      <BossDisplay
        bossName="Shichifuja's Shadow"
        modeKey="Dimensional Singularity"
        defaultBossId="60000008"
        preloadedBosses={preloadedBosses}
      />
    </GuideTemplate>
  );
}
