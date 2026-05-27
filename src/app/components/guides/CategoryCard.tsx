import Image from 'next/image';
import Link from 'next/link';
import type { Lang } from '@/lib/i18n/config';
import type { TranslationKey } from '@/i18n';
import { localePath } from '@/lib/navigation';
import { guideAccent } from './guidesTheme';

type Props = {
  slug: string;
  icon: string;
  count: number;
  lang: Lang;
  t: Record<TranslationKey, string>;
};

export default function CategoryCard({ slug, icon, count, lang, t }: Props) {
  const titleKey = `guides.category.${slug}` as TranslationKey;
  const descKey = `guides.category.${slug}.desc` as TranslationKey;
  const title = t[titleKey] ?? slug;
  const description = t[descKey] ?? '';
  const accent = guideAccent(slug);
  const guidesUnit = count === 1
    ? t['guides.count.one'].replace('{count}', String(count))
    : t['guides.count.many'].replace('{count}', String(count));

  return (
    <Link
      href={localePath(lang, `/guides/${slug}`)}
      className={[
        'group relative flex items-start gap-4 overflow-hidden rounded-xl border bg-slate-800/50 p-4 transition-[transform,border-color,box-shadow] duration-150',
        'hover:-translate-y-px focus-visible:ring-2 focus-visible:ring-(--color-filter-ring) focus-visible:outline-none',
        'border-zinc-800',
        accent.hoverBorder,
        accent.glow,
      ].join(' ')}
    >
      <div
        className={[
          'relative flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border bg-linear-to-br to-transparent',
          accent.iconBorder,
          accent.iconFrom,
        ].join(' ')}
      >
        <Image
          src={`${icon}.webp`}
          alt={title}
          fill
          sizes="48px"
          className="object-contain p-1"
        />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="static pb-0 text-sm font-semibold text-zinc-100 after:hidden">
            {title}
          </h2>
          <span
            className={[
              'shrink-0 rounded-full border px-2 py-0.5 font-mono text-[9.5px] font-semibold uppercase tracking-[0.14em]',
              accent.pillBg,
              accent.pillBorder,
              accent.text,
            ].join(' ')}
          >
            {guidesUnit}
          </span>
        </div>
        {description && (
          <p className="mt-1 text-xs text-zinc-400">{description}</p>
        )}
      </div>
    </Link>
  );
}
