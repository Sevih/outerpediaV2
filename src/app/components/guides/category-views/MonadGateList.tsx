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

function groupByDepthRange(guides: GuideMeta[]): { key: string; items: ParsedGuide[] }[] {
  const parsed: ParsedGuide[] = [];

  for (const meta of guides) {
    const p = parseSlug(meta.slug);
    if (!p) continue;
    parsed.push({ meta, ...p });
  }

  parsed.sort((a, b) => {
    if (a.depth !== b.depth) return a.depth - b.depth;
    return a.route - b.route;
  });

  const early = parsed.filter((g) => g.depth <= 5);
  const depth6 = parsed.filter((g) => g.depth === 6);

  const groups: { key: string; items: ParsedGuide[] }[] = [];
  if (early.length > 0) groups.push({ key: '1-5', items: early });
  if (depth6.length > 0) groups.push({ key: '6', items: depth6 });

  return groups;
}

/* ── Sub-groups by depth (merges multi-route depths) ────── */

type DepthGroup = { depth: number; items: ParsedGuide[] };

function groupByDepth(items: ParsedGuide[]): DepthGroup[] {
  const map = new Map<number, ParsedGuide[]>();
  for (const item of items) {
    if (!map.has(item.depth)) map.set(item.depth, []);
    map.get(item.depth)!.push(item);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a - b)
    .map(([depth, items]) => ({ depth, items }));
}

/* ── Cards ───────────────────────────────────────────────── */

function SingleCard({ meta, depth, lang, t }: {
  meta: GuideMeta;
  depth: number;
  lang: CategoryViewProps['lang'];
  t: CategoryViewProps['t'];
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
        <p className="text-xs font-medium text-zinc-200 drop-shadow-lg">
          {t['guides.monad_gate.depth'].replace('{n}', String(depth))}
        </p>
        <p className="text-xs font-medium text-zinc-200 drop-shadow-lg line-clamp-3">
          {routeName}
        </p>
      </div>
    </Link>
  );
}

function SplitCard({ items, lang, t }: {
  items: ParsedGuide[];
  lang: CategoryViewProps['lang'];
  t: CategoryViewProps['t'];
}) {
  const { meta, depth } = items[0];

  return (
    <div className="relative overflow-hidden rounded-lg w-[calc((100%-1.5rem)/3)] h-40 sm:w-36 sm:h-72
                    ring-1 ring-white/10">
      <Image
        src={`/images/guides/${meta.icon}.webp`}
        alt={lRec(meta.title, lang)}
        fill
        sizes="(max-width: 640px) 80px, 126px"
        className="object-cover"
      />
      <div className="absolute inset-0 bg-linear-to-b from-black/60 via-transparent to-transparent" />
      <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/20 to-transparent" />

      {/* Top 25% — depth + route name */}
      <div className="absolute inset-x-0 top-0 h-1/4 p-2 pointer-events-none z-10">
        <p className="text-xs font-medium text-zinc-200 drop-shadow-lg">
          {t['guides.monad_gate.depth'].replace('{n}', String(depth))}
        </p>
        <p className="text-xs font-medium text-zinc-200 drop-shadow-lg line-clamp-3">
          {lRec(meta.title, lang).split(':').pop()?.replace(/\s*\[.*\]/, '').trim()}
        </p>
      </div>

      {/* Divider top */}
      <div className="absolute inset-x-2 top-1/4 h-px bg-white/30 z-10" />

      {/* Middle 37.5% → route 1 */}
      <Link
        href={localePath(lang, `/guides/${items[0].meta.category}/${items[0].meta.slug}`)}
        className="absolute inset-x-0 top-1/4 h-3/8 flex items-center justify-center
                   hover:bg-white/10 transition-colors"
      >
        <span className="text-[10px] sm:text-xs font-bold text-zinc-100 drop-shadow-lg bg-black px-2 py-0.5 rounded">
          {lRec(items[0].meta.title, lang).match(/\[(.+)\]/)?.[1] ?? `Part ${items[0].route}`}
        </span>
      </Link>

      {/* Divider bottom */}
      <div className="absolute inset-x-2 top-5/8 h-px bg-white/30 z-10" />

      {/* Bottom 37.5% → route 2 */}
      <Link
        href={localePath(lang, `/guides/${items[1].meta.category}/${items[1].meta.slug}`)}
        className="absolute inset-x-0 top-5/8 h-3/8 flex items-center justify-center
                   hover:bg-white/10 transition-colors"
      >
        <span className="text-[10px] sm:text-xs font-bold text-zinc-100 drop-shadow-lg bg-black px-2 py-0.5 rounded">
          {lRec(items[1].meta.title, lang).match(/\[(.+)\]/)?.[1] ?? `Part ${items[1].route}`}
        </span>
      </Link>
    </div>
  );
}

/* ── Component ───────────────────────────────────────────── */

export default function MonadGateList({ guides, lang, t }: CategoryViewProps) {
  const groups = groupByDepthRange(guides);

  return (
    <div className="mt-6 space-y-8">
      {groups.map(({ key, items }) => {
        const depths = groupByDepth(items);
        return (
          <section key={key}>
            <h2 className="mb-4">
              {t['guides.monad_gate.depth'].replace('{n}', key)}
            </h2>

            <div className="flex flex-wrap justify-center gap-3">
              {depths.map(({ depth, items: depthItems }) =>
                depthItems.length === 2 ? (
                  <SplitCard key={depth} items={depthItems} lang={lang} t={t} />
                ) : (
                  depthItems.map((g) => (
                    <SingleCard key={g.meta.slug} meta={g.meta} depth={depth} lang={lang} t={t} />
                  ))
                )
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
