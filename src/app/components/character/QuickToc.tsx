'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

export type TocSection = { id: string; label: string };

function useSectionObserver(ids: string[]) {
  const [active, setActive] = useState<string>(ids[0] ?? '');
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    const els = ids
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => !!el);

    if (!els.length) return;

    observerRef.current?.disconnect();
    observerRef.current = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible?.target?.id) setActive(visible.target.id);
      },
      { rootMargin: '-20% 0px -60% 0px', threshold: [0, 0.25, 0.5, 0.75, 1] },
    );

    els.forEach((el) => observerRef.current!.observe(el));
    return () => observerRef.current?.disconnect();
  }, [ids]);

  return active;
}

export default function QuickToc({ sections }: { sections: TocSection[] }) {
  const ids = useMemo(() => sections.map((s) => s.id), [sections]);
  const active = useSectionObserver(ids);

  return (
    <nav
      aria-label="Page sections"
      className="sticky top-4 z-30 mx-auto mb-6 w-fit rounded-xl border border-white/10 bg-black/40 px-3 py-2 shadow-sm backdrop-blur"
    >
      <ul className="flex flex-wrap items-center justify-center gap-2">
        {sections.map((s) => {
          const isActive = s.id === active;
          return (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                onClick={(e) => {
                  e.preventDefault();
                  const el = document.getElementById(s.id);
                  if (el) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    history.replaceState(null, '', `#${s.id}`);
                  }
                }}
                className={[
                  'inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm transition ring-1',
                  isActive
                    ? 'bg-yellow-500/20 text-yellow-300 ring-yellow-400/40'
                    : 'bg-white/5 text-gray-200 ring-white/10 hover:bg-white/10',
                ].join(' ')}
              >
                {s.label}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
