import type { Metadata } from 'next';
import type { Lang } from '@/lib/i18n/config';
import { createPageMetadata, getMonthYear } from '@/lib/seo';
import { getT, loadMessages } from '@/i18n';

export const revalidate = 86400;

type Props = { params: Promise<{ lang: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  const l = lang as Lang;
  const t = await getT(l);
  const monthYear = getMonthYear(l);
  return createPageMetadata({
    lang: l,
    path: '/characters',
    title: t('page.characters.meta_title', { monthYear }),
    description: t('page.characters.description', { monthYear }),
  });
}

export default async function CharactersPage({ params }: Props) {
  const { lang } = await params;
  const t = await loadMessages(lang as Lang);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 md:px-6">
      <h1 className="text-3xl font-bold">{t['page.characters.title']}</h1>
      <p className="mt-2 text-zinc-400">{t['common.coming_soon']}</p>
    </div>
  );
}
