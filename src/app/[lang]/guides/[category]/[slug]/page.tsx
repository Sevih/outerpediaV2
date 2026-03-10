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

  const cat = guide.category;
  const categoryKey = `guides.category.${cat}` as TranslationKey;
  const categoryTitle = t[categoryKey] ?? cat;
  const hasCustomOg = !!(guide.og_image || guide.boss_id);

  const ogImage = guide.og_image
    ?? (guide.boss_id?.startsWith('2') ? `/images/characters/portrait/og_${guide.boss_id}.png` : undefined)
    ?? (guide.boss_id ? `/images/characters/boss/portrait/MT_${guide.boss_id}.png` : undefined)
    ?? (cat === 'adventure' || cat === 'monad-gate' || cat === 'skyward-tower'
      ? `/images/guides/${guide.icon}.png`
      : undefined);

  let ogImageSize: { width: number; height: number } | undefined;
  if (!hasCustomOg) {
    if (cat === 'adventure' || cat === 'monad-gate') ogImageSize = { width: 75, height: 150 };
    else if (cat === 'skyward-tower') ogImageSize = { width: 1200, height: 630 };
  }

  return createPageMetadata({
    lang,
    path: `/guides/${guide.category}/${slug}`,
    title: t['page.guide.meta_title'].replace('{title}', title).replace('{category}', categoryTitle),
    description: `${title} — ${description}`,
    ...(ogImage && { ogImage }),
    ...(ogImageSize && { ogImageSize }),
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

      <h1 className="mx-auto text-center text-3xl font-bold mt-4">
        {title}
        <span className="sr-only">{` — Outerplane ${categoryTitle} Guide`}</span>
      </h1>
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
