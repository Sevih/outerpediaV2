import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { Lang } from '@/lib/i18n/config';
import { LANGS } from '@/lib/i18n/config';
import { createPageMetadata } from '@/lib/seo';
import { loadMessages } from '@/i18n';
import type { TranslationKey } from '@/i18n';
import { getValidCategories, getGuidesByCategory, getGuideCategory } from '@/lib/data/guides';
import GuideListClient from '@/app/components/guides/GuideListClient';
import { getCategoryView } from '@/app/components/guides/category-views';
import Link from 'next/link';
import { localePath } from '@/lib/navigation';

type Props = { params: Promise<{ lang: string; category: string }> };

export async function generateStaticParams() {
  const categories = await getValidCategories();
  return LANGS.flatMap((lang) =>
    categories.map((category) => ({ lang, category }))
  );
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang: rawLang, category } = await params;
  const lang = rawLang as Lang;
  const [t, categoryData] = await Promise.all([
    loadMessages(lang),
    getGuideCategory(category),
  ]);
  const titleKey = `guides.category.${category}` as TranslationKey;
  const descKey = `guides.category.${category}.desc` as TranslationKey;
  const title = t[titleKey] ?? category;
  const description = t[descKey] ?? t['page.guides.description'];

  return createPageMetadata({
    lang,
    path: `/guides/${category}`,
    title: `${title} — ${t['page.guides.title']}`,
    description,
    keywords: categoryData?.keywords,
  });
}

export default async function GuideCategoryPage({ params }: Props) {
  const { lang: rawLang, category } = await params;
  const lang = rawLang as Lang;

  const validCategories = await getValidCategories();
  if (!validCategories.includes(category)) notFound();

  const [t, guides, categoryData] = await Promise.all([
    loadMessages(lang),
    getGuidesByCategory(category),
    getGuideCategory(category),
  ]);

  const titleKey = `guides.category.${category}` as TranslationKey;
  const descKey = `guides.category.${category}.desc` as TranslationKey;
  const title = t[titleKey] ?? category;
  const description = t[descKey] ?? '';

  const CategoryView = getCategoryView(category);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 md:px-6">
      <Link
        href={localePath(lang, '/guides')}
        className="inline-flex items-center gap-1 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
      >
        &larr; {t['page.guides.title']}
      </Link>

      <h1 className="h1-page mt-4">{title}</h1>
      {description && (
        <p className="mt-2 text-sm text-zinc-400">{description}</p>
      )}

      {guides.length === 0 ? (
        <p className="mt-8 text-zinc-500">{t['common.coming_soon']}</p>
      ) : CategoryView ? (
        <CategoryView guides={guides} lang={lang} t={t} />
      ) : (
        <GuideListClient
          guides={guides}
          lang={lang}
          t={t}
          sortable={categoryData?.sortable ?? false}
        />
      )}
    </div>
  );
}
