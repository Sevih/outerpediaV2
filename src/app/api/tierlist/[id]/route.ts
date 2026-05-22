import { NextResponse } from 'next/server';
import type { RowDataPacket } from 'mysql2';
import { getDbConnection } from '@/lib/db';
import { ensureTable, ID_RE } from '../_store';

export const dynamic = 'force-dynamic';

/** GET /api/tierlist/[id] → { z } (the encoded tier list) or 404. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!ID_RE.test(id)) return NextResponse.json({ error: 'bad_id' }, { status: 400 });

  const conn = await getDbConnection();
  if (!conn) return NextResponse.json({ error: 'storage_unavailable' }, { status: 503 });
  try {
    await ensureTable(conn);
    const [rows] = await conn.execute<RowDataPacket[]>(
      'SELECT payload FROM tier_lists WHERE id = ? LIMIT 1',
      [id],
    );
    const row = rows[0];
    if (!row) return NextResponse.json({ error: 'not_found' }, { status: 404 });
    return NextResponse.json(
      { z: row.payload as string },
      { headers: { 'Cache-Control': 'public, max-age=300' } },
    );
  } catch {
    return NextResponse.json({ error: 'storage_error' }, { status: 500 });
  } finally {
    await conn.end().catch(() => {});
  }
}
