'use client';

import GuideTemplate from '@/app/components/guides/GuideTemplate';
import { TowerGuide } from '@/app/components/guides/tower';
import { useI18n } from '@/lib/contexts/I18nContext';
import towerData from '@data/tower/hard.json';
import type { TowerData } from '@/types/tower';

const data = towerData as TowerData;

export default function HardTowerGuide() {
  const { t } = useI18n();

  return (
    <GuideTemplate title={t('tower.per_floor_strategy')}>
      <TowerGuide data={data} />
    </GuideTemplate>
  );
}
