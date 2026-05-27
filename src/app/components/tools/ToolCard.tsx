import Image from 'next/image';
import Link from 'next/link';
import type { Lang } from '@/lib/i18n/config';
import type { TranslationKey } from '@/i18n';
import { localePath } from '@/lib/navigation';
import { CATEGORY_ACCENT, type CategoryAccentKey } from './toolsTheme';
import StatusBadge from './StatusBadge';

type Props = {
  slug: string;
  icon: string;
  status: 'available' | 'coming-soon' | 'hidden' | 'unlisted';
  href?: string;
  lang: Lang;
  t: Record<TranslationKey, string>;
  devMode?: boolean;
  category: CategoryAccentKey;
};

export default function ToolCard({ slug, icon, status, href, lang, t, devMode, category }: Props) {
  const titleKey = `tools.${slug}` as TranslationKey;
  const descKey = `tools.${slug}.desc` as TranslationKey;
  const title = t[titleKey] ?? slug;
  const description = t[descKey] ?? '';
  const isDim = status === 'coming-soon';
  const accent = CATEGORY_ACCENT[category];

  const inner = (
    <>
      <div
        className={[
          'relative flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border bg-linear-to-br to-transparent transition-colors',
          isDim ? 'border-zinc-800 from-transparent' : `${accent.iconBorder} ${accent.iconFrom}`,
        ].join(' ')}
      >
        <Image
          src={`/images/ui/${icon}.webp`}
          alt={title}
          fill
          sizes="48px"
          className={['object-contain p-1', isDim ? 'opacity-60' : ''].join(' ')}
        />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h3 className="truncate text-sm font-semibold text-zinc-100 after:hidden">{title}</h3>
          {status === 'available' ? null : <StatusBadge status={status} t={t} />}
        </div>
        <p className="mt-0.5 line-clamp-2 text-xs text-zinc-400">{description}</p>
      </div>
    </>
  );

  const baseClasses =
    'group flex items-start gap-3 rounded-xl border border-zinc-800 bg-slate-800/50 p-4 transition-[transform,border-color,box-shadow] duration-150';

  if ((status === 'coming-soon' || status === 'hidden') && !devMode) {
    return (
      <div
        className={[
          baseClasses,
          'cursor-default opacity-70',
          status === 'hidden' ? 'border-dashed border-amber-700/40' : '',
        ].join(' ')}
      >
        {inner}
      </div>
    );
  }

  return (
    <Link
      href={localePath(lang, href ?? `/${slug}`)}
      className={[
        baseClasses,
        `hover:-translate-y-px hover:bg-slate-800/70 ${accent.hoverBorder} hover:shadow-[0_6px_24px_-12px_var(--color-filter-ring)] focus-visible:ring-2 focus-visible:ring-(--color-filter-ring) focus-visible:outline-none`,
      ].join(' ')}
    >
      {inner}
    </Link>
  );
}
