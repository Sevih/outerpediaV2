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
  const monthYear = getMonthYear(lang);

  const totalGuides = Object.values(counts).reduce((sum, n) => sum + n, 0);
  const counterLabel = t['guides.counter']
    .replace('{guides}', String(totalGuides))
    .replace('{categories}', String(categories.length));

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 md:px-6">
      {/* Hero */}
      <div className="flex flex-col items-center text-center">
        <h1 className="h1-page">
          {t['page.guides.title']}
          <span className="sr-only">{` — Boss Strategies, Tips & Guides`}</span>
        </h1>
        <p className="mx-auto mt-2 max-w-2xl text-sm text-zinc-400">
          {t['page.guides.description']}
        </p>
        <p className="sr-only">{monthYear}</p>
        <div className="mt-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500">
          <span className="inline-block size-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.6)]" aria-hidden />
          <span>{counterLabel}</span>
        </div>
      </div>

      <h2 className="sr-only">{t['page.guides.list']}</h2>

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
