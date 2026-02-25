import { NextRequest, NextResponse } from 'next/server';
import { DEFAULT_LANG, isValidLang } from '@/lib/i18n/config';

/**
 * Hybrid i18n proxy:
 * - Dev:  /jp/characters stays as-is (path-based)
 * - Prod: jp.outerpedia.com/characters → rewrites to /jp/characters
 * - Root: / → redirects to /en/ (default lang)
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip static assets, API routes, and root-level routes
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/images') ||
    pathname.startsWith('/feed') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // --- Production: subdomain → path rewrite ---
  const host = request.headers.get('host') ?? '';
  const subdomain = extractSubdomain(host);

  if (subdomain && isValidLang(subdomain)) {
    // Already has a [lang] prefix in path? Skip (shouldn't happen in prod, but be safe)
    const firstSegment = pathname.split('/')[1];
    if (isValidLang(firstSegment)) {
      return NextResponse.next();
    }

    // Rewrite: jp.outerpedia.com/characters → /jp/characters (internal)
    const url = request.nextUrl.clone();
    url.pathname = `/${subdomain}${pathname}`;
    return NextResponse.rewrite(url);
  }

  const firstSegment = pathname.split('/')[1];

  // --- Custom domain without subdomain (e.g. outerpedia.local) = default lang ---
  if (isCustomDomain(host)) {
    // Path has default lang prefix → redirect to strip it (clean URL)
    if (firstSegment === DEFAULT_LANG) {
      const url = request.nextUrl.clone();
      url.pathname = pathname.slice(`/${DEFAULT_LANG}`.length) || '/';
      return NextResponse.redirect(url);
    }

    // Path has another lang prefix → let it through (shouldn't happen normally)
    if (isValidLang(firstSegment)) {
      return NextResponse.next();
    }

    // No lang prefix → rewrite internally with default lang
    const url = request.nextUrl.clone();
    url.pathname = `/${DEFAULT_LANG}${pathname}`;
    return NextResponse.rewrite(url);
  }

  // --- Dev (localhost): path-based routing ---
  // Path already has a valid lang prefix → continue
  if (isValidLang(firstSegment)) {
    return NextResponse.next();
  }

  // No lang prefix → redirect to default lang
  const url = request.nextUrl.clone();
  url.pathname = `/${DEFAULT_LANG}${pathname}`;
  return NextResponse.redirect(url);
}

/** Check if host is a custom domain (not localhost) */
function isCustomDomain(host: string): boolean {
  const hostname = host.split(':')[0];
  return hostname.split('.').length >= 2 && hostname !== 'localhost';
}

/** Extract subdomain from host (e.g., "jp.outerpedia.com" → "jp") */
function extractSubdomain(host: string): string | null {
  // Remove port
  const hostname = host.split(':')[0];
  const parts = hostname.split('.');

  // Need at least 3 parts for a subdomain (sub.domain.tld)
  if (parts.length < 3) return null;

  const sub = parts[0];

  // Ignore "www"
  if (sub === 'www') return null;

  return sub;
}

export const config = {
  matcher: [
    // Match all paths except static files
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
