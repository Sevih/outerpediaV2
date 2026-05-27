'use client';

import { useI18n } from '@/lib/contexts/I18nContext';
import { ActiveChip, Eyebrow } from './FilterAtoms';

export type ActiveChipItem = {
  key: string;
  label: React.ReactNode;
  color: string;
  prefix?: string;
  onRemove: () => void;
};

type Props = {
  items: ActiveChipItem[];
  totalCount: number;
  matchCount: number;
  onResetAll: () => void;
  onCopyShareUrl: () => void;
  copied: boolean;
};

export default function ActiveFiltersStrip({
  items, totalCount, matchCount, onResetAll, onCopyShareUrl, copied,
}: Props) {
  const { t } = useI18n();

  if (items.length === 0) {
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-zinc-800/80 bg-slate-800/50 px-3 py-2">
        <Eyebrow>{matchCount} / {totalCount}</Eyebrow>
        <span className="text-xs text-zinc-500">{t('characters.filters.empty_hint')}</span>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-zinc-800/80 bg-slate-800/50 px-3 py-2">
      <Eyebrow>
        {t('characters.filters.active.count', { count: items.length })} · {matchCount}/{totalCount}
      </Eyebrow>
      <div className="flex flex-1 flex-wrap items-center gap-1.5">
        {items.map(item => (
          <ActiveChip
            key={item.key}
            label={item.label}
            color={item.color}
            prefix={item.prefix}
            onRemove={item.onRemove}
          />
        ))}
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <button
          type="button"
          onClick={onResetAll}
          className="inline-flex h-6.5 items-center gap-1.5 rounded-md border border-zinc-800 bg-zinc-900 px-2.5 text-[11px] text-zinc-300 transition hover:border-zinc-700 hover:text-white"
        >
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
            <path d="M2 4h8M3 4v6a1 1 0 001 1h4a1 1 0 001-1V4M5 4V3a1 1 0 011-1h0a1 1 0 011 1v1" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
          {t('characters.filters.reset')}
        </button>
        <button
          type="button"
          onClick={onCopyShareUrl}
          className="inline-flex h-6.5 items-center gap-1.5 rounded-md border border-filter-ring/40 bg-filter-ring/15 px-2.5 text-[11px] text-filter-ring transition hover:bg-filter-ring/25"
        >
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
            <path d="M5 7l-1 1a2 2 0 11-3-3l2-2a2 2 0 013 0M7 5l1-1a2 2 0 113 3l-2 2a2 2 0 01-3 0" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
          {copied ? t('common.copied') : t('characters.filters.copy')}
        </button>
      </div>
    </div>
  );
}
