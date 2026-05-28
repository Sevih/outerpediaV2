'use client';

import { useI18n } from '@/lib/contexts/I18nContext';
import { ELEMENTS, CLASSES, RARITIES } from '@/types/enums';
import type { ElementType, RarityType } from '@/types/enums';
import { ElementIconPill, ClassIconPill, StarPill, TONE } from './FilterAtoms';

type Props = {
  query: string;
  onQueryChange: (v: string) => void;

  elementFilter: ElementType[];
  onToggleElement: (v: ElementType) => void;

  classFilter: string[];
  onToggleClass: (v: string) => void;

  rarityFilter: RarityType[];
  onToggleRarity: (v: RarityType) => void;

  advancedCount: number;
  onOpenAdvanced: () => void;
  advancedOpen?: boolean;
};

export default function CharactersFiltersBar({
  query, onQueryChange,
  elementFilter, onToggleElement,
  classFilter, onToggleClass,
  rarityFilter, onToggleRarity,
  advancedCount, onOpenAdvanced, advancedOpen,
}: Props) {
  const { t } = useI18n();

  return (
    <div className="space-y-3">
      {/* Mobile: search + Filter button */}
      <div className="flex items-center gap-2 md:hidden">
        <SearchField value={query} onChange={onQueryChange} placeholder={t('characters.filters.search_placeholder')} />
        <AdvancedButton
          label={t('characters.filters.title')}
          count={advancedCount + elementFilter.length + classFilter.length + rarityFilter.length}
          active={advancedOpen}
          onClick={onOpenAdvanced}
        />
      </div>

      {/* Mobile: element + class quick rows */}
      <div className="space-y-2 md:hidden">
        <div className="flex flex-wrap items-center justify-center gap-1.5">
          {ELEMENTS.map(el => (
            <ElementIconPill
              key={el}
              element={el}
              active={elementFilter.includes(el)}
              onClick={() => onToggleElement(el)}
              size="sm"
            />
          ))}
        </div>
        <div className="flex flex-wrap items-center justify-center gap-1.5">
          {CLASSES.map(cls => (
            <ClassIconPill
              key={cls}
              classType={cls}
              active={classFilter.includes(cls)}
              onClick={() => onToggleClass(cls)}
              size="sm"
            />
          ))}
          <span className="mx-1 h-5 w-px bg-zinc-800" />
          {RARITIES.map(r => (
            <StarPill
              key={r}
              stars={r}
              active={rarityFilter.includes(r)}
              onClick={() => onToggleRarity(r)}
            />
          ))}
        </div>
      </div>

      {/* Desktop: single horizontal toolbar with labeled groups */}
      <div className="hidden flex-wrap items-end gap-x-4 gap-y-3 rounded-xl border border-zinc-800 bg-slate-800/50 px-3 py-2.5 backdrop-blur-sm md:flex">
        <div className="w-72 max-w-full">
          <SearchField value={query} onChange={onQueryChange} placeholder={t('characters.filters.search_placeholder')} />
        </div>

        <Divider />

        <BarGroup label={t('filters.elements')}>
          {ELEMENTS.map(el => (
            <ElementIconPill
              key={el}
              element={el}
              active={elementFilter.includes(el)}
              onClick={() => onToggleElement(el)}
            />
          ))}
        </BarGroup>

        <Divider />

        <BarGroup label={t('filters.classes')}>
          {CLASSES.map(cls => (
            <ClassIconPill
              key={cls}
              classType={cls}
              active={classFilter.includes(cls)}
              onClick={() => onToggleClass(cls)}
            />
          ))}
        </BarGroup>

        <Divider />

        <BarGroup label={t('filters.rarity')}>
          {RARITIES.map(r => (
            <StarPill
              key={r}
              stars={r}
              active={rarityFilter.includes(r)}
              onClick={() => onToggleRarity(r)}
            />
          ))}
        </BarGroup>

        <div className="flex-1" />

        {/* xl+ shows the persistent sidebar instead, so the trigger is hidden there. */}
        <div className="xl:hidden">
          <AdvancedButton
            label={t('characters.filters.advanced')}
            count={advancedCount}
            active={advancedOpen}
            onClick={onOpenAdvanced}
          />
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ──

function Divider() {
  return <span className="h-9 w-px self-end bg-zinc-700/70" aria-hidden />;
}

function BarGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-center font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-300">
        {label}
      </span>
      <div className="flex flex-wrap items-center justify-center gap-1">
        {children}
      </div>
    </div>
  );
}

function SearchField({
  value, onChange, placeholder,
}: {
  value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <div className="relative flex items-center">
      <svg
        className="pointer-events-none absolute left-3 size-3.5 text-zinc-500"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <circle cx="11" cy="11" r="7" />
        <path d="M20 20l-3.5-3.5" strokeLinecap="round" />
      </svg>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-9 w-full rounded-lg border border-zinc-800 bg-slate-900/80 pl-9 pr-8 text-sm text-white placeholder-zinc-500 focus:border-filter-ring focus:outline-none"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="clear"
          className="absolute right-2 text-zinc-400 hover:text-white"
        >
          ×
        </button>
      )}
    </div>
  );
}

function AdvancedButton({
  label, count, active, onClick,
}: {
  label: string; count: number; active?: boolean; onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={active}
      style={{
        background: active ? TONE.cyan : undefined,
        borderColor: active ? TONE.cyan : '#27272a',
        color: active ? '#0a0a0a' : '#ededed',
      }}
      className={`inline-flex h-9 shrink-0 items-center gap-2 rounded-lg border px-3 text-sm font-medium transition hover:border-zinc-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-filter-ring ${active ? '' : 'bg-slate-900/80'}`}
    >
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
        <path d="M2 4h12M4 8h8M6 12h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      {label}
      {count > 0 && (
        <span
          style={{
            background: active ? '#0a0a0a' : TONE.cyan,
            color: active ? TONE.cyan : '#0a0a0a',
          }}
          className="inline-flex h-4.5 min-w-4.5 items-center justify-center rounded-full px-1.5 font-mono text-[10px] font-bold"
        >
          {count}
        </span>
      )}
    </button>
  );
}
