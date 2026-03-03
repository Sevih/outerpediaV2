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

import boss4500277 from '@data/boss/4500277.json';
import boss4500283 from '@data/boss/4500283.json';

/* ── Typed data ─────────────────────────────────────────── */

const str = strings as Record<string, LangMap>;
const recommended = recommendedData as CharacterRecommendation[];
const tips = tipsData as Record<string, LangMap[]>;

const preloadedBosses: Record<string, Boss> = {
  '4500277': boss4500277 as unknown as Boss,
  '4500283': boss4500283 as unknown as Boss,
};

// Normal (4500277) → Maxie 4500275 / Roxie 4500276, Hard (4500283) → Maxie 4500281 / Roxie 4500282
const MAXIE_IDS = ['4500275', '4500281'];
const ROXIE_IDS = ['4500276', '4500282'];

/* ── Component ──────────────────────────────────────────── */

export default function HildeGuide() {
  const { lang } = useI18n();
  const [minionIndex, setMinionIndex] = useState(1); // default: hard mode

  return (
    <GuideTemplate
      title={lRec(str.title, lang)}
      introduction={lRec(str.intro, lang)}
    >
      <BossDisplay
        bossName="Hilde"
        versionIds={['4500277', '4500283']}
        defaultBossId="4500283"
        preloadedBosses={preloadedBosses}
        onVersionChange={setMinionIndex}
      />
      <MinionDisplay
        entries={[
          { bossName: 'Maxie', versionIndex: 0, defaultBossId: MAXIE_IDS[minionIndex] },
          { bossName: 'Roxie', versionIndex: 0, defaultBossId: ROXIE_IDS[minionIndex] },
        ]}
      />
      <hr className="my-6 border-neutral-700" />
      <TacticalTips sections={[{ title: 'tactical', tips: tips.tactical }]} />
      <hr className="my-6 border-neutral-700" />
      <RecommendedCharacterList entries={recommended} />
    </GuideTemplate>
  );
}
