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
import boss60000006 from '@data/boss/60000006.json';

const STRINGS = strings as Record<string, LangMap>;
const TIPS = tips as Record<string, LangMap[]>;
const RECOMMENDED = recommended as CharacterRecommendation[];

const preloadedBosses: Record<string, Boss> = {
  '60000006': boss60000006 as unknown as Boss,
};

const GBETH_TITLE: LangMap = {
  en: 'GBeth team strategy',
  jp: 'GBeth編成戦略',
  kr: 'GBeth 팀 전략',
  zh: 'GBeth队伍策略',
  fr: 'Strategie equipe GBeth',
};

export default function AndroidSphinxGuide() {
  const { lang } = useI18n();

  return (
    <GuideTemplate
      title={lRec(STRINGS.title, lang)}
      introduction={lRec(STRINGS.intro, lang)}
    >
      <BossDisplay
        bossName="Android Sphinx"
        modeKey="Dimensional Singularity"
        defaultBossId="60000006"
        preloadedBosses={preloadedBosses}
      />

      <hr className="my-6 border-neutral-700" />
      <TacticalTips
        sections={[
          { title: 'general', tips: TIPS.general },
          { title: GBETH_TITLE, tips: TIPS.gbeth },
        ]}
      />

      <hr className="my-6 border-neutral-700" />
      <RecommendedCharacterList entries={RECOMMENDED} />

      <hr className="my-6 border-neutral-700" />
      <MultiVideoEmbed
        hashPrefix="android-sphinx-video"
        videos={[
          {
            platform: 'youtube',
            id: 'zT7d1IjcQs4',
            title: 'Sphinx Guardian — Dimensional Singularity — Rank SSS++',
            author: 'Sevih',
            label: 'Rank SSS++',
          },
        ]}
      />
    </GuideTemplate>
  );
}
