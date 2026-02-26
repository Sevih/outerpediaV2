'use client';

import GuideTemplate from '@/app/components/guides/GuideTemplate';
import WorldBossDisplay from '@/app/components/guides/WorldBossDisplay';
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
      title={lRec(jul2025.strings.title, lang)}
      introduction={lRec(jul2025.strings.intro, lang)}
      defaultVersion="july2025"
      versions={{
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
              <CombatFootage
                videoId="13vcQM1kMEg"
                title="Harshna - World Boss - SSS - Extreme League"
                author="Sevih"
                date="01/07/2025"
              />
            </>
          ),
        },
        legacy2024: {
          label: lRec(legacy2024.strings.label, lang),
          content: (
            <>
              <div>
                <h3 className="text-xl font-bold text-sky-300 mb-3 after:hidden">
                  {lRec(legacy2024.strings.title, lang)}
                </h3>
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
