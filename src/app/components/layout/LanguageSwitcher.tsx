'use client';

import { usePathname } from 'next/navigation';
import { LANGUAGES, LANGS, isValidLang } from '@/lib/i18n/config';
import type { Lang } from '@/lib/i18n/config';
import { useI18n } from '@/lib/contexts/I18nContext';

const BASE_DOMAIN = process.env.NEXT_PUBLIC_BASE_DOMAIN ?? 'outerpedia.com';

/** Convert a 2-letter country code (e.g. "gb") to its flag emoji */
function toFlag(code: string): string {
  return [...code.toUpperCase()]
    .map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65))
    .join('');
}

export default function LanguageSwitcher() {
  const { lang } = useI18n();
  const pathname = usePathname();

  const onChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const target = e.target.value as Lang;
    if (target === lang) return;

    const host = window.location.hostname;
    const isSubdomain =
      host === BASE_DOMAIN || host.endsWith(`.${BASE_DOMAIN}`);

    if (isSubdomain) {
      // Production: switch subdomain
      const { protocol, search, hash } = window.location;
      const sub = LANGUAGES[target].subdomain;
      const prefix = sub ? `${sub}.` : '';
      // Strip lang prefix from path (proxy rewrote it, but pathname may include it)
      const segments = pathname.split('/');
      const cleanPath =
        segments[1] && isValidLang(segments[1])
          ? '/' + segments.slice(2).join('/')
          : pathname;
      window.location.href = `${protocol}//${prefix}${BASE_DOMAIN}${cleanPath}${search}${hash}`;
      return;
    }

    // Development: swap the [lang] path segment
    const segments = pathname.split('/');
    if (segments[1] && isValidLang(segments[1])) {
      segments[1] = target;
    }
    window.location.href = segments.join('/') || '/';
  };

  return (
    <label className="inline-flex items-center gap-2 text-sm">
      <span className="sr-only">Language</span>
      <select
        aria-label="Language"
        className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1"
        value={lang}
        onChange={onChange}
      >
        {LANGS.map((l) => {
          const cfg = LANGUAGES[l];
          return (
            <option key={l} value={l}>
              {toFlag(cfg.flag)} {cfg.label}
            </option>
          );
        })}
      </select>
    </label>
  );
}
