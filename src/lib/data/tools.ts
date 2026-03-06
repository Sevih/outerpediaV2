import { readFile } from 'fs/promises';
import { join } from 'path';
import type { ToolMeta, ToolCategory } from '@/types/tool';

const TOOLS_DIR = join(process.cwd(), 'data/tools');
const isDev = process.env.NODE_ENV === 'development';

// ─── Caches ──────────────────────────────────────────────────────────────────

let categoriesCache: Record<string, Omit<ToolCategory, 'slug'>> | null = null;
let indexCache: Record<string, Omit<ToolMeta, 'slug'>> | null = null;

async function loadCategories() {
  if (!categoriesCache) {
    const raw = await readFile(join(TOOLS_DIR, '_categories.json'), 'utf-8');
    categoriesCache = JSON.parse(raw);
  }
  return categoriesCache!;
}

async function loadIndex() {
  if (!indexCache) {
    const raw = await readFile(join(TOOLS_DIR, '_index.json'), 'utf-8');
    indexCache = JSON.parse(raw);
  }
  return indexCache!;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/** All tool categories sorted by order */
export async function getToolCategories(): Promise<ToolCategory[]> {
  const raw = await loadCategories();
  return Object.entries(raw)
    .map(([slug, data]) => ({ slug, ...data }))
    .sort((a, b) => a.order - b.order);
}

/** All tools sorted by order (hidden tools only visible in dev) */
export async function getAllTools(): Promise<ToolMeta[]> {
  const raw = await loadIndex();
  return Object.entries(raw)
    .map(([slug, data]) => ({ slug, ...data }))
    .filter((t) => isDev || t.status !== 'hidden')
    .sort((a, b) => a.order - b.order);
}

/** Tools grouped by category (respecting category order) */
export async function getToolsByCategory(): Promise<{ category: ToolCategory; tools: ToolMeta[] }[]> {
  const [categories, tools] = await Promise.all([getToolCategories(), getAllTools()]);
  return categories
    .map((cat) => ({
      category: cat,
      tools: tools.filter((t) => t.category === cat.slug),
    }))
    .filter((group) => group.tools.length > 0);
}

/** Single tool by slug (hidden tools only visible in dev) */
export async function getToolMeta(slug: string): Promise<ToolMeta | null> {
  const raw = await loadIndex();
  const data = raw[slug];
  if (!data) return null;
  if (!isDev && data.status === 'hidden') return null;
  return { slug, ...data };
}

/** All slugs for generateStaticParams (hidden tools only in dev) */
export async function getToolSlugs(): Promise<string[]> {
  const raw = await loadIndex();
  return Object.entries(raw)
    .filter(([, data]) => isDev || data.status !== 'hidden')
    .map(([slug]) => slug);
}
