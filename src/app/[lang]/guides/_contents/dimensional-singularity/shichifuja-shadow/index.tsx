"use client";

import GuideTemplate from "@/app/components/guides/GuideTemplate";
import BossDisplay from "@/app/components/guides/BossDisplay";
import TacticalTips from "@/app/components/guides/TacticalTips";
import RecommendedCharacterList from "@/app/components/guides/RecommendedCharacterList";
import MultiVideoEmbed from "@/app/components/ui/MultiVideoEmbed";
import { useI18n } from "@/lib/contexts/I18nContext";
import { lRec } from "@/lib/i18n/localize";
import type { Boss } from "@/types/boss";
import type { LangMap } from "@/types/common";
import type { CharacterRecommendation } from "@/app/components/guides/RecommendedCharacterList";

import strings from "./strings.json";
import tips from "./tips.json";
import recommended from "./recommended.json";
import boss60000008 from "@data/boss/60000008.json";

const STRINGS = strings as Record<string, LangMap>;
const TIPS = tips as Record<string, LangMap[]>;
const RECOMMENDED = recommended as CharacterRecommendation[];

const preloadedBosses: Record<string, Boss> = {
  "60000008": boss60000008 as unknown as Boss,
};

export default function ShichifujaShadowGuide() {
  const { lang } = useI18n();

  return (
    <GuideTemplate
      title={lRec(STRINGS.title, lang)}
      introduction={lRec(STRINGS.intro, lang)}
      
    >
      <BossDisplay
        bossName="Shichifuja's Shadow"
        modeKey="Dimensional Singularity"
        defaultBossId="60000008"
        preloadedBosses={preloadedBosses}
      />
      <hr className="my-6 border-neutral-700" />
      <TacticalTips sections={[
        { title: "general", tips: TIPS.strategy },
        { title: "strategy", tips: TIPS.mero }
        ]} />
      <hr className="my-6 border-neutral-700" />
      <RecommendedCharacterList entries={RECOMMENDED} />
      <hr className="my-6 border-neutral-700" />
      <MultiVideoEmbed
        hashPrefix="shichifuja-shadow-video"
        videos={[
          {
            platform: 'youtube',
            id: 'yCIh-lHzUoo',
            title: "Shichifuja's Shadow — Dimensional Singularity — Rank SSS++",
            author: 'Sevih',
            label: 'Sevih',
          },
        ]}
      />
    </GuideTemplate>
  );
}
