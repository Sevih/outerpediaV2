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
import boss60000003 from '@data/boss/60000003.json';

const STRINGS = strings as Record<string, LangMap>;
const TIPS = tips as Record<string, LangMap[]>;
const RECOMMENDED = recommended as Record<string, CharacterRecommendation[]>;

const preloadedBosses: Record<string, Boss> = {
  '60000003': boss60000003 as unknown as Boss,
};

const GBETH_TITLE: LangMap = {
  en: 'GBeth team strategy',
  jp: 'GBeth編成戦略',
  kr: 'GBeth 팀 전략',
  zh: 'GBeth队伍策略',
  fr: 'Strategie equipe GBeth',
};

const WATER_TITLE: LangMap = {
  en: 'Water team strategy',
  jp: '水属性編成戦略',
  kr: '물 속성 팀 전략',
  zh: '水属性队伍策略',
  fr: 'Strategie equipe Water',
};

const MERO_TITLE: LangMap = {
  en: 'Mero team strategy',
  jp: 'メロ編成戦略',
  kr: '메로 팀 전략',
  zh: '梅萝队伍策略',
  fr: 'Strategie equipe Mero',
};

const GDAHLIA_TITLE: LangMap = {
  en: 'GDahlia team strategy',
  jp: 'GDahlia編成戦略',
  kr: 'GDahlia 팀 전략',
  zh: 'GDahlia队伍策略',
  fr: 'Strategie equipe GDahlia',
};

export default function BlazingKnightMeteosGuide() {
  const { lang } = useI18n();

  return (
    <GuideTemplate
      title={lRec(STRINGS.title, lang)}
      introduction={lRec(STRINGS.intro, lang)}
    >
      <BossDisplay
        bossName="Blazing Knight Meteos"
        modeKey="Dimensional Singularity"
        defaultBossId="60000003"
        preloadedBosses={preloadedBosses}
      />

      <hr className="my-6 border-neutral-700" />
      <TacticalTips
        sections={[
          { title: 'general', tips: TIPS.general },
          { title: GBETH_TITLE, tips: TIPS.gbeth },
          { title: WATER_TITLE, tips: TIPS.water },
          { title: MERO_TITLE, tips: TIPS.mero },
          { title: GDAHLIA_TITLE, tips: TIPS.gdahlia },
        ]}
      />

      <hr className="my-6 border-neutral-700" />
      <RecommendedCharacterList title={GBETH_TITLE} entries={RECOMMENDED.gbeth} />

      <hr className="my-6 border-neutral-700" />
      <RecommendedCharacterList title={WATER_TITLE} entries={RECOMMENDED.water} />

      <hr className="my-6 border-neutral-700" />
      <RecommendedCharacterList title={MERO_TITLE} entries={RECOMMENDED.mero} />

      <hr className="my-6 border-neutral-700" />
      <RecommendedCharacterList title={GDAHLIA_TITLE} entries={RECOMMENDED.gdahlia} />

      <hr className="my-6 border-neutral-700" />
      <MultiVideoEmbed
        hashPrefix="blazing-knight-meteos-video"
        videos={[
          {
            platform: 'youtube',
            id: 'WUTVYyPYIq8',
            title: 'Blazing Knight Meteos — Dimensional Singularity — Rank SSS++',
            author: 'Sevih',
            label: 'Rank SSS++',
          },
          {
            platform: 'youtube',
            id: '7FrEgI696Ww',
            title: 'Dimensional Singularity Meteos - M.Skadi Team | Outerplane',
            author: 'baba yaga',
            label: 'M.Skadi',
          },
        ]}
      />
    </GuideTemplate>
  );
}
