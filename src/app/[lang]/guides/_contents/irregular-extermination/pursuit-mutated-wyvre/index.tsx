'use client';

import GuideTemplate from '@/app/components/guides/GuideTemplate';
import BossDisplay from '@/app/components/guides/BossDisplay';
import TacticalTips from '@/app/components/guides/TacticalTips';
import RecommendedCharacterList from '@/app/components/guides/RecommendedCharacterList';
import StageBasedTeamSelector from '@/app/components/guides/StageBasedTeamSelector';
import CombatFootage from '@/app/components/guides/CombatFootage';
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

import boss51202003 from '@data/boss/51202003.json';

/* ── Typed data ─────────────────────────────────────────── */

const str = strings as Record<string, LangMap>;
const teams = teamsData as TeamData;
const recommended = recommendedData as CharacterRecommendation[];
const tips = tipsData as Record<string, LangMap[]>;

const preloadedBosses: Record<string, Boss> = {
  '51202003': boss51202003 as unknown as Boss,
};

/* ── Component ──────────────────────────────────────────── */

export default function PursuitMutatedWyvreGuide() {
  const { lang } = useI18n();

  return (
    <GuideTemplate
      title={lRec(str.title, lang)}
    >
      <BossDisplay
        bossName="Mutated Wyvre"
        modeKey="Pursuit Operation"
        defaultBossId="51202003"
        preloadedBosses={preloadedBosses}
      />
      <hr className="my-6 border-neutral-700" />
      <TacticalTips sections={[{ title: 'tactical', tips: tips.tactical }]} />
      <hr className="my-6 border-neutral-700" />
      <RecommendedCharacterList entries={recommended} />
      <hr className="my-6 border-neutral-700" />
      <StageBasedTeamSelector teamData={teams} defaultStage="One Run Kill" />
      <hr className="my-6 border-neutral-700" />
      <CombatFootage
        videoId="PCgNRKFlRGI"
        title={lRec(str.video_title, lang)}
        author="Sevih"
        date="09/05/2025"
      />
    </GuideTemplate>
  );
}
