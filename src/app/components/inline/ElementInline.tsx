'use client';

import { ELEMENT_TEXT } from '@/lib/theme';
import type { ElementType } from '@/types/enums';
import InlineIcon from './InlineIcon';

type Props = { element: string };

const VALID_ELEMENTS: Set<string> = new Set(['Fire', 'Water', 'Earth', 'Light', 'Dark']);

export default function ElementInline({ element }: Props) {
  if (!VALID_ELEMENTS.has(element)) {
    return <span className="text-red-500">{element}</span>;
  }

  const el = element as ElementType;

  return (
    <InlineIcon
      icon={`/images/ui/elem/CM_Element_${element}.webp`}
      label={element}
      color={ELEMENT_TEXT[el]}
      underline={false}
    />
  );
}
