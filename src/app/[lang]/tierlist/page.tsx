import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import type { Lang } from '@/lib/i18n/config';
import type { TranslationKey } from '@/i18n';
import { createPageMetadata, getMonthYear } from '@/lib/seo';
import { loadMessages } from '@/i18n';
import { localePath } from '@/lib/navigation';
import { getAllTools, isDev } from '@/lib/data/tools';

export const revalidate = 86400;

type Props = { params: Promise<{ lang: string }> };

const FEATURED_SLUGS = ['tierlistpve', 'tierlistpvp'] as const;

const OTHER_RANKING_SLUGS = [
  'ee-priority-base',
  'ee-priority-plus10',
  'most-used-units',
] as const;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  const l = lang as Lang;
  const t = await loadMessages(l);
  const monthYear = getMonthYear(l);
  return createPageMetadata({
    lang: l,
    path: '/tierlist',
    title: t['page.tierlist.meta_title'].replace('{monthYear}', monthYear),
    description: t['page.tierlist.description'].replace('{monthYear}', monthYear),
  });
}

export default async function TierlistPage({ params }: Props) {
  const { lang: rawLang } = await params;
  const lang = rawLang as Lang;
  const [t, allTools] = await Promise.all([
    loadMessages(lang),
    getAllTools(),
  ]);

  const toolMap = Object.fromEntries(allTools.map((tool) => [tool.slug, tool]));

  const featured = FEATURED_SLUGS.map((slug) => toolMap[slug]).filter(Boolean);
  const others = OTHER_RANKING_SLUGS.map((slug) => toolMap[slug]).filter(Boolean);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 md:px-6">
      <h1 className="h1-page text-center">{t['page.tierlist.title']}</h1>
      <p className="mx-auto mt-2 max-w-2xl text-center text-sm text-zinc-400">
        {t['page.tierlist.description'].replace('{monthYear}', getMonthYear(lang))}
      </p>

      {/* Featured: PvE & PvP */}
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {featured.map((tool) => {
          const titleKey = `tools.${tool.slug}` as TranslationKey;
          const descKey = `tools.${tool.slug}.desc` as TranslationKey;
          const isAvailable = tool.status === 'available' || isDev;

          const inner = (
            <div className="flex flex-col items-center gap-3 p-6 text-center">
              <div className="relative h-16 w-16">
                <Image
                  src={`/images/ui/${tool.icon}.webp`}
                  alt=""
                  fill
                  sizes="64px"
                  className="object-contain"
                />
              </div>
              <div>
                <h2 className="text-lg font-bold text-zinc-100 after:hidden">
                  {t[titleKey] ?? tool.slug}
                </h2>
                <p className="mt-1 text-sm text-zinc-400">
                  {t[descKey] ?? ''}
                </p>
              </div>
              {!isAvailable && (
                <span className="rounded-full bg-zinc-700 px-3 py-1 text-xs font-medium text-zinc-400">
                  {t['common.coming_soon']}
                </span>
              )}
            </div>
          );

          if (!isAvailable) {
            return (
              <div
                key={tool.slug}
                className="card-interactive cursor-default opacity-50"
              >
                {inner}
              </div>
            );
          }

          return (
            <Link
              key={tool.slug}
              href={localePath(lang, `/${tool.slug}`)}
              className="card-interactive group transition-colors"
            >
              {inner}
            </Link>
          );
        })}
      </div>

      {/* Other Rankings */}
      {others.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-4 text-lg font-semibold text-zinc-200">
            {t['page.tierlist.other_rankings']}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {others.map((tool) => {
              const titleKey = `tools.${tool.slug}` as TranslationKey;
              const descKey = `tools.${tool.slug}.desc` as TranslationKey;
              const isAvailable = tool.status === 'available' || isDev;

              const inner = (
                <>
                  <div className="relative h-12 w-12 shrink-0">
                    <Image
                      src={`/images/ui/${tool.icon}.webp`}
                      alt=""
                      fill
                      sizes="48px"
                      className="object-contain"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-semibold text-zinc-100 after:hidden">
                      {t[titleKey] ?? tool.slug}
                    </h3>
                    <p className="mt-0.5 text-xs text-zinc-400">
                      {t[descKey] ?? ''}
                    </p>
                  </div>
                  {!isAvailable && (
                    <span className="shrink-0 rounded-full bg-zinc-700 px-2.5 py-0.5 text-xs font-medium text-zinc-400">
                      {t['common.coming_soon']}
                    </span>
                  )}
                </>
              );

              if (!isAvailable) {
                return (
                  <div
                    key={tool.slug}
                    className="card-interactive flex items-center gap-4 p-4 cursor-default opacity-50"
                  >
                    {inner}
                  </div>
                );
              }

              return (
                <Link
                  key={tool.slug}
                  href={localePath(lang, `/${tool.slug}`)}
                  className="card-interactive group flex items-center gap-4 p-4 transition-colors"
                >
                  {inner}
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
