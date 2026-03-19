import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const EE_PATH = path.join(process.cwd(), 'data', 'equipment', 'ee.json');

function devOnly() {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return null;
}

function detectEol(raw: string): string {
  return raw.includes('\r\n') ? '\r\n' : '\n';
}

// Key order to preserve consistency with extractor
const EE_KEY_ORDER = [
  'name', 'name_jp', 'name_kr', 'name_zh',
  'mainStat', 'mainStat_jp', 'mainStat_kr', 'mainStat_zh',
  'effect', 'effect_jp', 'effect_kr', 'effect_zh',
  'effect10', 'effect10_jp', 'effect10_kr', 'effect10_zh',
  'icon_effect',
  'buff', 'debuff',
  'rank', 'rank10',
];

function orderEEKeys(obj: Record<string, unknown>): Record<string, unknown> {
  const ordered: Record<string, unknown> = {};
  for (const key of EE_KEY_ORDER) {
    if (key in obj) ordered[key] = obj[key];
  }
  for (const key of Object.keys(obj)) {
    if (!(key in ordered)) ordered[key] = obj[key];
  }
  return ordered;
}

/**
 * GET /api/admin/editor/ee
 *
 * Returns all EE entries with editable fields.
 */
export async function GET() {
  const blocked = devOnly();
  if (blocked) return blocked;

  try {
    const raw = await fs.readFile(EE_PATH, 'utf-8');
    const data = JSON.parse(raw) as Record<string, Record<string, unknown>>;

    const entries = Object.entries(data)
      .sort(([a], [b]) => parseInt(a) - parseInt(b))
      .map(([id, entry]) => ({
        id,
        name: entry.name ?? id,
        rank: entry.rank ?? '',
        rank10: entry.rank10 ?? '',
        buff: entry.buff ?? [],
        debuff: entry.debuff ?? [],
      }));

    return NextResponse.json({ entries });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/**
 * PUT /api/admin/editor/ee
 *
 * Body: { id, rank?, rank10?, buff?, debuff? }
 *
 * Only updates the provided fields.
 */
export async function PUT(req: NextRequest) {
  const blocked = devOnly();
  if (blocked) return blocked;

  try {
    const body = await req.json();
    const { id } = body;
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const existingRaw = await fs.readFile(EE_PATH, 'utf-8');
    const existing = JSON.parse(existingRaw) as Record<string, Record<string, unknown>>;

    if (!(id in existing)) {
      return NextResponse.json({ error: `EE ${id} not found` }, { status: 404 });
    }

    const entry = { ...existing[id] };

    if ('rank' in body) entry.rank = body.rank;
    if ('rank10' in body) entry.rank10 = body.rank10;
    if ('buff' in body) entry.buff = body.buff;
    if ('debuff' in body) entry.debuff = body.debuff;

    existing[id] = orderEEKeys(entry);

    // Sort by ID
    const sorted: Record<string, Record<string, unknown>> = {};
    for (const k of Object.keys(existing).sort()) {
      sorted[k] = existing[k];
    }

    const eol = detectEol(existingRaw);
    let output = JSON.stringify(sorted, null, 2) + '\n';
    if (eol === '\r\n') {
      output = output.replace(/\n/g, '\r\n');
    }

    await fs.writeFile(EE_PATH, output, 'utf-8');

    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
