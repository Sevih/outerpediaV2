'use client';

import GuideTemplate from '@/app/components/guides/GuideTemplate';
import { TowerGuide } from '@/app/components/guides/tower';
import { useI18n } from '@/lib/contexts/I18nContext';
import { lRec } from '@/lib/i18n/localize';
import towerData from '@data/tower/very-hard.json';
import type { TowerData } from '@/types/tower';

const data = towerData as TowerData;

export default function VeryHardTowerGuide() {
  const { lang, t } = useI18n();

  return (
    <GuideTemplate
      title={t('tower.per_floor_strategy')}
      disclaimer={data.disclaimer ? lRec(data.disclaimer, lang) : undefined}
    >
      <TowerGuide data={data} />
    </GuideTemplate>
  );
}
