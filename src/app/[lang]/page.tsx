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
  const { lang: _lang } = await params;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4">
      <h1 className="h1-page">Outerpedia — Outerplane Wiki &amp; Database</h1>
      <p>Coming soon.</p>
    </main>
  );
}
