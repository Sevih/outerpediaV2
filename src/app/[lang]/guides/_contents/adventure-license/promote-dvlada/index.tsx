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

import boss50000006 from '@data/boss/50000006.json';
import boss50000007 from '@data/boss/50000007.json';

/* ── Typed data ─────────────────────────────────────────── */

const str = strings as Record<string, LangMap>;
const teams = teamsData as unknown as TeamData;
const recommended = recommendedData as CharacterRecommendation[];
const tips = tipsData as Record<string, LangMap[]>;

const preloadedBosses: Record<string, Boss> = {
  '50000006': boss50000006 as unknown as Boss,
  '50000007': boss50000007 as unknown as Boss,
};

/* ── Component ──────────────────────────────────────────── */

export default function PromDvladaGuide() {
  const { lang } = useI18n();

  return (
    <GuideTemplate
      title={lRec(str.title, lang)}
      introduction={lRec(str.intro, lang)}
    >
      <BossDisplay
        bossName="Vlada"
        modeKey="Challenge"
        defaultBossId="50000006"
        preloadedBosses={preloadedBosses}
      />
      <BossDisplay
        bossName="Drakhan"
        modeKey="Challenge"
        defaultBossId="50000007"
        preloadedBosses={preloadedBosses}
      />
      <hr className="my-6 border-neutral-700" />
      <TacticalTips sections={[{ title: 'tactical', tips: tips.tactical }]} />
      <hr className="my-6 border-neutral-700" />
      <RecommendedCharacterList entries={recommended} />
      <hr className="my-6 border-neutral-700" />
      <StageBasedTeamSelector teamData={teams} defaultStage="Curse Team" />
      <hr className="my-6 border-neutral-700" />
      <CombatFootage
        videoId="JIx2mVtXufA"
        title="Demiurge Vlada - Adventure License: Promotion Challenge"
        author="Sevih"
        date="09/07/2025"
      />
    </GuideTemplate>
  );
}
