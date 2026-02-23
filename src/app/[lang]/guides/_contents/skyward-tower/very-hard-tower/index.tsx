'use client';

import GuideTemplate from '@/app/components/guides/GuideTemplate';
import { TowerGuide } from '@/app/components/guides/tower';
import { useI18n } from '@/lib/contexts/I18nContext';
import { lRec } from '@/lib/i18n/localize';
import towerData from '@data/tower/very-hard.json';
import type { TowerData } from '@/types/tower';

const data = towerData as TowerData;

const TITLE = { en: 'Skyward Tower — Very Hard', jp: '飛天の塔 — ベリーハード', kr: '비천의 탑 — 매우 어려움', zh: '飞天之塔 — 极难' };

export default function VeryHardTowerGuide() {
  const { lang } = useI18n();

  return (
    <GuideTemplate
      title={lRec(TITLE, lang)}
      disclaimer={data.disclaimer ? lRec(data.disclaimer, lang) : undefined}
    >
      <TowerGuide data={data} />
    </GuideTemplate>
  );
}
