import fs from 'fs'
import path from 'path'
import type { ObservationV2 } from './observations'

/**
 * Server-side reader for the admin observations JSONL store. Lives in its
 * own file so the client bundle (which imports `ObservationV2` + the
 * `recomputeFromObs` helper from `./observations`) doesn't pull `fs` into
 * the browser. Only the server component (`index.tsx`) ever imports this —
 * any accidental client import would surface a "Module not found: fs" build
 * error, the same way it did before the split.
 *
 * Returns an empty array when the file is missing (typical in CI / fresh
 * checkouts). Dev gating happens at the call site.
 */
export async function loadObservations(): Promise<ObservationV2[]> {
  const file = path.join(process.cwd(), 'data', 'admin', 'damage-lab-observations-v2.jsonl')
  if (!fs.existsSync(file)) return []
  const raw = fs.readFileSync(file, 'utf-8')
  return raw.split('\n')
    .filter(line => line.trim().length > 0)
    .map(line => JSON.parse(line) as ObservationV2)
}
