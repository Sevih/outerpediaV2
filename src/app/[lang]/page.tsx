import type { Metadata } from 'next';
import type { Lang } from '@/lib/i18n/config';
import { createPageMetadata } from '@/lib/seo';
import { loadMessages } from '@/i18n';

type Props = { params: Promise<{ lang: Lang }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  const t = await loadMessages(lang);
  return createPageMetadata({
    lang,
    path: '/',
    title: t['page.home.title'],
    description: t['page.home.description'],
  });
}

export default async function Home({ params }: Props) {
  const { lang } = await params;
  const t = await loadMessages(lang);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4">
      <h1 className="h1-page">{t['page.home.title']}</h1>
      <p>{t['common.coming_soon']}</p>
    </main>
  );
}
