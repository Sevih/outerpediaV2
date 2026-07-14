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
} from '@/types/joint-challenge';

/* -- Shared data ---------------------------------------------- */
import strings from './strings.json';
import defaultConfig from './config.json';

/* -- Version: 07-2026 ---------------------------------------- */
import v0726Config from './versions/07-2026/config.json';
import v0726Tips from './versions/07-2026/tips.json';
import v0726Recommended from './versions/07-2026/recommended.json';
import v0726Teams from './versions/07-2026/teams.json';

/* -- Version: 02-2026 ---------------------------------------- */
import v0226Config from './versions/02-2026/config.json';
import v0226Tips from './versions/02-2026/tips.json';
import v0226Recommended from './versions/02-2026/recommended.json';
import v0226Teams from './versions/02-2026/teams.json';

/* -- Version: 08-2025 ---------------------------------------- */
import v0825Config from './versions/08-2025/config.json';
import v0825Tips from './versions/08-2025/tips.json';
import v0825Recommended from './versions/08-2025/recommended.json';
import v0825Teams from './versions/08-2025/teams.json';

/* -- Version: 01-2024 ---------------------------------------- */
import v0124Config from './versions/01-2024/config.json';

/* -- Typed JSON casts (JSON imports have literal types) -------- */
function loadBoss(id: string, suffix = ''): Boss {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require(`@data/boss/${id}${suffix}.json`) as Boss;
}
const defaults = defaultConfig as JointChallengeDefaultConfig;
const str = strings as Record<string, LangMap>;

/* -- Config resolve ------------------------------------------- */

type ResolvedVersion = {
  label: LangMap;
  boss: { id: string; data: Boss };
  bossSuffix?: string;
};

function resolve(override: JointChallengeVersionOverride): ResolvedVersion {
  const id = override.boss?.id ?? defaults.boss.id;
  const suffix = override.boss?.version != null ? `-${override.boss.version}` : '';
  return {
    label: override.label,
    boss: { id, data: loadBoss(id, suffix) },
    bossSuffix: suffix || undefined,
  };
}

/* -- Typed data ----------------------------------------------- */

const jul2026 = {
  ...resolve(v0726Config as JointChallengeVersionOverride),
  tips: v0726Tips as Record<string, LangMap[]>,
  recommended: v0726Recommended as CharacterRecommendation[],
  teams: v0726Teams as TeamData,
};

const feb2026 = {
  ...resolve(v0226Config as JointChallengeVersionOverride),
  tips: v0226Tips as Record<string, LangMap[]>,
  recommended: v0226Recommended as CharacterRecommendation[],
  teams: v0226Teams as TeamData,
};

const aug2025 = {
  ...resolve(v0825Config as JointChallengeVersionOverride),
  tips: v0825Tips as Record<string, LangMap[]>,
  recommended: v0825Recommended as CharacterRecommendation[],
  teams: v0825Teams as TeamData,
};

const legacy2024 = {
  label: (v0124Config as JointChallengeVersionOverride).label,
};

/* -- Component ------------------------------------------------ */

export default function ShichifujaGuide() {
  const { lang } = useI18n();

  return (
    <GuideTemplate
      title={lRec(str.title, lang)}
      introduction={lRec(str.intro, lang)}
      defaultVersion="july2026"
      versions={{
        july2026: {
          label: lRec(jul2026.label, lang),
          content: (
            <>
              <BossDisplay
                bossName="Shichifuja"
                modeKey="Joint Challenge"
                defaultBossId={jul2026.boss.id}
                preloadedBosses={{ [jul2026.boss.id]: jul2026.boss.data }}
                bossFileSuffix={jul2026.bossSuffix}
              />
              <hr className="my-6 border-neutral-700" />
              <TacticalTips
                sections={[{ title: 'tactical', tips: jul2026.tips.tactical }]}
              />
              <hr className="my-6 border-neutral-700" />
              <RecommendedCharacterList entries={jul2026.recommended} />
              <hr className="my-6 border-neutral-700" />
              <StageBasedTeamSelector teamData={jul2026.teams} defaultStage="Recommended Team" />
              <hr className="my-6 border-neutral-700" />
              <CombatFootage
                videoId="wVCW6qVT64A"
                title="Shichifuja - Joint Challenge - Very Hard Mode"
                author="Sevih"
                date="14/07/2026"
              />
            </>
          ),
        },
        february2026: {
          label: lRec(feb2026.label, lang),
          content: (
            <>
              <BossDisplay
                bossName="Shichifuja"
                modeKey="Joint Challenge"
                defaultBossId={feb2026.boss.id}
                preloadedBosses={{ [feb2026.boss.id]: feb2026.boss.data }}
                bossFileSuffix={feb2026.bossSuffix}
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
          label: lRec(aug2025.label, lang),
          content: (
            <>
              <BossDisplay
                bossName="Shichifuja"
                modeKey="Joint Challenge"
                defaultBossId={aug2025.boss.id}
                preloadedBosses={{ [aug2025.boss.id]: aug2025.boss.data }}
                bossFileSuffix={aug2025.bossSuffix}
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
              <MultiVideoEmbed
                hashPrefix="shichifuja-aug2025-video"
                videos={[
                  {
                    platform: 'youtube',
                    id: 'hcJ6L4DwjWA',
                    title: 'Shichifuja — Very Hard — 1 run clear',
                    author: 'Sevih',
                    label: 'Sevih',
                  },
                  {
                    platform: 'youtube',
                    id: 'FK0_YUVU1K0',
                    title: 'Shichifuja — Very Hard — 1 run clear',
                    author: 'ダイス',
                    label: 'ダイス',
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
