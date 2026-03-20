import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const BOSS_DIR = path.join(process.cwd(), 'data', 'boss');

/** GET /api/admin/utils/bosses → returns { [id]: name } */
export async function GET() {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  try {
    const files = await fs.readdir(BOSS_DIR);
    const map: Record<string, string> = {};

    await Promise.all(
      files.filter(f => f.endsWith('.json')).map(async f => {
        const raw = await fs.readFile(path.join(BOSS_DIR, f), 'utf-8');
        const b = JSON.parse(raw);
        const id = f.replace('.json', '');
        const name = b.Name?.en ?? id;
        const surname = b.Surname?.en ?? '';
        map[id] = b.IncludeSurname && surname ? `${surname} ${name}` : name;
      })
    );

    return NextResponse.json(map);
  } catch {
    return NextResponse.json({});
  }
}
