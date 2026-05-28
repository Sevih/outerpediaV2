'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { ElementType } from '@/types/enums';
import { useI18n } from '@/lib/contexts/I18nContext';
import { elementAccent } from './characterDetailTheme';

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
      { rootMargin: '-120px 0px -70% 0px', threshold: [0, 0.25, 0.5, 0.75, 1] },
    );

    els.forEach((el) => observerRef.current!.observe(el));
    return () => observerRef.current?.disconnect();
  }, [ids]);

  return active;
}

export default function QuickToc({ sections, element }: { sections: TocSection[]; element: ElementType }) {
  const { t } = useI18n();
  const { hex } = elementAccent(element);
  const ids = useMemo(() => sections.map((s) => s.id), [sections]);
  const active = useSectionObserver(ids);

  return (
    <nav
      aria-label={t('page.character.toc.on_this_page')}
      className="sticky top-14 z-30 border-y border-white/6 bg-slate-950/85 backdrop-blur"
    >
      <ul className="mx-auto flex max-w-285 flex-wrap justify-center gap-1.5 px-4 py-2.5 lg:px-6">
        {sections.map((s) => {
          const on = s.id === active;
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
                style={on ? { color: hex, backgroundColor: `${hex}1f`, borderColor: `${hex}66` } : undefined}
                className={[
                  'inline-flex items-center rounded-full border px-3 py-1 text-[12.5px] transition-colors',
                  on ? 'font-medium' : 'border-transparent text-zinc-400 hover:bg-white/5 hover:text-zinc-200',
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
