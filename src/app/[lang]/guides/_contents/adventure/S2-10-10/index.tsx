'use client';

import GuideTemplate from '@/app/components/guides/GuideTemplate';
import BossDisplay from '@/app/components/guides/BossDisplay';
import MinionDisplay from '@/app/components/guides/MinionDisplay';
import TacticalTips from '@/app/components/guides/TacticalTips';
import RecommendedCharacterList from '@/app/components/guides/RecommendedCharacterList';
import { useI18n } from '@/lib/contexts/I18nContext';
import { lRec } from '@/lib/i18n/localize';
import type { Boss } from '@/types/boss';
import type { LangMap } from '@/types/common';
import type { CharacterRecommendation } from '@/app/components/guides/RecommendedCharacterList';

import strings from './strings.json';
import recommendedData from './recommended.json';
import tipsData from './tips.json';

import boss4500154 from '@data/boss/4500154.json';
import boss4500182 from '@data/boss/4500182.json';

/* ── Typed data ─────────────────────────────────────────── */

const str = strings as Record<string, LangMap>;
const recommended = recommendedData as CharacterRecommendation[];
const tips = tipsData as Record<string, LangMap[]>;

const preloadedBosses: Record<string, Boss> = {
  '4500154': boss4500154 as unknown as Boss,
  '4500182': boss4500182 as unknown as Boss,
};

/* ── Component ──────────────────────────────────────────── */

export default function DrakhanGuide() {
  const { lang } = useI18n();

  return (
    <GuideTemplate
      title={lRec(str.title, lang)}
      introduction={lRec(str.intro, lang)}
    >
      <BossDisplay
        bossName="Drakhan"
        versionIds={['4500154', '4500182']}
        defaultBossId="4500182"
        preloadedBosses={preloadedBosses}
      />
      <MinionDisplay bossName="Vlada" versionIndex={0} defaultBossId="4500184" />
      <hr className="my-6 border-neutral-700" />
      <TacticalTips sections={[{ title: 'tactical', tips: tips.tactical }]} />
      <hr className="my-6 border-neutral-700" />
      <RecommendedCharacterList entries={recommended} />
    </GuideTemplate>
  );
}
