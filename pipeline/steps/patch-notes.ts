import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { readFile, writeFile } from 'fs/promises';
import { join, basename } from 'path';
import * as cheerio from 'cheerio';
import { PATHS } from '../config';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const WP_API = 'https://annoucements.outerplane.vagames.co.kr/wp-json/wp/v2/posts';

// Dev limit — set to 0 for all posts
const DEV_LIMIT = 0;

// Rate limiting (ms)
const DELAY_API = 500;
const DELAY_IMAGE = 150;

const USER_AGENT = 'Outerpedia/1.0 (https://outerpedia.com; community wiki)';

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

type LangDef = {
  lang: string;
  /** Parent category ID that groups all subcategories for this language */
  parentCategoryId: number;
};

const LANGUAGES: LangDef[] = [
  { lang: 'en', parentCategoryId: 11 },
  { lang: 'kr', parentCategoryId: 26 },
  { lang: 'jp', parentCategoryId: 28 },
];

/** Map WP category IDs → normalized type */
const CATEGORY_TYPE_MAP: Record<number, string> = {
  // EN
  20: 'update', 22: 'notice', 18: 'event', 43: 'devnote', 145: 'known-issue',
  // KR
  46: 'update', 37: 'notice', 38: 'event', 47: 'devnote', 146: 'known-issue',
  // JP
  44: 'update', 39: 'notice', 40: 'event', 45: 'devnote', 147: 'known-issue',
  // Media (excluded)
  148: 'media', 149: 'media', 150: 'media',
};

type PatchNotePost = {
  id: number;
  date: string;
  slug: string;
  lang: string;
  type: string;
  title: string;
  content: string;
};

type PatchNotesData = {
  posts: PatchNotePost[];
  lastFetched: string;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const FETCH_OPTS: RequestInit = { headers: { 'User-Agent': USER_AGENT } };

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url, FETCH_OPTS);
  if (!res.ok) throw new Error(`Fetch failed: ${res.status} ${url}`);
  return res.json() as Promise<T>;
}

async function downloadImage(url: string, destPath: string): Promise<boolean> {
  if (existsSync(destPath)) return false;
  const res = await fetch(url, FETCH_OPTS);
  if (!res.ok) return false;
  const buffer = Buffer.from(await res.arrayBuffer());
  writeFileSync(destPath, buffer);
  return true;
}

function resolveType(categoryIds: number[]): string {
  for (const id of categoryIds) {
    const type = CATEGORY_TYPE_MAP[id];
    if (type && type !== 'media') return type;
  }
  return 'notice'; // fallback
}

function decodeEntities(text: string): string {
  const $ = cheerio.load(`<span>${text}</span>`);
  return $('span').text();
}

function sanitizeHTML(html: string, postId: number): { html: string; imageUrls: string[] } {
  const $ = cheerio.load(html);
  const imageUrls: string[] = [];

  // Rewrite image sources to local paths
  $('img').each((_i, el) => {
    const src = $(el).attr('src');
    if (!src) return;
    imageUrls.push(src);
    const filename = decodeURIComponent(basename(new URL(src).pathname));
    $(el).attr('src', `/images/patch-notes/${postId}/${filename}`);
    // Remove WP-specific attributes
    $(el).removeAttr('loading').removeAttr('decoding').removeAttr('srcset').removeAttr('sizes');
    // Remove WP classes
    const cls = $(el).attr('class');
    if (cls) $(el).removeAttr('class');
  });

  // Replace <video> with a clickable link (cross-origin playback is unreliable)
  $('video').each((_i, el) => {
    const src = $(el).attr('src');
    if (!src) return;
    const filename = decodeURIComponent(basename(new URL(src).pathname));
    $(el).replaceWith(
      `<a href="${src}" target="_blank" rel="noopener noreferrer" class="pn-video-link">▶ ${filename}</a>`,
    );
  });

  // Remove WP-specific classes from figures and other elements
  $('[class]').each((_i, el) => {
    const cls = $(el).attr('class') || '';
    // Keep only semantic classes, strip WP-generated ones
    const cleaned = cls
      .split(/\s+/)
      .filter(c => !c.startsWith('wp-') && !c.startsWith('has-') && !c.startsWith('is-style-'))
      .join(' ')
      .trim();
    if (cleaned) $(el).attr('class', cleaned);
    else $(el).removeAttr('class');
  });

  return { html: $('body').html() || '', imageUrls };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export async function run(): Promise<string> {
  const outputDir = join(PATHS.patchNotes);
  if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true });
  const outputPath = join(outputDir, 'posts.json');

  // Skip network scraping in prod build — data is already committed
  if (process.argv.includes('--prod') || process.env.CI) {
    if (existsSync(outputPath)) return 'skipped (prod)';
  }

  // Load existing data for incremental fetch
  let existing: PatchNotesData = { posts: [], lastFetched: '' };
  try {
    const raw = await readFile(outputPath, 'utf-8');
    existing = JSON.parse(raw);
  } catch { /* first run */ }

  // --force-since=YYYY-MM-DD → drop all posts on or after that date to force re-scrape
  const forceSinceArg = process.argv.find(a => a.startsWith('--force-since='));
  if (forceSinceArg) {
    const sinceDate = forceSinceArg.split('=')[1];
    const before = existing.posts.length;
    existing.posts = existing.posts.filter(p => p.date < sinceDate);
    console.log(`[patch-notes] --force-since=${sinceDate}: removed ${before - existing.posts.length} posts, re-scraping…`);
  }

  type WPPost = {
    id: number;
    date: string;
    slug: string;
    title: { rendered: string };
    content: { rendered: string };
    categories: number[];
  };

  const existingIds = new Set(existing.posts.map(p => p.id));
  const allPosts: PatchNotePost[] = [...existing.posts];
  let newCount = 0;
  let imgCount = 0;
  let skippedLangs = 0;

  for (const { lang, parentCategoryId } of LANGUAGES) {
    // Quick check: fetch only the latest post — if already known, skip this language
    if (existingIds.size > 0) {
      try {
        if (lang !== 'en') await sleep(DELAY_API);
        const checkUrl = `${WP_API}?categories=${parentCategoryId}&per_page=1&_fields=id`;
        const [latest] = await fetchJSON<WPPost[]>(checkUrl);
        if (latest && existingIds.has(latest.id)) {
          skippedLangs++;
          continue;
        }
      } catch { /* proceed with full fetch */ }
    }

    const perPage = DEV_LIMIT || 100;
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const url = `${WP_API}?categories=${parentCategoryId}&per_page=${perPage}&page=${page}&_fields=id,date,slug,title,content,categories`;
      let posts: WPPost[];
      try {
        if (page > 1 || lang !== 'en') await sleep(DELAY_API);
        posts = await fetchJSON<WPPost[]>(url);
      } catch {
        break; // likely 400 on empty page
      }

      let hitExisting = false;
      for (const post of posts) {
        if (existingIds.has(post.id)) { hitExisting = true; break; }

        const type = resolveType(post.categories);
        if (type === 'media') continue;

        // Sanitize HTML and extract image URLs
        const { html, imageUrls } = sanitizeHTML(post.content.rendered, post.id);

        // Download images
        const imgDir = join(PATHS.patchNotesImages, String(post.id));
        if (imageUrls.length > 0 && !existsSync(imgDir)) {
          mkdirSync(imgDir, { recursive: true });
        }
        for (const imgUrl of imageUrls) {
          try {
            const filename = decodeURIComponent(basename(new URL(imgUrl).pathname));
            const downloaded = await downloadImage(imgUrl, join(imgDir, filename));
            if (downloaded) { imgCount++; await sleep(DELAY_IMAGE); }
          } catch { /* skip broken images */ }
        }

        allPosts.push({
          id: post.id,
          date: post.date.split('T')[0],
          slug: post.slug,
          lang,
          type,
          title: decodeEntities(post.title.rendered),
          content: html,
        });
        existingIds.add(post.id);
        newCount++;
      }

      // Stop if we hit a known post, got fewer than requested, or in dev mode
      if (hitExisting || posts.length < perPage || DEV_LIMIT > 0) {
        hasMore = false;
      } else {
        page++;
      }
    }
  }

  // Sort by date descending
  allPosts.sort((a, b) => b.date.localeCompare(a.date));

  const result: PatchNotesData = {
    posts: allPosts,
    lastFetched: new Date().toISOString(),
  };

  await writeFile(outputPath, JSON.stringify(result, null, 2), 'utf-8');

  const skipInfo = skippedLangs === LANGUAGES.length ? ' (up to date)' : skippedLangs > 0 ? ` (${skippedLangs}/${LANGUAGES.length} langs up to date)` : '';
  return `${allPosts.length} posts (${newCount} new), ${imgCount} images downloaded${skipInfo}`;
}
