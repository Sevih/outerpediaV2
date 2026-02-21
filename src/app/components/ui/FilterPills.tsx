'use client';

import Image from 'next/image';
import { FILTER } from '@/lib/theme';
import { useI18n } from '@/lib/contexts/I18nContext';

// ── FilterSearch ──

export function FilterSearch({
  value, onChange, placeholder, className,
}: {
  value: string; onChange: (value: string) => void; placeholder?: string; className?: string;
}) {
  return (
    <div className={`relative mx-auto max-w-md ${className ?? ''}`}>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full rounded-lg border border-zinc-700 ${FILTER.bg} px-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-filter focus:outline-none`}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white"
        >
          &times;
        </button>
      )}
    </div>
  );
}

// ── FilterPill ──

export function FilterPill({
  active, children, onClick, className, title,
}: {
  active: boolean; children: React.ReactNode; onClick: () => void; title?: string; className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-pressed={active}
      className={[
        'inline-flex items-center justify-center rounded cursor-pointer select-none transition',
        active ? `${FILTER.active} text-white ring-1 ${FILTER.ring}` : `${FILTER.bg} text-zinc-200 ${FILTER.hover}`,
        'text-xs leading-none',
        '**:leading-none [&_img]:align-middle [&_img]:block',
        `focus:outline-none ${FILTER.focusRing}`,
        className,
      ].filter(Boolean).join(' ')}
    >
      {children}
    </button>
  );
}

// ── IconFilterGroup ──

export function IconFilterGroup<T extends string>({
  label, items, filter, onToggle, onReset, imagePath,
}: {
  label: string;
  items: { name: string; value: T | null }[];
  filter: T[];
  onToggle: (value: T) => void;
  onReset: () => void;
  imagePath: (value: T) => string;
}) {
  const { t } = useI18n();
  return (
    <div className="w-full flex flex-col items-center">
      <p className="text-center text-xs uppercase tracking-wide text-zinc-300 mb-1">{label}</p>
      <div className="flex gap-2 justify-center">
        {items.map(item => (
          <FilterPill
            key={item.name}
            title={item.name}
            active={item.value === null ? filter.length === 0 : filter.includes(item.value)}
            onClick={() => item.value ? onToggle(item.value) : onReset()}
            className="w-9 h-9 px-0"
          >
            {item.value ? (
              <div className="relative h-7 w-7">
                <Image src={imagePath(item.value)} alt={item.value} fill sizes="28px" className="object-contain" />
              </div>
            ) : (
              <span className="text-[11px]">{t('common.all')}</span>
            )}
          </FilterPill>
        ))}
      </div>
    </div>
  );
}

// ── TextFilterGroup ──

export function TextFilterGroup<T extends string>({
  label, items, filter, onToggle, onReset,
}: {
  label: string;
  items: { name: string; value: T | null }[];
  filter: T[];
  onToggle: (value: T) => void;
  onReset: () => void;
}) {
  return (
    <div className="w-full flex flex-col items-center">
      <p className="text-center text-xs uppercase tracking-wide text-zinc-300 mb-1">{label}</p>
      <div className="flex flex-wrap gap-2 justify-center">
        {items.map(item => (
          <FilterPill
            key={item.name}
            active={item.value === null ? filter.length === 0 : filter.includes(item.value)}
            onClick={() => item.value ? onToggle(item.value) : onReset()}
            className="h-8 px-2.5"
          >
            {item.name}
          </FilterPill>
        ))}
      </div>
    </div>
  );
}
