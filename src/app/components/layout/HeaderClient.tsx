'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState, useEffect, useCallback } from 'react';
import LanguageSwitcher from './LanguageSwitcher';
import SearchModal, { SearchTrigger } from '@/app/components/ui/SearchModal';
import { useI18n } from '@/lib/contexts/I18nContext';
import { NAV_ITEMS } from '@/lib/nav';

function NavIcon({ src, alt }: { src: string; alt: string }) {
  return (
    <span className="relative inline-block h-4.5 w-4.5 shrink-0">
      <Image
        src={src}
        alt={alt}
        fill
        sizes="18px"
        className="object-contain"
      />
    </span>
  );
}

export default function HeaderClient() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const { t, href } = useI18n();

  // Ctrl+K shortcut
  const onGlobalKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      setSearchOpen(true);
    }
  }, []);

  useEffect(() => {
    document.addEventListener('keydown', onGlobalKeyDown);
    return () => document.removeEventListener('keydown', onGlobalKeyDown);
  }, [onGlobalKeyDown]);

  return (
    <header className="sticky top-0 z-60 border-b border-zinc-800 bg-black/60 backdrop-blur supports-backdrop-filter:bg-black/40">
      <div className="flex items-center justify-between px-4 py-3 md:px-8">
        {/* Logo */}
        <Link href={href('/')} className="flex items-center gap-3">
          <span className="relative inline-block h-7 w-7">
            <Image
              src="/favicon.ico"
              alt="Outerpedia"
              fill
              sizes="28px"
              className="object-contain"
              priority
              unoptimized
            />
          </span>
          <span className="font-semibold tracking-wide">Outerpedia</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-1 md:flex lg:gap-2">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={href(item.href)}
              className="flex items-center gap-1.5 rounded-md px-2 py-2 text-sm hover:bg-zinc-800/60 lg:gap-2 lg:px-3"
              aria-label={t(item.key)}
              title={t(item.key)}
            >
              {/* Icon: lg+ only */}
              <span className="hidden lg:inline-block">
                <NavIcon src={`/images/ui/nav/${item.icon}.webp`} alt={t(item.key)} />
              </span>

              {/* Short label: md to xl */}
              <span className="whitespace-nowrap xl:hidden">{t(item.shortKey)}</span>

              {/* Full label: xl+ */}
              <span className="hidden whitespace-nowrap xl:inline">
                {t(item.key)}
              </span>
            </Link>
          ))}
        </nav>

        {/* Desktop: search + language switcher */}
        <div className="hidden items-center gap-1 md:flex">
          <SearchTrigger onClick={() => setSearchOpen(true)} />
          <LanguageSwitcher />
        </div>

        {/* Mobile: search + hamburger */}
        <div className="flex items-center gap-1 md:hidden">
          <SearchTrigger onClick={() => setSearchOpen(true)} />
          <button
            className="rounded px-3 py-2 hover:bg-zinc-800"
            onClick={() => setMenuOpen((v) => !v)}
            aria-expanded={menuOpen}
            aria-label={t('aria.toggle_menu')}
          >
            &#9776;
          </button>
        </div>
      </div>

      {/* Search modal */}
      <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />

      {/* Mobile nav dropdown */}
      {menuOpen && (
        <div className="relative z-60 border-t border-zinc-800 md:hidden">
          <nav className="flex flex-col gap-1 px-4 py-3">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={href(item.href)}
                className="flex items-center gap-2 rounded px-3 py-2 hover:bg-zinc-800"
                onClick={() => setMenuOpen(false)}
                aria-label={t(item.key)}
              >
                <NavIcon src={`/images/ui/nav/${item.icon}.webp`} alt={t(item.key)} />
                <span>{t(item.key)}</span>
              </Link>
            ))}
            <div className="pt-2">
              <LanguageSwitcher />
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
