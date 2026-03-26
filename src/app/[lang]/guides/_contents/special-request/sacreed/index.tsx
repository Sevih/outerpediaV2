'use client';

import { useState } from 'react';
import GuideTemplate from '@/app/components/guides/GuideTemplate';
import BossDisplay from '@/app/components/guides/BossDisplay';
import MinionDisplay from '@/app/components/guides/MinionDisplay';
import LootTable from '@/app/components/guides/LootTable';
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

const DEDICATED_CORE_IDS: Record<string, string> = {
  '404400362': '404400462', //stage 13
  '404400361': '404400461', //stage 12
  '404400360': '404400460', //stage 11
  '404400359': '404400459', //stage 10
};

function getCoreId(bossId: string): string {
  return DEDICATED_CORE_IDS[bossId] ?? `404400450S${bossId}`;
}

/* ── Component ──────────────────────────────────────────── */

export default function SacreedGuardianGuide() {
  const { lang } = useI18n();
  const [bossId, setBossId] = useState('404400362');

  return (
    <GuideTemplate
      title={lRec(str.title, lang)}
      introduction={lRec(str.intro, lang)}
    >
      <LootTable bossId="404400362" />
      <BossDisplay
        bossName="Sacreed Guardian"
        modeKey="Special Request: Ecology Study"
        defaultBossId="404400362"
        preloadedBosses={preloadedBosses}
        onBossIdChange={setBossId}
      />
      <MinionDisplay
        bossName="Deformed Inferior Core"
        modeKey="Special Request: Ecology Study"
        versionIndex={0}
        defaultBossId={getCoreId(bossId)}
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
