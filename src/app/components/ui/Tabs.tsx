'use client';

import { useEffect, useRef } from 'react';

type TabsProps = {
  items: string[];
  labels?: string[];
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
              'rounded-full px-4 py-1.5 text-sm font-medium transition ring-1',
              isActive
                ? 'bg-yellow-500/20 text-yellow-300 ring-yellow-400/40'
                : 'bg-zinc-800 text-zinc-300 ring-white/10 hover:bg-zinc-700',
            ].join(' ')}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
