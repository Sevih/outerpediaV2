import { readFile } from 'fs/promises';
import { join } from 'path';
import { getBaseUrl } from '@/lib/seo';

type ChangelogEntry = {
  date: string;
  type: string;
  title: { en: string };
  content: { en: string[] };
  url?: string;
};

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export async function GET() {
  const raw = await readFile(join(process.cwd(), 'data/changelog.json'), 'utf-8');
  const entries: ChangelogEntry[] = JSON.parse(raw);
  const baseUrl = getBaseUrl();

  const items = entries.slice(0, 20).map((entry) => {
    const link = entry.url
      ? `${baseUrl}/en${entry.url}`
      : `${baseUrl}/en/changelog`;
    const description = entry.content.en.join(' ');

    return `    <item>
      <title>${escapeXml(entry.title.en)}</title>
      <link>${escapeXml(link)}</link>
      <description>${escapeXml(description)}</description>
      <pubDate>${new Date(entry.date).toUTCString()}</pubDate>
      <category>${escapeXml(entry.type)}</category>
      <guid isPermaLink="false">${escapeXml(`${entry.date}-${entry.title.en}`)}</guid>
    </item>`;
  });

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Outerpedia — Outerplane Wiki Updates</title>
    <link>${baseUrl}/en/changelog</link>
    <description>Latest updates from Outerpedia, the Outerplane wiki and database.</description>
    <language>en</language>
    <atom:link href="${baseUrl}/feed" rel="self" type="application/rss+xml"/>
${items.join('\n')}
  </channel>
</rss>`;

  return new Response(rss, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  });
}
