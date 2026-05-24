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
import boss60000012 from '@data/boss/60000012.json';

const STRINGS = strings as Record<string, LangMap>;
const TIPS = tips as Record<string, LangMap[]>;
const RECOMMENDED = recommended as Record<string, CharacterRecommendation[]>;

const preloadedBosses: Record<string, Boss> = {
  '60000012': boss60000012 as unknown as Boss,
};

const GBETH_TITLE: LangMap = {
  en: 'GBeth team strategy',
  jp: 'GBeth編成戦略',
  kr: 'GBeth 팀 전략',
  zh: 'GBeth队伍策略',
  fr: 'Strategie equipe GBeth',
};

const GDAHLIA_TITLE: LangMap = {
  en: 'GDahlia team strategy',
  jp: 'GDahliaチーム戦略',
  kr: 'GDahlia 팀 전략',
  zh: 'GDahlia队伍策略',
  fr: 'Strategie equipe GDahlia',
};

const DARK_TITLE: LangMap = {
  en: 'Dark team strategy',
  jp: '闇属性編成戦略',
  kr: '암속성 구성 전략',
  zh: '暗属性队伍策略',
  fr: 'Strategie equipe Dark',
};

export default function SkuldGuide() {
  const { lang } = useI18n();

  return (
    <GuideTemplate
      title={lRec(STRINGS.title, lang)}
      introduction={lRec(STRINGS.intro, lang)}
    >
      <BossDisplay
        bossName="Skuld"
        modeKey="Dimensional Singularity"
        defaultBossId="60000012"
        preloadedBosses={preloadedBosses}
      />
      <hr className="my-6 border-neutral-700" />
      <TacticalTips sections={[
        { title: 'strategy', tips: TIPS.strategy },
      ]} />
      <hr className="my-6 border-neutral-700" />
      <RecommendedCharacterList title={GBETH_TITLE} entries={RECOMMENDED.gbeth} />
      <hr className="my-6 border-neutral-700" />
      <RecommendedCharacterList title={GDAHLIA_TITLE} entries={RECOMMENDED.gdahlia} />
      <hr className="my-6 border-neutral-700" />
      <RecommendedCharacterList title={DARK_TITLE} entries={RECOMMENDED.dark} />
      <hr className="my-6 border-neutral-700" />
      <MultiVideoEmbed
        hashPrefix="skuld-video"
        videos={[
          {
            platform: 'youtube',
            id: '4_6VLVfIkMI',
            title: 'Skuld — Dimensional Singularity',
            author: 'Jaego Sun',
            label: 'G.Dahlia — Rank SSS++',
          },
        ]}
      />
    </GuideTemplate>
  );
}
