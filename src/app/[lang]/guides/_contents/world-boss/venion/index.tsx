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

/* ── Version: 01-2026 ──────────────────────────────────── */
import v01Strings from './versions/01-2026/strings.json';
import v01Teams from './versions/01-2026/teams.json';
import v01Recommended from './versions/01-2026/recommended.json';
import v01Tips from './versions/01-2026/tips.json';

/* ── Boss data (default mode: Extreme) ───────────────── */
import boss4086017 from '@data/boss/4086017.json';
import boss4086018 from '@data/boss/4086018.json';

const preloadedBosses: Record<string, Boss> = {
  '4086017': boss4086017 as unknown as Boss,
  '4086018': boss4086018 as unknown as Boss,
};

/* ── Version: 06-2025 ──────────────────────────────────── */
import v06Strings from './versions/06-2025/strings.json';

/* ── Version: legacy-2024 ──────────────────────────────── */
import vLegacyStrings from './versions/legacy-2024/strings.json';

/* ── Typed data ─────────────────────────────────────────── */

const jan2026 = {
  strings: v01Strings as Record<string, LangMap>,
  teams: v01Teams as TeamData,
  phase1: v01Recommended.phase1 as CharacterRecommendation[],
  phase2: v01Recommended.phase2 as CharacterRecommendation[],
  tips: v01Tips as Record<string, LangMap[]>,
};

const jun2025 = {
  strings: v06Strings as Record<string, LangMap>,
};

const legacy2024 = {
  strings: vLegacyStrings as Record<string, LangMap>,
};

/* ── Boss config ────────────────────────────────────────── */

const bossConfig = {
  boss1Key: 'Walking Fortress Vault Venion',
  boss2Key: 'Uncharted Fortress Vault Venion',
  boss1Ids: {
    Normal: '4086013',
    'Very Hard': '4086015',
    Extreme: '4086017',
  },
  boss2Ids: {
    Hard: '4086014',
    'Very Hard': '4086016',
    Extreme: '4086018',
  },
} as const;

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
          label: lRec(jan2026.strings.label, lang),
          content: (
            <>
              <WorldBossDisplay config={bossConfig} defaultMode="Extreme" preloadedBosses={preloadedBosses} />
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
              <CombatFootage
                videoId="8YNWM3dErpo"
                title="Venion - World Boss - SSS - Extreme League"
                author="Sevih"
                date="27/01/2026"
              />
            </>
          ),
        },
        june2025: {
          label: lRec(jun2025.strings.label, lang),
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
          label: lRec(legacy2024.strings.label, lang),
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
