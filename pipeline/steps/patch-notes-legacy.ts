import { existsSync, mkdirSync } from 'fs';
import { readFile, readdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { PATHS } from '../config';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const LEGACY_DIR = join(PATHS.patchNotes, 'legacy');

const CATEGORIES = [
  'patchnotes',
  'event',
  'developer-notes',
  'compendium',
  'media-archives',
  'official-4-cut-cartoon',
  'probabilities',
  'world-introduction',
] as const;

type LegacyPost = {
  id: string;
  date: string;
  slug: string;
  lang: 'en';
  type: string;
  title: string;
  content: string;
};

type LegacyData = {
  posts: LegacyPost[];
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Parse YAML frontmatter from a markdown file */
function parseFrontmatter(raw: string): { meta: Record<string, string>; body: string } {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) return { meta: {}, body: raw };

  const meta: Record<string, string> = {};
  for (const line of match[1].split('\n')) {
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    let val = line.slice(idx + 1).trim();
    // Strip surrounding quotes
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    // Skip array values (images list)
    if (val.startsWith('-') || val === '') continue;
    meta[key] = val;
  }

  return { meta, body: match[2] };
}

/** Convert markdown body to simple HTML */
function markdownToHTML(md: string): string {
  let html = md
    // Images: ![alt](src) → <img>
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">')
    // Bold: **text** or __text__
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/__(.+?)__/g, '<strong>$1</strong>')
    // Italic: *text* or _text_ (not inside words)
    .replace(/(?<!\w)\*(.+?)\*(?!\w)/g, '<em>$1</em>')
    // Strikethrough: ~~text~~
    .replace(/~~(.+?)~~/g, '<del>$1</del>')
    // Horizontal rules
    .replace(/^---+$/gm, '<hr>')
    .replace(/^\*\*\*+$/gm, '<hr>')
    // Line breaks: two trailing spaces or explicit \
    .replace(/ {2,}$/gm, '<br>')
    .replace(/\\$/gm, '<br>');

  // Convert paragraphs: split by double newlines
  const blocks = html.split(/\n{2,}/);
  html = blocks
    .map(block => {
      const trimmed = block.trim();
      if (!trimmed) return '';
      // Don't wrap blocks that are already HTML elements
      if (trimmed.startsWith('<hr') || trimmed.startsWith('<img')) return trimmed;
      // Convert single newlines within a block to <br>
      return `<p>${trimmed.replace(/\n/g, '<br>')}</p>`;
    })
    .filter(Boolean)
    .join('\n');

  return html;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export async function run(): Promise<string> {
  const outputDir = join(PATHS.patchNotes);
  if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true });
  const outputPath = join(outputDir, 'legacy-posts.json');

  const allPosts: LegacyPost[] = [];

  for (const category of CATEGORIES) {
    const catDir = join(LEGACY_DIR, category);
    if (!existsSync(catDir)) continue;

    const files = (await readdir(catDir)).filter(f => f.endsWith('.md'));

    for (const file of files) {
      const raw = await readFile(join(catDir, file), 'utf-8');
      const { meta, body } = parseFrontmatter(raw);

      const date = (meta.date || '').split('T')[0];
      const slug = meta.id || file.replace(/\.md$/, '');

      allPosts.push({
        id: slug,
        date,
        slug,
        lang: 'en',
        type: category,
        title: meta.title || slug,
        content: markdownToHTML(body),
      });
    }
  }

  // Sort by date descending
  allPosts.sort((a, b) => b.date.localeCompare(a.date));

  const result: LegacyData = { posts: allPosts };
  await writeFile(outputPath, JSON.stringify(result, null, 2), 'utf-8');

  return `${allPosts.length} legacy posts converted`;
}
