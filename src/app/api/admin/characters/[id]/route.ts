import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data', 'character');

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const filePath = path.join(DATA_DIR, `${id}.json`);

  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    return NextResponse.json(JSON.parse(raw));
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
}
