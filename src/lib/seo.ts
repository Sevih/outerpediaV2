import type { Metadata } from 'next';
import { LANGUAGES, LANGS } from '@/lib/i18n/config';
import type { Lang } from '@/lib/i18n/config';

const SITE_NAME = 'Outerpedia';
const BASE_DOMAIN = 'outerpedia.com';
const DEFAULT_OG_IMAGE = '/images/ui/og_home.jpg';

/** Build the full URL for a given language and path */
export function buildUrl(lang: Lang, path = ''): string {
  // On Vercel: path-based routing, no subdomains
  const vercelUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL;
  if (vercelUrl) {
    return `https://${vercelUrl}/${lang}${path}`;
  }

  // Production: subdomain-based routing
  const sub = LANGUAGES[lang].subdomain;
  const prefix = sub ? `${sub}.` : '';
  return `https://${prefix}${BASE_DOMAIN}${path}`;
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
  keywords,
  noindex = false,
}: PageMetadataOptions): Metadata {
  const url = buildUrl(lang, path);
  const fullTitle = title === SITE_NAME ? title : `${title} | ${SITE_NAME}`;

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
      images: [{ url: ogImage, width: 1200, height: 630 }],
    },
    twitter: {
      card: 'summary_large_image',
      title: fullTitle,
      description,
      images: [ogImage],
    },
    ...(noindex && {
      robots: { index: false, follow: false },
    }),
  };
}
