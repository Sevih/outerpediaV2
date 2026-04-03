import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const MISSING_PATH = path.join(process.cwd(), 'data', 'tower', 'missing-monsters.json');

function devOnly() {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return null;
}

export async function GET() {
  const blocked = devOnly();
  if (blocked) return blocked;

  try {
    const raw = await fs.readFile(MISSING_PATH, 'utf-8');
    return NextResponse.json({ missing: JSON.parse(raw) });
  } catch {
    return NextResponse.json({ missing: [] });
  }
}

/** Remove a monster ID from missing-monsters.json after successful extraction */
export async function DELETE(req: NextRequest) {
  const blocked = devOnly();
  if (blocked) return blocked;

  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  try {
    const raw = await fs.readFile(MISSING_PATH, 'utf-8');
    const list = JSON.parse(raw) as { id: string }[];
    const updated = list.filter(m => m.id !== id);
    await fs.writeFile(MISSING_PATH, JSON.stringify(updated, null, 2) + '\n', 'utf-8');
    return NextResponse.json({ ok: true, remaining: updated.length });
  } catch {
    return NextResponse.json({ ok: true });
  }
}
