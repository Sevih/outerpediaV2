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

/* ── Version: 12-2025 ──────────────────────────────────── */
import v12Config from './versions/12-2025/config.json';
import v12Strings from './versions/12-2025/strings.json';
import v12Teams from './versions/12-2025/teams.json';
import v12Recommended from './versions/12-2025/recommended.json';
import v12Tips from './versions/12-2025/tips.json';

/* ── Version: 10-2024 ──────────────────────────────────── */
import v10Config from './versions/10-2024/config.json';
import v10Strings from './versions/10-2024/strings.json';

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

const dec2025 = {
  ...resolve(v12Config as WorldBossVersionOverride),
  strings: v12Strings as Record<string, LangMap>,
  teams: v12Teams as TeamData,
  phase1: v12Recommended.phase1 as CharacterRecommendation[],
  phase2: v12Recommended.phase2 as CharacterRecommendation[],
  tips: v12Tips as Record<string, LangMap[]>,
};

const oct2024 = {
  label: (v10Config as WorldBossVersionOverride).label,
  strings: v10Strings as Record<string, LangMap>,
};

/* ── Component ──────────────────────────────────────────── */

export default function RagnakeusGuide() {
  const { lang } = useI18n();

  return (
    <GuideTemplate
      title={lRec(dec2025.strings.title, lang)}
      introduction={lRec(dec2025.strings.intro, lang)}
      defaultVersion="december2025"
      versions={{
        december2025: {
          label: lRec(dec2025.label, lang),
          content: (
            <>
              <WorldBossDisplay
                config={dec2025.boss}
                defaultMode="Extreme"
                preloadedBosses={dec2025.preloaded}
                bossFileSuffix={dec2025.bossSuffix}
              />
              <hr className="my-6 border-neutral-700" />
              <TacticalTips
                sections={[
                  { title: 'strategy', tips: dec2025.tips.strategy },
                  { title: 'phase1', tips: dec2025.tips.phase1 },
                  { title: 'phase2', tips: dec2025.tips.phase2 },
                ]}
              />
              <hr className="my-6 border-neutral-700" />
              <RecommendedCharacterList title="phase1" entries={dec2025.phase1} />
              <RecommendedCharacterList title="phase2" entries={dec2025.phase2} />
              <hr className="my-6 border-neutral-700" />
              <StageBasedTeamSelector teamData={dec2025.teams} defaultStage="Phase 1" />
              <hr className="my-6 border-neutral-700" />
              <MultiVideoEmbed
                hashPrefix="ragnakeus-dec2025-video"
                videos={[
                  {
                    platform: 'youtube',
                    id: '8SU0TH6_DY4',
                    title: 'Dragon of Death Ragnakeus — Extreme — SSS rank',
                    author: 'Sevih',
                    label: 'Sevih',
                  },
                  {
                    platform: 'youtube',
                    id: 'vJy2cCOoRo0',
                    title: 'Dragon of Death Ragnakeus — Extreme — SSS rank',
                    author: 'ダイス',
                    label: 'ダイス',
                  },
                ]}
              />
            </>
          ),
        },
        october2024: {
          label: lRec(oct2024.label, lang),
          content: (
            <>
              <div>
                <h2 className="text-xl font-bold text-sky-300 mb-3 after:hidden">
                  {lRec(oct2024.strings.title, lang)}
                </h2>
                <p className="mb-4 text-sm text-zinc-300">
                  {lRec(oct2024.strings.intro, lang)}
                  <strong>Ducky</strong>:
                </p>
              </div>
              <CombatFootage
                videoId="vR_FaPyptRk"
                title="15mil Ragnakeus World Boss Guide"
                author="Ducky"
                date="01/12/2025"
              />
            </>
          ),
        },
      }}
    />
  );
}
