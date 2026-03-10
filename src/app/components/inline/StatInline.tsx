'use client';

import { use } from 'react';
import InlineIcon from './InlineIcon';
import { useI18n } from '@/lib/contexts/I18nContext';
import type { TranslationKey } from '@/i18n/locales/en';

type StatEntry = { label: string; icon: string };
const statsPromise = import('@data/stats.json').then(m => m.default as Record<string, StatEntry>);

const STAT_I18N: Record<string, TranslationKey> = {
  'ATK': 'sys.stat.atk',
  'DEF': 'sys.stat.def',
  'HP': 'sys.stat.hp',
  'ATK%': 'sys.stat.atk_percent',
  'DEF%': 'sys.stat.def_percent',
  'HP%': 'sys.stat.hp_percent',
  'EFF': 'sys.stat.eff',
  'RES': 'sys.stat.res',
  'SPD': 'sys.stat.spd',
  'CHC': 'sys.stat.chc',
  'CHD': 'sys.stat.chd',
  'PEN%': 'sys.stat.pen_percent',
  'LS': 'sys.stat.ls',
  'DMG UP%': 'sys.stat.dmg_up',
  'DMG RED%': 'sys.stat.dmg_red',
  'CDMG RED%': 'sys.stat.cdmg_red',
};

type Props = { name: string; iconOnly?: boolean };

export default function StatInline({ name, iconOnly = false }: Props) {
  const { t } = useI18n();
  const statsMap = use(statsPromise);
  const stat = statsMap[name];
  if (!stat) {
    return <span className="text-red-500">{name}</span>;
  }

  const i18nKey = STAT_I18N[name];
  const label = i18nKey ? t(i18nKey) : stat.label;

  if (iconOnly) {
    return (
      <InlineIcon
        icon={`/images/ui/effect/${stat.icon}`}
        label=""
        color="text-stat"
        tooltip={label}
      />
    );
  }

  return (
    <InlineIcon
      icon={`/images/ui/effect/${stat.icon}`}
      label={label}
      color="text-stat"
      underline={false}
    />
  );
}
