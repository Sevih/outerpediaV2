import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { Lang } from '@/lib/i18n/config';
import { LANGS } from '@/lib/i18n/config';
import { createPageMetadata } from '@/lib/seo';
import { loadMessages } from '@/i18n';
import type { TranslationKey } from '@/i18n';
import { getGuideMeta, getGuideSlugsWithCategories } from '@/lib/data/guides';
import { lRec } from '@/lib/i18n/localize';
import Link from 'next/link';
import { localePath } from '@/lib/navigation';

export const revalidate = 86400;

type Props = { params: Promise<{ lang: string; category: string; slug: string }> };

export async function generateStaticParams() {
  const guides = await getGuideSlugsWithCategories();
  return LANGS.flatMap((lang) =>
    guides.map(({ category, slug }) => ({ lang, category, slug }))
  );
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang: rawLang, slug } = await params;
  const lang = rawLang as Lang;
  const [t, guide] = await Promise.all([
    loadMessages(lang),
    getGuideMeta(slug),
  ]);

  if (!guide) return {};

  const title = lRec(guide.title, lang);
  const description = lRec(guide.description, lang);

  return createPageMetadata({
    lang,
    path: `/guides/${guide.category}/${slug}`,
    title: t['page.guide.meta_title'].replace('{title}', title),
    description,
    // TODO: verify og_image overrides in _index.json render well on Discord/social
    ogImage: guide.og_image ?? `/images/guides/${guide.icon}.png`,
  });
}

export default async function GuideDetailPage({ params }: Props) {
  const { lang: rawLang, category, slug } = await params;
  const lang = rawLang as Lang;

  const guide = await getGuideMeta(slug);
  if (!guide || guide.category !== category) notFound();

  const t = await loadMessages(lang);
  const categoryKey = `guides.category.${category}` as TranslationKey;
  const categoryTitle = t[categoryKey] ?? category;
  const title = lRec(guide.title, lang);

  // Server-side dynamic import — full HTML in the response
  let GuideContent: React.ComponentType;
  try {
    const mod = await import(`../../_contents/${category}/${slug}`);
    GuideContent = mod.default;
  } catch {
    notFound();
  }

  return (
    <div className="px-4 py-6 md:px-6">
      <Link
        href={localePath(lang, `/guides/${category}`)}
        className="inline-flex items-center gap-1 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
      >
        &larr; {categoryTitle}
      </Link>

      <h1 className="mx-auto text-center text-3xl font-bold mt-4">{title}</h1>
      <div className="mt-2 flex items-center gap-3 text-xs text-zinc-500">
        <span>{t['page.guide.by'].replace('{author}', guide.author)}</span>
        <span>{t['page.guide.updated'].replace('{date}', guide.last_updated)}</span>
      </div>

      <div className="mt-8">
        <GuideContent />
      </div>
    </div>
  );
}
