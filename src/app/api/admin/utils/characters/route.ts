import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const JSON_PATH = path.join(process.cwd(), 'data', 'generated', 'characters-index.json');

/** GET /api/admin/utils/characters
 *  - default → `[{id, name}, ...]` (lightweight)
 *  - `?full=1` → raw index entries with `ID` injected, compatible with `CharacterListEntry`
 */
export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  try {
    const raw = await fs.readFile(JSON_PATH, 'utf-8');
    const data: Record<string, Record<string, unknown>> = JSON.parse(raw);
    if (req.nextUrl.searchParams.get('full') === '1') {
      const list = Object.entries(data).map(([id, v]) => ({ ID: id, ...v }));
      list.sort((a, b) =>
        String((a as Record<string, unknown>).Fullname ?? '').localeCompare(
          String((b as Record<string, unknown>).Fullname ?? ''),
        ),
      );
      return NextResponse.json(list);
    }
    const list = Object.entries(data).map(([id, v]) => ({ id, name: String(v.Fullname ?? '') }));
    list.sort((a, b) => a.name.localeCompare(b.name));
    return NextResponse.json(list);
  } catch {
    return NextResponse.json([]);
  }
}
