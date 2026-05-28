'use client';

import { useI18n } from '@/lib/contexts/I18nContext';
import AdvancedFiltersPanel, {
  type AdvancedFiltersPanelProps,
} from './AdvancedFiltersPanel';

type Props = AdvancedFiltersPanelProps & {
  onResetAll: () => void;
};

/**
 * Persistent advanced-filters column for xl+ screens. Same body as the mobile
 * drawer (AdvancedFiltersPanel) but rendered inline, sticky, with its own
 * internal scroll — no overlay, no scrim.
 */
export default function CharactersFiltersSidebar({ onResetAll, ...panelProps }: Props) {
  const { t } = useI18n();

  return (
    <aside className="hidden w-90 shrink-0 xl:block">
      <div className="sticky top-4 flex max-h-[calc(100vh-2rem)] flex-col overflow-hidden rounded-xl border border-zinc-800 bg-slate-800/50">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-zinc-800/80 px-4 py-3">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-filter-ring">
            <path d="M2 4h12M4 8h8M6 12h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <div className="min-w-0 flex-1 text-sm font-semibold text-zinc-100">
            {t('characters.filters.advanced')}
          </div>
          <button
            type="button"
            onClick={onResetAll}
            className="text-[11px] text-zinc-400 transition hover:text-white"
          >
            {t('characters.filters.reset')}
          </button>
        </div>

        <AdvancedFiltersPanel {...panelProps} />
      </div>
    </aside>
  );
}
