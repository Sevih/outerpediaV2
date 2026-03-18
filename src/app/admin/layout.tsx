'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

interface NavItem {
  label: string;
  href: string;
  disabled?: boolean;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Extractor',
    items: [
      { label: 'Characters', href: '/admin/extractor/characters' },
      { label: 'Equipment', href: '/admin/extractor/equipment' },
      { label: 'Bosses', href: '/admin/extractor/bosses', disabled: true },
      { label: 'Buffs', href: '/admin/extractor/buffs', disabled: true },
    ],
  },
  {
    label: 'Editor',
    items: [
      { label: 'Characters', href: '/admin/editor/characters' },
      { label: 'Equipment', href: '/admin/editor/equipment' },
      { label: 'Bosses', href: '/admin/editor/bosses', disabled: true },
      { label: 'Buffs', href: '/admin/editor/buffs', disabled: true },
    ],
  },
  {
    label: 'Utils',
    items: [
      { label: 'Promo Codes', href: '/admin/utils/promo-codes', disabled: true },
      { label: 'Banners', href: '/admin/utils/banners', disabled: true },
      { label: 'Events', href: '/admin/utils/events', disabled: true },
    ],
  },
  {
    label: 'Tools',
    items: [
      { label: 'Bytes Parser', href: '/admin/parser' },
    ],
  },
];

function NavSection({ group, pathname }: { group: NavGroup; pathname: string }) {
  const hasActive = group.items.some(item => pathname.startsWith(item.href));
  const [open, setOpen] = useState(hasActive);

  return (
    <div>
      <button
        onClick={() => setOpen(v => !v)}
        className="flex w-full items-center justify-between px-3 py-2 text-xs font-semibold uppercase tracking-wider text-zinc-500 hover:text-zinc-300"
      >
        {group.label}
        <span className={`transition-transform ${open ? 'rotate-0' : '-rotate-90'}`}>▾</span>
      </button>
      {open && (
        <div className="space-y-0.5 pb-2">
          {group.items.map(item => {
            const active = pathname.startsWith(item.href);
            if (item.disabled) {
              return (
                <span
                  key={item.href}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm text-zinc-600 cursor-not-allowed"
                >
                  {item.label}
                  <span className="ml-auto rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-600">soon</span>
                </span>
              );
            }
            return (
              <Link
                key={item.href}
                href={item.href as never}
                className={`block px-3 py-1.5 text-sm transition-colors ${
                  active
                    ? 'bg-blue-600/15 text-blue-400 border-l-2 border-blue-500'
                    : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  return (
    <div className="flex h-screen bg-zinc-950 text-zinc-100">
      {/* Sidebar */}
      <aside className="flex w-56 shrink-0 flex-col border-r border-zinc-800">
        <Link href="/admin" className="px-4 py-4 text-lg font-bold hover:text-blue-400 transition-colors">
          Admin
        </Link>
        <nav className="flex-1 overflow-y-auto">
          {NAV_GROUPS.map(group => (
            <NavSection key={group.label} group={group} pathname={pathname} />
          ))}
        </nav>
      </aside>

      {/* Content */}
      <main className="flex-1 overflow-y-auto p-6">
        {children}
      </main>
    </div>
  );
}
