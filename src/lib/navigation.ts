import type { Route } from 'next';
import type { Lang } from '@/lib/i18n/config';

/**
 * Build a locale-aware internal path.
 * Always returns the path as-is since we use subdomain routing.
 */
export function localePath(_lang: Lang, path: string): Route {
  return path as Route;
}
