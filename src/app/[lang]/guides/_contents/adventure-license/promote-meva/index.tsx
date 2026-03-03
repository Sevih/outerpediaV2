'use client';

import GuideTemplate from '@/app/components/guides/GuideTemplate';
import BossDisplay from '@/app/components/guides/BossDisplay';
import TacticalTips from '@/app/components/guides/TacticalTips';
import RecommendedCharacterList from '@/app/components/guides/RecommendedCharacterList';
import StageBasedTeamSelector from '@/app/components/guides/StageBasedTeamSelector';
import { useI18n } from '@/lib/contexts/I18nContext';
import { lRec } from '@/lib/i18n/localize';
import type { Boss } from '@/types/boss';
import type { LangMap } from '@/types/common';
import type { TeamData } from '@/types/team';
import type { CharacterRecommendation } from '@/app/components/guides/RecommendedCharacterList';

import strings from './strings.json';
import teamsData from './teams.json';
import recommendedData from './recommended.json';
import tipsData from './tips.json';

import boss50000008 from '@data/boss/50000008.json';
import boss50000009 from '@data/boss/50000009.json';

/* ── Typed data ─────────────────────────────────────────── */

const str = strings as Record<string, LangMap>;
const teams = teamsData as unknown as TeamData;
const recommended = recommendedData as CharacterRecommendation[];
const tips = tipsData as Record<string, LangMap[]>;

const preloadedBosses: Record<string, Boss> = {
  '50000008': boss50000008 as unknown as Boss,
  '50000009': boss50000009 as unknown as Boss,
};

/* ── Component ──────────────────────────────────────────── */

export default function PromMevaGuide() {
  const { lang } = useI18n();

  return (
    <GuideTemplate
      title={lRec(str.title, lang)}
      introduction={lRec(str.intro, lang)}
    >
      <div className="space-y-4">
        <BossDisplay
          bossName="Monad Eva"
          modeKey="Challenge"
          defaultBossId="50000008"
          preloadedBosses={preloadedBosses}
        />
        <BossDisplay
          bossName="K"
          modeKey="Challenge"
          defaultBossId="50000009"
          preloadedBosses={preloadedBosses}
        />
      </div>
      <hr className="my-6 border-neutral-700" />
      <TacticalTips sections={[{ title: 'tactical', tips: tips.tactical }]} />
      <hr className="my-6 border-neutral-700" />
      <RecommendedCharacterList entries={recommended} />
      <hr className="my-6 border-neutral-700" />
      <StageBasedTeamSelector teamData={teams} defaultStage="Fixed Damage Team" />
    </GuideTemplate>
  );
}
