import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { DEFAULT_LANG } from '@/lib/i18n/config';
import { createPageMetadata } from '@/lib/seo';
import { loadMessages } from '@/i18n';

export async function generateMetadata(): Promise<Metadata> {
  const t = await loadMessages(DEFAULT_LANG);
  return createPageMetadata({
    lang: DEFAULT_LANG,
    path: '/',
    title: t['page.home.title'],
    description: t['page.home.description'],
  });
}

/** Root page redirects to default language. Middleware handles this too, but this is a safety net. */
export default function RootPage() {
  redirect(`/${DEFAULT_LANG}`);
}
