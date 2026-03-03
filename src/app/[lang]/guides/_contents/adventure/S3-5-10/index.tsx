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

import boss4500288 from '@data/boss/4500288.json';
import boss4500293 from '@data/boss/4500293.json';

/* ── Typed data ─────────────────────────────────────────── */

const str = strings as Record<string, LangMap>;
const recommended = recommendedData as CharacterRecommendation[];
const tips = tipsData as Record<string, LangMap[]>;

const preloadedBosses: Record<string, Boss> = {
  '4500288': boss4500288 as unknown as Boss,
  '4500293': boss4500293 as unknown as Boss,
};

// Normal (4500288) → Hilde normal 4500285, Hard (4500293) → Hilde hard 4500290
const MINION_IDS = ['4500285', '4500290'];

/* ── Component ──────────────────────────────────────────── */

export default function ReginaGuide() {
  const { lang } = useI18n();
  const [minionIndex, setMinionIndex] = useState(1); // default: hard mode

  return (
    <GuideTemplate
      title={lRec(str.title, lang)}
      introduction={lRec(str.intro, lang)}
    >
      <BossDisplay
        bossName="Regina"
        versionIds={['4500288', '4500293']}
        defaultBossId="4500293"
        preloadedBosses={preloadedBosses}
        onVersionChange={setMinionIndex}
      />
      <MinionDisplay bossName="Hilde" versionIndex={0} defaultBossId={MINION_IDS[minionIndex]} />
      <hr className="my-6 border-neutral-700" />
      <TacticalTips sections={[{ title: 'tactical', tips: tips.tactical }]} />
      <hr className="my-6 border-neutral-700" />
      <RecommendedCharacterList entries={recommended} />
    </GuideTemplate>
  );
}
