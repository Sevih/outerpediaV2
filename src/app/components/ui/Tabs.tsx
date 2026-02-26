'use client';

import React, { useEffect, useRef } from 'react';

type TabsProps = {
  items: readonly string[];
  labels?: React.ReactNode[];
  value: string;
  onChange: (value: string) => void;
  hashPrefix?: string;
  className?: string;
};

export default function Tabs({
  items,
  labels,
  value,
  onChange,
  hashPrefix,
  className,
}: TabsProps) {
  const didReadHash = useRef(false);

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

  function handleClick(item: string) {
    onChange(item);
    if (hashPrefix) {
      history.replaceState(null, '', `#${hashPrefix}-${item}`);
    }
  }

  return (
    <div
      className={['flex flex-wrap gap-2', className].filter(Boolean).join(' ')}
      role="tablist"
    >
      {items.map((item, i) => {
        const label = labels?.[i] ?? item;
        const isActive = item === value;
        return (
          <button
            key={item}
            role="tab"
            aria-selected={isActive}
            onClick={() => handleClick(item)}
            className={[
              'relative rounded px-4 py-2 text-sm font-medium transition-all',
              isActive
                ? 'tab-game-active bg-linear-to-b from-amber-500/15 to-transparent text-amber-300 border-t-2 border-t-amber-400/60 border-x border-b border-amber-500/20 shadow-[0_2px_16px_rgba(251,191,36,0.1)]'
                : 'border border-zinc-700/40 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50 hover:border-zinc-600/30',
            ].join(' ')}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
