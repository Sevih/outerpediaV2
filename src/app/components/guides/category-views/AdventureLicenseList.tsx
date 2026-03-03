'use client';

import { useCallback, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import type { CategoryViewProps } from './types';
import type { GuideMeta } from '@/types/guide';
import type { Lang } from '@/lib/i18n/config';
import { lRec } from '@/lib/i18n/localize';
import { localePath } from '@/lib/navigation';


/* ── Helpers ─────────────────────────────────────────────── */

function isPromotion(slug: string) {
  return slug.startsWith('promote-');
}

/** Replace _Lock with _Open in icon name */
function openIcon(icon: string) {
  return icon.replace(/_Lock$/, '_Open');
}

/* ── Sub-components ──────────────────────────────────────── */

function WeeklyCard({ meta, lang }: { meta: GuideMeta; lang: Lang }) {
  const name = lRec(meta.title, lang);

  return (
    <Link
      href={localePath(lang, `/guides/${meta.category}/${meta.slug}`)}
      className="group flex flex-col items-center gap-1.5 w-[calc((100%-2*1rem)/3)] sm:w-[calc((100%-6*2rem)/7)]"
    >
      <div className="relative w-full aspect-150/260 overflow-hidden rounded-lg
                      group-hover:ring-1 group-hover:ring-yellow-400/50 transition-all">
        <Image
          src={`/images/guides/${meta.icon}.webp`}
          alt={name}
          fill
          sizes="(max-width: 640px) 80px, 96px"
          className="object-cover transition-transform duration-300 group-hover:scale-105"
        />
      </div>
      <p className="w-full text-center text-xs font-medium text-zinc-200 line-clamp-2">
        {name}
      </p>
    </Link>
  );
}

function PromotionCard({
  meta, lang, revealed, onReveal, revealLabel,
}: {
  meta: GuideMeta;
  lang: Lang;
  revealed: boolean;
  onReveal: () => void;
  revealLabel: string;
}) {
  const name = lRec(meta.title, lang);
  const lockSrc = `/images/guides/${meta.icon}.webp`;
  const openSrc = `/images/guides/${openIcon(meta.icon)}.webp`;

  return (
    <div className="flex flex-col items-center gap-1.5 w-[calc((100%-2*1rem)/3)] sm:w-[calc((100%-6*2rem)/7)]">
      {/* Flip container */}
      <div className="relative w-full aspect-150/260 perspective-[600px]">
        <div
          className={`relative w-full h-full transition-transform duration-500 transform-3d
                      ${revealed ? 'transform-[rotateY(180deg)]' : ''}`}
        >
          {/* Front face — Lock (click to reveal) */}
          <button
            type="button"
            onClick={onReveal}
            className="absolute inset-0 overflow-hidden rounded-lg backface-hidden cursor-pointer"
          >
            <Image
              src={lockSrc}
              alt=""
              fill
              sizes="(max-width: 640px) 80px, 96px"
              className="object-cover"
            />
          </button>

          {/* Back face — Open (link to guide) */}
          <Link
            href={localePath(lang, `/guides/${meta.category}/${meta.slug}`)}
            className="group absolute inset-0 overflow-hidden rounded-lg
                       backface-hidden transform-[rotateY(180deg)]
                       hover:ring-1 hover:ring-yellow-400/50 transition-all"
          >
            <Image
              src={openSrc}
              alt={name}
              fill
              sizes="(max-width: 640px) 80px, 96px"
              className="object-cover transition-transform duration-300 group-hover:scale-105"
            />
          </Link>
        </div>
      </div>

      {/* Bottom: reveal button or name */}
      {revealed ? (
        <p className="w-full text-center text-xs font-medium text-zinc-200 line-clamp-2">
          {name}
        </p>
      ) : (
        <button
          onClick={onReveal}
          className="w-full text-center text-xs font-medium text-yellow-300 hover:text-yellow-200 transition-colors"
        >
          {revealLabel}
        </button>
      )}
    </div>
  );
}

/* ── Main Component ──────────────────────────────────────── */

export default function AdventureLicenseList({ guides, lang, t }: CategoryViewProps) {
  const [tab, setTab] = useState<'weekly' | 'promotion'>('weekly');
  const [revealed, setRevealed] = useState<Set<string>>(new Set());

  const { weekly, promotion } = useMemo(() => {
    const w: GuideMeta[] = [];
    const p: GuideMeta[] = [];
    for (const g of guides) {
      if (isPromotion(g.slug)) p.push(g);
      else w.push(g);
    }
    const byTitle = (a: GuideMeta, b: GuideMeta) =>
      (a.title.en ?? '').localeCompare(b.title.en ?? '');
    w.sort(byTitle);
    p.sort(byTitle);
    return { weekly: w, promotion: p };
  }, [guides]);

  const reveal = useCallback((slug: string) => {
    setRevealed(prev => new Set(prev).add(slug));
  }, []);

  const items = tab === 'weekly' ? weekly : promotion;

  return (
    <div className="mt-6 space-y-6">
      {/* Tabs */}
      <div className="flex justify-center gap-2">
        <button
          onClick={() => setTab('weekly')}
          className={`rounded-lg border px-3 py-1.5 text-sm transition-colors
            ${tab === 'weekly'
              ? 'border-yellow-400/50 bg-yellow-400/10 text-yellow-300'
              : 'border-white/10 bg-zinc-800 text-zinc-300 hover:bg-zinc-700'}`}
        >
          {t['guides.adventure_license.weekly']}
        </button>
        <button
          onClick={() => setTab('promotion')}
          className={`rounded-lg border px-3 py-1.5 text-sm transition-colors
            ${tab === 'promotion'
              ? 'border-yellow-400/50 bg-yellow-400/10 text-yellow-300'
              : 'border-white/10 bg-zinc-800 text-zinc-300 hover:bg-zinc-700'}`}
        >
          {t['guides.adventure_license.promotion']}
        </button>
      </div>

      {/* Cards */}
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-4 sm:gap-x-8 sm:gap-y-6">
        {items.map((meta) =>
          tab === 'weekly' ? (
            <WeeklyCard key={meta.slug} meta={meta} lang={lang} />
          ) : (
            <PromotionCard
              key={meta.slug}
              meta={meta}
              lang={lang}
              revealed={revealed.has(meta.slug)}
              onReveal={() => reveal(meta.slug)}
              revealLabel={t['guides.adventure_license.reveal']}
            />
          )
        )}
      </div>
    </div>
  );
}
