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

/* ── Version: 05-2026 ──────────────────────────────────── */
import v05Strings from './versions/05-2026/strings.json';
import v05Teams from './versions/05-2026/teams.json';
import v05Recommended from './versions/05-2026/recommended.json';
import v05Tips from './versions/05-2026/tips.json';

/* ── Version: 07-2025 ──────────────────────────────────── */
import v07Strings from './versions/07-2025/strings.json';
import v07Teams from './versions/07-2025/teams.json';
import v07Recommended from './versions/07-2025/recommended.json';
import v07Tips from './versions/07-2025/tips.json';

/* ── Boss data (default mode: Extreme) ───────────────── */
import boss4086029 from '@data/boss/4086029.json';
import boss4086030 from '@data/boss/4086030.json';

const preloadedBosses: Record<string, Boss> = {
  '4086029': boss4086029 as unknown as Boss,
  '4086030': boss4086030 as unknown as Boss,
};

/* ── Version: legacy-2024 ──────────────────────────────── */
import vLegacyStrings from './versions/legacy-2024/strings.json';

/* ── Typed data ─────────────────────────────────────────── */

const may2026 = {
  strings: v05Strings as Record<string, LangMap>,
  teams: v05Teams as TeamData,
  phase1: v05Recommended.phase1 as CharacterRecommendation[],
  phase2: v05Recommended.phase2 as CharacterRecommendation[],
  tips: v05Tips as Record<string, LangMap[]>,
};

const jul2025 = {
  strings: v07Strings as Record<string, LangMap>,
  teams: v07Teams as TeamData,
  phase1: v07Recommended.phase1 as CharacterRecommendation[],
  phase2: v07Recommended.phase2 as CharacterRecommendation[],
  tips: v07Tips as Record<string, LangMap[]>,
};

const legacy2024 = {
  strings: vLegacyStrings as Record<string, LangMap>,
};

/* ── Boss config ────────────────────────────────────────── */

const bossConfig = {
  boss1Key: 'Revenant Dragon Harshna',
  boss2Key: 'Frozen Dragon of Phantasm Harshna',
  boss1Ids: {
    Normal: '4086025',
    'Very Hard': '4086027',
    Extreme: '4086029',
  },
  boss2Ids: {
    Hard: '4086026',
    'Very Hard': '4086028',
    Extreme: '4086030',
  },
} as const;

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
          label: lRec(may2026.strings.label, lang),
          content: (
            <>
              <WorldBossDisplay config={bossConfig} defaultMode="Extreme" preloadedBosses={preloadedBosses} />
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
          label: lRec(jul2025.strings.label, lang),
          content: (
            <>
              <WorldBossDisplay config={bossConfig} defaultMode="Extreme" preloadedBosses={preloadedBosses} />
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
          label: lRec(legacy2024.strings.label, lang),
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
