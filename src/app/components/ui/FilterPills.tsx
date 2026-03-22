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

// ── FilterSelect ──

import { useState, useEffect, useRef } from 'react';

export type FilterSelectOption<T extends string = string> = {
  value: T;
  label: string;
  image?: string;
};

export function FilterSelect<T extends string = string>({
  label,
  placeholder,
  options,
  value,
  onChange,
}: {
  label?: string;
  placeholder?: string;
  options: FilterSelectOption<T>[];
  value: T | null;
  onChange: (value: T | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = value ? options.find(o => o.value === value) : null;

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  return (
    <div className="w-full flex flex-col items-center">
      {label && <p className="text-center text-xs uppercase tracking-wide text-zinc-300 mb-1">{label}</p>}
      <div ref={ref} className="relative w-full max-w-48">
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          className={[
            'w-full flex items-center justify-between rounded px-3 py-2 text-sm cursor-pointer select-none transition',
            selected ? `${FILTER.active} text-white ring-1 ${FILTER.ring}` : `${FILTER.bg} text-zinc-200 ${FILTER.hover}`,
            `focus:outline-none ${FILTER.focusRing}`,
          ].join(' ')}
        >
          <span className="flex items-center gap-2 truncate">
            {selected?.image && (
              <span className="relative h-5 w-5 shrink-0">
                <Image src={selected.image} alt="" fill sizes="20px" className="object-contain" />
              </span>
            )}
            <span>{selected?.label ?? placeholder ?? '—'}</span>
          </span>
          <svg className={`h-4 w-4 shrink-0 text-zinc-400 transition-transform ${open ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
          </svg>
        </button>
        {open && (
          <div className="absolute z-40 mt-1 w-full max-h-60 overflow-y-auto rounded bg-zinc-800 ring-1 ring-zinc-600 shadow-xl">
            {/* Reset option */}
            <button
              type="button"
              onClick={() => { onChange(null); setOpen(false); }}
              className={`flex w-full items-center gap-2 px-3 py-2 text-sm transition ${!selected ? 'bg-zinc-700/60 text-white' : 'text-zinc-300 hover:bg-zinc-700/30'}`}
            >
              {placeholder ?? '—'}
            </button>
            {options.map(option => {
              const active = option.value === value;
              return (
                <button
                  type="button"
                  key={option.value}
                  onClick={() => { onChange(option.value); setOpen(false); }}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-sm transition ${active ? 'bg-zinc-700/60 text-white' : 'text-zinc-300 hover:bg-zinc-700/30'}`}
                >
                  {option.image && (
                    <span className="relative h-5 w-5 shrink-0">
                      <Image src={option.image} alt="" fill sizes="20px" className="object-contain" />
                    </span>
                  )}
                  <span>{option.label}</span>
                </button>
              );
            })}
          </div>
        )}
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
