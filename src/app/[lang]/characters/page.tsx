import { Suspense } from 'react';
import type { Metadata } from 'next';
import type { Lang } from '@/lib/i18n/config';
import { createPageMetadata, getMonthYear } from '@/lib/seo';
import { getT, loadMessages } from '@/i18n';
import { getCharactersForList } from '@/lib/data/characters';
import CharactersPageClient from './CharactersPageClient';

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
  const l = lang as Lang;
  const [t, characters] = await Promise.all([
    loadMessages(l),
    getCharactersForList(),
  ]);

  return (
    <div className="mx-auto max-w-350 px-4 py-6 md:px-6">
      <h1 className="mx-auto text-center text-3xl font-bold">{t['page.characters.title']}</h1>
      <p className="mt-1 mb-4 text-center text-sm text-zinc-400">{t['common.updated'].replace('{monthYear}', getMonthYear(l))}</p>
      <Suspense>
        <CharactersPageClient characters={characters} lang={l} />
      </Suspense>
    </div>
  );
}
