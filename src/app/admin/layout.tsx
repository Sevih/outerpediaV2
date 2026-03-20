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
      { label: 'Promo Codes', href: '/admin/utils/promo-codes' },
      { label: 'Banners', href: '/admin/utils/banners' },
      { label: 'Tower', href: '/admin/utils/tower' },
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

function CollapsedNavGroup({ group, pathname }: { group: NavGroup; pathname: string }) {
  const hasActive = group.items.some(item => !item.disabled && pathname.startsWith(item.href));

  return (
    <div className="flex flex-col items-center gap-0.5 py-1">
      <span className={`text-[10px] font-semibold uppercase ${hasActive ? 'text-blue-400' : 'text-zinc-600'}`}>
        {group.label.slice(0, 3)}
      </span>
      {group.items.map(item => {
        if (item.disabled) return null;
        const active = pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href as never}
            title={item.label}
            className={`flex h-8 w-8 items-center justify-center rounded text-xs font-medium transition-colors ${
              active
                ? 'bg-blue-600/15 text-blue-400'
                : 'text-zinc-500 hover:bg-zinc-800/50 hover:text-zinc-200'
            }`}
          >
            {item.label.slice(0, 2)}
          </Link>
        );
      })}
    </div>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  return (
    <div className="flex h-screen bg-zinc-950 text-zinc-100">
      {/* Sidebar */}
      <aside className={`flex shrink-0 flex-col border-r border-zinc-800 transition-all duration-200 ${collapsed ? 'w-14' : 'w-56'}`}>
        <div className="flex items-center justify-between px-2 py-3">
          {!collapsed && (
            <Link href="/admin" className="px-2 text-lg font-bold hover:text-blue-400 transition-colors">
              Admin
            </Link>
          )}
          <button
            onClick={() => setCollapsed(v => !v)}
            className={`flex h-8 w-8 items-center justify-center rounded text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300 transition-colors ${collapsed ? 'mx-auto' : ''}`}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? '▶' : '◀'}
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto">
          {collapsed
            ? NAV_GROUPS.map(group => (
                <CollapsedNavGroup key={group.label} group={group} pathname={pathname} />
              ))
            : NAV_GROUPS.map(group => (
                <NavSection key={group.label} group={group} pathname={pathname} />
              ))
          }
        </nav>
      </aside>

      {/* Content */}
      <main className="flex-1 overflow-y-auto p-6">
        {children}
      </main>
    </div>
  );
}
