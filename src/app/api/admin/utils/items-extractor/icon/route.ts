import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const ICON_TARGET_DIR = path.join(process.cwd(), 'public', 'images', 'items');
const ICON_SOURCE_DIR = path.join(
  process.cwd(),
  'datamine',
  'extracted_astudio',
  'assets',
  'editor',
  'resources',
  'sprite',
  'at_thumbnailitemruntime',
);

// Whitelisted icon-name pattern: alphanumeric, underscore, dash. Avoids path traversal.
const SAFE = /^[A-Za-z0-9_-]+$/;

async function readIfExists(p: string): Promise<Buffer | null> {
  try { return await fs.readFile(p); } catch { return null; }
}

/**
 * Dev-only icon resolver used by the items-extractor preview thumbnails.
 * Tries: public webp → public png → datamine png. Returns 404 if none found.
 */
export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const name = req.nextUrl.searchParams.get('name');
  if (!name || !SAFE.test(name)) {
    return NextResponse.json({ error: 'Invalid name' }, { status: 400 });
  }

  const candidates: { path: string; type: string }[] = [
    { path: path.join(ICON_TARGET_DIR, `${name}.webp`), type: 'image/webp' },
    { path: path.join(ICON_TARGET_DIR, `${name}.png`), type: 'image/png' },
    { path: path.join(ICON_SOURCE_DIR, `${name}.png`), type: 'image/png' },
  ];

  for (const c of candidates) {
    const buf = await readIfExists(c.path);
    if (buf) {
      return new NextResponse(new Uint8Array(buf), {
        status: 200,
        headers: {
          'Content-Type': c.type,
          'Cache-Control': 'no-cache',
        },
      });
    }
  }

  return new NextResponse(null, { status: 404 });
}
