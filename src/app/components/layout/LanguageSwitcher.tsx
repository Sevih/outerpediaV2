'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { LANGUAGES, LANGS, isValidLang } from '@/lib/i18n/config';
import type { Lang } from '@/lib/i18n/config';
import { useI18n } from '@/lib/contexts/I18nContext';

/** Strip a lang subdomain from hostname to get the base domain.
 *  e.g. "jp.outerpedia.com" → "outerpedia.com"
 */
function extractBaseDomain(host: string): string {
  const parts = host.split('.');
  if (parts.length >= 3 && isValidLang(parts[0])) {
    return parts.slice(1).join('.');
  }
  return host;
}

/** SVG flag rendered as an <img>. Falls back to a neutral square if the
 *  asset is missing — emoji flags don't render on Chrome/Windows so we
 *  ship local SVGs instead. */
function FlagIcon({ code, className = 'h-3.5 w-5' }: { code: string; className?: string }) {
  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={`/images/ui/flags/${code}.svg`}
      alt=""
      aria-hidden
      width={20}
      height={14}
      className={`shrink-0 rounded-xs object-cover ${className}`}
    />
  );
}

type Variant = 'desktop' | 'mobile-chips';

export default function LanguageSwitcher({ variant = 'desktop' }: { variant?: Variant }) {
  const { lang, t } = useI18n();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Close on outside click + Escape
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const navigate = (target: Lang) => {
    if (target === lang) {
      setOpen(false);
      return;
    }
    const { protocol, port, search, hash } = window.location;
    const host = window.location.hostname;
    const currentBase = extractBaseDomain(host);
    const sub = LANGUAGES[target].subdomain;
    const prefix = sub ? `${sub}.` : '';
    const portSuffix = port ? `:${port}` : '';
    const segments = pathname.split('/');
    const cleanPath =
      segments[1] && isValidLang(segments[1])
        ? '/' + segments.slice(2).join('/')
        : pathname;
    window.location.href = `${protocol}//${prefix}${currentBase}${portSuffix}${cleanPath}${search}${hash}`;
  };

  const current = LANGUAGES[lang];

  // Mobile drawer variant: row of chips, no dropdown
  if (variant === 'mobile-chips') {
    return (
      <div>
        <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-zinc-500">
          {t('common.language')}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {LANGS.map((l) => {
            const cfg = LANGUAGES[l];
            const isCurrent = l === lang;
            return (
              <button
                key={l}
                onClick={() => navigate(l)}
                className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition ${
                  isCurrent
                    ? 'border-cyan-500/60 bg-cyan-500/10 text-cyan-300'
                    : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
                }`}
                aria-current={isCurrent ? 'true' : undefined}
              >
                <FlagIcon code={cfg.flag} className="h-3 w-4.5" />
                <span className="font-mono">{cfg.abbrev}</span>
                {!cfg.isOfficial && (
                  <span className="size-1 rounded-full bg-amber-400" aria-hidden />
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t('common.language')}
        className="flex items-center gap-1.5 rounded-md border border-zinc-800 bg-zinc-900/70 px-2.5 py-1.5 font-mono text-xs text-zinc-300 transition hover:border-zinc-700 hover:bg-zinc-900"
      >
        <FlagIcon code={current.flag} className="h-3 w-4.5" />
        <span>{current.abbrev}</span>
        <svg
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden
          className={`shrink-0 text-zinc-500 transition ${open ? 'rotate-180' : ''}`}
        >
          <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+6px)] z-70 w-60 rounded-lg border border-zinc-800 bg-zinc-900 p-1.5 shadow-2xl">
          <p className="px-2.5 pb-1 pt-1 font-mono text-[10px] uppercase tracking-widest text-zinc-500">
            {t('common.language')}
          </p>
          <ul role="listbox" className="flex flex-col">
            {LANGS.map((l) => {
              const cfg = LANGUAGES[l];
              const isCurrent = l === lang;
              return (
                <li key={l}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={isCurrent}
                    onClick={() => navigate(l)}
                    className={`flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm transition ${
                      isCurrent ? 'bg-zinc-800 text-white' : 'text-zinc-200 hover:bg-zinc-800/60'
                    }`}
                  >
                    <FlagIcon code={cfg.flag} className="h-3.5 w-5" />
                    <span className="flex-1">{cfg.label}</span>
                    <span
                      className={`rounded px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider ${
                        cfg.isOfficial
                          ? 'bg-emerald-500/10 text-emerald-400'
                          : 'bg-amber-500/10 text-amber-400'
                      }`}
                    >
                      {cfg.isOfficial ? t('header.lang.official') : t('header.lang.community')}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="mt-1 border-t border-zinc-800 px-2.5 pb-1 pt-2 text-[11px] leading-snug text-zinc-500">
            <span className="text-amber-400">●</span> {t('header.lang.community_note')}
          </p>
        </div>
      )}
    </div>
  );
}
