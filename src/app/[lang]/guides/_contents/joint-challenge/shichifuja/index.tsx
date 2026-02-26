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

/* -- Version: 02-2026 ---------------------------------------- */
import v0226Strings from './versions/02-2026/strings.json';
import v0226Tips from './versions/02-2026/tips.json';
import v0226Recommended from './versions/02-2026/recommended.json';
import v0226Teams from './versions/02-2026/teams.json';

/* -- Version: 08-2025 ---------------------------------------- */
import v0825Strings from './versions/08-2025/strings.json';
import v0825Tips from './versions/08-2025/tips.json';
import v0825Recommended from './versions/08-2025/recommended.json';
import v0825Teams from './versions/08-2025/teams.json';

/* -- Version: 01-2024 ---------------------------------------- */
import v0124Strings from './versions/01-2024/strings.json';

/* -- Boss data ------------------------------------------------ */
import boss4634084 from '@data/boss/4634084.json';

const preloadedBosses: Record<string, Boss> = {
  '4634084': boss4634084 as unknown as Boss,
};

/* -- Typed data ----------------------------------------------- */

const feb2026 = {
  strings: v0226Strings as Record<string, LangMap>,
  tips: v0226Tips as Record<string, LangMap[]>,
  recommended: v0226Recommended as CharacterRecommendation[],
  teams: v0226Teams as TeamData,
};

const aug2025 = {
  strings: v0825Strings as Record<string, LangMap>,
  tips: v0825Tips as Record<string, LangMap[]>,
  recommended: v0825Recommended as CharacterRecommendation[],
  teams: v0825Teams as TeamData,
};

const legacy2024 = {
  strings: v0124Strings as Record<string, LangMap>,
};

/* -- Component ------------------------------------------------ */

export default function ShichifujaGuide() {
  const { lang } = useI18n();

  return (
    <GuideTemplate
      title={lRec(feb2026.strings.title, lang)}
      introduction={lRec(feb2026.strings.intro, lang)}
      defaultVersion="february2026"
      versions={{
        february2026: {
          label: lRec(feb2026.strings.label, lang),
          content: (
            <>
              <BossDisplay
                bossName="Shichifuja"
                modeKey="Joint Challenge"
                defaultBossId="4634084"
                preloadedBosses={preloadedBosses}
              />
              <hr className="my-6 border-neutral-700" />
              <TacticalTips
                sections={[{ title: 'tactical', tips: feb2026.tips.tactical }]}
              />
              <hr className="my-6 border-neutral-700" />
              <RecommendedCharacterList entries={feb2026.recommended} />
              <hr className="my-6 border-neutral-700" />
              <StageBasedTeamSelector teamData={feb2026.teams} defaultStage="Recommended Team" />
              <hr className="my-6 border-neutral-700" />
              <CombatFootage
                videoId="OmtZiNdwiGk"
                title="Shichifuja - Joint Challenge - Very Hard"
                author="Sevih"
                date="24/02/2026"
              />
            </>
          ),
        },
        august2025: {
          label: lRec(aug2025.strings.label, lang),
          content: (
            <>
              <BossDisplay
                bossName="Shichifuja"
                modeKey="Joint Challenge"
                defaultBossId="4634084"
                preloadedBosses={preloadedBosses}
              />
              <hr className="my-6 border-neutral-700" />
              <TacticalTips
                sections={[{ title: 'tactical', tips: aug2025.tips.tactical }]}
              />
              <hr className="my-6 border-neutral-700" />
              <RecommendedCharacterList entries={aug2025.recommended} />
              <hr className="my-6 border-neutral-700" />
              <StageBasedTeamSelector teamData={aug2025.teams} defaultStage="Recommended Team" />
              <hr className="my-6 border-neutral-700" />
              <CombatFootage
                videoId="hcJ6L4DwjWA"
                title="Shichifuja - Joint Challenge - Very Hard"
                author="Sevih"
                date="19/08/2025"
              />
            </>
          ),
        },
        legacy2024: {
          label: lRec(legacy2024.strings.label, lang),
          content: (
            <>
              <CombatFootage
                videoId="EjCfC5roxiQ"
                title="Shichifuja Joint Challenge Max Score"
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
