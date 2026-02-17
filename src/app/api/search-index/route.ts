import { readFile } from 'fs/promises';
import { join } from 'path';

export async function GET() {
  const raw = await readFile(
    join(process.cwd(), 'data/generated/characters-index.json'),
    'utf-8'
  );
  return new Response(raw, {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  });
}
