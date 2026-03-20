import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const JSON_PATH = path.join(process.cwd(), 'data', 'generated', 'characters-index.json');

/** GET /api/admin/utils/characters → returns [{id, name}, ...] (lightweight) */
export async function GET() {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  try {
    const raw = await fs.readFile(JSON_PATH, 'utf-8');
    const data: Record<string, { Fullname: string }> = JSON.parse(raw);
    const list = Object.entries(data).map(([id, v]) => ({ id, name: v.Fullname }));
    list.sort((a, b) => a.name.localeCompare(b.name));
    return NextResponse.json(list);
  } catch {
    return NextResponse.json([]);
  }
}
