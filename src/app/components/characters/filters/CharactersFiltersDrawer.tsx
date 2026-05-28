'use client';

import { useEffect, useState } from 'react';
import { useI18n } from '@/lib/contexts/I18nContext';
import { TONE } from './FilterAtoms';
import AdvancedFiltersPanel, {
  type AdvancedFiltersPanelProps,
  type DrawerTagGroup,
} from './AdvancedFiltersPanel';

export type { DrawerTagGroup };

type Props = AdvancedFiltersPanelProps & {
  open: boolean;
  onClose: () => void;
  onResetAll: () => void;
  matchCount: number;
  totalCount: number;
};

const ANIM_MS = 220;

export default function CharactersFiltersDrawer({
  open, onClose, onResetAll, matchCount, totalCount, ...panelProps
}: Props) {
  const { t } = useI18n();
  const [mounted, setMounted] = useState(false);
  const [entered, setEntered] = useState(false);

  // Body scroll lock + Escape
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  // Open/close: control the mounted state (close is deferred so the exit transition can play)
  useEffect(() => {
    if (open) {
      setMounted(true);
      return;
    }
    setEntered(false);
    const id = setTimeout(() => setMounted(false), ANIM_MS);
    return () => clearTimeout(id);
  }, [open]);

  // Once mounted, wait for the initial off-screen paint, then transition in
  useEffect(() => {
    if (!mounted) return;
    const r = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(r);
  }, [mounted]);

  if (!mounted) return null;

  return (
    <div className="fixed inset-0 z-70 flex items-end md:items-stretch md:justify-end xl:hidden" role="dialog" aria-modal="true">
      {/* Scrim */}
      <button
        type="button"
        aria-label={t('characters.filters.close')}
        onClick={onClose}
        className={`absolute inset-0 cursor-default bg-black/60 transition-opacity duration-200 ${entered ? 'opacity-100' : 'opacity-0'}`}
      />

      {/* Panel */}
      <aside
        className={`relative flex h-[88vh] w-full flex-col rounded-t-2xl border-t border-zinc-800 bg-zinc-950 shadow-2xl transition-transform duration-200 ease-out md:h-full md:max-h-none md:w-full md:max-w-lg md:rounded-none md:border-l md:border-t-0 ${entered ? 'translate-y-0 md:translate-x-0' : 'translate-y-full md:translate-y-0 md:translate-x-full'}`}
      >
        {/* Grab handle (mobile only) */}
        <div className="flex justify-center pt-2.5 md:hidden">
          <span className="h-1 w-10 rounded bg-zinc-700" aria-hidden />
        </div>

        {/* Header */}
        <div className="flex items-center gap-3 border-b border-zinc-800/80 px-5 py-3.5">
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
          <button
            type="button"
            onClick={onClose}
            aria-label={t('characters.filters.close')}
            className="flex size-7 items-center justify-center rounded-md border border-zinc-800 text-zinc-400 transition hover:border-zinc-700 hover:text-white"
          >
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
              <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <AdvancedFiltersPanel {...panelProps} />

        {/* Footer */}
        <div className="flex items-center gap-2 border-t border-zinc-800/80 bg-zinc-950/95 px-5 py-3">
          <span className="font-mono text-xs text-zinc-400">
            <span className="text-base font-semibold text-zinc-100">{matchCount}</span>
            <span className="ml-1 text-zinc-500">/ {totalCount}</span>
          </span>
          <div className="flex-1" />
          <button
            type="button"
            onClick={onClose}
            style={{ background: TONE.cyan }}
            className="inline-flex h-9 items-center gap-2 rounded-lg px-4 text-sm font-semibold text-zinc-950 transition hover:brightness-110"
          >
            {t('characters.common.matches', { count: matchCount })}
          </button>
        </div>
      </aside>
    </div>
  );
}
