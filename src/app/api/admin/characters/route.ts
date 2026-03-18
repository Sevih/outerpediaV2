import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { stringifyCharacter } from '@/app/api/admin/lib/character-json';

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

// ── Editable fields ──

const EDITABLE_TOP = new Set(['Chain_Type', 'rank', 'rank_pvp', 'role', 'tags']);
const EDITABLE_SKILL = new Set(['cd', 'wgr', 'wgr_dual', 'offensive', 'target', 'buff', 'debuff', 'dual_offensive', 'dual_target', 'dual_buff', 'dual_debuff']);

/**
 * Merge only editable fields from `updates` into `original`.
 * Non-editable fields keep their original values.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mergeEditable(original: any, updates: any): any {
  const result = { ...original };

  for (const key of EDITABLE_TOP) {
    if (key in updates) result[key] = updates[key];
  }

  if (updates.skills && original.skills) {
    result.skills = { ...original.skills };
    for (const sk of Object.keys(original.skills)) {
      if (!updates.skills[sk]) continue;
      result.skills[sk] = { ...original.skills[sk] };
      for (const field of EDITABLE_SKILL) {
        if (field in updates.skills[sk]) {
          result.skills[sk][field] = updates.skills[sk][field];
        }
      }
    }
  }

  return result;
}

export async function PUT(request: NextRequest) {
  const blocked = devOnly();
  if (blocked) return blocked;

  const data = await request.json();
  if (!data.ID) {
    return NextResponse.json({ error: 'Missing ID' }, { status: 400 });
  }

  const filePath = path.join(DATA_DIR, `${data.ID}.json`);

  try {
    const originalRaw = await fs.readFile(filePath, 'utf-8');
    const original = JSON.parse(originalRaw);
    const merged = mergeEditable(original, data);
    const output = stringifyCharacter(merged, originalRaw);

    // Validate
    JSON.parse(output);

    await fs.writeFile(filePath, output, 'utf-8');
  } catch (err) {
    return NextResponse.json({ error: `Save failed: ${err}` }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
