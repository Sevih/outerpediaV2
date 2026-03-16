import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');

export async function GET() {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const [buffsRaw, debuffsRaw, tagsRaw] = await Promise.all([
    fs.readFile(path.join(DATA_DIR, 'effects', 'buffs.json'), 'utf-8'),
    fs.readFile(path.join(DATA_DIR, 'effects', 'debuffs.json'), 'utf-8'),
    fs.readFile(path.join(DATA_DIR, 'tags.json'), 'utf-8'),
  ]);

  const buffsArr: { name: string; label: string; icon: string }[] = JSON.parse(buffsRaw);
  const debuffsArr: { name: string; label: string; icon: string }[] = JSON.parse(debuffsRaw);
  const tagsObj: Record<string, { label: string; image: string }> = JSON.parse(tagsRaw);

  return NextResponse.json({
    buffs: buffsArr.map(b => ({ id: b.name, label: b.label, icon: b.icon })),
    debuffs: debuffsArr.map(d => ({ id: d.name, label: d.label, icon: d.icon })),
    tags: Object.entries(tagsObj).map(([id, t]) => ({ id, label: t.label, image: t.image })),
  });
}
