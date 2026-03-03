'use client';

import { useState } from 'react';
import GuideTemplate from '@/app/components/guides/GuideTemplate';
import BossDisplay from '@/app/components/guides/BossDisplay';
import MinionDisplay from '@/app/components/guides/MinionDisplay';
import TacticalTips from '@/app/components/guides/TacticalTips';
import RecommendedCharacterList from '@/app/components/guides/RecommendedCharacterList';
import { useI18n } from '@/lib/contexts/I18nContext';
import { lRec } from '@/lib/i18n/localize';
import type { Boss } from '@/types/boss';
import type { LangMap } from '@/types/common';
import type { CharacterRecommendation } from '@/app/components/guides/RecommendedCharacterList';

import strings from './strings.json';
import recommendedData from './recommended.json';
import tipsData from './tips.json';

import boss4500265 from '@data/boss/4500265.json';
import boss4500266 from '@data/boss/4500266.json';

/* ── Typed data ─────────────────────────────────────────── */

const str = strings as Record<string, LangMap>;
const recommended = recommendedData as CharacterRecommendation[];
const tips = tipsData as Record<string, LangMap[]>;

const preloadedBosses: Record<string, Boss> = {
  '4500265': boss4500265 as unknown as Boss,
  '4500266': boss4500266 as unknown as Boss,
};

// Normal mode (4500265) → Sand Soldier Khopesh normal (4002201), Hard mode (4500266) → hard (4102201)
const MINION_IDS = ['4002201', '4102201'];

/* ── Component ──────────────────────────────────────────── */

export default function FatalGuide() {
  const { lang } = useI18n();
  const [minionIndex, setMinionIndex] = useState(1); // default: hard mode

  return (
    <GuideTemplate
      title={lRec(str.title, lang)}
      introduction={lRec(str.intro, lang)}
    >
      <BossDisplay
        bossName="Fatal"
        versionIds={['4500265', '4500266']}
        defaultBossId="4500266"
        preloadedBosses={preloadedBosses}
        onVersionChange={setMinionIndex}
      />
      <MinionDisplay
        entries={[
          { bossName: 'Sand Soldier Khopesh', versionIndex: 0, defaultBossId: MINION_IDS[minionIndex] },
          { bossName: 'Sand Soldier Khopesh', versionIndex: 0, defaultBossId: MINION_IDS[minionIndex] },
        ]}
      />
      <hr className="my-6 border-neutral-700" />
      <TacticalTips sections={[{ title: 'tactical', tips: tips.tactical }]} />
      <hr className="my-6 border-neutral-700" />
      <RecommendedCharacterList entries={recommended} />
    </GuideTemplate>
  );
}
