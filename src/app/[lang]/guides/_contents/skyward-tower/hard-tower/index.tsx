'use client';

import GuideTemplate from '@/app/components/guides/GuideTemplate';
import { TowerGuide } from '@/app/components/guides/tower';
import { useI18n } from '@/lib/contexts/I18nContext';
import { lRec } from '@/lib/i18n/localize';
import towerData from '@data/tower/hard.json';
import type { TowerData } from '@/types/tower';

const data = towerData as TowerData;

const TITLE = { en: 'Skyward Tower — Hard', jp: '飛天の塔 — ハード', kr: '비천의 탑 — 하드', zh: '飞天之塔 — 困难' };

export default function HardTowerGuide() {
  const { lang } = useI18n();

  return (
    <GuideTemplate title={lRec(TITLE, lang)}>
      <TowerGuide data={data} />
    </GuideTemplate>
  );
}
