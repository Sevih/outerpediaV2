'use client';

import { useI18n } from '@/lib/contexts/I18nContext';
import type { TranslationKey } from '@/i18n/locales/en';
import InlineIcon from './InlineIcon';

type Props = {
  name: string;
  subclass?: string;
};

const CLASS_I18N: Record<string, TranslationKey> = {
  Striker: 'sys.class.striker',
  Defender: 'sys.class.defender',
  Ranger: 'sys.class.ranger',
  Mage: 'sys.class.mage',
  Healer: 'sys.class.healer',
};

const SUBCLASS_I18N: Record<string, TranslationKey> = {
  Attacker: 'sys.subclass.attacker',
  Bruiser: 'sys.subclass.bruiser',
  Wizard: 'sys.subclass.wizard',
  Enchanter: 'sys.subclass.enchanter',
  Vanguard: 'sys.subclass.vanguard',
  Tactician: 'sys.subclass.tactician',
  Sweeper: 'sys.subclass.sweeper',
  Phalanx: 'sys.subclass.phalanx',
  Reliever: 'sys.subclass.reliever',
  Sage: 'sys.subclass.sage',
};

export default function ClassInline({ name, subclass }: Props) {
  const { t } = useI18n();

  const icon = subclass
    ? `/images/ui/class/CM_Sub_Class_${subclass}.webp`
    : `/images/ui/class/CM_Class_${name}.webp`;

  const label = subclass
    ? (SUBCLASS_I18N[subclass] ? t(SUBCLASS_I18N[subclass]) : subclass)
    : (CLASS_I18N[name] ? t(CLASS_I18N[name]) : name);

  return (
    <InlineIcon
      icon={icon}
      label={label}
      color="text-class"
      underline={false}
    />
  );
}
