'use client';

import GuideTemplate from '@/app/components/guides/GuideTemplate';
import BossDisplay from '@/app/components/guides/BossDisplay';
import { useI18n } from '@/lib/contexts/I18nContext';
import { lRec } from '@/lib/i18n/localize';
import type { Boss } from '@/types/boss';
import type { LangMap } from '@/types/common';

import strings from './strings.json';
import boss60000005 from '@data/boss/60000005.json';

const STRINGS = strings as Record<string, LangMap>;

const preloadedBosses: Record<string, Boss> = {
  '60000005': boss60000005 as unknown as Boss,
};

export default function FrozenDragonPhantasmHarshnaGuide() {
  const { lang } = useI18n();

  return (
    <GuideTemplate
      title={lRec(STRINGS.title, lang)}
      introduction={lRec(STRINGS.intro, lang)}
      updating
    >
      <BossDisplay
        bossName="Frozen Dragon of Phantasm Harshna"
        modeKey="Dimensional Singularity"
        defaultBossId="60000005"
        preloadedBosses={preloadedBosses}
      />
    </GuideTemplate>
  );
}
