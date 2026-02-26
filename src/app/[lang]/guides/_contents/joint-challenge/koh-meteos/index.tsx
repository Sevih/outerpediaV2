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
      title={lRec(nov2025.strings.title, lang)}
      introduction={lRec(nov2025.strings.intro, lang)}
      defaultVersion="november2025"
      versions={{
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
              <CombatFootage
                videoId="g3LcTpm9fMo"
                title="Knight of Hope Meteos - Joint Challenge - Very Hard Mode"
                author="Sevih"
                date="15/05/2025"
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
