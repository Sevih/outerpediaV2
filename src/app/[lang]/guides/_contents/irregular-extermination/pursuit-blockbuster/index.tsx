'use client';

import GuideTemplate from '@/app/components/guides/GuideTemplate';
import BossDisplay from '@/app/components/guides/BossDisplay';
import LootTable from '@/app/components/guides/LootTable';
import TacticalTips from '@/app/components/guides/TacticalTips';
import RecommendedCharacterList from '@/app/components/guides/RecommendedCharacterList';
import StageBasedTeamSelector from '@/app/components/guides/StageBasedTeamSelector';
import CombatFootage from '@/app/components/guides/CombatFootage';
import MultiVideoEmbed from '@/app/components/ui/MultiVideoEmbed';
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

import boss51202002 from '@data/boss/51202002.json';

/* ── Typed data ─────────────────────────────────────────── */

const str = strings as Record<string, LangMap>;
const teams = teamsData as TeamData;
const recommended = recommendedData as CharacterRecommendation[];
const tips = tipsData as Record<string, LangMap[]>;

const preloadedBosses: Record<string, Boss> = {
  '51202002': boss51202002 as unknown as Boss,
};

/* ── Component ──────────────────────────────────────────── */

export default function PursuitBlockbusterGuide() {
  const { lang } = useI18n();

  return (
    <GuideTemplate
      title={lRec(str.title, lang)}
    >
      <LootTable bossId="51202002" />
      <BossDisplay
        bossName="Blockbuster"
        modeKey="Pursuit Operation"
        defaultBossId="51202002"
        preloadedBosses={preloadedBosses}
      />
      <hr className="my-6 border-neutral-700" />
      <TacticalTips sections={[{ title: 'tactical', tips: tips.tactical }]} />
      <hr className="my-6 border-neutral-700" />
      <RecommendedCharacterList entries={recommended} />
      <hr className="my-6 border-neutral-700" />
      <StageBasedTeamSelector teamData={teams} defaultStage="Non-Crit Team" />
      <hr className="my-6 border-neutral-700" />
      <MultiVideoEmbed
        hashPrefix="blockbuster-video"
        videos={[
          {
            platform: 'youtube',
            id: 'pgWkc6X6VNE',
            title: 'Blockbuster — 1 run clear',
            author: 'Sevih',
            label: 'Sevih',
          },
          {
            platform: 'youtube',
            id: 'cHA0BvTevSo',
            title: 'Blockbuster — 1 run clear (gift reset, no damage, full auto)',
            author: 'ダイス',
            label: 'ダイス (Gift Reset)',
          },
          {
            platform: 'youtube',
            id: 'rfBH2EpszRA',
            title: 'Blockbuster — 9 turn clear (no damage)',
            author: 'ダイス',
            label: 'ダイス (9T No DMG)',
          },
          {
            platform: 'youtube',
            id: 'WGWNplB0S-E',
            title: 'Blockbuster — Very Hard — 1 run clear',
            author: 'ダイス',
            label: 'ダイス (VH)',
          },
        ]}
      />
    </GuideTemplate>
  );
}
