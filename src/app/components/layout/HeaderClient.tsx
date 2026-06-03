'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState, useEffect, useCallback } from 'react';
import LanguageSwitcher from './LanguageSwitcher';
import SearchModal, { SearchTrigger, SearchTriggerCompact } from '@/app/components/ui/SearchModal';
import { useI18n } from '@/lib/contexts/I18nContext';
import { NAV_ITEMS } from '@/lib/nav';
import type { TranslationKey } from '@/i18n';

function NavIcon({ src, alt, size = 18 }: { src: string; alt: string; size?: number }) {
  return (
    <span
      className="relative inline-block shrink-0"
      style={{ width: size, height: size }}
    >
      <Image src={src} alt={alt} fill sizes={`${size}px`} className="object-contain" />
    </span>
  );
}

type Props = {
  guideCategorySlugs: string[];
};

export default function HeaderClient({ guideCategorySlugs }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { t, href } = useI18n();
  const appVersion = process.env.NEXT_PUBLIC_APP_VERSION;
  const gameVersion = process.env.NEXT_PUBLIC_GAME_VERSION;

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

  // Allow other components (e.g. home hero) to open the search modal
  useEffect(() => {
    const open = () => setSearchOpen(true);
    window.addEventListener('op:open-search', open);
    return () => window.removeEventListener('op:open-search', open);
  }, []);

  // Scrolled state — collapses header padding once scrolled past threshold.
  // Hysteresis (collapse at >40, expand at <10) creates a dead zone wider than
  // the header's height change, so the browser's scroll anchoring can't bounce
  // scrollY back across a single threshold and loop the two states near the top.
  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      setScrolled((prev) => (prev ? y > 10 : y > 40));
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Close mobile menu on resize to desktop
  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= 768) setMenuOpen(false);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const guideChildren = guideCategorySlugs.map((slug) => ({
    key: `guides.category.${slug}` as TranslationKey,
    href: `/guides/${slug}`,
  }));

  return (
    <header className="sticky top-0 z-60 border-b border-zinc-800 bg-black/70 backdrop-blur supports-backdrop-filter:bg-black/50">
      <div
        className={`mx-auto flex items-center gap-3 px-3 transition-[padding] md:px-6 ${
          scrolled ? 'py-1.5' : 'py-2.5 md:py-3'
        }`}
      >
        {/* Logo + version */}
        <Link href={href('/')} className="flex shrink-0 items-center gap-2">
          <span
            className={`relative inline-block transition-[width,height] ${
              scrolled ? 'h-6 w-6' : 'h-7 w-7'
            }`}
          >
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
          <span
            className={`font-semibold tracking-wide transition-[font-size] ${
              scrolled ? 'text-sm' : 'text-base'
            }`}
          >
            Outerpedia
          </span>
          {appVersion && !scrolled && (
            <span className="hidden flex-col items-start gap-0.5 font-mono text-[9px] uppercase tracking-widest text-zinc-500 lg:inline-flex">
              <span className="rounded border border-zinc-800 px-1.5 py-0.5">v{appVersion}</span>
              {gameVersion && (
                <span className="rounded border border-zinc-800 px-1.5 py-0.5" title={`Game version ${gameVersion}`}>
                  GV {gameVersion}
                </span>
              )}
            </span>
          )}
        </Link>

        {/* Desktop nav */}
        <nav className="ml-1 hidden items-center gap-0.5 md:flex lg:gap-1">
          {NAV_ITEMS.map((item) => {
            const children = item.href === '/guides' ? guideChildren : undefined;
            return (
              <div key={item.href} className="relative group">
                <Link
                  href={href(item.href)}
                  className={`flex items-center gap-1.5 rounded-md text-sm text-zinc-300 transition hover:bg-zinc-800/60 hover:text-white lg:gap-2 ${
                    scrolled ? 'px-2 py-1' : 'px-2 py-1.5 lg:px-3'
                  }`}
                  aria-label={t(item.key)}
                  title={t(item.key)}
                >
                  <span className="hidden lg:inline-block">
                    <NavIcon
                      src={`/images/ui/nav/${item.icon}.webp`}
                      alt={t(item.key)}
                      size={scrolled ? 16 : 18}
                    />
                  </span>
                  <span className="whitespace-nowrap xl:hidden">
                    {t(item.shortKey)}
                  </span>
                  <span className="hidden whitespace-nowrap xl:inline">
                    {t(item.key)}
                  </span>
                </Link>

                {children && (
                  <div className="pointer-events-none absolute left-0 top-full pt-1 opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100">
                    <div className="min-w-52 rounded-lg border border-zinc-700 bg-zinc-900 py-1 shadow-xl">
                      {children.map((child) => (
                        <Link
                          key={child.href}
                          href={href(child.href)}
                          className="block px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800 hover:text-white"
                        >
                          {t(child.key)}
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Desktop right side: search + lang */}
        <div className="ml-auto hidden items-center gap-2 md:flex">
          <SearchTrigger onClick={() => setSearchOpen(true)} />
          <LanguageSwitcher />
        </div>

        {/* Mobile right side: search + hamburger */}
        <div className="ml-auto flex items-center gap-2 md:hidden">
          <SearchTriggerCompact onClick={() => setSearchOpen(true)} />
          <button
            className="flex size-9 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-300 transition hover:bg-zinc-800"
            onClick={() => setMenuOpen((v) => !v)}
            aria-expanded={menuOpen}
            aria-label={t('aria.toggle_menu')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
              {menuOpen ? (
                <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              ) : (
                <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Search modal */}
      <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />

      {/* Mobile drawer */}
      {menuOpen && (
        <div className="relative z-60 border-t border-zinc-800 bg-black/90 md:hidden">
          <div className="flex flex-col gap-3 px-4 py-4">
            <nav className="flex flex-col gap-0.5">
              {NAV_ITEMS.map((item) => {
                const children = item.href === '/guides' ? guideChildren : undefined;
                return (
                  <div key={item.href}>
                    <Link
                      href={href(item.href)}
                      className="flex items-center gap-3 rounded-md px-2 py-2.5 text-sm text-zinc-100 transition hover:bg-zinc-800"
                      onClick={() => setMenuOpen(false)}
                      aria-label={t(item.key)}
                    >
                      <span className="flex size-7 items-center justify-center rounded bg-zinc-800/60">
                        <NavIcon src={`/images/ui/nav/${item.icon}.webp`} alt={t(item.key)} size={16} />
                      </span>
                      <span className="flex-1">{t(item.key)}</span>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-zinc-600" aria-hidden>
                        <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </Link>
                    {children && (
                      <div className="ml-10 flex flex-col gap-0.5 pb-1">
                        {children.map((child) => (
                          <Link
                            key={child.href}
                            href={href(child.href)}
                            className="rounded px-2 py-1.5 text-sm text-zinc-400 transition hover:bg-zinc-800 hover:text-white"
                            onClick={() => setMenuOpen(false)}
                          >
                            {t(child.key)}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </nav>
            <div className="border-t border-zinc-800 pt-3">
              <LanguageSwitcher variant="mobile-chips" />
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
