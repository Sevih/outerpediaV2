'use client';

import GuideTemplate from '@/app/components/guides/GuideTemplate';
import { TowerGuide } from '@/app/components/guides/tower';
import { useI18n } from '@/lib/contexts/I18nContext';
import { lRec } from '@/lib/i18n/localize';
import towerData from '@data/tower/light.json';
import type { TowerData } from '@/types/tower';

const data = towerData as TowerData;

const TITLE = { en: 'Light Elemental Tower', jp: '光属性の塔', kr: '명속성 탑', zh: '光属性之塔' };

export default function LightTowerGuide() {
  const { lang } = useI18n();

  return (
    <GuideTemplate title={lRec(TITLE, lang)}>
      <TowerGuide data={data} />
    </GuideTemplate>
  );
}
