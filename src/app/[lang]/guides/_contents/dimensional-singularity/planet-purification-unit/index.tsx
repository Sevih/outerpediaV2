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
import boss60000002 from '@data/boss/60000002.json';

const STRINGS = strings as Record<string, LangMap>;
const TIPS = tips as Record<string, LangMap[]>;
const RECOMMENDED = recommended as Record<string, CharacterRecommendation[]>;

const preloadedBosses: Record<string, Boss> = {
  '60000002': boss60000002 as unknown as Boss,
};

const WATER_TITLE: LangMap = {
  en: 'Water team strategy',
  jp: '水属性編成戦略',
  kr: '물 속성 팀 전략',
  zh: '水属性队伍策略',
  fr: 'Strategie equipe Water',
};

export default function PlanetPurificationUnitGuide() {
  const { lang } = useI18n();

  return (
    <GuideTemplate
      title={lRec(STRINGS.title, lang)}
      introduction={lRec(STRINGS.intro, lang)}
    >
      <BossDisplay
        bossName="Planet Purification Unit"
        modeKey="Dimensional Singularity"
        defaultBossId="60000002"
        preloadedBosses={preloadedBosses}
      />
      <hr className="my-6 border-neutral-700" />
      <TacticalTips sections={[
        { title: 'strategy', tips: TIPS.strategy },
      ]} />
      <hr className="my-6 border-neutral-700" />
      <RecommendedCharacterList title={WATER_TITLE} entries={RECOMMENDED.water} />
      <hr className="my-6 border-neutral-700" />
      <MultiVideoEmbed
        hashPrefix="planet-purification-unit-video"
        videos={[
          {
            platform: 'youtube',
            id: 'P3TJO_At4Z8',
            title: 'Water Team - Dimensional Singularity KSAI | Outerplane',
            author: 'baba yaga',
            label: 'Water',
          },
          {
            platform: 'youtube',
            id: 'NLiBVg0TJes',
            title: 'Dimensional Singularity KSAI - Regina/Roxie Team | Outerplane',
            author: 'Baba Yaga',
            label: 'Regina/Roxie Team',
          }
        ]}
      />
    </GuideTemplate>
  );
}
