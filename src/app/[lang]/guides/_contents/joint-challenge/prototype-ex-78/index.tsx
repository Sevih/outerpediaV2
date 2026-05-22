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

/* -- Version: 03-2026 ---------------------------------------- */
import v0326Config from './versions/03-2026/config.json';
import v0326Tips from './versions/03-2026/tips.json';
import v0326Recommended from './versions/03-2026/recommended.json';
import v0326Teams from './versions/03-2026/teams.json';

/* -- Version: 10-2025 ---------------------------------------- */
import v10Config from './versions/10-2025/config.json';
import v10Tips from './versions/10-2025/tips.json';
import v10Recommended from './versions/10-2025/recommended.json';
import v10Teams from './versions/10-2025/teams.json';

/* -- Version: 12-2024 ---------------------------------------- */
import v12Config from './versions/12-2024/config.json';

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

const mar2026 = {
  ...resolve(v0326Config as JointChallengeVersionOverride),
  tips: v0326Tips as Record<string, LangMap[]>,
  recommended: v0326Recommended as CharacterRecommendation[],
  teams: v0326Teams as TeamData,
};

const oct2025 = {
  ...resolve(v10Config as JointChallengeVersionOverride),
  tips: v10Tips as Record<string, LangMap[]>,
  recommended: v10Recommended as CharacterRecommendation[],
  teams: v10Teams as TeamData,
};

const legacy2024 = {
  label: (v12Config as JointChallengeVersionOverride).label,
};

/* -- Component ------------------------------------------------ */

export default function PrototypeEx78Guide() {
  const { lang } = useI18n();

  return (
    <GuideTemplate
      title={lRec(str.title, lang)}
      introduction={lRec(str.intro, lang)}
      defaultVersion="march2026"
      versions={{
        march2026: {
          label: lRec(mar2026.label, lang),
          content: (
            <>
              <BossDisplay
                bossName="Prototype EX-78"
                modeKey="Joint Challenge"
                defaultBossId={mar2026.boss.id}
                preloadedBosses={{ [mar2026.boss.id]: mar2026.boss.data }}
                bossFileSuffix={mar2026.bossSuffix}
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
              <MultiVideoEmbed
                hashPrefix="ex78-mar2026-video"
                videos={[
                  {
                    platform: 'youtube',
                    id: 'JojsTsS9kyU',
                    title: 'Prototype EX-78 — Very Hard — 1 run clear',
                    author: 'Sevih',
                    label: 'Sevih',
                  },
                  {
                    platform: 'youtube',
                    id: '1gWGk6wrGKw',
                    title: 'Prototype EX-78 — Very Hard — 1 run clear (poison comp)',
                    author: 'ダイス',
                    label: 'ダイス (Poison)',
                  },
                ]}
              />
            </>
          ),
        },
        october2025: {
          label: lRec(oct2025.label, lang),
          content: (
            <>
              <BossDisplay
                bossName="Prototype EX-78"
                modeKey="Joint Challenge"
                defaultBossId={oct2025.boss.id}
                preloadedBosses={{ [oct2025.boss.id]: oct2025.boss.data }}
                bossFileSuffix={oct2025.bossSuffix}
              />
              <hr className="my-6 border-neutral-700" />
              <TacticalTips
                sections={[{ title: 'tactical', tips: oct2025.tips.tactical }]}
              />
              <hr className="my-6 border-neutral-700" />
              <RecommendedCharacterList entries={oct2025.recommended} />
              <hr className="my-6 border-neutral-700" />
              <StageBasedTeamSelector teamData={oct2025.teams} defaultStage="Recommended Team" />
              <hr className="my-6 border-neutral-700" />
              <MultiVideoEmbed
                hashPrefix="ex78-oct2025-video"
                videos={[
                  {
                    platform: 'youtube',
                    id: 'pqoL50bJaRY',
                    title: 'Prototype EX-78 — Very Hard — 1 run clear (Comp A)',
                    author: 'ダイス',
                    label: 'Comp A',
                  },
                  {
                    platform: 'youtube',
                    id: 'FDC42YQQOM8',
                    title: 'Prototype EX-78 — Very Hard — 1 run clear (Comp B)',
                    author: 'ダイス',
                    label: 'Comp B',
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
