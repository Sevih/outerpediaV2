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
const PUBLISHER_ID = `${CANONICAL_ORIGIN}/#publisher`;
const LOGO_PATH = '/images/logo.png';
const LOGO_SIZE = { width: 1000, height: 1353 };

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
      {
        '@type': 'Organization',
        '@id': PUBLISHER_ID,
        name: SITE_NAME,
        url: `${CANONICAL_ORIGIN}/`,
        logo: {
          '@type': 'ImageObject',
          url: `${CANONICAL_ORIGIN}${LOGO_PATH}`,
          width: LOGO_SIZE.width,
          height: LOGO_SIZE.height,
        },
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

/**
 * VideoGameCharacter for individual character pages.
 * `partOf` links the character to the Outerplane VideoGame entity declared
 * in the site graph, so crawlers can resolve "Dahlia (Outerplane)" instead
 * of just "Dahlia". `image` is resolved against the canonical origin.
 */
export function buildVideoGameCharacterJsonLd(opts: {
  lang: Lang;
  path: string;
  name: string;
  description: string;
  image?: string;
}): JsonLdNode {
  const safeLang = normalizeLang(opts.lang);
  const url = buildUrl(safeLang, opts.path);
  const imageUrl = opts.image
    ? (opts.image.startsWith('http') ? opts.image : `${CANONICAL_ORIGIN}${opts.image}`)
    : undefined;
  const node: JsonLdNode = {
    '@context': 'https://schema.org',
    '@type': 'VideoGameCharacter',
    name: opts.name,
    description: opts.description,
    url,
    inLanguage: LANGUAGES[safeLang].htmlLang,
    partOf: { '@id': VIDEOGAME_ID },
    subjectOf: {
      '@type': 'WebPage',
      '@id': url,
      isPartOf: { '@id': WEBSITE_ID },
    },
  };
  if (imageUrl) node.image = imageUrl;
  return node;
}

/**
 * In-game equipment entity. Schema.org has no first-class type for video game
 * items, so we use `Thing` with `category` and link to the Outerplane VideoGame
 * via `isPartOf`. Adequate for entity linking; not eligible for any Google
 * rich result, which is fine — these are not commercial products.
 */
export function buildEquipmentJsonLd(opts: {
  lang: Lang;
  path: string;
  name: string;
  category: string;
  description: string;
  image?: string;
}): JsonLdNode {
  const safeLang = normalizeLang(opts.lang);
  const url = buildUrl(safeLang, opts.path);
  const imageUrl = opts.image
    ? (opts.image.startsWith('http') ? opts.image : `${CANONICAL_ORIGIN}${opts.image}`)
    : undefined;
  const node: JsonLdNode = {
    '@context': 'https://schema.org',
    '@type': 'Thing',
    name: opts.name,
    description: opts.description,
    url,
    additionalType: 'https://schema.org/Product',
    category: opts.category,
    inLanguage: LANGUAGES[safeLang].htmlLang,
    isPartOf: { '@id': VIDEOGAME_ID },
    subjectOf: {
      '@type': 'WebPage',
      '@id': url,
      isPartOf: { '@id': WEBSITE_ID },
    },
  };
  if (imageUrl) node.image = imageUrl;
  return node;
}

/**
 * ItemList for ranked or curated character/equipment lists.
 * Caller must order `items` consistently with `itemListOrder` (the position
 * field is just the 1-based index in the supplied array).
 */
export function buildItemListJsonLd(opts: {
  name: string;
  description?: string;
  url?: string;
  items: ReadonlyArray<{ name: string; url: string }>;
  itemListOrder?: 'Ascending' | 'Descending' | 'Unordered';
}): JsonLdNode {
  const node: JsonLdNode = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: opts.name,
    numberOfItems: opts.items.length,
    itemListOrder: opts.itemListOrder === 'Unordered'
      ? 'https://schema.org/ItemListUnordered'
      : `https://schema.org/ItemListOrder${opts.itemListOrder ?? 'Ascending'}`,
    itemListElement: opts.items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      url: item.url,
    })),
  };
  if (opts.description) node.description = opts.description;
  if (opts.url) node.url = opts.url;
  return node;
}

/**
 * VideoObject for an embedded video. `uploadDate` is intentionally omitted
 * (we don't have it in the data); the resulting schema is valid schema.org
 * but not eligible for Google's video rich result carousel — the value here
 * is entity linking for LLM crawlers, not SERP enrichment.
 */
export function buildVideoObjectJsonLd(opts: {
  platform: 'youtube' | 'twitch' | 'bilibili';
  id: string;
  title: string;
  author?: string;
}): JsonLdNode {
  let embedUrl: string;
  let contentUrl: string | undefined;
  let thumbnailUrl: string | undefined;
  switch (opts.platform) {
    case 'youtube':
      embedUrl = `https://www.youtube.com/embed/${opts.id}`;
      contentUrl = `https://www.youtube.com/watch?v=${opts.id}`;
      thumbnailUrl = `https://i.ytimg.com/vi/${opts.id}/hqdefault.jpg`;
      break;
    case 'twitch':
      embedUrl = `https://player.twitch.tv/?video=${opts.id}`;
      contentUrl = `https://www.twitch.tv/videos/${opts.id.replace(/^v/, '')}`;
      break;
    case 'bilibili':
      embedUrl = `https://player.bilibili.com/player.html?bvid=${opts.id}`;
      contentUrl = `https://www.bilibili.com/video/${opts.id}`;
      break;
  }
  const node: JsonLdNode = {
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    name: opts.title,
    description: opts.title,
    embedUrl,
  };
  if (contentUrl) node.contentUrl = contentUrl;
  if (thumbnailUrl) node.thumbnailUrl = thumbnailUrl;
  if (opts.author) node.author = { '@type': 'Person', name: opts.author };
  return node;
}

/**
 * Blog schema for the site changelog. Each entry becomes a BlogPosting child.
 * Entries that link out (entry.url) get a localized absolute URL so crawlers
 * can connect changelog mentions to their target content.
 */
export function buildBlogJsonLd(opts: {
  lang: Lang;
  path: string;
  name: string;
  description: string;
  entries: ReadonlyArray<{ date: string; title: string; content: string[]; url?: string }>;
}): JsonLdNode {
  const safeLang = normalizeLang(opts.lang);
  const blogUrl = buildUrl(safeLang, opts.path);
  const htmlLang = LANGUAGES[safeLang].htmlLang;
  return {
    '@context': 'https://schema.org',
    '@type': 'Blog',
    '@id': `${blogUrl}#blog`,
    name: opts.name,
    description: opts.description,
    url: blogUrl,
    inLanguage: htmlLang,
    publisher: { '@id': PUBLISHER_ID },
    isPartOf: { '@id': WEBSITE_ID },
    blogPost: opts.entries.map((entry) => {
      const node: JsonLdNode = {
        '@type': 'BlogPosting',
        headline: entry.title,
        articleBody: entry.content.join('\n'),
        datePublished: entry.date,
        inLanguage: htmlLang,
        author: { '@id': PUBLISHER_ID },
        publisher: { '@id': PUBLISHER_ID },
      };
      if (entry.url) node.url = buildUrl(safeLang, entry.url);
      return node;
    }),
  };
}

/**
 * Article schema for guide pages. `image` should be a site-relative path
 * (e.g. `/images/...`); resolved against the canonical origin to give crawlers
 * a stable, absolute URL regardless of which language subdomain is serving.
 */
export function buildArticleJsonLd(opts: {
  lang: Lang;
  path: string;
  headline: string;
  description: string;
  image?: string;
  author: string;
  datePublished: string;
  dateModified?: string;
}): JsonLdNode {
  const safeLang = normalizeLang(opts.lang);
  const url = buildUrl(safeLang, opts.path);
  const imageUrl = opts.image
    ? (opts.image.startsWith('http') ? opts.image : `${CANONICAL_ORIGIN}${opts.image}`)
    : undefined;

  const node: JsonLdNode = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: opts.headline,
    description: opts.description,
    inLanguage: LANGUAGES[safeLang].htmlLang,
    datePublished: opts.datePublished,
    dateModified: opts.dateModified ?? opts.datePublished,
    author: { '@type': 'Person', name: opts.author },
    publisher: { '@id': PUBLISHER_ID },
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    isPartOf: { '@id': WEBSITE_ID },
    about: { '@id': VIDEOGAME_ID },
  };
  if (imageUrl) node.image = imageUrl;
  return node;
}
