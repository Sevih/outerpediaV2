import type { Metadata } from 'next';
import type { Lang } from '@/lib/i18n/config';
import type { TranslationKey } from '@/i18n';
import { createPageMetadata } from '@/lib/seo';
import { loadMessages } from '@/i18n';
import { getToolsByCategory } from '@/lib/data/tools';
import ToolCard from '@/app/components/tools/ToolCard';

type Props = { params: Promise<{ lang: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  const t = await loadMessages(lang as Lang);
  return createPageMetadata({
    lang: lang as Lang,
    path: '/tools',
    title: t['page.tools.title'],
    description: t['page.tools.description'],
  });
}

export default async function ToolsPage({ params }: Props) {
  const { lang: rawLang } = await params;
  const lang = rawLang as Lang;
  const [t, groups] = await Promise.all([
    loadMessages(lang),
    getToolsByCategory(),
  ]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 md:px-6">
      <h1 className="h1-page text-center">{t['page.tools.title']}</h1>

      {groups.map(({ category, tools }) => {
        const catKey = `tools.category.${category.slug}` as TranslationKey;
        return (
          <section key={category.slug} className="mt-8">
            <h2 className="mb-3 text-lg font-semibold text-zinc-200">
              {t[catKey] ?? category.slug}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {tools.map((tool) => (
                <ToolCard
                  key={tool.slug}
                  slug={tool.slug}
                  icon={tool.icon}
                  status={tool.status}
                  href={tool.href}
                  lang={lang}
                  t={t}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
