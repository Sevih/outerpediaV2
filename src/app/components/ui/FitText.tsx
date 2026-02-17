'use client';

import { useRef, useLayoutEffect } from 'react';

type Props = {
  children: string;
  /** Maximum (default) font size in px */
  max: number;
  /** Minimum font size in px — text stays at this size even if it overflows */
  min: number;
  className?: string;
};

/**
 * Auto-shrinks text to fit on a single line within its container.
 * Starts at `max` px, reduces to `min` px if needed.
 */
export default function FitText({ children, max, min, className }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Reset to max size
    el.style.fontSize = `${max}px`;

    if (el.scrollWidth <= el.clientWidth) return;

    // Approximate ideal size via ratio, then fine-tune
    const ratio = el.clientWidth / el.scrollWidth;
    let size = Math.max(min, Math.round(max * ratio * 2) / 2);
    el.style.fontSize = `${size}px`;

    while (el.scrollWidth > el.clientWidth && size > min) {
      size -= 0.5;
      el.style.fontSize = `${size}px`;
    }
  }, [children, max, min]);

  return (
    <div
      ref={ref}
      className={className}
      style={{ fontSize: max, whiteSpace: 'nowrap' }}
    >
      {children}
    </div>
  );
}
