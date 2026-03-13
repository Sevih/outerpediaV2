'use client';

import * as HoverCard from '@radix-ui/react-hover-card';
import { useState, useCallback, useEffect, useRef } from 'react';

type Props = {
  children: React.ReactNode;
  content: React.ReactNode;
  bg?: string;
};

/**
 * Shared tooltip wrapper using Radix HoverCard.
 * Desktop: hover. Mobile: tap to open, tap outside to close.
 */
export default function InlineTooltip({ children, content, bg = 'bg-neutral-800' }: Props) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLSpanElement>(null);

  const handleTap = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if ('ontouchstart' in window) {
      e.preventDefault();
      setOpen((v) => !v);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    const close = (e: TouchEvent) => {
      if (triggerRef.current && !triggerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('touchstart', close);
    return () => document.removeEventListener('touchstart', close);
  }, [open]);

  return (
    <HoverCard.Root openDelay={0} closeDelay={0} open={open} onOpenChange={setOpen}>
      <HoverCard.Trigger asChild>
        <span ref={triggerRef} onClick={handleTap} onTouchEnd={handleTap}>
          {children}
        </span>
      </HoverCard.Trigger>
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
