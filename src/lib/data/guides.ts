import { readFile } from 'fs/promises';
import { join } from 'path';
import type { GuideMeta, GuideCategory } from '@/types/guide';

const GUIDES_DIR = join(process.cwd(), 'data/guides');

// ─── Caches ──────────────────────────────────────────────────────────────────

let categoriesCache: Record<string, Omit<GuideCategory, 'slug'>> | null = null;
let indexCache: Record<string, Omit<GuideMeta, 'slug' | 'category'> & { category: string }> | null = null;

async function loadCategories() {
  if (!categoriesCache) {
    const raw = await readFile(join(GUIDES_DIR, '_categories.json'), 'utf-8');
    categoriesCache = JSON.parse(raw);
  }
  return categoriesCache!;
}

async function loadIndex() {
  if (!indexCache) {
    const raw = await readFile(join(GUIDES_DIR, '_index.json'), 'utf-8');
    indexCache = JSON.parse(raw);
  }
  return indexCache!;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/** All categories sorted by order */
export async function getGuideCategories(): Promise<GuideCategory[]> {
  const raw = await loadCategories();
  return Object.entries(raw)
    .map(([slug, data]) => ({ slug, ...data }))
    .sort((a, b) => a.order - b.order);
}

/** List of valid category slugs */
export async function getValidCategories(): Promise<string[]> {
  const raw = await loadCategories();
  return Object.keys(raw);
}

/** All guides */
export async function getAllGuides(): Promise<GuideMeta[]> {
  const raw = await loadIndex();
  return Object.entries(raw).map(([slug, data]) => ({ slug, ...data }));
}

/** Guides filtered by category */
export async function getGuidesByCategory(category: string): Promise<GuideMeta[]> {
  const all = await getAllGuides();
  return all.filter((g) => g.category === category);
}

/** Single guide metadata by slug */
export async function getGuideMeta(slug: string): Promise<GuideMeta | null> {
  const raw = await loadIndex();
  const data = raw[slug];
  if (!data) return null;
  return { slug, ...data };
}

/** All {category, slug} pairs for generateStaticParams */
export async function getGuideSlugsWithCategories(): Promise<{ category: string; slug: string }[]> {
  const all = await getAllGuides();
  return all.map(({ category, slug }) => ({ category, slug }));
}

/** Count of guides per category */
export async function getGuideCounts(): Promise<Record<string, number>> {
  const all = await getAllGuides();
  const counts: Record<string, number> = {};
  for (const guide of all) {
    counts[guide.category] = (counts[guide.category] ?? 0) + 1;
  }
  return counts;
}
