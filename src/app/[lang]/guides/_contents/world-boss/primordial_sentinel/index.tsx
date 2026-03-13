'use client';

import GuideTemplate from '@/app/components/guides/GuideTemplate';
import WorldBossDisplay from '@/app/components/guides/WorldBossDisplay';
import TacticalTips from '@/app/components/guides/TacticalTips';
import RecommendedCharacterList from '@/app/components/guides/RecommendedCharacterList';
import StageBasedTeamSelector from '@/app/components/guides/StageBasedTeamSelector';
import CombatFootage from '@/app/components/guides/CombatFootage';
import { useI18n } from '@/lib/contexts/I18nContext';
import { lRec } from '@/lib/i18n/localize';
import parseText from '@/lib/parse-text';
import type { Boss } from '@/types/boss';
import type { LangMap } from '@/types/common';
import type { TeamData } from '@/types/team';
import type { CharacterRecommendation } from '@/app/components/guides/RecommendedCharacterList';

/* ── Version: 03-2026 ──────────────────────────────────── */
import v03_26Strings from './versions/03-2026/strings.json';
import v03_26Teams from './versions/03-2026/teams.json';
import v03_26Recommended from './versions/03-2026/recommended.json';
import v03_26Tips from './versions/03-2026/tips.json';

/* ── Version: 11-2025 ──────────────────────────────────── */
import v11Strings from './versions/11-2025/strings.json';
import v11Teams from './versions/11-2025/teams.json';
import v11Recommended from './versions/11-2025/recommended.json';
import v11Tips from './versions/11-2025/tips.json';

/* ── Version: 07-2024 ──────────────────────────────────── */
import v07Strings from './versions/07-2024/strings.json';
import v07Tips from './versions/07-2024/tips.json';

/* ── Boss data (default mode: Extreme) ───────────────── */
import boss4086011 from '@data/boss/4086011.json';
import boss4086012 from '@data/boss/4086012.json';

const preloadedBosses: Record<string, Boss> = {
  '4086011': boss4086011 as unknown as Boss,
  '4086012': boss4086012 as unknown as Boss,
};

/* ── Typed data ─────────────────────────────────────────── */

const mar2026 = {
  strings: v03_26Strings as Record<string, LangMap>,
  teams: v03_26Teams as TeamData,
  phase1: v03_26Recommended.phase1 as CharacterRecommendation[],
  phase2: v03_26Recommended.phase2 as CharacterRecommendation[],
  tips: v03_26Tips as Record<string, LangMap[]>,
};

const nov2025 = {
  strings: v11Strings as Record<string, LangMap>,
  teams: v11Teams as TeamData,
  phase1: v11Recommended.phase1 as CharacterRecommendation[],
  phase2: v11Recommended.phase2 as CharacterRecommendation[],
  tips: v11Tips as Record<string, LangMap[]>,
};

const jul2024 = {
  strings: v07Strings as Record<string, LangMap>,
  tips: v07Tips as Record<string, LangMap[]>,
};

/* ── Boss config ────────────────────────────────────────── */

const bossConfig = {
  boss1Key: 'Primordial Sentinel',
  boss2Key: 'Glorious Sentinel',
  boss1Ids: {
    Normal: '4086007',
    'Very Hard': '4086009',
    Extreme: '4086011',
  },
  boss2Ids: {
    Hard: '4086008',
    'Very Hard': '4086010',
    Extreme: '4086012',
  },
} as const;

/* ── Component ──────────────────────────────────────────── */

export default function PrimordialSentinelGuide() {
  const { lang } = useI18n();

  return (
    <GuideTemplate
      title={lRec(mar2026.strings.title, lang)}
      introduction={lRec(mar2026.strings.intro, lang)}
      defaultVersion="march2026"
      versions={{
        march2026: {
          label: lRec(mar2026.strings.label, lang),
          content: (
            <>
              <WorldBossDisplay config={bossConfig} defaultMode="Extreme" preloadedBosses={preloadedBosses} />
              <hr className="my-6 border-neutral-700" />
              <TacticalTips
                sections={[
                  { title: 'phase1', tips: mar2026.tips.phase1 },
                  { title: 'transition', tips: mar2026.tips.transition },
                ]}
              />
              <hr className="my-6 border-neutral-700" />
              <RecommendedCharacterList title="phase1" entries={mar2026.phase1} />
              <RecommendedCharacterList title="phase2" entries={mar2026.phase2} />
              <hr className="my-6 border-neutral-700" />
              <StageBasedTeamSelector teamData={mar2026.teams} defaultStage="Phase 1" />
            </>
          ),
        },
        november2025: {
          label: lRec(nov2025.strings.label, lang),
          content: (
            <>
              <WorldBossDisplay config={bossConfig} defaultMode="Extreme" preloadedBosses={preloadedBosses} />
              <hr className="my-6 border-neutral-700" />
              <TacticalTips
                sections={[
                  { title: 'strategy', tips: nov2025.tips.strategy },
                  { title: 'phase2', tips: nov2025.tips.phase2 },
                ]}
              />
              <hr className="my-6 border-neutral-700" />
              <RecommendedCharacterList title="phase1" entries={nov2025.phase1} />
              <RecommendedCharacterList title="phase2" entries={nov2025.phase2} />
              <hr className="my-6 border-neutral-700" />
              <StageBasedTeamSelector teamData={nov2025.teams} defaultStage="Phase 1" />
              <hr className="my-6 border-neutral-700" />
              <CombatFootage
                videoId="4me_DqMftbs"
                title="Primordial Sentinel - World Boss - SSS - Extreme League"
                author="Unknown"
                date="01/11/2025"
              />
            </>
          ),
        },
        july2024: {
          label: lRec(jul2024.strings.label, lang),
          content: (
            <>
              <TacticalTips
                sections={[
                  { title: 'phase1', tips: jul2024.tips.phase1 },
                  { title: 'phase2', tips: jul2024.tips.phase2 },
                ]}
              />
              <hr className="my-6 border-neutral-700" />
              <div>
                <h2 className="text-xl font-bold text-sky-300 mb-3 after:hidden">
                  {lRec(jul2024.strings.title, lang)}
                </h2>
                <p className="text-neutral-300 mb-4">{parseText(lRec(jul2024.strings.note1, lang))}</p>
                <p className="text-neutral-300 mb-4">{parseText(lRec(jul2024.strings.note2, lang))}</p>
                <p className="text-neutral-300">{parseText(lRec(jul2024.strings.note3, lang))}</p>
              </div>
              <hr className="my-6 border-neutral-700" />
              <CombatFootage
                videoId="Kd-dKroOXEo"
                title="Glorious Sentinel World Boss 23mil+ by Ducky"
                author="Ducky"
                date="01/07/2024"
              />
            </>
          ),
        },
      }}
    />
  );
}
