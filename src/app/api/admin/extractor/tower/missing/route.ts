import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const MISSING_PATH = path.join(process.cwd(), 'data', 'tower', 'missing-monsters.json');

export async function GET() {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const raw = await fs.readFile(MISSING_PATH, 'utf-8');
    return NextResponse.json({ missing: JSON.parse(raw) });
  } catch {
    return NextResponse.json({ missing: [] });
  }
}
