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
import boss60000009 from '@data/boss/60000009.json';

const STRINGS = strings as Record<string, LangMap>;
const TIPS = tips as Record<string, LangMap[]>;
const RECOMMENDED = recommended as CharacterRecommendation[];

const preloadedBosses: Record<string, Boss> = {
  '60000009': boss60000009 as unknown as Boss,
};

const BURN_TITLE: LangMap = {
  en: 'Burn team strategy',
  jp: '火傷編成戦略',
  kr: '화상 팀 전략',
  zh: '烧伤队伍策略',
  fr: 'Strategie equipe Burn',
};

const MERO_TITLE: LangMap = {
  en: 'Mero team strategy',
  jp: 'メロ編成戦略',
  kr: '메로 팀 전략',
  zh: '梅萝队伍策略',
  fr: 'Strategie equipe Mero',
};

const GBETH_TITLE: LangMap = {
  en: 'GBeth team strategy',
  jp: 'GBeth編成戦略',
  kr: 'GBeth 팀 전략',
  zh: 'GBeth队伍策略',
  fr: 'Strategie equipe GBeth',
};

export default function VIE11AGuide() {
  const { lang } = useI18n();

  return (
    <GuideTemplate
      title={lRec(STRINGS.title, lang)}
      introduction={lRec(STRINGS.intro, lang)}
    >
      <BossDisplay
        bossName="VI=E-11-A"
        modeKey="Dimensional Singularity"
        defaultBossId="60000009"
        preloadedBosses={preloadedBosses}
      />

      <hr className="my-6 border-neutral-700" />
      <TacticalTips
        sections={[
          { title: 'general', tips: TIPS.general },
          { title: BURN_TITLE, tips: TIPS.burn },
          { title: MERO_TITLE, tips: TIPS.mero },
          { title: GBETH_TITLE, tips: TIPS.gbeth },
        ]}
      />

      <hr className="my-6 border-neutral-700" />
      <RecommendedCharacterList entries={RECOMMENDED} />

      <hr className="my-6 border-neutral-700" />
      <MultiVideoEmbed
        hashPrefix="vi-e-11-a-video"
        videos={[
          {
            platform: 'youtube',
            id: 'FAZU7zEMJjo',
            title: 'VI=E 11 A — Dimensional Singularity — Rank SSS++',
            author: 'Sevih',
            label: 'Rank SSS++',
          },
        ]}
      />
    </GuideTemplate>
  );
}
