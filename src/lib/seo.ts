import type { Metadata } from 'next';
import { LANGUAGES, LANGS } from '@/lib/i18n/config';
import type { Lang } from '@/lib/i18n/config';

/** Locale-aware "Month Year" string for dynamic SEO titles (e.g. "February 2026") */
export function getMonthYear(lang: Lang): string {
  const now = new Date();
  return now.toLocaleString(LANGUAGES[lang].htmlLang, { month: 'long', year: 'numeric' });
}

const SITE_NAME = 'Outerpedia';
const BASE_DOMAIN = 'outerpedia.com';
const DEFAULT_OG_IMAGE = '/images/ui/og_default.jpg';

/** Base URL for the current environment (Vercel, dev, or production) */
export function getBaseUrl(): string {
  const vercelUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL;
  if (vercelUrl) return `https://${vercelUrl}`;
  if (process.env.NODE_ENV === 'development') return `http://localhost:${process.env.PORT ?? '3000'}`;
  return `https://${BASE_DOMAIN}`;
}

/** Build the full URL for a given language and path */
export function buildUrl(lang: Lang, path = ''): string {
  const segment = path === '/' ? '' : path;
  const base = getBaseUrl();

  // Vercel & dev: path-based routing
  if (!base.includes(BASE_DOMAIN)) {
    return `${base}/${lang}${segment}`;
  }

  // Production: subdomain-based routing
  const sub = LANGUAGES[lang].subdomain;
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
      locale: OG_LOCALE[lang],
      images: [{ url: ogImage, width, height }],
    },
    twitter: {
      card: isDefault ? 'summary_large_image' : 'summary',
      title: fullTitle,
      description,
      images: [ogImage],
    },
    ...(noindex && {
      robots: { index: false, follow: false },
    }),
  };
}
