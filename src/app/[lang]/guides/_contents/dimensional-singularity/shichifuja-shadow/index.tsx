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
const RECOMMENDED = recommended as Record<string, CharacterRecommendation[]>;

const preloadedBosses: Record<string, Boss> = {
  "60000008": boss60000008 as unknown as Boss,
};

const MERO_TITLE: LangMap = {
  en: "Mero team strategy",
  jp: "メロ編成戦略",
  kr: "메로 팀 전략",
  zh: "梅萝队伍策略",
  fr: "Strategie equipe Mero",
};

const BURN_TITLE: LangMap = {
  en: "Burn team strategy",
  jp: "火傷編成戦略",
  kr: "화상 팀 전략",
  zh: "烧伤队伍策略",
  fr: "Strategie equipe Burn",
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
        { title: MERO_TITLE, tips: TIPS.mero },
        { title: BURN_TITLE, tips: TIPS.burn }
        ]} />
      <hr className="my-6 border-neutral-700" />
      <RecommendedCharacterList title={MERO_TITLE} entries={RECOMMENDED.mero} />
      <hr className="my-6 border-neutral-700" />
      <RecommendedCharacterList title={BURN_TITLE} entries={RECOMMENDED.burn} />
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
