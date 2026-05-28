'use client';

import { useRef, useState } from 'react';
import Image from 'next/image';

export type FullArt = {
  src: string;
  alt: string;
  /** Skin name caption; null for the default art. */
  label: string | null;
};

const SIZES = '(max-width: 1024px) 90vw, 360px';

/** Full-body art viewer. With a single art it renders a plain image; with
 *  skins it becomes a swipeable carousel (arrows + dots + caption). */
export default function FullArtCarousel({ items, hex }: { items: FullArt[]; hex: string }) {
  const [active, setActive] = useState(0);
  const touchStartX = useRef<number | null>(null);
  const length = items.length;

  if (length <= 1) {
    const art = items[0];
    return (
      <div className="relative mx-auto aspect-6/7 w-full max-w-90 shrink-0 lg:mx-0">
        {art && (
          <Image src={art.src} alt={art.alt} fill sizes={SIZES} priority className="object-contain" />
        )}
      </div>
    );
  }

  const go = (next: number) => setActive((next + length) % length);
  const current = items[active];

  return (
    <div className="mx-auto flex w-full max-w-90 shrink-0 flex-col items-center gap-2.5 lg:mx-0">
      <div
        className="relative aspect-6/7 w-full"
        onTouchStart={(e) => { touchStartX.current = e.touches[0].clientX; }}
        onTouchEnd={(e) => {
          if (touchStartX.current === null) return;
          const dx = e.changedTouches[0].clientX - touchStartX.current;
          if (Math.abs(dx) > 40) go(active + (dx < 0 ? 1 : -1));
          touchStartX.current = null;
        }}
      >
        {items.map((art, i) => (
          <Image
            key={art.src}
            src={art.src}
            alt={art.alt}
            fill
            sizes={SIZES}
            priority={i === 0}
            className={`object-contain transition-opacity duration-300 ${i === active ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
          />
        ))}

        <button
          type="button"
          onClick={() => go(active - 1)}
          aria-label="Previous art"
          className="absolute top-1/2 left-0 -translate-y-1/2 rounded-full border border-white/10 bg-slate-950/55 p-1.5 text-zinc-200 backdrop-blur transition hover:bg-slate-950/80 hover:text-white"
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => go(active + 1)}
          aria-label="Next art"
          className="absolute top-1/2 right-0 -translate-y-1/2 rounded-full border border-white/10 bg-slate-950/55 p-1.5 text-zinc-200 backdrop-blur transition hover:bg-slate-950/80 hover:text-white"
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m9 18 6-6-6-6" />
          </svg>
        </button>
      </div>

      {/* Caption — height reserved to avoid layout shift between arts. */}
      <div className="flex h-5 items-center font-game text-sm text-zinc-300">{current.label}</div>

      <div className="flex justify-center gap-2">
        {items.map((art, i) => (
          <button
            key={art.src}
            type="button"
            onClick={() => setActive(i)}
            aria-label={`Show art ${i + 1}`}
            aria-current={i === active ? 'true' : undefined}
            style={i === active ? { backgroundColor: hex, width: '1.5rem' } : undefined}
            className={`h-2 rounded-full transition-all ${i === active ? '' : 'w-2 bg-zinc-700 hover:bg-zinc-500'}`}
          />
        ))}
      </div>
    </div>
  );
}
