'use client';

import { ELEMENT_TEXT } from '@/lib/theme';
import { useI18n } from '@/lib/contexts/I18nContext';
import type { TranslationKey } from '@/i18n/locales/en';
import type { ElementType } from '@/types/enums';
import InlineIcon from './InlineIcon';

type Props = { element: string };

const VALID_ELEMENTS: Set<string> = new Set(['Fire', 'Water', 'Earth', 'Light', 'Dark']);

const ELEMENT_I18N: Record<string, TranslationKey> = {
  Fire: 'sys.element.fire',
  Water: 'sys.element.water',
  Earth: 'sys.element.earth',
  Light: 'sys.element.light',
  Dark: 'sys.element.dark',
};

export default function ElementInline({ element }: Props) {
  const { t } = useI18n();

  if (!VALID_ELEMENTS.has(element)) {
    return <span className="text-red-500">{element}</span>;
  }

  const el = element as ElementType;
  const i18nKey = ELEMENT_I18N[element];
  const label = i18nKey ? t(i18nKey) : element;

  return (
    <InlineIcon
      icon={`/images/ui/elem/CM_Element_${element}.webp`}
      label={label}
      color={ELEMENT_TEXT[el]}
      underline={false}
    />
  );
}
