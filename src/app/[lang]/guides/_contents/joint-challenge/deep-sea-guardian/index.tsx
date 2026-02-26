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

/* -- Version: 01-2026 ---------------------------------------- */
import v0126Strings from './versions/01-2026/strings.json';
import v0126Tips from './versions/01-2026/tips.json';
import v0126Recommended from './versions/01-2026/recommended.json';
import v0126Teams from './versions/01-2026/teams.json';

/* -- Version: 07-2025 ---------------------------------------- */
import v0725Strings from './versions/07-2025/strings.json';
import v0725Tips from './versions/07-2025/tips.json';
import v0725Recommended from './versions/07-2025/recommended.json';
import v0725Teams from './versions/07-2025/teams.json';

/* -- Version: 03-2025 ---------------------------------------- */
import v0325Strings from './versions/03-2025/strings.json';
import v0325Tips from './versions/03-2025/tips.json';
import v0325Recommended from './versions/03-2025/recommended.json';
import v0325Teams from './versions/03-2025/teams.json';

/* -- Version: 10-2024 ---------------------------------------- */
import v1024Strings from './versions/10-2024/strings.json';

/* -- Boss data ------------------------------------------------ */
import boss4134065 from '@data/boss/4134065.json';

const preloadedBosses: Record<string, Boss> = {
  '4134065': boss4134065 as unknown as Boss,
};

/* -- Typed data ----------------------------------------------- */

const jan2026 = {
  strings: v0126Strings as Record<string, LangMap>,
  tips: v0126Tips as Record<string, LangMap[]>,
  recommended: v0126Recommended as CharacterRecommendation[],
  teams: v0126Teams as TeamData,
};

const jul2025 = {
  strings: v0725Strings as Record<string, LangMap>,
  tips: v0725Tips as Record<string, LangMap[]>,
  recommended: v0725Recommended as CharacterRecommendation[],
  teams: v0725Teams as TeamData,
};

const mar2025 = {
  strings: v0325Strings as Record<string, LangMap>,
  tips: v0325Tips as Record<string, LangMap[]>,
  recommended: v0325Recommended as CharacterRecommendation[],
  teams: v0325Teams as TeamData,
};

const legacy2024 = {
  strings: v1024Strings as Record<string, LangMap>,
};

/* -- Component ------------------------------------------------ */

export default function DeepSeaGuardianGuide() {
  const { lang } = useI18n();

  return (
    <GuideTemplate
      title={lRec(jan2026.strings.title, lang)}
      introduction={lRec(jan2026.strings.intro, lang)}
      defaultVersion="january2026"
      versions={{
        january2026: {
          label: lRec(jan2026.strings.label, lang),
          content: (
            <>
              <BossDisplay
                bossName="Deep Sea Guardian"
                modeKey="Joint Challenge"
                defaultBossId="4134065"
                preloadedBosses={preloadedBosses}
              />
              <hr className="my-6 border-neutral-700" />
              <TacticalTips
                sections={[{ title: 'tactical', tips: jan2026.tips.tactical }]}
              />
              <hr className="my-6 border-neutral-700" />
              <RecommendedCharacterList entries={jan2026.recommended} />
              <hr className="my-6 border-neutral-700" />
              <StageBasedTeamSelector teamData={jan2026.teams} defaultStage="Recommended Team" />
            </>
          ),
        },
        july2025: {
          label: lRec(jul2025.strings.label, lang),
          content: (
            <>
              <BossDisplay
                bossName="Deep Sea Guardian"
                modeKey="Joint Challenge"
                defaultBossId="4134065"
                preloadedBosses={preloadedBosses}
              />
              <hr className="my-6 border-neutral-700" />
              <TacticalTips
                sections={[{ title: 'tactical', tips: jul2025.tips.tactical }]}
              />
              <hr className="my-6 border-neutral-700" />
              <RecommendedCharacterList entries={jul2025.recommended} />
              <hr className="my-6 border-neutral-700" />
              <StageBasedTeamSelector teamData={jul2025.teams} defaultStage="Recommended Team" />
              <hr className="my-6 border-neutral-700" />
              <CombatFootage
                videoId="ScFXrrOeVNk"
                title="Deep Sea Guardian - Joint Challenge - Very Hard"
                author="Sevih"
                date="23/07/2025"
              />
            </>
          ),
        },
        march2025: {
          label: lRec(mar2025.strings.label, lang),
          content: (
            <>
              <BossDisplay
                bossName="Deep Sea Guardian"
                modeKey="Joint Challenge"
                defaultBossId="4134065"
                preloadedBosses={preloadedBosses}
              />
              <hr className="my-6 border-neutral-700" />
              <TacticalTips
                sections={[{ title: 'tactical', tips: mar2025.tips.tactical }]}
              />
              <hr className="my-6 border-neutral-700" />
              <RecommendedCharacterList entries={mar2025.recommended} />
              <hr className="my-6 border-neutral-700" />
              <StageBasedTeamSelector teamData={mar2025.teams} defaultStage="Recommended Team" />
            </>
          ),
        },
        legacy2024: {
          label: lRec(legacy2024.strings.label, lang),
          content: (
            <>
              <CombatFootage
                videoId="pHi3CcaWhn0"
                title="Deep Sea Guardian Joint Challenge Max Score"
                author="Ducky"
                date="02/10/2024"
              />
            </>
          ),
        },
      }}
    />
  );
}
