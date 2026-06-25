import { NextResponse } from 'next/server';
import { getRecoStatPriorities } from '@/lib/data/characters';

/** GET /api/reco/:id → stat priorities (main stats + substat prio) for a character's recos. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!/^\d+$/.test(id)) {
    return NextResponse.json({ error: 'bad_id' }, { status: 400 });
  }

  const data = await getRecoStatPriorities(id);
  if (!data) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  return NextResponse.json(data, {
    headers: { 'Cache-Control': 'public, max-age=3600, s-maxage=3600' },
  });
}
