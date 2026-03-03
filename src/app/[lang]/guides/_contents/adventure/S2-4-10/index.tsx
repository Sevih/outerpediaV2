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

import boss4500041 from '@data/boss/4500041.json';
import boss4500045 from '@data/boss/4500045.json';

/* ── Typed data ─────────────────────────────────────────── */

const str = strings as Record<string, LangMap>;
const recommended = recommendedData as CharacterRecommendation[];
const tips = tipsData as Record<string, LangMap[]>;

const preloadedBosses: Record<string, Boss> = {
  '4500041': boss4500041 as unknown as Boss,
  '4500045': boss4500045 as unknown as Boss,
};

// Normal mode (4500041) → Sterope normal (4500042), Hard mode (4500045) → Sterope hard (4500046)
const MINION_IDS = ['4500042', '4500046'];

/* ── Component ──────────────────────────────────────────── */

export default function AsteiGuide() {
  const { lang } = useI18n();
  const [minionIndex, setMinionIndex] = useState(1); // default: hard mode

  return (
    <GuideTemplate
      title={lRec(str.title, lang)}
      introduction={lRec(str.intro, lang)}
    >
      <div className="bg-yellow-100 text-black px-2 py-1 rounded-lg shadow-md text-sm text-center border border-yellow-100 mb-4">
        {lRec(str.note, lang)}
      </div>
      <BossDisplay
        bossName="Astei"
        versionIds={['4500041', '4500045']}
        defaultBossId="4500045"
        preloadedBosses={preloadedBosses}
        onVersionChange={setMinionIndex}
      />
      <MinionDisplay bossName="Sterope" versionIndex={0} defaultBossId={MINION_IDS[minionIndex]} />
      <hr className="my-6 border-neutral-700" />
      <TacticalTips sections={[{ title: 'tactical', tips: tips.tactical }]} />
      <hr className="my-6 border-neutral-700" />
      <RecommendedCharacterList entries={recommended} />
    </GuideTemplate>
  );
}
