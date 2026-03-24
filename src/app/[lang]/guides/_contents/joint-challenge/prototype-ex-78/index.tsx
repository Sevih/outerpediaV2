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

/* -- Version: 03-2026 ---------------------------------------- */
import v0326Strings from './versions/03-2026/strings.json';
import v0326Tips from './versions/03-2026/tips.json';
import v0326Recommended from './versions/03-2026/recommended.json';
import v0326Teams from './versions/03-2026/teams.json';

/* -- Version: 10-2025 ---------------------------------------- */
import v10Strings from './versions/10-2025/strings.json';
import v10Tips from './versions/10-2025/tips.json';
import v10Recommended from './versions/10-2025/recommended.json';
import v10Teams from './versions/10-2025/teams.json';

/* -- Version: 12-2024 ---------------------------------------- */
import v12Strings from './versions/12-2024/strings.json';

/* -- Boss data ------------------------------------------------ */
import boss4548181 from '@data/boss/4548181.json';

const preloadedBosses: Record<string, Boss> = {
  '4548181': boss4548181 as unknown as Boss,
};

/* -- Typed data ----------------------------------------------- */

const mar2026 = {
  strings: v0326Strings as Record<string, LangMap>,
  tips: v0326Tips as Record<string, LangMap[]>,
  recommended: v0326Recommended as CharacterRecommendation[],
  teams: v0326Teams as TeamData,
};

const oct2025 = {
  strings: v10Strings as Record<string, LangMap>,
  tips: v10Tips as Record<string, LangMap[]>,
  recommended: v10Recommended as CharacterRecommendation[],
  teams: v10Teams as TeamData,
};

const legacy2024 = {
  strings: v12Strings as Record<string, LangMap>,
};

/* -- Component ------------------------------------------------ */

export default function PrototypeEx78Guide() {
  const { lang } = useI18n();

  return (
    <GuideTemplate
      title={lRec(mar2026.strings.title, lang)}
      introduction={lRec(mar2026.strings.intro, lang)}
      defaultVersion="march2026"
      versions={{
        march2026: {
          label: lRec(mar2026.strings.label, lang),
          content: (
            <>
              <BossDisplay
                bossName="Prototype EX-78"
                modeKey="Joint Challenge"
                defaultBossId="4548181"
                preloadedBosses={preloadedBosses}
              />
              <hr className="my-6 border-neutral-700" />
              <TacticalTips
                sections={[{ title: 'tactical', tips: mar2026.tips.tactical }]}
              />
              <hr className="my-6 border-neutral-700" />
              <RecommendedCharacterList entries={mar2026.recommended} />
              <hr className="my-6 border-neutral-700" />
              <StageBasedTeamSelector teamData={mar2026.teams} defaultStage="Recommended Team" />
              <hr className="my-6 border-neutral-700" />
              <CombatFootage
                videoId="JojsTsS9kyU"
                title="Prototype EX-78 - Joint Challenge - Very Hard Mode"
                author="Sevih"
                date="24/03/2026"
              />
            </>
          ),
        },
        october2025: {
          label: lRec(oct2025.strings.label, lang),
          content: (
            <>
              <BossDisplay
                bossName="Prototype EX-78"
                modeKey="Joint Challenge"
                defaultBossId="4548181"
                preloadedBosses={preloadedBosses}
              />
              <hr className="my-6 border-neutral-700" />
              <TacticalTips
                sections={[{ title: 'tactical', tips: oct2025.tips.tactical }]}
              />
              <hr className="my-6 border-neutral-700" />
              <RecommendedCharacterList entries={oct2025.recommended} />
              <hr className="my-6 border-neutral-700" />
              <StageBasedTeamSelector teamData={oct2025.teams} defaultStage="Recommended Team" />
            </>
          ),
        },
        legacy2024: {
          label: lRec(legacy2024.strings.label, lang),
          content: (
            <>
              <CombatFootage
                videoId="UuspJgswwNQ"
                title="Prototype EX-78 Joint Challenge Max Score"
                author="Ducky"
                date="01/12/2024"
              />
            </>
          ),
        },
      }}
    />
  );
}
