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
import boss60000001 from "@data/boss/60000001.json";

const STRINGS = strings as Record<string, LangMap>;
const TIPS = tips as Record<string, LangMap[]>;
const RECOMMENDED = recommended as Record<string, CharacterRecommendation[]>;

const preloadedBosses: Record<string, Boss> = {
  "60000001": boss60000001 as unknown as Boss,
};

const WATER_TITLE: LangMap = {
  en: "Water team strategy",
  jp: "水属性編成戦略",
  kr: "물 속성 팀 전략",
  zh: "水属性队伍策略",
  fr: "Strategie equipe Water",
};

const GBETH_TITLE: LangMap = {
  en: "GBeth team strategy",
  jp: "GBeth編成戦略",
  kr: "GBeth 팀 전략",
  zh: "GBeth队伍策略",
  fr: "Strategie equipe GBeth",
};

export default function AbominationHunterBelialGuide() {
  const { lang } = useI18n();

  return (
    <GuideTemplate
      title={lRec(STRINGS.title, lang)}
      introduction={lRec(STRINGS.intro, lang)}
    >
      <BossDisplay
        bossName="Abomination Hunter Belial"
        modeKey="Dimensional Singularity"
        defaultBossId="60000001"
        preloadedBosses={preloadedBosses}
      />

      <hr className="my-6 border-neutral-700" />
      <TacticalTips
        sections={[
          { title: "general", tips: TIPS.general },
          { title: WATER_TITLE, tips: TIPS.freeze },
          { title: GBETH_TITLE, tips: TIPS.dot },
        ]}
      />

      <hr className="my-6 border-neutral-700" />
      <RecommendedCharacterList title={WATER_TITLE} entries={RECOMMENDED.water} />

      <hr className="my-6 border-neutral-700" />
      <RecommendedCharacterList title={GBETH_TITLE} entries={RECOMMENDED.gbeth} />

      <hr className="my-6 border-neutral-700" />
      <MultiVideoEmbed
        hashPrefix="abomination-hunter-belial-video"
        videos={[
          {
            platform: "youtube",
            id: "bEcRDPR1q9Y",
            title: "Abomination Hunter Belial — Dimensional Singularity — Rank SSS++",
            author: "Sevih",
            label: "Rank SSS++",
          },
        ]}
      />
    </GuideTemplate>
  );
}
