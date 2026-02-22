import Image from 'next/image';
import Link from 'next/link';
import type { Lang } from '@/lib/i18n/config';
import type { TranslationKey } from '@/i18n';

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

  return (
    <Link
      href={`/${lang}/guides/${slug}`}
      className="card-interactive group flex items-center gap-4 p-4 transition-colors"
    >
      <div className="relative h-12 w-12 shrink-0">
        <Image
          src={`${icon}.webp`}
          alt=""
          fill
          sizes="48px"
          className="object-contain"
        />
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="text-sm font-semibold text-zinc-100 after:hidden">
          {title}
        </h3>
        <p className="mt-0.5 text-xs text-zinc-400">{description}</p>
      </div>
      <span className="shrink-0 rounded-full bg-zinc-700 px-2.5 py-0.5 text-xs font-medium text-zinc-300">
        {count}
      </span>
    </Link>
  );
}
