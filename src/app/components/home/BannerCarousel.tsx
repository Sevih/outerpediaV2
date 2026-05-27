'use client';

import { useEffect, useState, type ReactNode } from 'react';

export type CarouselItem = {
  /** Stable key for React */
  key: string;
  /** Card rendered in the deck */
  card: ReactNode;
  /** Metadata block rendered next to the deck (synced with active) */
  sidePanel: ReactNode;
};

type Props = {
  items: CarouselItem[];
  /** Auto-rotation interval in ms. Defaults to 6s. */
  intervalMs?: number;
};

/** Deck-style carousel (mobile-only). The active card sits on top of the
 *  stack, two cards behind peek out via a small translate + scale. A side
 *  panel beside the deck shows the active banner metadata. Auto-rotates
 *  every `intervalMs`; pauses on hover/focus. Dots below for manual nav. */
export default function BannerCarousel({ items, intervalMs = 6000 }: Props) {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  const length = items.length;

  useEffect(() => {
    if (paused || length <= 1) return;
    const id = setInterval(() => {
      setActive((prev) => (prev + 1) % length);
    }, intervalMs);
    return () => clearInterval(id);
  }, [paused, length, intervalMs]);

  if (length === 0) return null;

  return (
    <div
      className="flex flex-col items-center"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div className="flex items-center justify-center gap-6">
        {/* Deck */}
        <div className="relative grid w-fit shrink-0">
          {items.map((item, i) => {
            const offset = (i - active + length) % length;
            const isActive = offset === 0;
            const visible = offset <= 2;
            const tx = offset * 10;
            const ty = offset * 10;
            const scale = 1 - offset * 0.04;
            const opacity = visible ? Math.max(0, 1 - offset * 0.35) : 0;
            const z = length - offset;
            return (
              <div
                key={item.key}
                className="col-start-1 row-start-1 transition-all duration-500 ease-out"
                style={{
                  transform: `translate(${tx}px, ${ty}px) scale(${scale})`,
                  opacity,
                  zIndex: z,
                  pointerEvents: isActive ? 'auto' : 'none',
                }}
                aria-hidden={!isActive}
              >
                {item.card}
              </div>
            );
          })}
        </div>

        {/* Side panel — shows the active banner metadata. We render all panels
            but only the active one is visible (smooth opacity transitions). */}
        <div className="relative">
          {items.map((item, i) => (
            <div
              key={item.key}
              className={`transition-opacity duration-300 ${
                i === active ? 'opacity-100' : 'pointer-events-none absolute inset-0 opacity-0'
              }`}
              aria-hidden={i !== active}
            >
              {item.sidePanel}
            </div>
          ))}
        </div>
      </div>

      {/* Dots */}
      {length > 1 && (
        <div className="mt-8 flex justify-center gap-2">
          {items.map((item, i) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setActive(i)}
              className={`h-2 rounded-full transition-all ${
                i === active
                  ? 'w-6 bg-cyan-400'
                  : 'w-2 bg-zinc-700 hover:bg-zinc-500'
              }`}
              aria-label={`Show banner ${i + 1}`}
              aria-current={i === active ? 'true' : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}
