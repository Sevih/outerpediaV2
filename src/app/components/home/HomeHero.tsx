'use client';

import Image from 'next/image';
import { FaSearch } from 'react-icons/fa';
import type { Messages } from '@/i18n';

type Props = {
  t: Messages;
};

export default function HomeHero({ t }: Props) {
  const openSearch = () => {
    window.dispatchEvent(new CustomEvent('op:open-search'));
  };

  return (
    <section className="relative isolate overflow-hidden min-h-44 md:min-h-52 lg:min-h-60">
      {/* Banner image — alt carries the page title so it contributes to SEO */}
      <Image
        src="/images/croped_banner.webp"
        alt={t['page.home.title']}
        fill
        priority
        sizes="100vw"
        className="object-cover object-center"
      />
      {/* Dark gradient overlay for readability */}
      <div
        aria-hidden
        className="absolute inset-0 bg-linear-to-b from-black/55 via-black/35 to-black/80"
      />

      {/* Hero content */}
      <div className="relative z-10 mx-auto flex min-h-44 w-full max-w-3xl flex-col items-center justify-center gap-3 px-4 py-8 md:min-h-52 md:py-10 lg:min-h-60 lg:py-12">
        {/* H1 — visible but discreet so search bar stays the focal point */}
        <h1 className="text-balance rounded-md border border-white/5 bg-black/35 px-3 py-1 text-center text-xs font-semibold uppercase tracking-widest text-zinc-300 backdrop-blur-xs sm:text-sm">
          {t['page.home.title']}
        </h1>

        {/* Tagline — kept for SR / SEO context, hidden visually */}
        <p className="sr-only">{t['page.home.description']}</p>

        {/* Search trigger — main visual element */}
        <button
          type="button"
          onClick={openSearch}
          className="flex w-full max-w-md items-center gap-3 rounded-xl border border-zinc-700 bg-zinc-900/85 px-4 py-2.5 text-left text-sm text-zinc-300 shadow-2xl backdrop-blur transition hover:border-cyan-500/40 hover:bg-zinc-900"
        >
          <FaSearch className="shrink-0 text-zinc-400" />
          <span className="flex-1 truncate text-zinc-400">
            {t['search.placeholder']}
          </span>
          <kbd className="hidden rounded border border-zinc-700 bg-zinc-800 px-1.5 py-0.5 font-mono text-[10px] text-zinc-300 sm:inline">
            Ctrl+K
          </kbd>
        </button>
      </div>
    </section>
  );
}
