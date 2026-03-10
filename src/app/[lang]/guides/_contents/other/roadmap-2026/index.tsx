'use client';

import { useI18n } from '@/lib/contexts/I18nContext';
import { lRec } from '@/lib/i18n/localize';
import {
  QuarterlyRoadmapSection,
  MonthlyUpdatesSection,
  NewCharactersSection,
  CoreFusionSection,
  DimensionSingularitySection,
  RTASection,
  DemiurgeLimitedPlansSection,
  CouponSection,
  DevelopmentDirectionSection,
  CreditsSection,
} from './helpers';

const HEADINGS = {
  intro: {
    en: "Summary of the January 2026 Offline Meeting where Major9 and VAGames presented the 2026 roadmap for Outerplane.",
    jp: "Major9とVAGamesが2026年のOuterplaneロードマップを発表した2026年1月オフラインミーティングの概要。",
    kr: "Major9와 VAGames가 2026년 Outerplane 로드맵을 발표한 2026년 1월 오프라인 미팅 요약.",
    zh: "Major9和VAGames在2026年1月线下会议上展示的Outerplane 2026路线图摘要。"
  },
  developmentDirection: { en: "Development Direction", jp: "開発方針", kr: "개발 방향", zh: "开发方向" },
  roadmapOverview: { en: "2026 Roadmap Overview", jp: "2026年ロードマップ概要", kr: "2026 로드맵 개요", zh: "2026路线图概览" },
  monthlyUpdates: { en: "Monthly Update Plans (January - July 2026)", jp: "月間アップデート計画（2026年1月〜7月）", kr: "월간 업데이트 계획 (2026년 1월 - 7월)", zh: "月度更新计划（2026年1月-7月）" },
  newCharacters: { en: "New Characters Revealed", jp: "新キャラクター公開", kr: "신규 캐릭터 공개", zh: "新角色公开" },
  coreFusion: { en: "Core Fusion Plans", jp: "コア融合計画", kr: "코어 융합 계획", zh: "核心融合计划" },
  dimensionSingularity: { en: "New PVE Content: Dimension Singularity", jp: "新PVEコンテンツ: 次元特異点", kr: "신규 PVE 콘텐츠: 차원 특이점", zh: "新PVE内容：次元奇点" },
  rta: { en: "RTA (Real-Time Arena)", jp: "RTA（リアルタイムアリーナ）", kr: "RTA (실시간 아레나)", zh: "RTA（实时竞技场）" },
  demiurgePlans: { en: "Demiurge/Limited/Rerun Plans", jp: "デミウルゴス/限定/復刻計画", kr: "데미우르고스/한정/복각 계획", zh: "神匠/限定/复刻计划" },
  coupon: { en: "Coupon Code", jp: "クーポンコード", kr: "쿠폰 코드", zh: "优惠码" },
};

export default function Roadmap2026Guide() {
  const { lang } = useI18n();

  return (
    <div className="space-y-8">
      <p className="text-gray-300">
        {lRec(HEADINGS.intro, lang)}
      </p>

      <section>
        <h2 className="text-xl font-semibold mb-3">{lRec(HEADINGS.developmentDirection, lang)}</h2>
        <DevelopmentDirectionSection lang={lang} />
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-3">{lRec(HEADINGS.roadmapOverview, lang)}</h2>
        <QuarterlyRoadmapSection lang={lang} />
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-3">{lRec(HEADINGS.monthlyUpdates, lang)}</h2>
        <MonthlyUpdatesSection lang={lang} />
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-3">{lRec(HEADINGS.newCharacters, lang)}</h2>
        <NewCharactersSection lang={lang} />
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-3">{lRec(HEADINGS.coreFusion, lang)}</h2>
        <CoreFusionSection lang={lang} />
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-3">{lRec(HEADINGS.dimensionSingularity, lang)}</h2>
        <DimensionSingularitySection lang={lang} />
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-3">{lRec(HEADINGS.rta, lang)}</h2>
        <RTASection lang={lang} />
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-3">{lRec(HEADINGS.demiurgePlans, lang)}</h2>
        <DemiurgeLimitedPlansSection lang={lang} />
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-3">{lRec(HEADINGS.coupon, lang)}</h2>
        <CouponSection lang={lang} />
      </section>

      <CreditsSection lang={lang} />
    </div>
  );
}
