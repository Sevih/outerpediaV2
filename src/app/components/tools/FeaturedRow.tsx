import Image from 'next/image';
import Link from 'next/link';
import type { Lang } from '@/lib/i18n/config';
import type { TranslationKey } from '@/i18n';
import { localePath } from '@/lib/navigation';
import {
  CATEGORY_ACCENT,
  FLAGSHIP_SLUGS,
  FLAGSHIP_RIBBON,
  type CategoryAccentKey,
  type FlagshipSlug,
} from './toolsTheme';

type ToolData = {
  slug: string;
  icon: string;
  status: 'available' | 'coming-soon' | 'hidden' | 'unlisted';
  href?: string;
  category: string;
};

type GroupData = {
  category: { slug: string };
  tools: ToolData[];
};

type Props = {
  groups: GroupData[];
  lang: Lang;
  t: Record<TranslationKey, string>;
  devMode?: boolean;
};

const KNOWN: readonly CategoryAccentKey[] = ['rankings', 'equipment', 'simulators', 'info', 'media'];
function asAccentKey(slug: string): CategoryAccentKey {
  return (KNOWN as readonly string[]).includes(slug) ? (slug as CategoryAccentKey) : 'rankings';
}

/**
 * "Featured" rail above the tabs — 3 flagship tools rendered as larger cards
 * with per-category accent glow, a ribbon, and an explicit "open" CTA.
 *
 * Renders nothing if no flagship is actually present in the data.
 */
export default function FeaturedRow({ groups, lang, t, devMode }: Props) {
  const allTools = groups.flatMap((g) => g.tools);
  const flagshipMap = new Map(allTools.map((tool) => [tool.slug, tool]));
  const flagships = FLAGSHIP_SLUGS
    .map((slug) => flagshipMap.get(slug))
    .filter((tool): tool is ToolData => Boolean(tool));

  if (flagships.length === 0) return null;

  return (
    <section aria-label={t['tools.featured']} className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-300">
          {t['tools.featured']}
        </span>
        <span className="h-px flex-1 bg-zinc-800" aria-hidden />
        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-500">
          {flagships.length} / {allTools.length}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {flagships.map((tool) => (
          <FeaturedCard
            key={tool.slug}
            tool={tool}
            lang={lang}
            t={t}
            devMode={devMode}
          />
        ))}
      </div>
    </section>
  );
}

function FeaturedCard({
  tool, lang, t, devMode,
}: {
  tool: ToolData;
  lang: Lang;
  t: Record<TranslationKey, string>;
  devMode?: boolean;
}) {
  const accentKey = asAccentKey(tool.category);
  const accent = CATEGORY_ACCENT[accentKey];
  const titleKey = `tools.${tool.slug}` as TranslationKey;
  const descKey = `tools.${tool.slug}.desc` as TranslationKey;
  const title = t[titleKey] ?? tool.slug;
  const description = t[descKey] ?? '';
  const ribbonKind = FLAGSHIP_RIBBON[tool.slug as FlagshipSlug];
  const ribbonLabel = ribbonKind
    ? t[`tools.ribbon.${ribbonKind}` as TranslationKey]
    : '';
  const catLabel = t[`tools.category.${tool.category}` as TranslationKey] ?? tool.category;

  const inner = (
    <>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className={`size-1.5 rounded-full ${accent.dot}`} aria-hidden />
          <span className={`font-mono text-[10px] font-semibold uppercase tracking-[0.16em] ${accent.text}`}>
            {catLabel}
          </span>
        </div>
        {ribbonLabel && (
          <span className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-zinc-500">
            {ribbonLabel}
          </span>
        )}
      </div>

      <div className="flex items-end gap-3">
        <div className={`relative flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border bg-linear-to-br to-transparent ${accent.iconBorder} ${accent.iconFrom}`}>
          <Image
            src={`/images/ui/${tool.icon}.webp`}
            alt={title}
            fill
            sizes="56px"
            className="object-contain p-1"
          />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold tracking-tight text-zinc-50 after:hidden">{title}</h3>
          <p className="mt-0.5 line-clamp-2 text-xs text-zinc-400">{description}</p>
        </div>
      </div>

      <div className="mt-auto flex items-center justify-end border-t border-zinc-800 pt-2.5">
        <span className={`inline-flex items-center text-xs transition-transform duration-150 group-hover:translate-x-0.5 ${accent.text}`}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M3 8h10M9 4l4 4-4 4" />
          </svg>
        </span>
      </div>
    </>
  );

  const baseClasses = [
    'group flex min-h-44 flex-col gap-3 rounded-xl border p-4 transition-[transform,border-color,box-shadow] duration-150',
    'bg-linear-to-b to-slate-800/50',
    accent.featuredBorder,
    accent.featuredFrom,
  ].join(' ');

  if ((tool.status === 'coming-soon' || tool.status === 'hidden') && !devMode) {
    return (
      <div className={`${baseClasses} cursor-default opacity-70`}>{inner}</div>
    );
  }

  return (
    <Link
      href={localePath(lang, tool.href ?? `/${tool.slug}`)}
      className={`${baseClasses} hover:-translate-y-px ${accent.hoverBorder} hover:shadow-[0_8px_32px_-12px_rgba(34,211,238,0.25)] focus-visible:ring-2 focus-visible:ring-(--color-filter-ring) focus-visible:outline-none`}
    >
      {inner}
    </Link>
  );
}
