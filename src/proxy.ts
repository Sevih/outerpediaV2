import { NextRequest, NextResponse } from 'next/server';
import { DEFAULT_LANG, isValidLang } from '@/lib/i18n/config';

/**
 * Subdomain-based i18n proxy:
 * - jp.outerpedia.com/characters → rewrites to /jp/characters
 * - outerpedia.com/characters    → rewrites to /en/characters
 * - outerpedia.com/en/…          → redirects to outerpedia.com/… (strip default lang)
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip static assets, API routes, and root-level routes
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/images') ||
    pathname.startsWith('/feed')
  ) {
    return NextResponse.next();
  }

  // Let Next.js handle its own generated files (sitemap.xml, robots.txt, etc.)
  if (/^\/(sitemap.*\.xml|robots\.txt|manifest\.json)$/.test(pathname)) {
    return NextResponse.next();
  }

  // Block bot probes and non-existent file requests (e.g. /about-us.html,
  // /service-worker.js, /.well-known, /apple-touch-icon-precomposed.png, etc.)
  // These would otherwise match [lang] and cause MODULE_NOT_FOUND errors.
  if (pathname.startsWith('/.') || pathname.includes('.')) {
    return new NextResponse(null, { status: 404 });
  }

  // --- Subdomain → path rewrite ---
  const host = request.headers.get('host') ?? '';
  const subdomain = extractSubdomain(host);

  if (subdomain && isValidLang(subdomain)) {
    // Already has a [lang] prefix in path? Skip
    const firstSegment = pathname.split('/')[1];
    if (isValidLang(firstSegment)) {
      return NextResponse.next();
    }

    // Rewrite: jp.outerpedia.com/characters → /jp/characters (internal)
    const url = request.nextUrl.clone();
    url.pathname = `/${subdomain}${pathname}`;
    return NextResponse.rewrite(url);
  }

  // --- Root domain (no subdomain) = default lang ---
  const firstSegment = pathname.split('/')[1];

  // Path has default lang prefix → redirect to strip it (clean URL)
  if (firstSegment === DEFAULT_LANG) {
    const url = request.nextUrl.clone();
    url.pathname = pathname.slice(`/${DEFAULT_LANG}`.length) || '/';
    return NextResponse.redirect(url);
  }

  // Path has another lang prefix → let it through
  if (isValidLang(firstSegment)) {
    return NextResponse.next();
  }

  // No lang prefix → rewrite internally with default lang
  const url = request.nextUrl.clone();
  url.pathname = `/${DEFAULT_LANG}${pathname}`;
  return NextResponse.rewrite(url);
}

/** Extract subdomain from host (e.g., "jp.outerpedia.com" → "jp") */
function extractSubdomain(host: string): string | null {
  const hostname = host.split(':')[0];
  const parts = hostname.split('.');

  // Need at least 3 parts for a subdomain (sub.domain.tld)
  if (parts.length < 3) return null;

  const sub = parts[0];
  if (sub === 'www') return null;

  return sub;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
