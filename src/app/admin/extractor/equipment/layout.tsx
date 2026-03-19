'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import type { ReactNode } from 'react';

const TABS = [
  { key: 'weapons', label: 'Weapons', href: '/admin/extractor/equipment/weapons' },
  { key: 'accessories', label: 'Accessories', href: '/admin/extractor/equipment/accessories' },
  { key: 'armors', label: 'Armor Sets', href: '/admin/extractor/equipment/armors' },
  { key: 'talismans', label: 'Talismans', href: '/admin/extractor/equipment/talismans' },
  { key: 'ee', label: 'Exclusive Equipment', href: '/admin/extractor/equipment/ee' },
];

export default function EquipmentExtractorLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Equipment Extractor</h1>

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
