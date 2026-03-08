'use client';

import { useRef, useLayoutEffect } from 'react';

type Props = {
  children: string;
  /** Maximum (default) font size in px */
  max: number;
  /** Minimum font size in px — text stays at this size even if it overflows */
  min: number;
  /** Use center transform origin instead of left (for centered layouts) */
  center?: boolean;
  className?: string;
};

/**
 * Auto-shrinks text to fit on a single line within its container.
 * Renders at `max` px and uses transform scale to shrink visually,
 * avoiding font hinting issues at small sizes.
 */
export default function FitText({ children, max, min, center, className }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Reset
    el.style.transform = '';
    el.style.fontSize = `${max}px`;

    if (el.scrollWidth <= el.clientWidth) return;

    // Scale down visually instead of changing font size
    const minScale = min / max;
    const scale = Math.max(minScale, el.clientWidth / el.scrollWidth);
    el.style.transform = `scaleX(${scale})`;
  }, [children, max, min]);

  return (
    <div
      ref={ref}
      className={className}
      style={{ fontSize: max, whiteSpace: 'nowrap', transformOrigin: center ? 'center' : 'left' }}
    >
      {children}
    </div>
  );
}
