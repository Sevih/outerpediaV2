'use client';

import GuideTemplate from '@/app/components/guides/GuideTemplate';
import BossDisplay from '@/app/components/guides/BossDisplay';
import { useI18n } from '@/lib/contexts/I18nContext';
import { lRec } from '@/lib/i18n/localize';
import type { Boss } from '@/types/boss';
import type { LangMap } from '@/types/common';

import strings from './strings.json';
import boss60000001 from '@data/boss/60000001.json';

const STRINGS = strings as Record<string, LangMap>;

const preloadedBosses: Record<string, Boss> = {
  '60000001': boss60000001 as unknown as Boss,
};

export default function AbominationHunterBelialGuide() {
  const { lang } = useI18n();

  return (
    <GuideTemplate
      title={lRec(STRINGS.title, lang)}
      introduction={lRec(STRINGS.intro, lang)}
      updating
    >
      <BossDisplay
        bossName="Abomination Hunter Belial"
        modeKey="Dimensional Singularity"
        defaultBossId="60000001"
        preloadedBosses={preloadedBosses}
      />
    </GuideTemplate>
  );
}
