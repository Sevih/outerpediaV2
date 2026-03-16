import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data', 'character');

function devOnly() {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return null;
}

export async function GET() {
  const blocked = devOnly();
  if (blocked) return blocked;

  const files = await fs.readdir(DATA_DIR);
  const characters = await Promise.all(
    files
      .filter(f => f.endsWith('.json'))
      .map(async f => {
        const raw = await fs.readFile(path.join(DATA_DIR, f), 'utf-8');
        const data = JSON.parse(raw);
        return {
          ID: data.ID,
          Fullname: data.Fullname,
          Rarity: data.Rarity,
          Element: data.Element,
          Class: data.Class,
          rank: data.rank,
        };
      })
  );

  return NextResponse.json(characters);
}

export async function PUT(request: NextRequest) {
  const blocked = devOnly();
  if (blocked) return blocked;

  const data = await request.json();
  if (!data.ID) {
    return NextResponse.json({ error: 'Missing ID' }, { status: 400 });
  }

  const filePath = path.join(DATA_DIR, `${data.ID}.json`);
  await fs.writeFile(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8');

  return NextResponse.json({ success: true });
}
