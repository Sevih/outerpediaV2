'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import type { CategoryViewProps } from './types';
import type { GuideMeta } from '@/types/guide';
import { lRec } from '@/lib/i18n/localize';
import { localePath } from '@/lib/navigation';

/* ── Types ──────────────────────────────────────────────── */

type ParsedGuide = {
  meta: GuideMeta;
  depth: number;
  route: number;
};

/* ── Helpers ─────────────────────────────────────────────── */

function parseSlug(slug: string): { depth: number; route: number } | null {
  const match = slug.match(/^depth(\d+)-route(\d+)$/);
  if (!match) return null;
  return { depth: parseInt(match[1], 10), route: parseInt(match[2], 10) };
}

// Endless depths share the same list UX: five routes each, toggled via a depth selector so
// the page stays compact instead of stacking five identical sections.
const ENDLESS_DEPTHS = [6, 7, 8, 9, 10] as const;
// Depths where a route has two map variants (game picks one at random on entry). We surface
// both in a single SplitCard and pass `?v=0|1` to the page so the initial tab matches the click.
const VARIANT_DEPTHS = new Set<number>([10]);

/* ── Cards ───────────────────────────────────────────────── */

function SingleCard({ meta, depth, lang }: {
  meta: GuideMeta;
  depth: number;
  lang: CategoryViewProps['lang'];
}) {
  const fullName = lRec(meta.title, lang);
  const routeName = fullName.split(':').pop()?.trim() ?? fullName;

  return (
    <Link
      href={localePath(lang, `/guides/${meta.category}/${meta.slug}`)}
      className="group relative overflow-hidden rounded-lg w-[calc((100%-1.5rem)/3)] h-40 sm:w-36 sm:h-72
                 ring-1 ring-white/10 hover:ring-yellow-400/50 transition-all"
    >
      <Image
        src={`/images/guides/${meta.icon}.webp`}
        alt={routeName}
        fill
        sizes="(max-width: 640px) 80px, 126px"
        className="object-cover transition-transform duration-300 group-hover:scale-105"
      />
      <div className="absolute inset-0 bg-linear-to-b from-black/60 via-transparent to-transparent" />
      <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/20 to-transparent" />
      <div className="absolute inset-x-0 top-0 p-2">
        <p className="text-xs font-medium text-zinc-200 drop-shadow-lg">Depth {depth}</p>
        <p className="text-xs font-medium text-zinc-200 drop-shadow-lg line-clamp-3">
          {routeName}
        </p>
      </div>
    </Link>
  );
}

function SplitCard({ items, lang, depth }: {
  items: ParsedGuide[];
  lang: CategoryViewProps['lang'];
  depth: number;
}) {
  const { meta } = items[0];
  const title = lRec(meta.title, lang);
  const routeName = title.split(':').pop()?.replace(/\s*\[.*\]/, '').trim();
  const labelFor = (g: ParsedGuide, idx: number) =>
    lRec(g.meta.title, lang).match(/\[(.+)\]/)?.[1] ?? `Part ${idx + 1}`;

  return (
    <div className="relative overflow-hidden rounded-lg w-[calc((100%-1.5rem)/3)] h-40 sm:w-36 sm:h-72
                    ring-1 ring-white/10">
      <Image
        src={`/images/guides/${meta.icon}.webp`}
        alt={title}
        fill
        sizes="(max-width: 640px) 80px, 126px"
        className="object-cover"
      />
      <div className="absolute inset-0 bg-linear-to-b from-black/60 via-transparent to-transparent" />
      <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/20 to-transparent" />

      <div className="absolute inset-x-0 top-0 h-1/4 p-2 pointer-events-none z-10">
        <p className="text-xs font-medium text-zinc-200 drop-shadow-lg">Depth {depth}</p>
        <p className="text-xs font-medium text-zinc-200 drop-shadow-lg line-clamp-3">
          {routeName}
        </p>
      </div>

      <div className="absolute inset-x-2 top-1/4 h-px bg-white/30 z-10" />

      <Link
        href={localePath(lang, `/guides/${items[0].meta.category}/${items[0].meta.slug}`)}
        className="absolute inset-x-0 top-1/4 h-3/8 flex items-center justify-center
                   hover:bg-white/10 transition-colors"
      >
        <span className="text-[10px] sm:text-xs font-bold text-zinc-100 drop-shadow-lg bg-black px-2 py-0.5 rounded">
          {labelFor(items[0], 0)}
        </span>
      </Link>

      <div className="absolute inset-x-2 top-5/8 h-px bg-white/30 z-10" />

      <Link
        href={localePath(lang, `/guides/${items[1].meta.category}/${items[1].meta.slug}`)}
        className="absolute inset-x-0 top-5/8 h-3/8 flex items-center justify-center
                   hover:bg-white/10 transition-colors"
      >
        <span className="text-[10px] sm:text-xs font-bold text-zinc-100 drop-shadow-lg bg-black px-2 py-0.5 rounded">
          {labelFor(items[1], 1)}
        </span>
      </Link>
    </div>
  );
}

// Variant card for depths where the same slug exposes two map layouts via tabs inside the page.
// Both halves point to the same URL with a ?v= query param that the page reads to pick the tab.
function VariantCard({ item, lang }: {
  item: ParsedGuide;
  lang: CategoryViewProps['lang'];
}) {
  const { meta, depth } = item;
  const title = lRec(meta.title, lang);
  const routeName = title.split(':').pop()?.trim();
  const base = localePath(lang, `/guides/${meta.category}/${meta.slug}`);

  return (
    <div className="relative overflow-hidden rounded-lg w-[calc((100%-1.5rem)/3)] h-40 sm:w-36 sm:h-72
                    ring-1 ring-white/10">
      <Image
        src={`/images/guides/${meta.icon}.webp`}
        alt={title}
        fill
        sizes="(max-width: 640px) 80px, 126px"
        className="object-cover"
      />
      <div className="absolute inset-0 bg-linear-to-b from-black/60 via-transparent to-transparent" />
      <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/20 to-transparent" />

      <div className="absolute inset-x-0 top-0 h-1/4 p-2 pointer-events-none z-10">
        <p className="text-xs font-medium text-zinc-200 drop-shadow-lg">Depth {depth}</p>
        <p className="text-xs font-medium text-zinc-200 drop-shadow-lg line-clamp-3">
          {routeName}
        </p>
      </div>

      <div className="absolute inset-x-2 top-1/4 h-px bg-white/30 z-10" />

      <Link
        href={`${base}?v=0`}
        className="absolute inset-x-0 top-1/4 h-3/8 flex items-center justify-center
                   hover:bg-white/10 transition-colors"
      >
        <span className="text-[10px] sm:text-xs font-bold text-zinc-100 drop-shadow-lg bg-black px-2 py-0.5 rounded">
          Variant A
        </span>
      </Link>

      <div className="absolute inset-x-2 top-5/8 h-px bg-white/30 z-10" />

      <Link
        href={`${base}?v=1`}
        className="absolute inset-x-0 top-5/8 h-3/8 flex items-center justify-center
                   hover:bg-white/10 transition-colors"
      >
        <span className="text-[10px] sm:text-xs font-bold text-zinc-100 drop-shadow-lg bg-black px-2 py-0.5 rounded">
          Variant B
        </span>
      </Link>
    </div>
  );
}

/* ── Component ───────────────────────────────────────────── */

export default function MonadGateList({ guides, lang, t }: CategoryViewProps) {
  const parsed = useMemo<ParsedGuide[]>(() => {
    const out: ParsedGuide[] = [];
    for (const meta of guides) {
      const p = parseSlug(meta.slug);
      if (!p) continue;
      out.push({ meta, ...p });
    }
    return out.sort((a, b) => (a.depth !== b.depth ? a.depth - b.depth : a.route - b.route));
  }, [guides]);

  const story = parsed.filter((g) => g.depth <= 5);
  const endless = parsed.filter((g) => g.depth >= 6);

  // Pair story items by depth so D4's Part 1 / Part 2 collapse into a single SplitCard.
  const storyByDepth = new Map<number, ParsedGuide[]>();
  for (const g of story) {
    if (!storyByDepth.has(g.depth)) storyByDepth.set(g.depth, []);
    storyByDepth.get(g.depth)!.push(g);
  }

  const [endlessDepth, setEndlessDepth] = useState<number>(() => {
    const available = ENDLESS_DEPTHS.filter((d) => endless.some((g) => g.depth === d));
    return available[0] ?? 6;
  });
  const endlessAvailable = ENDLESS_DEPTHS.filter((d) =>
    endless.some((g) => g.depth === d),
  );
  const endlessItems = endless.filter((g) => g.depth === endlessDepth);
  const isVariantDepth = VARIANT_DEPTHS.has(endlessDepth);

  return (
    <div className="mt-6 space-y-8">
      {story.length > 0 && (
        <section>
          <h2 className="mb-4">
            {t['guides.monad_gate.depth'].replace('{n}', '1-5')}
          </h2>
          <div className="flex flex-wrap justify-center gap-3">
            {Array.from(storyByDepth.entries())
              .sort(([a], [b]) => a - b)
              .map(([depth, items]) =>
                items.length === 2 ? (
                  <SplitCard key={depth} items={items} lang={lang} depth={depth} />
                ) : (
                  items.map((g) => (
                    <SingleCard key={g.meta.slug} meta={g.meta} depth={depth} lang={lang} />
                  ))
                ),
              )}
          </div>
        </section>
      )}

      {endless.length > 0 && (
        <section>
          <h2 className="mb-4">
            {t['guides.monad_gate.depth'].replace('{n}', '6-10')}
          </h2>
          <div className="mb-4 flex flex-wrap gap-2">
            {endlessAvailable.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setEndlessDepth(d)}
                className={`px-3 py-1.5 rounded border text-sm font-medium transition ${
                  endlessDepth === d
                    ? 'bg-yellow-400 text-black border-yellow-400'
                    : 'bg-zinc-800 text-zinc-200 border-zinc-600 hover:border-zinc-400'
                }`}
              >
                {t['guides.monad_gate.depth'].replace('{n}', String(d))}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            {endlessItems.map((g) =>
              isVariantDepth ? (
                <VariantCard key={g.meta.slug} item={g} lang={lang} />
              ) : (
                <SingleCard
                  key={g.meta.slug}
                  meta={g.meta}
                  depth={g.depth}
                  lang={lang}
                />
              ),
            )}
          </div>
        </section>
      )}
    </div>
  );
}
