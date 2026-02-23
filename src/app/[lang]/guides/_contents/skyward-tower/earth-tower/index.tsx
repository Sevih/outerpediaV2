'use client';

import GuideTemplate from '@/app/components/guides/GuideTemplate';
import { TowerGuide } from '@/app/components/guides/tower';
import { useI18n } from '@/lib/contexts/I18nContext';
import { lRec } from '@/lib/i18n/localize';
import towerData from '@data/tower/earth.json';
import type { TowerData } from '@/types/tower';

const data = towerData as TowerData;

const TITLE = { en: 'Earth Elemental Tower', jp: '地属性の塔', kr: '지속성 탑', zh: '土属性之塔' };

export default function EarthTowerGuide() {
  const { lang } = useI18n();

  return (
    <GuideTemplate title={lRec(TITLE, lang)}>
      <TowerGuide data={data} />
    </GuideTemplate>
  );
}
