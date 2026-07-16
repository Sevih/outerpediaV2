'use client';

import GuideTemplate from '@/app/components/guides/GuideTemplate';
import BossDisplay from '@/app/components/guides/BossDisplay';
import TacticalTips from '@/app/components/guides/TacticalTips';
import RecommendedCharacterList from '@/app/components/guides/RecommendedCharacterList';
import MultiVideoEmbed from '@/app/components/ui/MultiVideoEmbed';
import { useI18n } from '@/lib/contexts/I18nContext';
import { lRec } from '@/lib/i18n/localize';
import type { Boss } from '@/types/boss';
import type { LangMap } from '@/types/common';
import type { CharacterRecommendation } from '@/app/components/guides/RecommendedCharacterList';

import strings from './strings.json';
import tips from './tips.json';
import recommended from './recommended.json';
import boss60000004 from '@data/boss/60000004.json';

const STRINGS = strings as Record<string, LangMap>;
const TIPS = tips as Record<string, LangMap[]>;
const RECOMMENDED = recommended as Record<string, CharacterRecommendation[]>;

const preloadedBosses: Record<string, Boss> = {
  '60000004': boss60000004 as unknown as Boss,
};

const EARTH_TITLE: LangMap = {
  en: 'Earth team strategy',
  jp: '地属性編成戦略',
  kr: '지속성 팀 전략',
  zh: '土属性队伍策略',
  fr: 'Strategie equipe Earth',
};

export default function TyrantToddlerGuide() {
  const { lang } = useI18n();

  return (
    <GuideTemplate
      title={lRec(STRINGS.title, lang)}
      introduction={lRec(STRINGS.intro, lang)}
    >
      <BossDisplay
        bossName="Tyrant Toddler"
        modeKey="Dimensional Singularity"
        defaultBossId="60000004"
        preloadedBosses={preloadedBosses}
      />
      <hr className="my-6 border-neutral-700" />
      <TacticalTips sections={[
        { title: 'strategy', tips: TIPS.strategy },
      ]} />
      <hr className="my-6 border-neutral-700" />
      <RecommendedCharacterList title={EARTH_TITLE} entries={RECOMMENDED.earth} />
      <hr className="my-6 border-neutral-700" />
      <MultiVideoEmbed
        hashPrefix="tyrant-toddler-video"
        videos={[
          {
            platform: 'youtube',
            id: 'S84F1X5hZWE',
            title: 'Dimensional Singularity Tyrant Toddler - S.Delta Team | Outerplane',
            author: 'baba yaga',
            label: 'S.Delta',
          },
        ]}
      />
    </GuideTemplate>
  );
}
