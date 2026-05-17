import { NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db';
import { ensureTable, payloadId, MAX_PAYLOAD } from './_store';

export const dynamic = 'force-dynamic';

// ── In-memory per-IP rate limit ──
const RL_WINDOW = 60_000;
const RL_MAX = 30;
const hits = new Map<string, { n: number; reset: number }>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  if (hits.size > 1000) {
    for (const [k, v] of hits) if (v.reset < now) hits.delete(k);
  }
  const entry = hits.get(ip);
  if (!entry || entry.reset < now) {
    hits.set(ip, { n: 1, reset: now + RL_WINDOW });
    return false;
  }
  entry.n += 1;
  return entry.n > RL_MAX;
}

function clientIp(request: Request): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}

/** POST { z } → stores the encoded tier list, returns { id }. */
export async function POST(request: Request) {
  const pool = getDbPool();
  if (!pool) return NextResponse.json({ error: 'storage_unavailable' }, { status: 503 });

  if (rateLimited(clientIp(request))) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }

  let z: unknown;
  try {
    z = (await request.json())?.z;
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }
  if (typeof z !== 'string' || z.length < 2 || z.length > MAX_PAYLOAD || z[0] !== '1') {
    return NextResponse.json({ error: 'bad_payload' }, { status: 400 });
  }

  try {
    await ensureTable(pool);
    const id = payloadId(z);
    // Same payload ⇒ same id; the upsert keeps the call idempotent.
    await pool.execute(
      'INSERT INTO tier_lists (id, payload) VALUES (?, ?) ON DUPLICATE KEY UPDATE id = id',
      [id, z],
    );
    return NextResponse.json({ id });
  } catch {
    return NextResponse.json({ error: 'storage_error' }, { status: 500 });
  }
}
