/**
 * Client helper for `GET /api/admin/damage-lab/v2/extract-buffs`.
 */

import type { ApplicableBuff } from '@/lib/damage/v2/buffs'

export async function fetchBuffs(): Promise<ApplicableBuff[]> {
  const res = await fetch('/api/admin/damage-lab/v2/extract-buffs')
  if (!res.ok) throw new Error(`fetchBuffs: ${res.status}`)
  const data = (await res.json()) as { buffs: ApplicableBuff[] }
  return data.buffs
}
