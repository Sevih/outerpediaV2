import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const JSON_PATH = path.join(process.cwd(), 'data', 'items.json');

/** GET /api/admin/utils/items → returns [{id, name, icon}, ...] (lightweight) */
export async function GET() {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  try {
    const raw = await fs.readFile(JSON_PATH, 'utf-8');
    const items: { id: string; name: string; icon?: string; rarity?: string }[] = JSON.parse(raw);
    const lite = items.map(i => ({ id: i.id, name: i.name, icon: i.icon ?? '', rarity: i.rarity ?? 'normal' }));
    return NextResponse.json(lite);
  } catch {
    return NextResponse.json([]);
  }
}
