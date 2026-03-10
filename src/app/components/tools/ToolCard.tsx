import Image from 'next/image';
import Link from 'next/link';
import type { Lang } from '@/lib/i18n/config';
import type { TranslationKey } from '@/i18n';
import { localePath } from '@/lib/navigation';

type Props = {
  slug: string;
  icon: string;
  status: 'available' | 'coming-soon' | 'hidden';
  href?: string;
  lang: Lang;
  t: Record<TranslationKey, string>;
  devMode?: boolean;
};

export default function ToolCard({ slug, icon, status, href, lang, t, devMode }: Props) {
  const titleKey = `tools.${slug}` as TranslationKey;
  const descKey = `tools.${slug}.desc` as TranslationKey;
  const title = t[titleKey] ?? slug;
  const description = t[descKey] ?? '';

  const inner = (
    <>
      <div className="relative h-12 w-12 shrink-0">
        <Image
          src={`/images/ui/${icon}.webp`}
          alt={title}
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
      {status === 'coming-soon' && (
        <span className="shrink-0 rounded-full bg-zinc-700 px-2.5 py-0.5 text-xs font-medium text-zinc-400">
          {t['common.coming_soon']}
        </span>
      )}
      {status === 'hidden' && (
        <span className="shrink-0 rounded-full bg-amber-900/50 px-2.5 py-0.5 text-xs font-medium text-amber-400">
          DEV
        </span>
      )}
    </>
  );

  if ((status === 'coming-soon' || status === 'hidden') && !devMode) {
    return (
      <div className={`card-interactive flex items-center gap-4 p-4 cursor-default ${status === 'hidden' ? 'opacity-60 border border-dashed border-amber-700/50' : 'opacity-50'}`}>
        {inner}
      </div>
    );
  }

  return (
    <Link
      href={localePath(lang, href ?? `/${slug}`)}
      className="card-interactive group flex items-center gap-4 p-4 transition-colors"
    >
      {inner}
    </Link>
  );
}
