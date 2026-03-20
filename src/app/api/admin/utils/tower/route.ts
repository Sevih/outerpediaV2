import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const TOWER_DIR = path.join(process.cwd(), 'data', 'tower');


function devOnly() {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return null;
}

export async function GET(req: NextRequest) {
  const blocked = devOnly();
  if (blocked) return blocked;
  const file = req.nextUrl.searchParams.get('file') ?? 'very-hard';
  const safe = path.basename(file);
  try {
    const raw = await fs.readFile(path.join(TOWER_DIR, `${safe}.json`), 'utf-8');
    return NextResponse.json(JSON.parse(raw));
  } catch {
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }
}

export async function POST(req: NextRequest) {
  const blocked = devOnly();
  if (blocked) return blocked;
  const file = req.nextUrl.searchParams.get('file') ?? 'very-hard';
  const safe = path.basename(file);
  const filePath = path.join(TOWER_DIR, `${safe}.json`);
  try {
    const data = await req.json();
    const raw = await fs.readFile(filePath, 'utf-8').catch(() => '');
    const eol = raw.includes('\r\n') ? '\r\n' : '\n';
    const trailingNewline = raw.endsWith('\n') || raw.endsWith('\r\n');
    let output = JSON.stringify(data, null, 2);
    if (trailingNewline) output += '\n';
    if (eol === '\r\n') output = output.replace(/\n/g, '\r\n');
    await fs.writeFile(filePath, output, 'utf-8');
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unknown error' }, { status: 500 });
  }
}
