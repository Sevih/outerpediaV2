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
import boss60000013 from '@data/boss/60000013.json';

const STRINGS = strings as Record<string, LangMap>;
const TIPS = tips as Record<string, LangMap[]>;
const RECOMMENDED = recommended as Record<string, CharacterRecommendation[]>;

const preloadedBosses: Record<string, Boss> = {
  '60000013': boss60000013 as unknown as Boss,
};

const LIGHT_TITLE: LangMap = {
  en: 'Light team strategy',
  jp: '光属性編成戦略',
  kr: '빛 속성 팀 전략',
  zh: '光属性队伍策略',
  fr: 'Strategie equipe Light',
};

const MERO_TITLE: LangMap = {
  en: 'Mero strategy',
  jp: 'メロ戦略',
  kr: '메로 전략',
  zh: '梅萝策略',
  fr: 'Strategie Mero',
};

const GBETH_TITLE: LangMap = {
  en: 'GBeth team strategy',
  jp: 'GBeth編成戦略',
  kr: 'GBeth 팀 전략',
  zh: 'GBeth队伍策略',
  fr: 'Strategie equipe GBeth',
};

export default function UrdDarkGuide() {
  const { lang } = useI18n();

  return (
    <GuideTemplate
      title={lRec(STRINGS.title, lang)}
      introduction={lRec(STRINGS.intro, lang)}
    >
      <BossDisplay
        bossName="Urd"
        modeKey="Dimensional Singularity"
        defaultBossId="60000013"
        preloadedBosses={preloadedBosses}
      />
      <hr className="my-6 border-neutral-700" />
      <TacticalTips sections={[
        { title: 'general', tips: TIPS.general },
      ]} />
      <hr className="my-6 border-neutral-700" />
      <RecommendedCharacterList title={LIGHT_TITLE} entries={RECOMMENDED.light} />
      <hr className="my-6 border-neutral-700" />
      <RecommendedCharacterList title={MERO_TITLE} entries={RECOMMENDED.mero} />
      <hr className="my-6 border-neutral-700" />
      <RecommendedCharacterList title={GBETH_TITLE} entries={RECOMMENDED.gbeth} />
      <hr className="my-6 border-neutral-700" />
      <MultiVideoEmbed
        hashPrefix="urd-dark-video"
        videos={[
          {
            platform: 'youtube',
            id: 'TTFAtX5A4dg',
            title: 'Urd (Dark) - Dimensional Singularity - Rank SSS++',
            author: 'Sevih',
            label: 'Mero — Rank SSS++',
          },
        ]}
      />
    </GuideTemplate>
  );
}
