import type { Metadata } from 'next';
import { LANGUAGES, LANGS, DEFAULT_LANG, isValidLang } from '@/lib/i18n/config';
import type { Lang } from '@/lib/i18n/config';

/**
 * Normalize an untrusted lang value to a valid Lang.
 * `generateMetadata` receives the raw `[lang]` route param, which can be an
 * unexpected value (bot probes, malformed URLs). Falling back to the default
 * language keeps these SEO helpers from throwing during SSR.
 */
function normalizeLang(lang: string): Lang {
  return isValidLang(lang) ? lang : DEFAULT_LANG;
}

/** Locale-aware "Month Year" string for dynamic SEO titles (e.g. "February 2026") */
export function getMonthYear(lang: Lang): string {
  const now = new Date();
  return now.toLocaleString(LANGUAGES[normalizeLang(lang)].htmlLang, { month: 'long', year: 'numeric' });
}

const SITE_NAME = 'Outerpedia';
const BASE_DOMAIN = process.env.NEXT_PUBLIC_BASE_DOMAIN ?? 'outerpedia.com';
const DEFAULT_OG_IMAGE = '/images/ui/og_default.jpg';

/** Base URL for the current environment */
export function getBaseUrl(): string {
  if (process.env.NODE_ENV === 'development') return `http://localhost:${process.env.PORT ?? '3000'}`;
  return `https://${BASE_DOMAIN}`;
}

/** Build the full URL for a given language and path */
export function buildUrl(lang: Lang, path = ''): string {
  const segment = path === '/' ? '' : path;
  const base = getBaseUrl();
  const safeLang = normalizeLang(lang);

  // Dev: path-based routing
  if (process.env.NODE_ENV === 'development') {
    return `${base}/${safeLang}${segment}`;
  }

  // Production: subdomain-based routing
  const sub = LANGUAGES[safeLang].subdomain;
  if (sub) {
    return `https://${sub}.${BASE_DOMAIN}${segment}`;
  }
  return `${base}${segment}`;
}

/** Build hreflang alternates for a given path */
function buildAlternates(path: string) {
  const languages: Record<string, string> = {};
  for (const l of LANGS) {
    languages[LANGUAGES[l].htmlLang] = buildUrl(l, path);
  }
  languages['x-default'] = buildUrl('en' as Lang, path);
  return languages;
}

/** OG locale mapping */
const OG_LOCALE: Record<Lang, string> = Object.fromEntries(
  LANGS.map((l) => [l, LANGUAGES[l].htmlLang.replace('-', '_')])
) as Record<Lang, string>;

type PageMetadataOptions = {
  lang: Lang;
  path: string;
  title: string;
  description: string;
  ogImage?: string;
  ogImageSize?: { width: number; height: number };
  keywords?: string[];
  noindex?: boolean;
};

/**
 * Create complete metadata for a page.
 * Handles title, description, OG, Twitter, hreflang, and robots.
 */
export function createPageMetadata({
  lang,
  path,
  title,
  description,
  ogImage = DEFAULT_OG_IMAGE,
  ogImageSize,
  keywords,
  noindex = false,
}: PageMetadataOptions): Metadata {
  const url = buildUrl(lang, path);
  const fullTitle = title === SITE_NAME ? title : `${title} | ${SITE_NAME}`;
  const isDefault = ogImage === DEFAULT_OG_IMAGE;
  const { width, height } = ogImageSize ?? (isDefault ? { width: 1200, height: 630 } : { width: 150, height: 150 });

  return {
    title,
    description,
    ...(keywords && { keywords }),
    alternates: {
      canonical: url,
      languages: buildAlternates(path),
    },
    openGraph: {
      title: fullTitle,
      description,
      url,
      siteName: SITE_NAME,
      type: 'website',
      locale: OG_LOCALE[normalizeLang(lang)],
      images: [{ url: ogImage, width, height }],
    },
    twitter: {
      card: isDefault || width > height ? 'summary_large_image' : 'summary',
      title: fullTitle,
      description,
      images: [ogImage],
    },
    ...(noindex && {
      robots: { index: false, follow: false },
    }),
  };
}

// ─── JSON-LD builders ────────────────────────────────────────────────────────
// Stable @id anchors so cross-references stay valid regardless of subdomain.
const CANONICAL_ORIGIN = `https://${BASE_DOMAIN}`;
const WEBSITE_ID = `${CANONICAL_ORIGIN}/#website`;
const VIDEOGAME_ID = `${CANONICAL_ORIGIN}/#videogame`;
const ORGANIZATION_ID = `${CANONICAL_ORIGIN}/#organization`;

type JsonLdValue = string | number | boolean | null | JsonLdNode | JsonLdValue[];
type JsonLdNode = { [key: string]: JsonLdValue };

/**
 * WebSite + VideoGame as a connected @graph.
 * Outerpedia (WebSite) is `about` Outerplane (VideoGame), with the publisher
 * Organization as a separate node. Goes in the root <head> for every page.
 */
export function buildSiteJsonLd(lang: Lang, description: string): JsonLdNode {
  const safeLang = normalizeLang(lang);
  const siteUrl = buildUrl(safeLang, '/');
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': WEBSITE_ID,
        url: siteUrl,
        name: SITE_NAME,
        description,
        inLanguage: LANGUAGES[safeLang].htmlLang,
        about: { '@id': VIDEOGAME_ID },
      },
      {
        '@type': 'VideoGame',
        '@id': VIDEOGAME_ID,
        name: 'Outerplane',
        applicationCategory: 'Game',
        genre: 'RPG',
        gamePlatform: ['Android', 'iOS'],
        operatingSystem: ['Android', 'iOS'],
        publisher: { '@id': ORGANIZATION_ID },
      },
      {
        '@type': 'Organization',
        '@id': ORGANIZATION_ID,
        name: 'VAGAMES CORP',
      },
    ],
  };
}

/** BreadcrumbList for the current path. Items must already be absolute URLs. */
export function buildBreadcrumbJsonLd(
  items: ReadonlyArray<{ name: string; url: string }>
): JsonLdNode {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  };
}
