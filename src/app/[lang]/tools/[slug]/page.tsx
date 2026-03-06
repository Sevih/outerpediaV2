import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { Lang } from '@/lib/i18n/config';
import { LANGS } from '@/lib/i18n/config';
import { createPageMetadata } from '@/lib/seo';
import { loadMessages } from '@/i18n';
import type { TranslationKey } from '@/i18n';
import { getToolMeta, getToolSlugs } from '@/lib/data/tools';
import Link from 'next/link';
import { localePath } from '@/lib/navigation';

export const revalidate = 86400;

type Props = { params: Promise<{ lang: string; slug: string }> };

export async function generateStaticParams() {
  const slugs = await getToolSlugs();
  return LANGS.flatMap((lang) =>
    slugs.map((slug) => ({ lang, slug }))
  );
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang: rawLang, slug } = await params;
  const lang = rawLang as Lang;
  const [t, tool] = await Promise.all([
    loadMessages(lang),
    getToolMeta(slug),
  ]);

  if (!tool || tool.status === 'coming-soon') return {};

  const titleKey = `tools.${slug}` as TranslationKey;
  const descKey = `tools.${slug}.desc` as TranslationKey;
  const title = t[titleKey] ?? slug;
  const description = t[descKey] ?? '';

  return createPageMetadata({
    lang,
    path: `/tools/${slug}`,
    title: t['page.tool.meta_title'].replace('{title}', title),
    description,
    ogImage: `/images/ui/${tool.icon}.png`,
    ogImageSize: { width: 150, height: 150 },
  });
}

export default async function ToolDetailPage({ params }: Props) {
  const { lang: rawLang, slug } = await params;
  const lang = rawLang as Lang;

  const tool = await getToolMeta(slug);
  if (!tool || tool.status === 'coming-soon') notFound();

  const t = await loadMessages(lang);
  const titleKey = `tools.${slug}` as TranslationKey;
  const title = t[titleKey] ?? slug;

  let ToolContent: React.ComponentType;
  try {
    const mod = await import(`../_contents/${slug}`);
    ToolContent = mod.default;
  } catch {
    notFound();
  }

  return (
    <div className="px-4 py-6 md:px-6">
      <Link
        href={localePath(lang, '/tools')}
        className="inline-flex items-center gap-1 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
      >
        &larr; {t['page.tools.title']}
      </Link>

      <h1 className="mx-auto text-center text-3xl font-bold mt-4">{title}</h1>

      <div className="mt-8">
        <ToolContent />
      </div>
    </div>
  );
}
