'use client';

import { useState, useCallback } from 'react';
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

import boss404400362 from '@data/boss/404400362.json';

/* ── Typed data ─────────────────────────────────────────── */

const str = strings as Record<string, LangMap>;
const teams = teamsData as TeamData;
const recommended = recommendedData as CharacterRecommendation[];
const tips = tipsData as Record<string, LangMap[]>;

const preloadedBosses: Record<string, Boss> = {
  '404400362': boss404400362 as unknown as Boss,
};

/* ── Core boss ID mapping ───────────────────────────────── */

const CORE_IDS = ['404400462', '404400461', '404400460', '404400459', '404400450'];

function getCoreId(versionIndex: number): string {
  return CORE_IDS[Math.min(versionIndex, CORE_IDS.length - 1)];
}

/* ── Component ──────────────────────────────────────────── */

export default function SacreedGuardianGuide() {
  const { lang } = useI18n();
  const [coreId, setCoreId] = useState(CORE_IDS[0]);

  const handleVersionChange = useCallback((index: number) => {
    setCoreId(getCoreId(index));
  }, []);

  return (
    <GuideTemplate
      title={lRec(str.title, lang)}
      introduction={lRec(str.intro, lang)}
    >
      <BossDisplay
        bossName="Sacreed Guardian"
        modeKey="Special Request: Ecology Study"
        defaultBossId="404400362"
        preloadedBosses={preloadedBosses}
        onVersionChange={handleVersionChange}
      />
      <BossDisplay
        key={coreId}
        bossName="Deformed Inferior Core"
        modeKey="Special Request: Ecology Study"
        defaultBossId={coreId}
      />
      <hr className="my-6 border-neutral-700" />
      <TacticalTips sections={[{ title: 'tactical', tips: tips.tactical }]} />
      <hr className="my-6 border-neutral-700" />
      <RecommendedCharacterList entries={recommended} />
      <hr className="my-6 border-neutral-700" />
      <StageBasedTeamSelector teamData={teams} defaultStage="1-10" />
      <hr className="my-6 border-neutral-700" />
      <CombatFootage
        videoId="fLdbR9Sa7G0"
        title="Sacreed Guardian 13 – Clean Run Showcase"
        author="Sevih"
        date="09/05/2025"
      />
    </GuideTemplate>
  );
}
