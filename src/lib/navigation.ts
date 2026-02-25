import type { Route } from 'next';
import type { Lang } from '@/lib/i18n/config';

const BASE_DOMAIN = process.env.NEXT_PUBLIC_BASE_DOMAIN ?? 'outerpedia.com';

/** Whether the current runtime uses subdomain-based routing */
function isSubdomainRouting(): boolean {
  // Client: check actual hostname
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    return host === BASE_DOMAIN || host.endsWith(`.${BASE_DOMAIN}`);
  }
  // Server on Vercel preview: path-based
  if (process.env.VERCEL_ENV === 'preview') return false;
  // Server elsewhere (production, local dev with Caddy): subdomain-based
  return true;
}

/**
 * Build a locale-aware internal path.
 * - Subdomain routing: returns path as-is (lang is in the subdomain)
 * - Path-based routing: prepends /{lang}
 */
export function localePath(lang: Lang, path: string): Route {
  if (isSubdomainRouting()) return path as Route;
  return `/${lang}${path}` as Route;
}
