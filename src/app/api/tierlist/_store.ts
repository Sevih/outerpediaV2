import { createHash } from 'crypto';
import type { Pool } from 'mysql2/promise';

/** Shared storage helpers for the tier-list share endpoints. */

export const MAX_PAYLOAD = 1024;
export const ID_RE = /^[A-Za-z0-9_-]{1,16}$/;

let tableReady: Promise<void> | null = null;

/** Create the `tier_lists` table once per process (idempotent). */
export function ensureTable(pool: Pool): Promise<void> {
  if (!tableReady) {
    tableReady = pool
      .query(
        `CREATE TABLE IF NOT EXISTS tier_lists (
           id VARCHAR(16) NOT NULL PRIMARY KEY,
           payload VARCHAR(${MAX_PAYLOAD}) NOT NULL,
           created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
         ) ENGINE=InnoDB DEFAULT CHARSET=ascii`,
      )
      .then(() => undefined)
      .catch((err) => { tableReady = null; throw err; });
  }
  return tableReady;
}

/** Deterministic short id derived from the payload — same list ⇒ same id. */
export function payloadId(z: string): string {
  return createHash('sha256').update(z).digest('base64url').slice(0, 12);
}
