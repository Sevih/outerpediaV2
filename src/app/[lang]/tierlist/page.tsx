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
    path: '/tierlist',
    title: t('page.tierlist.meta_title', { monthYear }),
    description: t('page.tierlist.description', { monthYear }),
  });
}

export default async function TierlistPage({ params }: Props) {
  const { lang } = await params;
  const t = await loadMessages(lang as Lang);

  return (
    <div className="mx-auto max-w-6xl p-6">
      <h1 className="text-3xl font-bold">{t['page.tierlist.title']}</h1>
      <p className="mt-2 text-zinc-400">{t['common.coming_soon']}</p>
    </div>
  );
}
