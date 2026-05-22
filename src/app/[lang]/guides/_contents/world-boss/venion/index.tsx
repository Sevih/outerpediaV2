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

/* ── Version: 01-2026 ──────────────────────────────────── */
import v01Config from './versions/01-2026/config.json';
import v01Strings from './versions/01-2026/strings.json';
import v01Teams from './versions/01-2026/teams.json';
import v01Recommended from './versions/01-2026/recommended.json';
import v01Tips from './versions/01-2026/tips.json';

/* ── Version: 06-2025 ──────────────────────────────────── */
import v06Config from './versions/06-2025/config.json';
import v06Strings from './versions/06-2025/strings.json';

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

const jan2026 = {
  ...resolve(v01Config as WorldBossVersionOverride),
  strings: v01Strings as Record<string, LangMap>,
  teams: v01Teams as TeamData,
  phase1: v01Recommended.phase1 as CharacterRecommendation[],
  phase2: v01Recommended.phase2 as CharacterRecommendation[],
  tips: v01Tips as Record<string, LangMap[]>,
};

const jun2025 = {
  label: (v06Config as WorldBossVersionOverride).label,
  strings: v06Strings as Record<string, LangMap>,
};

const legacy2024 = {
  label: (vLegacyConfig as WorldBossVersionOverride).label,
  strings: vLegacyStrings as Record<string, LangMap>,
};

/* ── Component ──────────────────────────────────────────── */

export default function VenionGuide() {
  const { lang } = useI18n();

  return (
    <GuideTemplate
      title={lRec(jan2026.strings.title, lang)}
      introduction={lRec(jan2026.strings.intro, lang)}
      defaultVersion="january2026"
      versions={{
        january2026: {
          label: lRec(jan2026.label, lang),
          content: (
            <>
              <WorldBossDisplay
                config={jan2026.boss}
                defaultMode="Extreme"
                preloadedBosses={jan2026.preloaded}
                bossFileSuffix={jan2026.bossSuffix}
              />
              <hr className="my-6 border-neutral-700" />
              <TacticalTips
                sections={[
                  { title: 'strategy', tips: jan2026.tips.strategy },
                  { title: 'phase1', tips: jan2026.tips.phase1 },
                  { title: 'phase2', tips: jan2026.tips.phase2 },
                ]}
              />
              <hr className="my-6 border-neutral-700" />
              <RecommendedCharacterList title="phase1" entries={jan2026.phase1} />
              <RecommendedCharacterList title="phase2" entries={jan2026.phase2} />
              <hr className="my-6 border-neutral-700" />
              <StageBasedTeamSelector teamData={jan2026.teams} defaultStage="Light and Dark" />
              <hr className="my-6 border-neutral-700" />
              <MultiVideoEmbed
                hashPrefix="venion-jan2026-video"
                videos={[
                  {
                    platform: 'youtube',
                    id: '8YNWM3dErpo',
                    title: 'Venion — Extreme — SSS rank',
                    author: 'Sevih',
                    label: 'Sevih',
                  },
                  {
                    platform: 'youtube',
                    id: 'pz-MRSpPNVk',
                    title: 'Venion — Extreme — Score 30M',
                    author: 'ダイス',
                    label: 'ダイス (30M)',
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
              <div>
                <h2 className="text-xl font-bold text-sky-300 mb-3 after:hidden">
                  {lRec(jun2025.strings.title, lang)}
                </h2>
                <p className="mb-4 text-sm text-zinc-300">
                  {lRec(jun2025.strings.intro, lang)}
                  <strong>Sevih</strong>:
                </p>
              </div>
              <CombatFootage
                videoId="SCAR0AeIsLU"
                title="Venion - World Boss - SSS - Extreme League"
                author="Sevih"
                date="01/06/2025"
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
                  <strong>Adjen</strong>:
                </p>
              </div>
              <CombatFootage
                videoId="PxdLAUgbBPg"
                title="SSS Extreme League World Boss Venion! [Outerplane]"
                author="Adjen"
                date="01/12/2024"
              />
            </>
          ),
        },
      }}
    />
  );
}
