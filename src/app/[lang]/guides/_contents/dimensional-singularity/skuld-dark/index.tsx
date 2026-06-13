'use client';

import GuideTemplate from '@/app/components/guides/GuideTemplate';
import BossDisplay from '@/app/components/guides/BossDisplay';
import TacticalTips from '@/app/components/guides/TacticalTips';
import RecommendedCharacterList from '@/app/components/guides/RecommendedCharacterList';
import { useI18n } from '@/lib/contexts/I18nContext';
import { lRec } from '@/lib/i18n/localize';
import type { Boss } from '@/types/boss';
import type { LangMap } from '@/types/common';
import type { CharacterRecommendation } from '@/app/components/guides/RecommendedCharacterList';

import strings from './strings.json';
import tips from './tips.json';
import recommended from './recommended.json';
import boss60000015 from '@data/boss/60000015.json';

const STRINGS = strings as Record<string, LangMap>;
const TIPS = tips as Record<string, LangMap[]>;
const RECOMMENDED = recommended as Record<string, CharacterRecommendation[]>;

const preloadedBosses: Record<string, Boss> = {
  '60000015': boss60000015 as unknown as Boss,
};

const GBETH_TITLE: LangMap = {
  en: 'GBeth team strategy',
  jp: 'GBeth編成戦略',
  kr: 'GBeth 팀 전략',
  zh: 'GBeth队伍策略',
  fr: 'Strategie equipe GBeth',
};

const LIGHT_TITLE: LangMap = {
  en: 'Light team strategy',
  jp: '光属性編成戦略',
  kr: '빛 속성 팀 전략',
  zh: '光属性队伍策略',
  fr: 'Strategie equipe Light',
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
      <hr className="my-6 border-neutral-700" />
      <RecommendedCharacterList title={GBETH_TITLE} entries={RECOMMENDED.gbeth} />
      <hr className="my-6 border-neutral-700" />
      <RecommendedCharacterList title={LIGHT_TITLE} entries={RECOMMENDED.light} />
    </GuideTemplate>
  );
}
