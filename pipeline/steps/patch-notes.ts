import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { readFile } from 'fs/promises';
import { join, basename, dirname } from 'path';
import * as cheerio from 'cheerio';
import { PATHS } from '../config';
import { writeFileAtomic } from '../lib/write-json';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const WP_API = 'https://annoucements.outerplane.vagames.co.kr/wp-json/wp/v2/posts';

// Dev limit — set to 0 for all posts
const DEV_LIMIT = 0;

// Incremental runs re-scan posts published within this many days, even ones we
// already have. The announcement site publishes posts out of date-order (a buff
// schedule dated to the period start can go live days later; older posts get
// edited and re-surfaced), so "stop at the first known post" silently misses
// them. Re-scanning a window upserts any straggler that landed behind known
// newer posts. Two weeks comfortably covers the buff-event cadence; widen if the
// publisher ever backdates further than this.
const RESCAN_WINDOW_DAYS = 14;

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
};

// Run timestamp lives here (gitignored) instead of inside the committed JSON,
// where it used to flip on every run and produce an empty diff.
const STAMP = join(PATHS.generated, '.patch-notes-stamp');

// ---------------------------------------------------------------------------
// In-game Buff Event extraction
// ---------------------------------------------------------------------------
// "[In-game Buff Event]" posts contain a daily schedule table. We parse the
// EN posts (cleanest table) into a normalized day → buff-type schedule that
// powers the homepage buff widget. The display labels live in the i18n locale
// files keyed by `type`; `raw` is kept for verification and as fallback for
// any unrecognized buff (type "other").

type BuffScheduleEntry = { date: string; type: string; raw: string };

/** Keyword matchers mapping a raw EN buff string → normalized type. Order matters. */
const BUFF_TYPE_MATCHERS: { type: string; test: RegExp }[] = [
  { type: 'frog-gold', test: /frog hall[^]*gold|gold[^]*frog hall/i },
  { type: 'frog-food', test: /frog hall[^]*food|food[^]*frog hall/i },
  { type: 'ark-raid', test: /ark raid/i },
  { type: 'special-ecology', test: /ecology/i },
  { type: 'special-identification', test: /identification/i },
  { type: 'doppelganger', test: /doppel/i },
  { type: 'kate-workshop', test: /kate/i },
  { type: 'story-survey', test: /survey/i },
  { type: 'evolution-stone', test: /evolution stone/i },
  { type: 'bounty-hunter', test: /bounty/i },
  { type: 'bandit-chase', test: /bandit/i },
];

function matchBuffType(text: string): string {
  for (const { type, test } of BUFF_TYPE_MATCHERS) {
    if (test.test(text)) return type;
  }
  return 'other';
}

const DAY_MS = 86_400_000;

/**
 * Resolve a buff-table date cell ("05/06(Wed)", "1/13", "12/30") to YYYY-MM-DD.
 * The cell carries no year, so we anchor on the post's publish date: buff rows
 * fall on/after it, so a candidate landing far before means it rolled into the
 * next year (e.g. a 01/12 row inside a post published 2025/12/30).
 */
function parseBuffDate(cell: string, postDate: string): string | null {
  const m = cell.match(/(\d{1,2})\s*\/\s*(\d{1,2})/);
  if (!m) return null;
  const month = parseInt(m[1], 10);
  const day = parseInt(m[2], 10);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  const anchor = Date.parse(`${postDate}T00:00:00Z`);
  const year = new Date(anchor).getUTCFullYear();
  let d = Date.UTC(year, month - 1, day);
  if (anchor - d > 60 * DAY_MS) d = Date.UTC(year + 1, month - 1, day);
  else if (d - anchor > 300 * DAY_MS) d = Date.UTC(year - 1, month - 1, day);

  return new Date(d).toISOString().slice(0, 10);
}

/**
 * Build the normalized buff schedule from all EN buff-event posts. Processes
 * posts oldest-first so a more recent post overrides any overlapping date.
 * The buff is always the table's last column; the date is always the first.
 */
function deriveBuffEvents(posts: PatchNotePost[]): BuffScheduleEntry[] {
  const buffPosts = posts
    .filter(p => p.lang === 'en' && /In-game Buff Event/i.test(p.title))
    .sort((a, b) => a.date.localeCompare(b.date));

  const byDate = new Map<string, BuffScheduleEntry>();

  for (const post of buffPosts) {
    const $ = cheerio.load(post.content);
    $('table').first().find('tr').each((_i, tr) => {
      const cells = $(tr).find('td, th');
      if (cells.length < 3) return;
      const first = $(cells[0]).text().trim();
      if (/^date$/i.test(first)) return; // header row
      const date = parseBuffDate(first, post.date);
      if (!date) return;
      const raw = $(cells[cells.length - 1]).text().trim();
      if (!raw) return;
      byDate.set(date, { date, type: matchBuffType(raw), raw });
    });
  }

  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

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

/**
 * Write `data` as pretty JSON only when it differs from what's already on disk,
 * so a no-op fetch doesn't churn the committed file. Returns true when written.
 */
async function writeJsonIfChanged(path: string, data: unknown): Promise<boolean> {
  const json = JSON.stringify(data, null, 2);
  let current: string | null = null;
  try { current = await readFile(path, 'utf-8'); } catch { /* missing → write */ }
  if (current === json) return false;
  await writeFileAtomic(path, json);
  return true;
}

/** Record the run time out-of-band (gitignored) for debugging/observability. */
function writeStamp(): void {
  mkdirSync(dirname(STAMP), { recursive: true });
  writeFileSync(STAMP, new Date().toISOString(), 'utf-8');
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
  let existing: PatchNotesData = { posts: [] };
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

  for (const { lang, parentCategoryId } of LANGUAGES) {
    const perPage = DEV_LIMIT || 100;
    // Cold start scans the full history; incremental runs only re-scan the
    // recent window. Posts are returned newest-first, so we page back until the
    // page's oldest post falls outside the window.
    const cutoffMs = existingIds.size === 0
      ? -Infinity
      : Date.now() - RESCAN_WINDOW_DAYS * DAY_MS;

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

      for (const post of posts) {
        if (existingIds.has(post.id)) continue; // already have it — keep scanning

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

      // Stop on a short (final) page, once we've paged past the re-scan window,
      // or in dev mode. `posts` is date-desc, so its last item is the oldest.
      const oldestMs = posts.length ? Date.parse(posts[posts.length - 1].date) : Infinity;
      if (posts.length < perPage || oldestMs < cutoffMs || DEV_LIMIT > 0) {
        hasMore = false;
      } else {
        page++;
      }
    }
  }

  // Sort by date descending
  allPosts.sort((a, b) => b.date.localeCompare(a.date));

  // Only rewrite when the meaningful content changed (see writeJsonIfChanged).
  const postsWritten = await writeJsonIfChanged(outputPath, { posts: allPosts });

  // Derive the homepage buff-event schedule (recomputed every run, even when no
  // new posts were fetched, so parser/taxonomy edits take effect on rebuild).
  const buffSchedule = deriveBuffEvents(allPosts);
  const buffWritten = await writeJsonIfChanged(
    join(outputDir, 'buff-events.json'),
    { schedule: buffSchedule },
  );

  writeStamp();

  const changed = [postsWritten && 'posts.json', buffWritten && 'buff-events.json'].filter(Boolean);
  const changeInfo = changed.length ? ` — wrote ${changed.join(', ')}` : ' — no changes';
  return `${allPosts.length} posts (${newCount} new), ${imgCount} images, ${buffSchedule.length} buff days${changeInfo}`;
}
