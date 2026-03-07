import type { Metadata } from 'next';
import type { Lang } from '@/lib/i18n/config';
import { createPageMetadata } from '@/lib/seo';
import { loadMessages } from '@/i18n';
import { getToolsByCategory } from '@/lib/data/tools';
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

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 md:px-6">
      <h1 className="h1-page text-center">{t['page.tools.title']}</h1>
      <ToolsPageContent groups={groups} lang={lang} t={t} />
    </div>
  );
}
