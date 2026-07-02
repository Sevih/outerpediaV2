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
import MultiVideoEmbed from "@/app/components/ui/MultiVideoEmbed";

import strings from './strings.json';
import tips from './tips.json';
import recommended from './recommended.json';
import boss60000005 from '@data/boss/60000005.json';

const STRINGS = strings as Record<string, LangMap>;
const TIPS = tips as Record<string, LangMap[]>;
const RECOMMENDED = recommended as Record<string, CharacterRecommendation[]>;

const preloadedBosses: Record<string, Boss> = {
  '60000005': boss60000005 as unknown as Boss,
};

const GENERAL_TITLE: LangMap = {
  en: 'General team strategy',
  jp: '汎用編成戦略',
  kr: '범용 팀 전략',
  zh: '通用队伍策略',
  fr: 'Strategie equipe generale',
};

const MSKADI_TITLE: LangMap = {
  en: 'MSkadi team strategy',
  jp: 'MSkadi編成戦略',
  kr: 'MSkadi 팀 전략',
  zh: 'MSkadi队伍策略',
  fr: 'Strategie equipe MSkadi',
};

export default function FrozenDragonPhantasmHarshnaGuide() {
  const { lang } = useI18n();

  return (
    <GuideTemplate
      title={lRec(STRINGS.title, lang)}
      introduction={lRec(STRINGS.intro, lang)}
    >
      <BossDisplay
        bossName="Frozen Dragon of Phantasm Harshna"
        modeKey="Dimensional Singularity"
        defaultBossId="60000005"
        preloadedBosses={preloadedBosses}
      />
      <hr className="my-6 border-neutral-700" />
      <TacticalTips sections={[
        { title: 'strategy', tips: TIPS.strategy },
      ]} />
      <hr className="my-6 border-neutral-700" />
      <RecommendedCharacterList title={GENERAL_TITLE} entries={RECOMMENDED.strategy} />
      <hr className="my-6 border-neutral-700" />
      <RecommendedCharacterList title={MSKADI_TITLE} entries={RECOMMENDED.mskadi} />
      <hr className="my-6 border-neutral-700" />
      <MultiVideoEmbed
              hashPrefix="frozen-dragon-of-phantasm-harshna-video"
              videos={[
                {
                  platform: "youtube",
                  id: "z3i9A2EHwZ8",
                  title: "OUTERPLANE - DELTA TEAM VS SINGULARITY BOSS - DRAGON ",
                  author: "Zeroceless",
                  label: "Rank S+",
                },
                {
                  platform: "youtube",
                  id: "8c3Ftx-y2pA",
                  title: "OUTERPLANE - RYU TEAM VS SINGULARITY BOSS - DRAGON ",
                  author: "Zeroceless",
                  label: "Rank SS+",
                }
              ]}
            />
    </GuideTemplate>
  );
}
