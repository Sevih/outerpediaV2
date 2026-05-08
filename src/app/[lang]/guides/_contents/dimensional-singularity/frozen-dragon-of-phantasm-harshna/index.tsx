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
const RECOMMENDED = recommended as CharacterRecommendation[];

const preloadedBosses: Record<string, Boss> = {
  '60000005': boss60000005 as unknown as Boss,
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
      <RecommendedCharacterList entries={RECOMMENDED} />
      <hr className="my-6 border-neutral-700" />
      <MultiVideoEmbed
              hashPrefix="frozen-dragon-of-phantasm-harshna-video"
              videos={[
                {
                  platform: "youtube",
                  id: "bEcRDPR1q9Y",
                  title: "Harshna — Dimensional Singularity — Rank SSS++",
                  author: "Zeroceless",
                  label: "Rank SSS++",
                }
              ]}
            />
    </GuideTemplate>
  );
}
