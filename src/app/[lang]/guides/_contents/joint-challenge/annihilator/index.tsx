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
import type {
  JointChallengeDefaultConfig,
  JointChallengeVersionOverride,
  JointChallengeVersionConfig,
} from '@/types/joint-challenge';

/* -- Shared data ---------------------------------------------- */
import strings from './strings.json';
import defaultConfig from './config.json';

/* -- Version: 05-2026 ---------------------------------------- */
import v05Config from './versions/05-2026/config.json';
import v05Tips from './versions/05-2026/tips.json';
import v05Recommended from './versions/05-2026/recommended.json';
import v05Teams from './versions/05-2026/teams.json';

/* -- Version: 12-2025 ---------------------------------------- */
import v12Config from './versions/12-2025/config.json';
import v12Tips from './versions/12-2025/tips.json';
import v12Recommended from './versions/12-2025/recommended.json';
import v12Teams from './versions/12-2025/teams.json';

/* -- Version: 06-2025 ---------------------------------------- */
import v06Config from './versions/06-2025/config.json';
import v06Recommended from './versions/06-2025/recommended.json';
import v06Teams from './versions/06-2025/teams.json';

/* -- Version: 01-2024 ---------------------------------------- */
import v01Config from './versions/01-2024/config.json';

/* -- Typed JSON casts (JSON imports have literal types) -------- */
function loadBoss(id: string, suffix = ''): Boss {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require(`@data/boss/${id}${suffix}.json`) as Boss;
}
const defaults = defaultConfig as JointChallengeDefaultConfig;
const str = strings as Record<string, LangMap>;

/* -- Config merge --------------------------------------------- */

function mergeConfig(override: JointChallengeVersionOverride): JointChallengeVersionConfig {
  return {
    label: override.label,
    boss: override.boss ?? defaults.boss,
    bossSuffix: override.bossSuffix,
  };
}

type ResolvedVersion = {
  label: LangMap;
  boss: { id: string; data: Boss };
  bossSuffix?: string;
};

function resolve(override: JointChallengeVersionOverride): ResolvedVersion {
  const config = mergeConfig(override);
  return {
    label: config.label,
    boss: { id: config.boss.id, data: loadBoss(config.boss.id, config.bossSuffix) },
    bossSuffix: config.bossSuffix,
  };
}

/* -- Typed data ----------------------------------------------- */

const may2026 = {
  ...resolve(v05Config as JointChallengeVersionOverride),
  tips: v05Tips as Record<string, LangMap[]>,
  recommended: v05Recommended as CharacterRecommendation[],
  teams: v05Teams as TeamData,
};

const dec2025 = {
  ...resolve(v12Config as JointChallengeVersionOverride),
  tips: v12Tips as Record<string, LangMap[]>,
  recommended: v12Recommended as CharacterRecommendation[],
  teams: v12Teams as TeamData,
};

const jun2025 = {
  ...resolve(v06Config as JointChallengeVersionOverride),
  recommended: v06Recommended as CharacterRecommendation[],
  teams: v06Teams as TeamData,
};

const legacy2024 = {
  label: (v01Config as JointChallengeVersionOverride).label,
};

/* -- Component ------------------------------------------------ */

export default function AnnihilatorGuide() {
  const { lang } = useI18n();

  return (
    <GuideTemplate
      title={lRec(str.title, lang)}
      introduction={lRec(str.intro, lang)}
      defaultVersion="may2026"
      versions={{
        may2026: {
          label: lRec(may2026.label, lang),
          content: (
            <>
              <BossDisplay
                bossName="Annihilator"
                modeKey="Joint Challenge"
                defaultBossId={may2026.boss.id}
                preloadedBosses={{ [may2026.boss.id]: may2026.boss.data }}
              />
              <hr className="my-6 border-neutral-700" />
              <TacticalTips
                sections={[{ title: 'tactical', tips: may2026.tips.tactical }]}
              />
              <hr className="my-6 border-neutral-700" />
              <RecommendedCharacterList entries={may2026.recommended} />
              <hr className="my-6 border-neutral-700" />
              <StageBasedTeamSelector teamData={may2026.teams} defaultStage="Recommended Team" />
              <hr className="my-6 border-neutral-700" />
              <MultiVideoEmbed
                hashPrefix="annihilator-may2026-video"
                videos={[
                  {
                    platform: 'youtube',
                    id: 'oN-pOB1x_Lc',
                    title: 'Annihilator — Very Hard — 1 run clear',
                    author: 'Sevih',
                    label: 'Sevih',
                  }
                ]}
              />
            </>
          ),
        },
        december2025: {
          label: lRec(dec2025.label, lang),
          content: (
            <>
              <BossDisplay
                bossName="Annihilator"
                modeKey="Joint Challenge"
                defaultBossId={dec2025.boss.id}
                preloadedBosses={{ [dec2025.boss.id]: dec2025.boss.data }}
                bossFileSuffix={dec2025.bossSuffix}
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
              <MultiVideoEmbed
                hashPrefix="annihilator-dec2025-video"
                videos={[
                  {
                    platform: 'youtube',
                    id: 'g64GWfYydvQ',
                    title: 'Annihilator — Very Hard — 1 run clear',
                    author: 'Sevih',
                    label: 'Sevih',
                  },
                  {
                    platform: 'youtube',
                    id: '-_czdjb-JsA',
                    title: 'Annihilator — Very Hard — 1 run clear',
                    author: 'ダイス',
                    label: 'ダイス',
                  },
                ]}
              />
            </>
          ),
        },
        june2025: {
          label: lRec(jun2025.label, lang),
          content: (
            <>
              <BossDisplay
                bossName="Annihilator"
                modeKey="Joint Challenge"
                defaultBossId={jun2025.boss.id}
                preloadedBosses={{ [jun2025.boss.id]: jun2025.boss.data }}
                bossFileSuffix={jun2025.bossSuffix}
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
              <MultiVideoEmbed
                hashPrefix="annihilator-jun2025-video"
                videos={[
                  {
                    platform: 'youtube',
                    id: '5r3gji7y6E0',
                    title: 'Annihilator — Very Hard — 1 run clear',
                    author: 'Sevih',
                    label: 'Sevih',
                  },
                  {
                    platform: 'youtube',
                    id: 'S_17kI3NbdM',
                    title: 'Annihilator — Very Hard — 1 run clear',
                    author: 'ダイス',
                    label: 'ダイス',
                  },
                  {
                    platform: 'youtube',
                    id: 'kC10KWfRY9I',
                    title: 'Annihilator — Max single hit damage challenge',
                    author: 'ダイス',
                    label: 'ダイス (Max DMG)',
                  },
                ]}
              />
            </>
          ),
        },
        legacy2024: {
          label: lRec(legacy2024.label, lang),
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
