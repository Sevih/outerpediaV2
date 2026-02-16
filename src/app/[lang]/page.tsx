import type { Metadata } from 'next';
import type { Lang } from '@/lib/i18n/config';
import { createPageMetadata } from '@/lib/seo';
import { loadMessages } from '@/i18n';

export const revalidate = 86400;

type Props = { params: Promise<{ lang: Lang }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  const t = await loadMessages(lang);
  const meta = createPageMetadata({
    lang,
    path: '/',
    title: t['page.home.title'],
    description: t['page.home.description'],
  });
  // Bypass layout template — home title already includes site name
  return { ...meta, title: { absolute: t['page.home.title'] } };
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
