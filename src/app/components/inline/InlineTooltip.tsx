'use client';

import * as HoverCard from '@radix-ui/react-hover-card';

type Props = {
  children: React.ReactNode;
  content: React.ReactNode;
  bg?: string;
};

/**
 * Shared tooltip wrapper using Radix HoverCard.
 * Eliminates per-component boilerplate.
 */
export default function InlineTooltip({ children, content, bg = 'bg-neutral-800' }: Props) {
  return (
    <HoverCard.Root openDelay={0} closeDelay={0}>
      <HoverCard.Trigger asChild>{children}</HoverCard.Trigger>
      <HoverCard.Portal>
        <HoverCard.Content
          side="top"
          align="center"
          sideOffset={6}
          className={`z-50 max-w-70 rounded px-3 py-2 shadow-lg border border-white/10 ${bg}`}
        >
          {content}
          <HoverCard.Arrow className={arrowClass(bg)} />
        </HoverCard.Content>
      </HoverCard.Portal>
    </HoverCard.Root>
  );
}

/** Extract fill color from bg class for the arrow */
function arrowClass(bg: string): string {
  if (bg.includes('buff-bg')) return 'fill-buff-bg';
  if (bg.includes('debuff-bg')) return 'fill-debuff-bg';
  return 'fill-neutral-800';
}
