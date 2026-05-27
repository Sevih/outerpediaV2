import type { Metadata } from 'next';
import type { Lang } from '@/lib/i18n/config';
import { createPageMetadata } from '@/lib/seo';
import { loadMessages } from '@/i18n';
import { getToolsByCategory, isDev } from '@/lib/data/tools';
import ToolsPageContent from '@/app/components/tools/ToolsPageContent';

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

  const totalTools = groups.reduce((n, g) => n + g.tools.length, 0);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 md:px-6">
      {/* Hero */}
      <div className="flex flex-col items-center text-center">
        <h1 className="h1-page">{t['page.tools.title']}</h1>
        <p className="mx-auto mt-2 max-w-2xl text-sm text-zinc-400">
          {t['page.tools.description']}
        </p>
        <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500">
          {t['tools.count'].replace('{count}', String(totalTools))}
        </p>
      </div>

      <ToolsPageContent groups={groups} lang={lang} t={t} devMode={isDev} />
    </div>
  );
}
