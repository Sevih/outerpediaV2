'use client';

import GuideTemplate from '@/app/components/guides/GuideTemplate';
import BossDisplay from '@/app/components/guides/BossDisplay';
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

/* -- Version: 04-2026 ---------------------------------------- */
import v04Strings from './versions/04-2026/strings.json';
import v04Tips from './versions/04-2026/tips.json';
import v04Recommended from './versions/04-2026/recommended.json';
import v04Teams from './versions/04-2026/teams.json';

/* -- Version: 11-2025 ---------------------------------------- */
import v11Strings from './versions/11-2025/strings.json';
import v11Tips from './versions/11-2025/tips.json';
import v11Recommended from './versions/11-2025/recommended.json';
import v11Teams from './versions/11-2025/teams.json';

/* -- Version: 05-2025 ---------------------------------------- */
import v05Strings from './versions/05-2025/strings.json';
import v05Tips from './versions/05-2025/tips.json';
import v05Recommended from './versions/05-2025/recommended.json';
import v05Teams from './versions/05-2025/teams.json';

/* -- Version: 01-2024 ---------------------------------------- */
import v01Strings from './versions/01-2024/strings.json';

/* -- Boss data ------------------------------------------------ */
import boss4176152 from '@data/boss/4176152.json';

const preloadedBosses: Record<string, Boss> = {
  '4176152': boss4176152 as unknown as Boss,
};

/* -- Typed data ----------------------------------------------- */

const apr2026 = {
  strings: v04Strings as Record<string, LangMap>,
  tips: v04Tips as Record<string, LangMap[]>,
  recommended: v04Recommended as CharacterRecommendation[],
  teams: v04Teams as TeamData,
};

const nov2025 = {
  strings: v11Strings as Record<string, LangMap>,
  tips: v11Tips as Record<string, LangMap[]>,
  recommended: v11Recommended as CharacterRecommendation[],
  teams: v11Teams as TeamData,
};

const may2025 = {
  strings: v05Strings as Record<string, LangMap>,
  tips: v05Tips as Record<string, LangMap[]>,
  recommended: v05Recommended as CharacterRecommendation[],
  teams: v05Teams as TeamData,
};

const legacy2024 = {
  strings: v01Strings as Record<string, LangMap>,
};

/* -- Component ------------------------------------------------ */

export default function KOHMeteosGuide() {
  const { lang } = useI18n();

  return (
    <GuideTemplate
      title={lRec(apr2026.strings.title, lang)}
      introduction={lRec(apr2026.strings.intro, lang)}
      defaultVersion="april2026"
      versions={{
        april2026: {
          label: lRec(apr2026.strings.label, lang),
          content: (
            <>
              <BossDisplay
                bossName="Knight of Hope Meteos"
                modeKey="Joint Challenge"
                defaultBossId="4176152"
                preloadedBosses={preloadedBosses}
              />
              <hr className="my-6 border-neutral-700" />
              <TacticalTips
                sections={[{ title: 'tactical', tips: apr2026.tips.tactical }]}
              />
              <hr className="my-6 border-neutral-700" />
              <RecommendedCharacterList entries={apr2026.recommended} />
              <hr className="my-6 border-neutral-700" />
              <StageBasedTeamSelector teamData={apr2026.teams} defaultStage="Recommended Team" />
              <hr className="my-6 border-neutral-700" />
              <MultiVideoEmbed
                hashPrefix="koh-meteos-apr2026-video"
                videos={[
                  {
                    platform: 'youtube',
                    id: 'YhiXf0_bVS0',
                    title: 'Knight of Hope Meteos - Joint Challenge - Very Hard Mode',
                    author: 'Sevih',
                  },
                ]}
              />
            </>
          ),
        },
        november2025: {
          label: lRec(nov2025.strings.label, lang),
          content: (
            <>
              <BossDisplay
                bossName="Knight of Hope Meteos"
                modeKey="Joint Challenge"
                defaultBossId="4176152"
                preloadedBosses={preloadedBosses}
              />
              <hr className="my-6 border-neutral-700" />
              <TacticalTips
                sections={[{ title: 'tactical', tips: nov2025.tips.tactical }]}
              />
              <hr className="my-6 border-neutral-700" />
              <RecommendedCharacterList entries={nov2025.recommended} />
              <hr className="my-6 border-neutral-700" />
              <StageBasedTeamSelector teamData={nov2025.teams} defaultStage="Recommended Team" />
              <hr className="my-6 border-neutral-700" />
              <MultiVideoEmbed
                videos={[
                  {
                    platform: 'youtube',
                    id: 'ju7o1UgbN6I',
                    title: 'Knight of Hope Meteos — Very Hard — 1 run clear',
                    author: 'ダイス',
                  },
                ]}
              />
            </>
          ),
        },
        may2025: {
          label: lRec(may2025.strings.label, lang),
          content: (
            <>
              <BossDisplay
                bossName="Knight of Hope Meteos"
                modeKey="Joint Challenge"
                defaultBossId="4176152"
                preloadedBosses={preloadedBosses}
              />
              <hr className="my-6 border-neutral-700" />
              <TacticalTips
                sections={[{ title: 'tactical', tips: may2025.tips.tactical }]}
              />
              <hr className="my-6 border-neutral-700" />
              <RecommendedCharacterList entries={may2025.recommended} />
              <hr className="my-6 border-neutral-700" />
              <StageBasedTeamSelector teamData={may2025.teams} defaultStage="Recommended Team" />
              <hr className="my-6 border-neutral-700" />
              <MultiVideoEmbed
                hashPrefix="koh-meteos-may2025-video"
                videos={[
                  {
                    platform: 'youtube',
                    id: 'g3LcTpm9fMo',
                    title: 'Knight of Hope Meteos — Very Hard — 1 run clear',
                    author: 'Sevih',
                    label: 'Sevih',
                  },
                  {
                    platform: 'youtube',
                    id: 'KqOYqObAQdg',
                    title: 'Knight of Hope Meteos — Very Hard — 1 run clear',
                    author: 'ダイス',
                    label: 'ダイス',
                  },
                ]}
              />
            </>
          ),
        },
        legacy2024: {
          label: lRec(legacy2024.strings.label, lang),
          content: (
            <>
              <CombatFootage
                videoId="X5bL_YZ73y4"
                title="Knight of Hope Meteos Joint Boss Max Score"
                author="Ducky"
                date="01/01/2024"
              />
            </>
          ),
        },
      }}
    />
  );
}
