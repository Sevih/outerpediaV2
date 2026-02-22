'use client';

import { FilterPill } from '@/app/components/ui/FilterPills';
import type { TranslationKey } from '@/i18n';

export type GuideSort =
  | 'order'
  | 'date_desc'
  | 'date_asc'
  | 'name_asc'
  | 'name_desc'
  | 'author_asc'
  | 'author_desc';

const SORT_OPTIONS: { value: GuideSort; label: TranslationKey }[] = [
  { value: 'order', label: 'common.sort.order' },
  { value: 'date_desc', label: 'common.sort.date_desc' },
  { value: 'date_asc', label: 'common.sort.date_asc' },
  { value: 'name_asc', label: 'common.sort.name_asc' },
  { value: 'name_desc', label: 'common.sort.name_desc' },
  { value: 'author_asc', label: 'common.sort.author_asc' },
  { value: 'author_desc', label: 'common.sort.author_desc' },
];

type Props = {
  sort: GuideSort;
  onSort: (sort: GuideSort) => void;
  t: Record<TranslationKey, string>;
};

export default function GuideSortBar({ sort, onSort, t }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs uppercase tracking-wide text-zinc-400">
        {t['common.sort']}
      </span>
      {SORT_OPTIONS.map((opt) => (
        <FilterPill
          key={opt.value}
          active={sort === opt.value}
          onClick={() => onSort(opt.value)}
          className="h-7 px-2.5"
        >
          {t[opt.label]}
        </FilterPill>
      ))}
    </div>
  );
}
