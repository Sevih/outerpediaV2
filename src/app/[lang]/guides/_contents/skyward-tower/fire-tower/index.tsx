'use client';

import GuideTemplate from '@/app/components/guides/GuideTemplate';
import { TowerGuide } from '@/app/components/guides/tower';
import { useI18n } from '@/lib/contexts/I18nContext';
import { lRec } from '@/lib/i18n/localize';
import towerData from '@data/tower/fire.json';
import type { TowerData } from '@/types/tower';

const data = towerData as TowerData;

const TITLE = { en: 'Fire Elemental Tower', jp: '火属性の塔', kr: '화속성 탑', zh: '火属性之塔' };

export default function FireTowerGuide() {
  const { lang } = useI18n();

  return (
    <GuideTemplate title={lRec(TITLE, lang)}>
      <TowerGuide data={data} />
    </GuideTemplate>
  );
}
