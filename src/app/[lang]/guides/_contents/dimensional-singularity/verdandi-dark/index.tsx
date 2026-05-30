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
import boss60000014 from '@data/boss/60000014.json';

const STRINGS = strings as Record<string, LangMap>;
const TIPS = tips as Record<string, LangMap[]>;
const RECOMMENDED = recommended as Record<string, CharacterRecommendation[]>;

const preloadedBosses: Record<string, Boss> = {
  '60000014': boss60000014 as unknown as Boss,
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

export default function VerdandiDarkGuide() {
  const { lang } = useI18n();

  return (
    <GuideTemplate
      title={lRec(STRINGS.title, lang)}
      introduction={lRec(STRINGS.intro, lang)}
    >
      <BossDisplay
        bossName="Verdandi"
        modeKey="Dimensional Singularity"
        defaultBossId="60000014"
        preloadedBosses={preloadedBosses}
      />

      <hr className="my-6 border-neutral-700" />
      <TacticalTips
        sections={[
          { title: 'general', tips: TIPS.general },
          { title: GBETH_TITLE, tips: TIPS.gbeth },
          { title: LIGHT_TITLE, tips: TIPS.light },
        ]}
      />

      <hr className="my-6 border-neutral-700" />
      <RecommendedCharacterList title={GBETH_TITLE} entries={RECOMMENDED.gbeth} />

      <hr className="my-6 border-neutral-700" />
      <RecommendedCharacterList title={LIGHT_TITLE} entries={RECOMMENDED.light} />

      <hr className="my-6 border-neutral-700" />
      <MultiVideoEmbed
        hashPrefix="verdandi-video"
        videos={[
          {
            platform: 'youtube',
            id: '4h2JnK2MXkM',
            title: 'Verdandi — Dimensional Singularity — Rank SSS++',
            author: 'Sevih',
            label: 'Rank SSS++',
          },
        ]}
      />
    </GuideTemplate>
  );
}
