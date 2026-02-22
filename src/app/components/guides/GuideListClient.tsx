'use client';

import { useMemo, useState } from 'react';
import type { Lang } from '@/lib/i18n/config';
import type { GuideMeta } from '@/types/guide';
import type { TranslationKey } from '@/i18n';
import { lRec } from '@/lib/i18n/localize';
import GuideCard from './GuideCard';
import GuideSortBar, { type GuideSort } from './GuideSortBar';

type Props = {
  guides: GuideMeta[];
  lang: Lang;
  t: Record<TranslationKey, string>;
  sortable: boolean;
};

export default function GuideListClient({ guides, lang, t, sortable }: Props) {
  const [sort, setSort] = useState<GuideSort>('order');

  const sorted = useMemo(() => {
    const list = [...guides];
    switch (sort) {
      case 'order':
        list.sort((a, b) => a.order - b.order);
        break;
      case 'date_desc':
        list.sort((a, b) => b.last_updated.localeCompare(a.last_updated));
        break;
      case 'date_asc':
        list.sort((a, b) => a.last_updated.localeCompare(b.last_updated));
        break;
      case 'name_asc':
        list.sort((a, b) => lRec(a.title, lang).localeCompare(lRec(b.title, lang)));
        break;
      case 'name_desc':
        list.sort((a, b) => lRec(b.title, lang).localeCompare(lRec(a.title, lang)));
        break;
      case 'author_asc':
        list.sort((a, b) => a.author.localeCompare(b.author));
        break;
      case 'author_desc':
        list.sort((a, b) => b.author.localeCompare(a.author));
        break;
    }
    return list;
  }, [guides, sort, lang]);

  return (
    <>
      {sortable && (
        <div className="mt-6">
          <GuideSortBar sort={sort} onSort={setSort} t={t} />
        </div>
      )}
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {sorted.map((guide) => (
          <GuideCard key={guide.slug} guide={guide} lang={lang} t={t} />
        ))}
      </div>
    </>
  );
}
