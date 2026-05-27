import Image from 'next/image';
import Link from 'next/link';
import type { Lang } from '@/lib/i18n/config';
import type { TranslationKey } from '@/i18n';
import { localePath } from '@/lib/navigation';
import { RAIL_ACCENT } from './tierlistTheme';

export type SupportingTool = {
  slug: string;
  icon: string;
  status: 'available' | 'coming-soon' | 'hidden' | 'unlisted';
  href?: string;
};

type Props = {
  tools: SupportingTool[];
  lang: Lang;
  t: Record<TranslationKey, string>;
};

export default function OtherRankingsRail({ tools, lang, t }: Props) {
  if (tools.length === 0) return null;

  return (
    <section className="flex flex-col gap-4">
      <div className="relative flex items-end justify-between gap-3 border-b border-zinc-800 pb-3">
        <span className={`absolute -bottom-px left-0 h-0.5 w-10 rounded-full ${RAIL_ACCENT.stripe}`} aria-hidden />
        <div className="flex items-center gap-2">
          <span className={`size-2 rounded-full ${RAIL_ACCENT.dot}`} aria-hidden />
          <h2 className={`text-base font-semibold tracking-tight ${RAIL_ACCENT.text} after:hidden`}>
            {t['page.tierlist.other_rankings']}
          </h2>
        </div>
        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-500">
          {tools.length} {t['tierlist.versus.tools_count']}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {tools.map((tool) => (
          <SupportingCard key={tool.slug} tool={tool} lang={lang} t={t} />
        ))}
      </div>
    </section>
  );
}

function SupportingCard({
  tool, lang, t,
}: {
  tool: SupportingTool;
  lang: Lang;
  t: Record<TranslationKey, string>;
}) {
  const titleKey = `tools.${tool.slug}` as TranslationKey;
  const descKey = `tools.${tool.slug}.desc` as TranslationKey;
  const title = t[titleKey] ?? tool.slug;
  const description = t[descKey] ?? '';
  const isDim = tool.status === 'coming-soon';

  const inner = (
    <>
      <div className={[
        'relative flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border bg-linear-to-br to-transparent transition-colors',
        isDim ? 'border-zinc-800 from-transparent' : `${RAIL_ACCENT.iconBorder} ${RAIL_ACCENT.iconFrom}`,
      ].join(' ')}>
        <Image
          src={`/images/ui/${tool.icon}.webp`}
          alt={title}
          fill
          sizes="48px"
          className={['object-contain p-1', isDim ? 'opacity-60' : ''].join(' ')}
        />
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-sm font-semibold text-zinc-100 after:hidden">{title}</h3>
        <p className="mt-0.5 line-clamp-2 text-xs text-zinc-400">{description}</p>
      </div>
    </>
  );

  const baseClasses = 'group flex items-start gap-3 rounded-xl border border-zinc-800 bg-slate-800/50 p-4 transition-[transform,border-color,box-shadow] duration-150';

  if (isDim) {
    return <div className={`${baseClasses} cursor-default opacity-70`}>{inner}</div>;
  }

  return (
    <Link
      href={localePath(lang, tool.href ?? `/${tool.slug}`)}
      className={[
        baseClasses,
        `hover:-translate-y-px hover:bg-slate-800/70 ${RAIL_ACCENT.hoverBorder} ${RAIL_ACCENT.hoverGlow} focus-visible:ring-2 focus-visible:ring-(--color-filter-ring) focus-visible:outline-none`,
      ].join(' ')}
    >
      {inner}
    </Link>
  );
}
