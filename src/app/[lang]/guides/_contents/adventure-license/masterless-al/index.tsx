'use client';

import GuideTemplate from '@/app/components/guides/GuideTemplate';
import BossDisplay from '@/app/components/guides/BossDisplay';
import MinionDisplay from '@/app/components/guides/MinionDisplay';
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

import boss51000001 from '@data/boss/51000001.json';

/* ── Typed data ─────────────────────────────────────────── */

const str = strings as Record<string, LangMap>;
const teams = teamsData as unknown as TeamData;
const recommended = recommendedData as CharacterRecommendation[];
const tips = tipsData as Record<string, LangMap[]>;

const preloadedBosses: Record<string, Boss> = {
  '51000001': boss51000001 as unknown as Boss,
};


/* ── Component ──────────────────────────────────────────── */

export default function MasterlessALGuide() {
  const { lang } = useI18n();

  return (
    <GuideTemplate
      title={lRec(str.title, lang)}
      introduction={lRec(str.intro, lang)}
    >
      <BossDisplay
        bossName="Masterless Guardian"
        modeKey="Adventure License"
        defaultBossId="51000001"
        preloadedBosses={preloadedBosses}
      />
      <MinionDisplay entries={[
        { bossName: 'Mini Guardian', modeKey: 'Adventure License', versionIndex: 0 },
        { bossName: 'Mini Guardian', modeKey: 'Adventure License', versionIndex: 0 },
      ]} />
      <hr className="my-6 border-neutral-700" />
      <TacticalTips sections={[{ title: 'tactical', tips: tips.tactical }]} />
      <hr className="my-6 border-neutral-700" />
      <RecommendedCharacterList entries={recommended} />
      <hr className="my-6 border-neutral-700" />
      <StageBasedTeamSelector teamData={teams} defaultStage="Recommended Team" />
    </GuideTemplate>
  );
}
