'use client';

import GuideTemplate from '@/app/components/guides/GuideTemplate';
import WorldBossDisplay from '@/app/components/guides/WorldBossDisplay';
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
  WorldBossMode,
  WorldBossConfig,
  WorldBossDefaultConfig,
  WorldBossVersionOverride,
} from '@/types/world-boss';

/* ── Shared data ────────────────────────────────────────── */
import defaultConfig from './config.json';

/* ── Version: 05-2026 ──────────────────────────────────── */
import v05Config from './versions/05-2026/config.json';
import v05Strings from './versions/05-2026/strings.json';
import v05Teams from './versions/05-2026/teams.json';
import v05Recommended from './versions/05-2026/recommended.json';
import v05Tips from './versions/05-2026/tips.json';

/* ── Version: 07-2025 ──────────────────────────────────── */
import v07Config from './versions/07-2025/config.json';
import v07Strings from './versions/07-2025/strings.json';
import v07Teams from './versions/07-2025/teams.json';
import v07Recommended from './versions/07-2025/recommended.json';
import v07Tips from './versions/07-2025/tips.json';

/* ── Version: legacy-2024 ──────────────────────────────── */
import vLegacyConfig from './versions/legacy-2024/config.json';
import vLegacyStrings from './versions/legacy-2024/strings.json';

/* ── Config merge ───────────────────────────────────────── */
const DEFAULT_MODE: WorldBossMode = 'Extreme';

function loadBoss(id: string, suffix = ''): Boss {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require(`@data/boss/${id}${suffix}.json`) as Boss;
}
const defaults = defaultConfig as WorldBossDefaultConfig;

function preloadMode(boss: WorldBossConfig, suffix: string | undefined, mode: WorldBossMode): Record<string, Boss> {
  const ids = [boss.boss1Ids[mode], boss.boss2Ids[mode]].filter(Boolean) as string[];
  return Object.fromEntries(ids.map((id) => [id, loadBoss(id, suffix)]));
}

type ResolvedVersion = {
  label: LangMap;
  boss: WorldBossConfig;
  bossSuffix?: string;
  preloaded: Record<string, Boss>;
};

function resolve(override: WorldBossVersionOverride): ResolvedVersion {
  const boss = defaults.boss;
  const suffix = override.boss?.version != null ? `-${override.boss.version}` : undefined;
  return {
    label: override.label,
    boss,
    bossSuffix: suffix,
    preloaded: preloadMode(boss, suffix, DEFAULT_MODE),
  };
}

/* ── Typed data ─────────────────────────────────────────── */

const may2026 = {
  ...resolve(v05Config as WorldBossVersionOverride),
  strings: v05Strings as Record<string, LangMap>,
  teams: v05Teams as TeamData,
  phase1: v05Recommended.phase1 as CharacterRecommendation[],
  phase2: v05Recommended.phase2 as CharacterRecommendation[],
  tips: v05Tips as Record<string, LangMap[]>,
};

const jul2025 = {
  ...resolve(v07Config as WorldBossVersionOverride),
  strings: v07Strings as Record<string, LangMap>,
  teams: v07Teams as TeamData,
  phase1: v07Recommended.phase1 as CharacterRecommendation[],
  phase2: v07Recommended.phase2 as CharacterRecommendation[],
  tips: v07Tips as Record<string, LangMap[]>,
};

const legacy2024 = {
  label: (vLegacyConfig as WorldBossVersionOverride).label,
  strings: vLegacyStrings as Record<string, LangMap>,
};

/* ── Component ──────────────────────────────────────────── */

export default function HarshnaGuide() {
  const { lang } = useI18n();

  return (
    <GuideTemplate
      title={lRec(may2026.strings.title, lang)}
      introduction={lRec(may2026.strings.intro, lang)}
      updating
      defaultVersion="may2026"
      versions={{
        may2026: {
          label: lRec(may2026.label, lang),
          content: (
            <>
              <WorldBossDisplay
                config={may2026.boss}
                defaultMode="Extreme"
                preloadedBosses={may2026.preloaded}
                bossFileSuffix={may2026.bossSuffix}
              />
              <hr className="my-6 border-neutral-700" />
              <TacticalTips
                sections={[
                  { title: 'phase1', tips: may2026.tips.phase1 },
                  { title: 'phase2', tips: may2026.tips.phase2 },
                ]}
              />
              <hr className="my-6 border-neutral-700" />
              <RecommendedCharacterList title="phase1" entries={may2026.phase1} />
              <RecommendedCharacterList title="phase2" entries={may2026.phase2} />
              <hr className="my-6 border-neutral-700" />
              <StageBasedTeamSelector teamData={may2026.teams} defaultStage="No Debuff Team" />
              <hr className="my-6 border-neutral-700" />
              <MultiVideoEmbed
                hashPrefix="harshna-jul2025-video"
                videos={[
                  {
                    platform: 'youtube',
                    id: 's9NPUwuSHGI',
                    title: 'Harshna — Extreme — SSS rank',
                    author: 'Sevih',
                    label: 'Extreme — SSS rank',
                  }
                ]}
              />
            </>
          ),
        },
        july2025: {
          label: lRec(jul2025.label, lang),
          content: (
            <>
              <WorldBossDisplay
                config={jul2025.boss}
                defaultMode="Extreme"
                preloadedBosses={jul2025.preloaded}
                bossFileSuffix={jul2025.bossSuffix}
              />
              <hr className="my-6 border-neutral-700" />
              <TacticalTips
                sections={[
                  { title: 'phase1', tips: jul2025.tips.phase1 },
                  { title: 'phase2', tips: jul2025.tips.phase2 },
                ]}
              />
              <hr className="my-6 border-neutral-700" />
              <RecommendedCharacterList title="phase1" entries={jul2025.phase1} />
              <RecommendedCharacterList title="phase2" entries={jul2025.phase2} />
              <hr className="my-6 border-neutral-700" />
              <StageBasedTeamSelector teamData={jul2025.teams} defaultStage="No Debuff Team" />
              <hr className="my-6 border-neutral-700" />
              <MultiVideoEmbed
                hashPrefix="harshna-jul2025-video"
                videos={[
                  {
                    platform: 'youtube',
                    id: '13vcQM1kMEg',
                    title: 'Harshna — Extreme — SSS rank',
                    author: 'Sevih',
                    label: 'Sevih',
                  },
                  {
                    platform: 'youtube',
                    id: 'XunI9dzNJ_U',
                    title: 'Harshna — Extreme — Final day (Comp C)',
                    author: 'ダイス',
                    label: 'ダイス (Comp C)',
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
              <div>
                <h2 className="text-xl font-bold text-sky-300 mb-3 after:hidden">
                  {lRec(legacy2024.strings.title, lang)}
                </h2>
                <p className="mb-4 text-sm text-zinc-300">
                  {lRec(legacy2024.strings.intro, lang)}
                  <strong>Ducky</strong>:
                </p>
              </div>
              <CombatFootage
                videoId="32qJPmuJDyg"
                title="Harsha World Boss 23mil. 1 Hour Long Fight"
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
