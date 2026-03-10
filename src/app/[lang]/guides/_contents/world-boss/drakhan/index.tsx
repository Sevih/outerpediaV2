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

/* ── Version: 12-2025 ──────────────────────────────────── */
import v12Strings from './versions/12-2025/strings.json';
import v12Teams from './versions/12-2025/teams.json';
import v12Recommended from './versions/12-2025/recommended.json';
import v12Tips from './versions/12-2025/tips.json';

/* ── Boss data (default mode: Extreme) ───────────────── */
import boss4086035 from '@data/boss/4086035.json';
import boss4086036 from '@data/boss/4086036.json';

const preloadedBosses: Record<string, Boss> = {
  '4086035': boss4086035 as unknown as Boss,
  '4086036': boss4086036 as unknown as Boss,
};

/* ── Version: 12-2024 ──────────────────────────────────── */
import v10Strings from './versions/12-2024/strings.json';

/* ── Typed data ─────────────────────────────────────────── */

const dec2025 = {
  strings: v12Strings as Record<string, LangMap>,
  teams: v12Teams as TeamData,
  phase1: v12Recommended.phase1 as CharacterRecommendation[],
  phase2: v12Recommended.phase2 as CharacterRecommendation[],
  tips: v12Tips as Record<string, LangMap[]>,
};

const dec2024 = {
  strings: v10Strings as Record<string, LangMap>,
};

/* ── Boss config ────────────────────────────────────────── */

const bossConfig = {
  boss1Key: 'Drakhan',
  boss2Key: 'Drakhan',
  boss1Ids: {
    Normal: '4086031',
    'Very Hard': '4086033',
    Extreme: '4086035',
  },
  boss2Ids: {
    Hard: '4086032',
    'Very Hard': '4086034',
    Extreme: '4086036',
  },
} as const;

/* ── Component ──────────────────────────────────────────── */

export default function DrakhanGuide() {
  const { lang } = useI18n();

  return (
    <GuideTemplate
      title={lRec(dec2025.strings.title, lang)}
      introduction={lRec(dec2025.strings.intro, lang)}
      defaultVersion="december2025"
      versions={{
        december2025: {
          label: lRec(dec2025.strings.label, lang),
          content: (
            <>
              <WorldBossDisplay config={bossConfig} defaultMode="Extreme" preloadedBosses={preloadedBosses} />
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
              <CombatFootage
                videoId="C-Oz2uDfuwc"
                title="Drakhan - World Boss - SSS - Extreme League"
                author="Sevih"
                date="31/12/2025"
              />
            </>
          ),
        },
        december2024: {
          label: lRec(dec2024.strings.label, lang),
          content: (
            <>
              <div>
                <h2 className="text-xl font-bold text-sky-300 mb-3 after:hidden">
                  {lRec(dec2024.strings.title, lang)}
                </h2>
                <p className="mb-4 text-sm text-zinc-300">
                  {lRec(dec2024.strings.intro, lang)}
                  <strong>Ducky</strong>:
                </p>
              </div>
              <CombatFootage
                videoId="tX4Xhm4byAY"
                title="Holy Night Dianne Summons, Testing, and New World Boss"
                author="Ducky"
                date="20/12/2024"
              />
            </>
          ),
        },
      }}
    />
  );
}
