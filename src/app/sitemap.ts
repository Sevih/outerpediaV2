import type { MetadataRoute } from 'next';
import { LANGS, LANGUAGES } from '@/lib/i18n/config';
import type { Lang } from '@/lib/i18n/config';
import { buildUrl } from '@/lib/seo';
import { getCharacterSlugs } from '@/lib/data/characters';
import { getValidCategories } from '@/lib/data/guides';
import { getGuideSlugsWithCategories } from '@/lib/data/guides';
import { getAllTools } from '@/lib/data/tools';

/**
 * Static pages to include in the sitemap.
 * Add new routes here as pages are created.
 */
const STATIC_PAGES = [
  '/',
  '/characters',
  '/equipments',
  '/tierlist',
  '/tools',
  '/guides',
  '/changelog',
  '/contributors',
  '/coupons',
  '/legal',
];

function buildAlternates(path: string) {
  const languages: Record<string, string> = {};
  for (const l of LANGS) {
    languages[LANGUAGES[l].htmlLang] = buildUrl(l, path);
  }
  return languages;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [];

  // Static pages
  for (const path of STATIC_PAGES) {
    entries.push({
      url: buildUrl('en' as Lang, path),
      lastModified: new Date(),
      alternates: { languages: buildAlternates(path) },
    });
  }

  // Dynamic: tool pages (skip tools with custom href, they redirect elsewhere)
  const tools = await getAllTools();
  for (const { slug, href } of tools) {
    if (href) continue;
    const path = `/${slug}`;
    entries.push({
      url: buildUrl('en' as Lang, path),
      lastModified: new Date(),
      alternates: { languages: buildAlternates(path) },
    });
  }

  // Dynamic: character pages
  const characterSlugs = await getCharacterSlugs();
  for (const slug of characterSlugs) {
    const path = `/characters/${slug}`;
    entries.push({
      url: buildUrl('en' as Lang, path),
      lastModified: new Date(),
      alternates: { languages: buildAlternates(path) },
    });
  }

  // Dynamic: guide category pages
  const guideCategories = await getValidCategories();
  for (const category of guideCategories) {
    const path = `/guides/${category}`;
    entries.push({
      url: buildUrl('en' as Lang, path),
      lastModified: new Date(),
      alternates: { languages: buildAlternates(path) },
    });
  }

  // Dynamic: individual guide pages
  const guideSlugs = await getGuideSlugsWithCategories();
  for (const { category, slug } of guideSlugs) {
    const path = `/guides/${category}/${slug}`;
    entries.push({
      url: buildUrl('en' as Lang, path),
      lastModified: new Date(),
      alternates: { languages: buildAlternates(path) },
    });
  }

  return entries;
}
