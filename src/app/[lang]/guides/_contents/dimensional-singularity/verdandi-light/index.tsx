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
import boss60000011 from '@data/boss/60000011.json';

const STRINGS = strings as Record<string, LangMap>;
const TIPS = tips as Record<string, LangMap[]>;
const RECOMMENDED = recommended as Record<string, CharacterRecommendation[]>;

const preloadedBosses: Record<string, Boss> = {
  '60000011': boss60000011 as unknown as Boss,
};

const GDAHLIA_TITLE: LangMap = {
  en: 'GDahlia team strategy',
  jp: 'GDahliaチーム戦略',
  kr: 'GDahlia 팀 전략',
  zh: 'GDahlia队伍策略',
  fr: 'Strategie equipe GDahlia',
};

export default function VerdandiLightGuide() {
  const { lang } = useI18n();

  return (
    <GuideTemplate
      title={lRec(STRINGS.title, lang)}
      introduction={lRec(STRINGS.intro, lang)}
    >
      <BossDisplay
        bossName="Verdandi"
        modeKey="Dimensional Singularity"
        defaultBossId="60000011"
        preloadedBosses={preloadedBosses}
      />
      <hr className="my-6 border-neutral-700" />
      <TacticalTips sections={[
        { title: 'general', tips: TIPS.general },
        { title: GDAHLIA_TITLE, tips: TIPS.gdahlia },
      ]} />
      <hr className="my-6 border-neutral-700" />
      <RecommendedCharacterList title={GDAHLIA_TITLE} entries={RECOMMENDED.gdahlia} />
      <hr className="my-6 border-neutral-700" />
      <MultiVideoEmbed
        hashPrefix="verdandi-light-video"
        videos={[
          {
            platform: 'youtube',
            id: 'JqQpVVv4z5g',
            title: 'Verdandi (Light) - Dimensional Singularity - Rank SSS++',
            author: 'Sevih',
            label: 'G.Dahlia — Rank SSS++',
          },
        ]}
      />
    </GuideTemplate>
  );
}
