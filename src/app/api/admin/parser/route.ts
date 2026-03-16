import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { parseBytes } from '@/app/admin/lib/bytes-parser';

const JSON_DIR = path.join(process.cwd(), 'data', 'admin', 'json');
const BYTES_DIR = path.join(process.cwd(), 'data', 'admin', 'bytes');

/**
 * GET /api/admin/parser
 *
 * ?action=list              → list available parsed files
 * ?action=parse&file=X      → read cached JSON
 * ?action=parse&file=X&force=1 → re-parse from .bytes and update cache
 */
export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = req.nextUrl;
  const action = searchParams.get('action') ?? 'list';

  if (action === 'list') {
    try {
      const entries = await fs.readdir(JSON_DIR);
      const files = entries
        .filter(f => f.endsWith('.json'))
        .sort((a, b) => a.localeCompare(b))
        .map(f => ({ name: f.replace('.json', '.bytes') }));

      return NextResponse.json({ files });
    } catch {
      return NextResponse.json({ error: 'Cannot read cache directory' }, { status: 500 });
    }
  }

  if (action === 'parse') {
    const file = searchParams.get('file');
    if (!file || !file.endsWith('.bytes')) {
      return NextResponse.json({ error: 'Invalid file parameter' }, { status: 400 });
    }

    const force = searchParams.get('force') === '1';
    const safeName = path.basename(file);
    const jsonPath = path.join(JSON_DIR, safeName.replace('.bytes', '.json'));

    // Force re-parse from .bytes
    if (force) {
      const bytesPath = path.join(BYTES_DIR, safeName);
      try {
        const buffer = await fs.readFile(bytesPath);
        const result = parseBytes(Buffer.from(buffer));
        await fs.writeFile(jsonPath, JSON.stringify(result), 'utf-8');
        return NextResponse.json(result);
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Parse error';
        return NextResponse.json({ error: message }, { status: 500 });
      }
    }

    // Read from cache
    try {
      const cached = await fs.readFile(jsonPath, 'utf-8');
      return NextResponse.json(JSON.parse(cached));
    } catch {
      return NextResponse.json({ error: 'File not found in cache' }, { status: 404 });
    }
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
