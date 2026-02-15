import type { MetadataRoute } from 'next';
import { LANGS, LANGUAGES } from '@/lib/i18n/config';
import type { Lang } from '@/lib/i18n/config';
import { buildUrl } from '@/lib/seo';

/**
 * Static pages to include in the sitemap.
 * Add new routes here as pages are created.
 */
const STATIC_PAGES = [
  '/',
  // '/characters',
  // '/equipments',
  // '/guides',
];

function buildAlternates(path: string) {
  const languages: Record<string, string> = {};
  for (const l of LANGS) {
    languages[LANGUAGES[l].htmlLang] = buildUrl(l, path);
  }
  return languages;
}

export default function sitemap(): MetadataRoute.Sitemap {
  const entries: MetadataRoute.Sitemap = [];

  // Static pages
  for (const path of STATIC_PAGES) {
    entries.push({
      url: buildUrl('en' as Lang, path),
      lastModified: new Date(),
      alternates: { languages: buildAlternates(path) },
    });
  }

  // TODO: Add dynamic pages (characters, guides, etc.) as they are implemented

  return entries;
}
