import type { Route } from 'next';
import type { Lang } from '@/lib/i18n/config';

const BASE_DOMAIN = process.env.NEXT_PUBLIC_BASE_DOMAIN ?? 'outerpedia.com';
const DEV_DOMAIN = 'outerpedia.local';

function matchesDomain(host: string, domain: string): boolean {
  return host === domain || host.endsWith(`.${domain}`);
}

/** Whether the current runtime uses subdomain-based routing */
function isSubdomainRouting(): boolean {
  // Client: check actual hostname
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    return matchesDomain(host, BASE_DOMAIN) || matchesDomain(host, DEV_DOMAIN);
  }
  // Server on Vercel preview: path-based
  if (process.env.VERCEL_ENV === 'preview') return false;
  // Server (dev + production): subdomain-based
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
