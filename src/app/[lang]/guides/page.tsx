import type { Metadata } from 'next';
import type { Lang } from '@/lib/i18n/config';
import { createPageMetadata, getMonthYear } from '@/lib/seo';
import { loadMessages } from '@/i18n';
import { getGuideCategories, getGuideCounts } from '@/lib/data/guides';
import CategoryCard from '@/app/components/guides/CategoryCard';

type Props = { params: Promise<{ lang: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  const t = await loadMessages(lang as Lang);
  const monthYear = getMonthYear(lang as Lang);
  return createPageMetadata({
    lang: lang as Lang,
    path: '/guides',
    title: t['page.guides.meta_title'].replace('{monthYear}', monthYear),
    description: t['page.guides.description'],
  });
}

export default async function GuidesPage({ params }: Props) {
  const { lang: rawLang } = await params;
  const lang = rawLang as Lang;
  const [t, categories, counts] = await Promise.all([
    loadMessages(lang),
    getGuideCategories(),
    getGuideCounts(),
  ]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 md:px-6">
      <h1 className="h1-page text-center">
        {t['page.guides.title']}
        <span className="sr-only">{` — Strategy Guides, Boss Walkthroughs & Tips`}</span>
      </h1>
      <p className="mt-2 text-center text-sm text-zinc-400">{t['page.guides.description']}</p>

      <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {categories.map((cat) => (
          <CategoryCard
            key={cat.slug}
            slug={cat.slug}
            icon={cat.icon}
            count={counts[cat.slug] ?? 0}
            lang={lang}
            t={t}
          />
        ))}
      </div>
    </div>
  );
}
