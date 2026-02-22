import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { Lang } from '@/lib/i18n/config';
import { LANGS } from '@/lib/i18n/config';
import { createPageMetadata } from '@/lib/seo';
import { loadMessages } from '@/i18n';
import type { TranslationKey } from '@/i18n';
import { getValidCategories, getGuidesByCategory } from '@/lib/data/guides';
import GuideCard from '@/app/components/guides/GuideCard';
import Link from 'next/link';

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
  const t = await loadMessages(lang);
  const titleKey = `guides.category.${category}` as TranslationKey;
  const descKey = `guides.category.${category}.desc` as TranslationKey;
  const title = t[titleKey] ?? category;
  const description = t[descKey] ?? t['page.guides.description'];

  return createPageMetadata({
    lang,
    path: `/guides/${category}`,
    title: `${title} — ${t['page.guides.title']}`,
    description,
  });
}

export default async function GuideCategoryPage({ params }: Props) {
  const { lang: rawLang, category } = await params;
  const lang = rawLang as Lang;

  const validCategories = await getValidCategories();
  if (!validCategories.includes(category)) notFound();

  const [t, guides] = await Promise.all([
    loadMessages(lang),
    getGuidesByCategory(category),
  ]);

  const titleKey = `guides.category.${category}` as TranslationKey;
  const descKey = `guides.category.${category}.desc` as TranslationKey;
  const title = t[titleKey] ?? category;
  const description = t[descKey] ?? '';

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 md:px-6">
      <Link
        href={`/${lang}/guides`}
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
      ) : (
        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {guides.map((guide) => (
            <GuideCard key={guide.slug} guide={guide} lang={lang} t={t} />
          ))}
        </div>
      )}
    </div>
  );
}
