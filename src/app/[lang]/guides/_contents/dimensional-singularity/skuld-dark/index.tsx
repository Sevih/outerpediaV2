'use client';

import GuideTemplate from '@/app/components/guides/GuideTemplate';
import BossDisplay from '@/app/components/guides/BossDisplay';
import TacticalTips from '@/app/components/guides/TacticalTips';
import { useI18n } from '@/lib/contexts/I18nContext';
import { lRec } from '@/lib/i18n/localize';
import type { Boss } from '@/types/boss';
import type { LangMap } from '@/types/common';

import strings from './strings.json';
import tips from './tips.json';
import boss60000015 from '@data/boss/60000015.json';

const STRINGS = strings as Record<string, LangMap>;
const TIPS = tips as Record<string, LangMap[]>;

const preloadedBosses: Record<string, Boss> = {
  '60000015': boss60000015 as unknown as Boss,
};

export default function SkuldDarkGuide() {
  const { lang } = useI18n();

  return (
    <GuideTemplate
      title={lRec(STRINGS.title, lang)}
      introduction={lRec(STRINGS.intro, lang)}
    >
      <BossDisplay
        bossName="Skuld"
        modeKey="Dimensional Singularity"
        defaultBossId="60000015"
        preloadedBosses={preloadedBosses}
      />
      <hr className="my-6 border-neutral-700" />
      <TacticalTips sections={[
        { title: 'strategy', tips: TIPS.strategy },
      ]} />
    </GuideTemplate>
  );
}
