'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';
import LanguageSwitcher from './LanguageSwitcher';
import { useI18n } from '@/lib/contexts/I18nContext';
import type { TranslationKey } from '@/i18n';

const NAV_ITEMS = [
  { key: 'nav.characters' as TranslationKey, href: '/characters', icon: 'CM_EtcMenu_Colleague', short: 'Chars' },
  { key: 'nav.equipment' as TranslationKey, href: '/equipments', icon: 'CM_EtcMenu_Inventory', short: 'Equip' },
  { key: 'nav.tierlist' as TranslationKey, href: '/tierlist', icon: 'CM_Mission_Icon_Weekly', short: 'Tier' },
  { key: 'nav.utilities' as TranslationKey, href: '/tools', icon: 'CM_EtcMenu_Setting', short: 'Tools' },
  { key: 'nav.guides' as TranslationKey, href: '/guides', icon: 'CM_EtcMenu_Character_Book', short: 'Guides' },
] as const;

export default function HeaderClient() {
  const [open, setOpen] = useState(false);
  const { lang, t } = useI18n();

  return (
    <header className="sticky top-0 z-[60] border-b border-zinc-800 bg-black/60 backdrop-blur supports-[backdrop-filter]:bg-black/40">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        {/* Logo */}
        <Link href={`/${lang}`} className="flex items-center gap-3">
          <span className="relative inline-block h-[28px] w-[28px]">
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
              href={`/${lang}${item.href}`}
              className="flex items-center gap-1.5 rounded-md px-2 py-2 text-sm hover:bg-zinc-800/60 lg:gap-2 lg:px-3"
              aria-label={t(item.key)}
              title={t(item.key)}
            >
              {/* Icon: lg+ only */}
              <span className="relative hidden h-[18px] w-[18px] shrink-0 lg:inline-block">
                <Image
                  src={`/images/ui/nav/${item.icon}.webp`}
                  alt=""
                  fill
                  sizes="18px"
                  className="object-contain"
                />
              </span>

              {/* Short label: md to xl */}
              <span className="whitespace-nowrap xl:hidden">{item.short}</span>

              {/* Full label: xl+ */}
              <span className="hidden whitespace-nowrap xl:inline">
                {t(item.key)}
              </span>
            </Link>
          ))}
        </nav>

        {/* Desktop language switcher */}
        <div className="hidden md:block">
          <LanguageSwitcher />
        </div>

        {/* Mobile hamburger */}
        <button
          className="rounded px-3 py-2 hover:bg-zinc-800 md:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label="Toggle menu"
        >
          &#9776;
        </button>
      </div>

      {/* Mobile nav dropdown */}
      {open && (
        <div className="relative z-[60] border-t border-zinc-800 md:hidden">
          <nav className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-3">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={`/${lang}${item.href}`}
                className="flex items-center gap-2 rounded px-3 py-2 hover:bg-zinc-800"
                onClick={() => setOpen(false)}
                aria-label={t(item.key)}
              >
                <span className="relative inline-block h-[18px] w-[18px]">
                  <Image
                    src={`/images/ui/nav/${item.icon}.webp`}
                    alt=""
                    fill
                    sizes="18px"
                    className="object-contain"
                  />
                </span>
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
