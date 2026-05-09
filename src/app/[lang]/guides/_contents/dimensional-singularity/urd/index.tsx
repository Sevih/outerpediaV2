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
import boss60000010 from "@data/boss/60000010.json";

const STRINGS = strings as Record<string, LangMap>;
const TIPS = tips as Record<string, LangMap[]>;
const RECOMMENDED = recommended as CharacterRecommendation[];

const preloadedBosses: Record<string, Boss> = {
  "60000010": boss60000010 as unknown as Boss,
};

const DOT_TITLE: LangMap = {
  en: "DoT strategy",
  jp: "DoT戦略",
  kr: "DoT 전략",
  zh: "DoT策略",
};

const DARK_TITLE: LangMap = {
  en: "Dark team strategy",
  jp: "闇属性編成戦略",
  kr: "암속성 구성 전략",
  zh: "暗属性队伍策略",
};

const MERO_TITLE: LangMap = {
  en: "Mero strategy",
  jp: "メロ戦略",
  kr: "메로 전략",
  zh: "梅萝策略",
};

export default function UrdGuide() {
  const { lang } = useI18n();

  return (
    <GuideTemplate
      title={lRec(STRINGS.title, lang)}
      introduction={lRec(STRINGS.intro, lang)}
      updating
    >
      <BossDisplay
        bossName="Urd"
        modeKey="Dimensional Singularity"
        defaultBossId="60000010"
        preloadedBosses={preloadedBosses}
      />
      <hr className="my-6 border-neutral-700" />
      <TacticalTips
        sections={[
          { title: "general", tips: TIPS.general },
          { title: DARK_TITLE, tips: TIPS.dark },
          { title: DOT_TITLE, tips: TIPS.dot },
          { title: MERO_TITLE, tips: TIPS.mero },
        ]}
      />
      <hr className="my-6 border-neutral-700" />
      <RecommendedCharacterList entries={RECOMMENDED} />

      <hr className="my-6 border-neutral-700" />
      <MultiVideoEmbed
        hashPrefix="urd-video"
        videos={[
          {
            platform: "youtube",
            id: "To5qeeNt5Bs",
            title:
              "Urd - Dimensional Singularity - Rank SSS++",
            author: "Sevih",
            label: "G.Beth — Rank SSS++",
          },
        ]}
      />
    </GuideTemplate>
  );
}
