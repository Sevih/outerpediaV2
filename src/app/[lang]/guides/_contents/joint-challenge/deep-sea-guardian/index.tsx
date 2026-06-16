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

/* -- Version: 06-2026 ---------------------------------------- */
import v0626Config from './versions/06-2026/config.json';
import v0626Tips from './versions/06-2026/tips.json';
import v0626Recommended from './versions/06-2026/recommended.json';
import v0626Teams from './versions/06-2026/teams.json';

/* -- Version: 01-2026 ---------------------------------------- */
import v0126Config from './versions/01-2026/config.json';
import v0126Tips from './versions/01-2026/tips.json';
import v0126Recommended from './versions/01-2026/recommended.json';
import v0126Teams from './versions/01-2026/teams.json';

/* -- Version: 07-2025 ---------------------------------------- */
import v0725Config from './versions/07-2025/config.json';
import v0725Tips from './versions/07-2025/tips.json';
import v0725Recommended from './versions/07-2025/recommended.json';
import v0725Teams from './versions/07-2025/teams.json';

/* -- Version: 03-2025 ---------------------------------------- */
import v0325Config from './versions/03-2025/config.json';
import v0325Tips from './versions/03-2025/tips.json';
import v0325Recommended from './versions/03-2025/recommended.json';
import v0325Teams from './versions/03-2025/teams.json';

/* -- Version: 10-2024 ---------------------------------------- */
import v1024Config from './versions/10-2024/config.json';

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

const jun2026 = {
  ...resolve(v0626Config as JointChallengeVersionOverride),
  tips: v0626Tips as Record<string, LangMap[]>,
  recommended: v0626Recommended as CharacterRecommendation[],
  teams: v0626Teams as TeamData,
};

const jan2026 = {
  ...resolve(v0126Config as JointChallengeVersionOverride),
  tips: v0126Tips as Record<string, LangMap[]>,
  recommended: v0126Recommended as CharacterRecommendation[],
  teams: v0126Teams as TeamData,
};

const jul2025 = {
  ...resolve(v0725Config as JointChallengeVersionOverride),
  tips: v0725Tips as Record<string, LangMap[]>,
  recommended: v0725Recommended as CharacterRecommendation[],
  teams: v0725Teams as TeamData,
};

const mar2025 = {
  ...resolve(v0325Config as JointChallengeVersionOverride),
  tips: v0325Tips as Record<string, LangMap[]>,
  recommended: v0325Recommended as CharacterRecommendation[],
  teams: v0325Teams as TeamData,
};

const legacy2024 = {
  label: (v1024Config as JointChallengeVersionOverride).label,
};

/* -- Component ------------------------------------------------ */

export default function DeepSeaGuardianGuide() {
  const { lang } = useI18n();

  return (
    <GuideTemplate
      title={lRec(str.title, lang)}
      introduction={lRec(str.intro, lang)}
      defaultVersion="june2026"
      versions={{
        june2026: {
          label: lRec(jun2026.label, lang),
          content: (
            <>
              <BossDisplay
                bossName="Deep Sea Guardian"
                modeKey="Joint Challenge"
                defaultBossId={jun2026.boss.id}
                preloadedBosses={{ [jun2026.boss.id]: jun2026.boss.data }}
                bossFileSuffix={jun2026.bossSuffix}
              />
              <hr className="my-6 border-neutral-700" />
              <TacticalTips
                sections={[{ title: 'tactical', tips: jun2026.tips.tactical }]}
              />
              <hr className="my-6 border-neutral-700" />
              <RecommendedCharacterList entries={jun2026.recommended} />
              <hr className="my-6 border-neutral-700" />
              <StageBasedTeamSelector teamData={jun2026.teams} defaultStage="Recommended Team" />
            </>
          ),
        },
        january2026: {
          label: lRec(jan2026.label, lang),
          content: (
            <>
              <BossDisplay
                bossName="Deep Sea Guardian"
                modeKey="Joint Challenge"
                defaultBossId={jan2026.boss.id}
                preloadedBosses={{ [jan2026.boss.id]: jan2026.boss.data }}
                bossFileSuffix={jan2026.bossSuffix}
              />
              <hr className="my-6 border-neutral-700" />
              <TacticalTips
                sections={[{ title: 'tactical', tips: jan2026.tips.tactical }]}
              />
              <hr className="my-6 border-neutral-700" />
              <RecommendedCharacterList entries={jan2026.recommended} />
              <hr className="my-6 border-neutral-700" />
              <StageBasedTeamSelector teamData={jan2026.teams} defaultStage="Recommended Team" />
              <hr className="my-6 border-neutral-700" />
              <MultiVideoEmbed
                videos={[
                  {
                    platform: 'youtube',
                    id: 'BoWdGr5fnGw',
                    title: 'Deep Sea Guardian — Very Hard — 6 turn clear',
                    author: 'ダイス',
                  },
                ]}
              />
            </>
          ),
        },
        july2025: {
          label: lRec(jul2025.label, lang),
          content: (
            <>
              <BossDisplay
                bossName="Deep Sea Guardian"
                modeKey="Joint Challenge"
                defaultBossId={jul2025.boss.id}
                preloadedBosses={{ [jul2025.boss.id]: jul2025.boss.data }}
                bossFileSuffix={jul2025.bossSuffix}
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
              <MultiVideoEmbed
                hashPrefix="deep-sea-jul2025-video"
                videos={[
                  {
                    platform: 'youtube',
                    id: 'ScFXrrOeVNk',
                    title: 'Deep Sea Guardian — Very Hard — 1 run clear',
                    author: 'Sevih',
                    label: 'Sevih',
                  },
                  {
                    platform: 'youtube',
                    id: '65GWPELsbk8',
                    title: 'Deep Sea Guardian — Very Hard — 1 run clear',
                    author: 'ダイス',
                    label: 'ダイス',
                  },
                  {
                    platform: 'youtube',
                    id: 'phzS6t9JqbE',
                    title: 'Deep Sea Guardian — Max single hit damage challenge',
                    author: 'ダイス',
                    label: 'ダイス (Max DMG)',
                  },
                ]}
              />
            </>
          ),
        },
        march2025: {
          label: lRec(mar2025.label, lang),
          content: (
            <>
              <BossDisplay
                bossName="Deep Sea Guardian"
                modeKey="Joint Challenge"
                defaultBossId={mar2025.boss.id}
                preloadedBosses={{ [mar2025.boss.id]: mar2025.boss.data }}
                bossFileSuffix={mar2025.bossSuffix}
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
          label: lRec(legacy2024.label, lang),
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
