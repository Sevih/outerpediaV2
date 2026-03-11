'use client';

import { usePathname } from 'next/navigation';
import { LANGUAGES, LANGS, isValidLang } from '@/lib/i18n/config';
import type { Lang } from '@/lib/i18n/config';
import { useI18n } from '@/lib/contexts/I18nContext';

/** Strip a lang subdomain from hostname to get the base domain.
 *  e.g. "jp.outerpedia.com" → "outerpedia.com"
 */
function extractBaseDomain(host: string): string {
  const parts = host.split('.');
  // If first part is a known lang subdomain, strip it
  if (parts.length >= 3 && isValidLang(parts[0])) {
    return parts.slice(1).join('.');
  }
  return host;
}

/** Convert a 2-letter country code (e.g. "gb") to its flag emoji */
function toFlag(code: string): string {
  return [...code.toUpperCase()]
    .map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65))
    .join('');
}

export default function LanguageSwitcher() {
  const { lang, t } = useI18n();
  const pathname = usePathname();

  const onChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const target = e.target.value as Lang;
    if (target === lang) return;

    const { protocol, port, search, hash } = window.location;
    const host = window.location.hostname;
    // Extract the base domain by stripping any lang subdomain
    const currentBase = extractBaseDomain(host);
    const sub = LANGUAGES[target].subdomain;
    const prefix = sub ? `${sub}.` : '';
    const portSuffix = port ? `:${port}` : '';
    // Strip lang prefix from path (proxy rewrote it, but pathname may include it)
    const segments = pathname.split('/');
    const cleanPath =
      segments[1] && isValidLang(segments[1])
        ? '/' + segments.slice(2).join('/')
        : pathname;
    window.location.href = `${protocol}//${prefix}${currentBase}${portSuffix}${cleanPath}${search}${hash}`;
  };

  return (
    <label className="inline-flex items-center gap-2 text-sm">
      <span className="sr-only">{t('common.language')}</span>
      <select
        aria-label={t('common.language')}
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
