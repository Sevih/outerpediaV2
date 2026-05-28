/**
 * Resolves YouTube metadata (uploadDate, title, channel) for every video
 * embedded across the site and caches it in data/video-meta.json.
 *
 * Schema.org's VideoObject requires `uploadDate`, which we don't author by
 * hand. We also pull title/channel so character pages — whose `video` field is
 * a raw ID — can show a real title/author instead of "Video".
 *
 * Dev-only: runs in the dev pipeline (auto-fetches newly added video IDs) and
 * is skipped on `--prod` builds, which read the committed JSON. Incremental by
 * default; only IDs absent from the cache are fetched, so most runs hit the
 * API zero times. Missing API key is non-fatal in the pipeline (warns), but
 * fatal when invoked directly with `required`.
 */
import { readFile, readdir } from 'fs/promises';
import { join, extname } from 'path';
import { PATHS } from '../config';
import { writeFileAtomic } from '../lib/write-json';

const ROOT = process.cwd();
const APP_DIR = join(ROOT, 'src/app');
const CHARACTER_VIDEOS = join(ROOT, 'data/character-videos.json');
const CHARACTER_DIR = PATHS.characters;
const OUTPUT = join(PATHS.generated, 'video-meta.json');
const API_URL = 'https://www.googleapis.com/youtube/v3/videos';

const YT_ID = /^[A-Za-z0-9_-]{11}$/;

export type VideoMeta = { uploadDate: string; title: string; author: string };

/**
 * Matches a YouTube video item literal in either field order
 * (`platform` before `id`/`videoId`, or the reverse). `[^}]*?` keeps the two
 * fields inside the same flat object literal.
 */
const YT_RE =
  /platform:\s*['"]youtube['"][^}]*?(?:video)?[iI]d:\s*['"]([A-Za-z0-9_-]{11})['"]|(?:video)?[iI]d:\s*['"]([A-Za-z0-9_-]{11})['"][^}]*?platform:\s*['"]youtube['"]/g;

async function walkTsx(dir: string, out: string[]): Promise<void> {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      await walkTsx(full, out);
    } else if (extname(entry.name) === '.tsx') {
      out.push(full);
    }
  }
}

async function collectIds(): Promise<Set<string>> {
  const ids = new Set<string>();

  // 1. Inline literals in .tsx components (guides, events, …)
  const files: string[] = [];
  await walkTsx(APP_DIR, files);
  for (const file of files) {
    const src = await readFile(file, 'utf-8');
    for (const m of src.matchAll(YT_RE)) {
      const id = m[1] ?? m[2];
      if (id) ids.add(id);
    }
  }

  // 2. Character videos data file (slug → [{ platform, id }])
  try {
    const raw = await readFile(CHARACTER_VIDEOS, 'utf-8');
    const byChar = JSON.parse(raw) as Record<string, Array<{ platform: string; id: string }>>;
    for (const vids of Object.values(byChar)) {
      for (const v of vids) {
        if (v.platform === 'youtube' && YT_ID.test(v.id)) ids.add(v.id);
      }
    }
  } catch {
    // no character videos file — skip
  }

  // 3. Per-character `video` field in data/character/*.json (raw YouTube ID)
  try {
    const charFiles = await readdir(CHARACTER_DIR);
    for (const file of charFiles) {
      if (extname(file) !== '.json') continue;
      const char = JSON.parse(await readFile(join(CHARACTER_DIR, file), 'utf-8')) as { video?: string };
      if (char.video && YT_ID.test(char.video)) ids.add(char.video);
    }
  } catch {
    // no character dir — skip
  }

  return ids;
}

async function loadExisting(): Promise<Record<string, VideoMeta>> {
  try {
    return JSON.parse(await readFile(OUTPUT, 'utf-8')) as Record<string, VideoMeta>;
  } catch {
    return {};
  }
}

async function fetchBatch(ids: string[], key: string): Promise<Record<string, VideoMeta>> {
  const url = `${API_URL}?part=snippet&fields=items(id,snippet(publishedAt,title,channelTitle))&id=${ids.join(',')}&key=${key}`;
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`YouTube API ${res.status}: ${body.slice(0, 300)}`);
  }
  const json = (await res.json()) as {
    items?: Array<{ id: string; snippet: { publishedAt: string; title: string; channelTitle: string } }>;
  };
  const out: Record<string, VideoMeta> = {};
  for (const item of json.items ?? []) {
    out[item.id] = {
      uploadDate: item.snippet.publishedAt,
      title: item.snippet.title,
      author: item.snippet.channelTitle,
    };
  }
  return out;
}

export async function run(opts: { force?: boolean; required?: boolean } = {}): Promise<string> {
  // The pipeline runs via tsx (outside Next), so .env.local isn't auto-loaded.
  try {
    process.loadEnvFile(join(ROOT, '.env.local'));
  } catch {
    // no .env.local — rely on shell-provided env
  }

  const allIds = await collectIds();
  const existing = await loadExisting();
  const toFetch = opts.force ? [...allIds] : [...allIds].filter((id) => !existing[id]);

  if (toFetch.length === 0) {
    return `${Object.keys(existing).length} cached, 0 new`;
  }

  const key = process.env.YOUTUBE_API_KEY;
  if (!key) {
    const msg = `${toFetch.length} new IDs but YOUTUBE_API_KEY is missing`;
    if (opts.required) throw new Error(`${msg} (set it in .env.local)`);
    return `${Object.keys(existing).length} cached, ${msg} — skipped`;
  }

  const fetched: Record<string, VideoMeta> = {};
  for (let i = 0; i < toFetch.length; i += 50) {
    Object.assign(fetched, await fetchBatch(toFetch.slice(i, i + 50), key));
  }

  const merged = { ...existing, ...fetched };
  // Stable, sorted output for clean diffs
  const sorted = Object.fromEntries(Object.entries(merged).sort(([a], [b]) => a.localeCompare(b)));
  await writeFileAtomic(OUTPUT, JSON.stringify(sorted, null, 2) + '\n');

  const missing = toFetch.filter((id) => !fetched[id]);
  const miss = missing.length ? `, ${missing.length} unavailable (${missing.join(', ')})` : '';
  return `${Object.keys(sorted).length} entries (+${Object.keys(fetched).length}${miss})`;
}
