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

/* -- Version: 12-2025 ---------------------------------------- */
import v12Strings from './versions/12-2025/strings.json';
import v12Tips from './versions/12-2025/tips.json';
import v12Recommended from './versions/12-2025/recommended.json';
import v12Teams from './versions/12-2025/teams.json';

/* -- Version: 06-2025 ---------------------------------------- */
import v06Strings from './versions/06-2025/strings.json';
import v06Recommended from './versions/06-2025/recommended.json';
import v06Teams from './versions/06-2025/teams.json';

/* -- Version: 01-2024 ---------------------------------------- */
import v01Strings from './versions/01-2024/strings.json';

/* -- Boss data ------------------------------------------------ */
import boss4318062 from '@data/boss/4318062.json';

const preloadedBosses: Record<string, Boss> = {
  '4318062': boss4318062 as unknown as Boss,
};

/* -- Typed data ----------------------------------------------- */

const dec2025 = {
  strings: v12Strings as Record<string, LangMap>,
  tips: v12Tips as Record<string, LangMap[]>,
  recommended: v12Recommended as CharacterRecommendation[],
  teams: v12Teams as TeamData,
};

const jun2025 = {
  strings: v06Strings as Record<string, LangMap>,
  recommended: v06Recommended as CharacterRecommendation[],
  teams: v06Teams as TeamData,
};

const legacy2024 = {
  strings: v01Strings as Record<string, LangMap>,
};

/* -- Component ------------------------------------------------ */

export default function AnnihilatorGuide() {
  const { lang } = useI18n();

  return (
    <GuideTemplate
      title={lRec(dec2025.strings.title, lang)}
      introduction={lRec(dec2025.strings.intro, lang)}
      defaultVersion="december2025"
      versions={{
        december2025: {
          label: lRec(dec2025.strings.label, lang),
          content: (
            <>
              <BossDisplay
                bossName="Annihilator"
                modeKey="Joint Challenge"
                defaultBossId="4318062"
                preloadedBosses={preloadedBosses}
              />
              <hr className="my-6 border-neutral-700" />
              <TacticalTips
                sections={[{ title: 'tactical', tips: dec2025.tips.tactical }]}
              />
              <hr className="my-6 border-neutral-700" />
              <RecommendedCharacterList entries={dec2025.recommended} />
              <hr className="my-6 border-neutral-700" />
              <StageBasedTeamSelector teamData={dec2025.teams} defaultStage="Recommended Team" />
              <hr className="my-6 border-neutral-700" />
              <CombatFootage
                videoId="g64GWfYydvQ"
                title="Annihilator - Joint Challenge - Very Hard Mode"
                author="Sevih"
                date="23/12/2025"
              />
            </>
          ),
        },
        june2025: {
          label: lRec(jun2025.strings.label, lang),
          content: (
            <>
              <BossDisplay
                bossName="Annihilator"
                modeKey="Joint Challenge"
                defaultBossId="4318062"
                preloadedBosses={preloadedBosses}
              />
              <hr className="my-6 border-neutral-700" />
              <TacticalTips
                sections={[{ title: 'tactical', tips: dec2025.tips.tactical }]}
              />
              <hr className="my-6 border-neutral-700" />
              <RecommendedCharacterList entries={jun2025.recommended} />
              <hr className="my-6 border-neutral-700" />
              <StageBasedTeamSelector teamData={jun2025.teams} defaultStage="Recommended Team" />
              <hr className="my-6 border-neutral-700" />
              <CombatFootage
                videoId="5r3gji7y6E0"
                title="Annihilator - Joint Challenge - Very Hard Mode"
                author="Sevih"
                date="25/06/2025"
              />
            </>
          ),
        },
        legacy2024: {
          label: lRec(legacy2024.strings.label, lang),
          content: (
            <>
              <CombatFootage
                videoId="8d88RKTABNA"
                title="Annihilator Joint Boss"
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
