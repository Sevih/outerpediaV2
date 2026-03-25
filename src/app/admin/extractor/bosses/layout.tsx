'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import type { ReactNode } from 'react';

const TABS = [
  { key: 'extract', label: 'Extract', href: '/admin/extractor/bosses/extract' },
  { key: 'compare', label: 'Compare All', href: '/admin/extractor/bosses/compare' },
  { key: 'by-mode', label: 'By Mode', href: '/admin/extractor/bosses/by-mode' },
];

export default function BossExtractorLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Boss / Monster Extractor</h1>

      <div className="flex gap-1 border-b border-zinc-800">
        {TABS.map(t => {
          const active = pathname.includes(t.key);
          return (
            <Link
              key={t.key}
              href={t.href as never}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                active
                  ? 'border-b-2 border-blue-500 text-blue-400'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {t.label}
            </Link>
          );
        })}
      </div>

      {children}
    </div>
  );
}
