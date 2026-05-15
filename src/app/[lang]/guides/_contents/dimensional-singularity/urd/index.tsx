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
const RECOMMENDED = recommended as Record<string, CharacterRecommendation[]>;

const preloadedBosses: Record<string, Boss> = {
  "60000010": boss60000010 as unknown as Boss,
};

const GBETH_TITLE: LangMap = {
  en: "GBeth team strategy",
  jp: "GBeth編成戦略",
  kr: "GBeth 팀 전략",
  zh: "GBeth队伍策略",
  fr: "Strategie equipe GBeth",
};

const GDAHLIA_TITLE: LangMap = {
  en: "GDahlia team strategy",
  jp: "GDahliaチーム戦略",
  kr: "GDahlia 팀 전략",
  zh: "GDahlia队伍策略",
  fr: "Strategie equipe GDahlia",
};

const DARK_TITLE: LangMap = {
  en: "Dark team strategy",
  jp: "闇属性編成戦略",
  kr: "암속성 구성 전략",
  zh: "暗属性队伍策略",
  fr: "Strategie equipe Dark",
};

const MERO_TITLE: LangMap = {
  en: "Mero strategy",
  jp: "メロ戦略",
  kr: "메로 전략",
  zh: "梅萝策略",
  fr: "Strategie Mero",
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
          { title: GDAHLIA_TITLE, tips: TIPS.gdahlia },
          { title: DARK_TITLE, tips: TIPS.dark },
          { title: GBETH_TITLE, tips: TIPS.gbeth },
          { title: MERO_TITLE, tips: TIPS.mero },
        ]}
      />
      <hr className="my-6 border-neutral-700" />
      <RecommendedCharacterList title={GDAHLIA_TITLE} entries={RECOMMENDED.gdahlia} />

      <hr className="my-6 border-neutral-700" />
      <RecommendedCharacterList title={DARK_TITLE} entries={RECOMMENDED.dark} />

      <hr className="my-6 border-neutral-700" />
      <RecommendedCharacterList title={GBETH_TITLE} entries={RECOMMENDED.gbeth} />

      <hr className="my-6 border-neutral-700" />
      <RecommendedCharacterList title={MERO_TITLE} entries={RECOMMENDED.mero} />

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
          {
            platform: "youtube",
            id: "Ttf3-QIraNg",
            title:
              "OUTERPLANE - GNOSIS TEAM VS SINGULARITY BOSS - URD ",
            author: "Zeroceless",
            label: "G.Dahlia — Rank SSS++",
          }
        ]}
      />
    </GuideTemplate>
  );
}
