'use client';

import GuideTemplate from '@/app/components/guides/GuideTemplate';
import BossDisplay from '@/app/components/guides/BossDisplay';
import TacticalTips from '@/app/components/guides/TacticalTips';
import { useI18n } from '@/lib/contexts/I18nContext';
import { lRec } from '@/lib/i18n/localize';
import type { Boss } from '@/types/boss';
import type { LangMap } from '@/types/common';

import strings from './strings.json';
import tipsData from './tips.json';

import boss4104007 from '@data/boss/4104007.json';

/* ── Typed data ─────────────────────────────────────────── */

const str = strings as Record<string, LangMap>;
const tips = tipsData as Record<string, LangMap[]>;

const preloadedBosses: Record<string, Boss> = {
  '4104007': boss4104007 as unknown as Boss,
};

/* ── Component ──────────────────────────────────────────── */

export default function MaxwellGuide() {
  const { lang } = useI18n();

  return (
    <GuideTemplate
      title={lRec(str.title, lang)}
      introduction={lRec(str.intro, lang)}
    >
      <BossDisplay
        bossName="Maxwell"
        modeKey="Story (Normal)"
        defaultBossId="4104007"
        preloadedBosses={preloadedBosses}
      />
      <hr className="my-6 border-neutral-700" />
      <TacticalTips sections={[{ title: 'tactical', tips: tips.tactical }]} />
    </GuideTemplate>
  );
}
