'use client';

import { useState, useRef, useEffect } from 'react';

type VersionSelectorProps = {
  items: string[];
  labels?: string[];
  value: string;
  onChange: (value: string) => void;
  hashPrefix?: string;
};

export default function VersionSelector({
  items,
  labels,
  value,
  onChange,
  hashPrefix,
}: VersionSelectorProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const didReadHash = useRef(false);

  const activeIndex = items.indexOf(value);
  const activeLabel = labels?.[activeIndex] ?? value;

  // Read hash on mount
  useEffect(() => {
    if (!hashPrefix || didReadHash.current) return;
    didReadHash.current = true;

    const hash = decodeURIComponent(window.location.hash.slice(1));
    const prefix = `${hashPrefix}-`;
    if (hash.startsWith(prefix)) {
      const tabValue = hash.slice(prefix.length);
      if (items.includes(tabValue) && tabValue !== value) {
        onChange(tabValue);
      }
    }
  }, [hashPrefix, items, onChange, value]);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [open]);

  function handleSelect(item: string) {
    onChange(item);
    setOpen(false);
    if (hashPrefix) {
      history.replaceState(null, '', `#${hashPrefix}-${item}`);
    }
  }

  return (
    <div ref={containerRef} className="relative inline-block">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-200 transition hover:border-zinc-500 hover:text-white"
      >
        {activeLabel}
        <svg
          className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <ul className="absolute z-50 mt-1 min-w-full rounded-lg border border-zinc-700 bg-zinc-900 py-1 shadow-xl">
          {items.map((item, i) => {
            const label = labels?.[i] ?? item;
            const isActive = item === value;
            return (
              <li key={item}>
                <button
                  onClick={() => handleSelect(item)}
                  className={`w-full whitespace-nowrap px-4 py-2 text-left text-sm transition ${
                    isActive
                      ? 'bg-amber-500/15 text-amber-300'
                      : 'text-zinc-300 hover:bg-zinc-800 hover:text-white'
                  }`}
                >
                  {label}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
