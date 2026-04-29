/**
 * Client helpers for `/api/admin/damage-lab/v2/observations` (CRUD).
 */

import type { ObservationV2 } from '@/app/api/admin/damage-lab/v2/observations/route'

export async function fetchObservations(): Promise<ObservationV2[]> {
  const res = await fetch('/api/admin/damage-lab/v2/observations')
  if (!res.ok) throw new Error(`fetchObservations: ${res.status}`)
  const data = (await res.json()) as { observations: ObservationV2[] }
  return data.observations
}

export async function saveObservation(input: Partial<ObservationV2>): Promise<ObservationV2> {
  const res = await fetch('/api/admin/damage-lab/v2/observations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) throw new Error(`saveObservation: ${res.status}`)
  const data = (await res.json()) as { ok: boolean; observation: ObservationV2 }
  return data.observation
}

export async function deleteObservation(id: string): Promise<void> {
  const res = await fetch(`/api/admin/damage-lab/v2/observations?id=${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })
  if (!res.ok) throw new Error(`deleteObservation: ${res.status}`)
}
